# Phase 0 — Employee Lifecycle · ✅ COMPLETE

**Shipped 2026-08-29.** Not committed — the working tree holds the changes for review.

**Verification:** Biome clean · `tsc --noEmit` clean · **68/68 tests** (was 46) · `bun run build` OK ·
dev server boots with no errors · migrations `0009` + `0010` applied locally.

---

## 1. The problem this solved

`users` had `joinDate` and **no counterpart**. No `isActive`, no `status`, no `exitDate`. An
employee row had exactly two states: exists / doesn't exist. Consequences found in the codebase:

1. **A hard delete is impossible anyway.** `audit_logs.actor_id`, `leave_requests.approved_by`,
   `asset_assignments.assigned_by_user_id` and `users.peer_lead_id` are all `ON DELETE no action`
   and would block it — while `timesheets`, `leave_balances` and `notifications` are `cascade` and
   would silently destroy history. Soft deactivation was the only correct shape.
2. **A departed lead stranded their reports forever.** `approvals-live-data.server.ts` and
   `approval-count.server.ts` scope by `eq(requester.peerLeadId, leadId)`; the departed lead stays
   the `peerLeadId`, so requests kept routing to an account nobody watched.
3. **Clearing `role` did nothing.** `getCurrentAppUser` *re-derives* `lead` from the org chart on
   every request, so a departing lead was re-promoted as long as anyone pointed at them.
4. **"Offboarding" in this codebase meant client engagements, not employment** — and it was
   **broken** (see §6).

---

## 2. Backend

### 2.1 Schema — `src/db/schema.ts`

Four columns appended to `users`:

```ts
// Employment lifecycle. Departures are soft: hard deletes are impossible
// (audit_logs / approvals / peer_lead_id all reference users with no action)
// and would cascade away timesheets and leave history.
isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
exitDate: text("exit_date"),
exitReason: text("exit_reason"),
deactivatedById: text("deactivated_by_id").references((): AnySQLiteColumn => users.id),
```

**Migration `drizzle/0010_peaceful_scarlet_spider.sql`** — plain `ADD COLUMN`s, no table rebuild.
Every existing employee defaults to active, so the migration is behaviour-neutral on apply.

### 2.2 Pure policy — `src/lib/employee-lifecycle.ts` (new)

Takes a plain snapshot so it is unit-testable with no database.

| Export | Signature | Purpose |
|---|---|---|
| `Role` | `"user" \| "lead" \| "admin"` | |
| `DeactivationBlocker` | discriminated union of 4 codes | `self_deactivation`, `last_admin`, `reports_need_reassignment`, `invalid_reassign_target` |
| `DeactivationSnapshot` | interface | Everything the rules need, read once |
| `ReportReassignment` | interface | `{ userIds, newLeadId, successorId, successorNewLeadId }` |
| `DeactivationAssessment` | interface | `{ blockers, canProceed, reportsToReassign }` |
| `assessDeactivation(snapshot)` | → `DeactivationAssessment` | The rules |
| `AccessState` | `"anonymous" \| "active" \| "deactivated"` | |
| `resolveAccessState(user)` | → `AccessState` | Distinguishes signed-out from no-longer-employed |

**Rules enforced:**

| Rule | Blocker code |
|---|---|
| You cannot deactivate your own account | `self_deactivation` |
| Cannot deactivate the last **active** admin | `last_admin` |
| Someone with direct reports needs a named successor | `reports_need_reassignment` |
| Successor must not be the departing person, and must be active | `invalid_reassign_target` |

Blockers **accumulate** — the assessment reports all of them, not just the first.

**Promote-from-within (the subtle one).** If the chosen successor is themselves one of the reports
being moved, a naive bulk update makes them their own lead. `assessDeactivation` therefore splits
the move: peers go to the successor, and the successor moves up to the **departing person's own
lead** (`targetPeerLeadId`), which may be `null` — making them a root of the org chart.

```ts
reportsToReassign: {
  userIds: ["c"],              // peers → successor
  newLeadId: "b",
  successorId: "b",            // set only on internal promotion
  successorNewLeadId: "grandparent",
}
```

### 2.3 Auth gate — `src/lib/current-user.server.ts`

The previous single export became an internal `resolveAppUser()` plus two public entry points.

| Export | Behaviour |
|---|---|
| `getCurrentUserWithState()` | `{ user, state }` resolved **once**. `user` is non-null only when still employed |
| `getCurrentAppUser()` | Returns `null` for a deactivated employee — **fails closed** |

**Why the gate is here and not in the middleware:** `src/api/leaves.ts` (4 call sites) and
`src/api/users.ts` call `getCurrentAppUser` **directly**, bypassing `authMiddleware`. Gating only
the middleware would have left five ungated paths.

Also changed: the dynamic `lead` promotion now requires the subordinate to be **active** —

```ts
.where(and(eq(users.peerLeadId, existingUser.id), eq(users.isActive, true)))
```

Without this, a departed report keeps resurrecting their former lead's approver rights.

### 2.4 Redirect routing — `src/lib/server-fn.ts`

```ts
const { user, state } = await getCurrentUserWithState();
if (!user) {
  // A deactivated employee must not be sent to sign-in: WorkOS will happily
  // re-authenticate them (deactivation is an app-level state), so they would
  // bounce straight back here and loop.
  throw redirect({ to: state === "deactivated" ? "/access-ended" : "/sign-in/$" });
}
```

This is the chokepoint that matters — `checkOnboardingUser` itself uses `authMiddleware`, so the
redirect fires here before `_authenticated.tsx` ever runs.

### 2.5 Server functions — `src/api/employees.ts`

| Function | Method | Middleware | Notes |
|---|---|---|---|
| `gatherDeactivationSnapshot(db, input)` | — | internal | Reads target, active reports, other active admins, successor validity, held assets, active deployments. **Shared by preview and commit so they can never disagree** |
| `getEmployeeDeactivationPreview` | GET | `adminMiddleware` | Returns `{ employee, blockers, canProceed, directReports, heldAssets, activeDeployments, today }` |
| `deactivateEmployee` | POST | `adminMiddleware` | Input `{ userId, exitDate, exitReason?, reassignReportsTo? }` |

**`deactivateEmployee` execution order** (D1 has no transactions, so this is deliberate — each
step is idempotent and the authoritative write lands **last**, so a partial failure leaves a
still-active account that can simply be retried):

1. **Move direct reports.** Per-report `assertNoReportingCycle` (reusing the existing helper),
   then `inArray` bulk update; the internally-promoted successor is moved separately.
2. **Clear equipment** via `returnAllCurrentAssetsForUser`.
3. **Close open client engagements** — `clientDeployments.status = 'completed'` + `endDate`.
4. **End access** — `isActive = false`, `exitDate`, `exitReason`, `deactivatedById`.
5. `logAuditEvent` with `action: "deactivate"`, recording reports reassigned and assets returned.

Guards: refuses if already deactivated; re-runs the assessment server-side even though the preview
already ran, so a stale UI cannot bypass a blocker.

### 2.6 Shared asset return — `src/lib/asset-return-policy.ts` (new)

The Brainee.org-vs-client return rule existed as **two copies that disagreed** — `offboardClientDeployment`
hardcoded `conditionIn: "good"` and so could never route damaged equipment to `defective` — plus a
**third copy inside `asset-policy.test.ts` that imported nothing**, meaning it tested no shipped code.

| Export | Purpose |
|---|---|
| `resolveAssetReturnRouting(isOwnerInternal, conditionIn, returnNotes?)` | → `{ destination, newStatus, defectReason }` |
| `isDamagedCondition(condition)` | `damaged \| defective` |

| Owner | Condition | → status | → destination |
|---|---|---|---|
| Brainee.org (`isInternal`) | good / fair / new | `in_inventory` | `brainee_inventory` |
| Brainee.org | damaged / defective | `defective` | `brainee_inventory` |
| Client | *any* | `returned_to_client` | `client_surrendered` |

Now called from **three** places: `returnAsset`, `offboardClientDeployment`, and
`returnAllCurrentAssetsForUser`. Covered by `asset-return-policy.test.ts` (8 tests) which imports
the real module.

### 2.7 Bulk asset helpers — `src/api/assets.ts`

| Export | Purpose |
|---|---|
| `returnAllCurrentAssetsForUser(db, { userId, actorId, returnedDate, note })` | Closes every current assignment, updates asset status, writes an `assetHistory` `returned` event per asset. Idempotent — already-closed assignments aren't selected. Returns the processed list |
| `listCurrentAssetsForUser(db, userId)` | Read-only, for the preview |

Built on the same `assetAssignments.isCurrent = true` query shape as the existing
`getEmployeeEquipmentAndDeployments`.

### 2.8 The `isActive` ripple

Rule applied: **filter pickers and routing, not historical joins.** A departed person's name must
still resolve on their past timesheets and closed tasks.

| File | Query | Change |
|---|---|---|
| `src/api/assets.ts` | asset-assignment people picker | `+ where isActive` |
| `src/api/assets.ts` | history `targetUserId` name lookup | **unchanged** (historical) |
| `src/api/deployments.ts` | deployment people picker | `+ where isActive` |
| `src/lib/team-calendar-live-data.server.ts` | calendar roster | `+ where isActive` |
| `src/routes/_authenticated.organization.tsx` | org chart | `isOnboarded` → `and(isOnboarded, isActive)` |
| `src/lib/notifications.server.ts` | admin fan-out | `inArray(role,["admin"])` → `and(role="admin", isActive)` |
| `src/lib/dashboard-stats.server.ts` | team size | `+ where isActive` |
| `src/lib/dashboard-stats.server.ts` | birthdays panel | `+ where isActive` |
| `src/api/leave-types.ts` | leave-balance provisioning | `+ where isActive` |
| `src/lib/approval-count.server.ts` | pending count, both branches | `+ isActive` |
| `src/lib/approvals-live-data.server.ts` | pending list | filtered in the **JS split**, not the query |
| `src/routes/_authenticated.admin.index.tsx` | admin employee list | **unfiltered** (admins must see departed staff) + `leadIds` now only counts active reports |

**Why `approvals-live-data` is different:** one query fetches pending *and* history, splitting in
JS. Filtering the query would have erased a departed person's legitimate approved-leave history.
So `requesterIsActive` was added to the select and the type, and applied only to `pending`:

```ts
// A departed employee's outstanding requests are moot — they would
// otherwise sit in an approver's queue forever. History keeps them.
pending: allRequests.filter(
  (request) => isActionableApprovalStatus(request.status) && request.requesterIsActive,
),
```

**Deliberately left unfiltered:** `detailed-admin-stats.server.ts` employee picker — an admin
looking at historical stats should still be able to select a departed employee.

---

## 3. Frontend

### 3.1 `/access-ended` — `src/routes/access-ended.tsx` (new)

Terminal page for a deactivated employee. Uses `AuthPageLayout` + `Card`, matching `sign-in.$.tsx`.

`beforeLoad` calls a `getAccessState` server fn and bounces everyone who shouldn't be here, so the
page cannot be used to probe account status:

| Caller state | Destination |
|---|---|
| `anonymous` | → `/sign-in/$` |
| `active` | → `/` |
| `deactivated` | stays |

Content: neutral copy ("This Brainee.org account is no longer active. Your records have been
retained"), a pointer to contact a manager, and a **Sign out** button calling `logoutUser` to clear
the cookie. No reason is disclosed.

### 3.2 `EmployeeDeactivateDialog` — `src/components/admin/EmployeeDeactivateDialog.tsx` (new)

| Prop | Type |
|---|---|
| `open` / `onOpenChange` | `boolean` / `(open) => void` |
| `employee` | `{ id, name } \| null` |
| `allUsers` | `{ id, name }[]` — successor candidates (active only) |
| `onSuccess` | `() => void` — caller does `router.invalidate()` |

Behaviour:

- Loads `getEmployeeDeactivationPreview` on open, and **re-loads whenever the successor selection
  changes**, so the blocker list reflects the current choice live.
- Renders blockers in a destructive `<Alert>` as a list.
- Successor `<Select>` appears **only** when the person has reports; lists the affected names
  beneath.
- `exitDate` defaults to the server's `today` from the preview payload — **not** a client
  `toISOString()` (landmine #6).
- A "This will also:" summary block states report moves, asset returns, deployment closures, and
  that the person will be signed out.
- Submit is disabled while `!canProceed`. On a server-side error it **re-loads the preview**,
  because blockers may have changed underneath the admin.
- Resets all local state when closed.

Follows the repo form idiom exactly: `useState` + `useTransition` + `sonner`,
`if ("error" in res && res.error)`, base-ui `Select` guarded against empty `onValueChange`.

### 3.3 `EmployeeTable` — `src/components/admin/EmployeeTable.tsx` (modified)

- `UserRow` gains `is_active?: boolean` and `exit_date?: string | null`.
- New **Status** column: `Active` (`bg-success/10 text-success`) or `Departed · <exit_date>`
  (`bg-muted text-muted-foreground`). Empty-state `colSpan` 6 → 7.
- New row action (`UserMinus`), rendered **only for active employees**, opening the dialog.
- `onSuccess={() => router.invalidate()}` — the correct refresh, not the assets route's no-op.
- **`allUsersForDropdown` replaced by `activeUsersForDropdown`**, used by both the deactivate
  dialog *and* `EmployeeEditSheet` — offering a departed person as someone's peer lead would
  recreate the exact stranding bug this phase fixes.

### 3.4 `_authenticated.admin.index.tsx` (modified)

- Exposes `is_active`, `exit_date`, `exit_reason` to the table.
- `leadIds` now derived from **active** users only, matching `getCurrentAppUser`.

---

## 4. Tests

`bun run test` → **68 passed** (was 46).

| File | Tests | Covers |
|---|---|---|
| `src/lib/employee-lifecycle.test.ts` | 14 | Happy path · self-deactivation · last admin · admin with another admin remaining · reports without successor · singular/plural message · successor = self · successor inactive · valid reassignment · **blocker accumulation** · **promote-from-within** · **promoted successor becomes a root** · `resolveAccessState` × 2 |
| `src/lib/asset-return-policy.test.ts` | 8 | Brainee.org good → inventory · Brainee.org damaged/defective → defective · defect reason from note · default defect reason · client-owned always surrendered · null/undefined condition |

### Integration verification (beyond unit tests)

Seeded a real lead + two reports into local D1 and ran `assessDeactivation` against **live
database rows**, then removed the seed data:

| Case | Result |
|---|---|
| Lead with 2 reports, no successor | ❌ blocked — `reports_need_reassignment` |
| Same, successor = a report | ✅ peers → successor; successor → root (no self-lead) |
| Successor = the departing person | ❌ blocked — `invalid_reassign_target` |
| Employee leading nobody | ✅ proceeds, 0 blockers |
| Admin deactivating themselves | ❌ blocked — `self_deactivation` + `last_admin` |

**This is how the promote-from-within bug was found** — the unit tests as originally written did
not cover it.

### Smoke test

Dev server boots with no errors. `/access-ended` correctly `307`s an anonymous visitor to
`/sign-in`, confirming the guard.

---

## 5. Prerequisites cleared in this phase

| # | Item | Resolution |
|---|---|---|
| 1 | **`zod` imported in 17 files but absent from `package.json`** — resolving only via hoisting from three TanStack packages | Declared `zod@^4.4.3`, pinned to the already-resolving version |
| 2 | **Schema/migration drift** — `acknowledged_at`, `issue_reported_at`, `issue_description`, `issue_status` live in `schema.ts` and shipped code but in **no migration**; `assets.asset_type` default differed (`physical` vs `capital_asset`) | Migration `0009_third_lady_vermin.sql`. Columns had been added to local D1 outside the migration chain — origin unconfirmed, see `08-OPEN-ITEMS-AND-DEBT.md` §1.2 |
| 3 | Uncommitted assets module (~10.4k LOC) | Landed by the user in commit `8a1290e` before this work |
| 4 | **`worker-configuration.d.ts` stale** — typed `VITE_CLERK_PUBLISHABLE_KEY` and `RESEND_*` | Regenerated via `wrangler types`; now types the five real `WORKOS_*` vars |
| 5 | `checkbox` primitive missing | **Deferred to Phase 3** — adding it now would be speculative |

### Local D1 reconciliation

Applying `0009` locally failed with `duplicate column name: acknowledged_at` — the four columns were
already present, added outside the migration chain (most likely a manual `wrangler d1 execute
--local` `ALTER TABLE`; **not** `db:push`, which targets remote). Resolution: backed up
`.wrangler/state/v3/d1/`, ran only the `assets` table-rebuild portion (preserving all **107** test
assets), then recorded `0009` in `d1_migrations`. Local is now genuinely in sync with the migration
chain, not just marked as such.

> ⚠️ **Production state is unknown and must be verified before migrating** — see
> `08-OPEN-ITEMS-AND-DEBT.md` §1.2. Nothing in this phase touched production.

---

## 6. Bugs fixed in passing

| Bug | Detail |
|---|---|
| **`offboardClientDeployment` was dead on arrival** | The mounted UI (`DeploymentsAndAssignmentsView.tsx:479`) sent `{ offboardDate, notes }`; the validator required `{ endDate, reason }`, so `.parse()` threw before the handler ran and the user saw a generic toast. The correct shape lived in `ClientDeploymentsManager.tsx` — which is **dead code, imported nowhere**. Fixed the caller |
| **Departed reports promoted their former lead** | `getCurrentAppUser` and `getAdminPageData` both derived `lead` from *any* report. Now active-only |
| **Return-routing logic triplicated and inconsistent** | Extracted to `asset-return-policy.ts` with real tests |

---

## 7. Files changed

**Created (10):**

```
src/lib/employee-lifecycle.ts
src/lib/employee-lifecycle.test.ts
src/lib/asset-return-policy.ts
src/lib/asset-return-policy.test.ts
src/routes/access-ended.tsx
src/components/admin/EmployeeDeactivateDialog.tsx
drizzle/0009_third_lady_vermin.sql
drizzle/0010_peaceful_scarlet_spider.sql
drizzle/meta/0009_snapshot.json
drizzle/meta/0010_snapshot.json
```

**Modified (21):** `package.json` · `bun.lock` · `worker-configuration.d.ts` ·
`drizzle/meta/_journal.json` · `src/routeTree.gen.ts` · `src/db/schema.ts` ·
`src/lib/current-user.server.ts` · `src/lib/server-fn.ts` · `src/lib/approval-count.server.ts` ·
`src/lib/approvals-live-data.server.ts` · `src/lib/dashboard-stats.server.ts` ·
`src/lib/notifications.server.ts` · `src/lib/team-calendar-live-data.server.ts` ·
`src/api/employees.ts` · `src/api/assets.ts` · `src/api/deployments.ts` · `src/api/leave-types.ts` ·
`src/routes/_authenticated.admin.index.tsx` · `src/routes/_authenticated.organization.tsx` ·
`src/components/admin/EmployeeTable.tsx` · `src/components/assets/DeploymentsAndAssignmentsView.tsx`

`644 insertions(+), 75 deletions(-)`

---

## 8. Not done in Phase 0

| Item | Why |
|---|---|
| Blocking deactivation on **project ownership** | `projects` does not exist yet. **Add this check to `assessDeactivation` in Phase 1** — a new `ownedProjectIds` blocker |
| Reactivation / rehire flow | Not requested. `getCurrentAppUser` will not resurrect an account today; a rehire currently needs a manual DB change |
| WorkOS-side deprovisioning webhook | Out of scope. Note a WorkOS deprovision stays invisible for up to 7 days (self-contained cookie); app-level deactivation is the only immediate revocation |
| Bulk/batch offboarding | Single-employee only |
