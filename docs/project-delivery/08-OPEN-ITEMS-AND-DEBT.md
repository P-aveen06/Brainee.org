# Open Items, Known Debt, Deployment Cautions

---

## 0. ⛔ Production rule

**Nothing automated touches production.** No agent, no script step, no "quick check".
All work lands locally; deploying and migrating production are **human-run steps** performed
deliberately by the maintainer. This is also recorded in `CLAUDE.md` so it applies every session.

The blocked commands: `db:migrate:prod` · `deploy` / `wrangler deploy` · any `wrangler ... --remote`
(**including read-only**) · `db:push` / `db:pull` / `db:studio` · `wrangler secret put`.

> ⚠️ **`db:push`, `db:pull` and `db:studio` are NOT local commands.** `drizzle.config.ts` uses
> `driver: "d1-http"` with `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_DATABASE_ID` /
> `CLOUDFLARE_D1_TOKEN` — they connect to the **remote production D1 over HTTP**. `db:studio`
> opens a database GUI onto live company data. Their names do not warn you.
>
> **Currently they fail**, because those three `CLOUDFLARE_*` variables are absent from
> `.env.local` (which holds only the five `WORKOS_*` vars). That is an accidental safety net, not
> a designed one — adding the credentials silently re-arms all three.
>
> **Recommended (not yet done, your call):** rename them so the target is obvious, e.g.
> `"db:push:PROD-DANGER"`, or delete `db:push` outright since the migration workflow replaces it.

---

## 1. Pending database changes

### 1.1 What is waiting

Two migrations exist on disk and are **applied locally only**:

| Migration | Contents | Risk |
|---|---|---|
| `0009_third_lady_vermin.sql` | Adds `acknowledged_at`, `issue_reported_at`, `issue_description`, `issue_status` to `asset_assignments`; **rebuilds `assets`** to change `asset_type` default `'physical'` → `'capital_asset'` | ⚠️ Medium — table rebuild, and may conflict (see §1.2) |
| `0010_peaceful_scarlet_spider.sql` | Adds `is_active`, `exit_date`, `exit_reason`, `deactivated_by_id` to `users` | ✅ Low — four plain `ADD COLUMN`s, all defaulted |
| `0011_bright_payback.sql` | Phase 1 schema: `projects`, `client_contacts`, `project_members`, `project_stages`, `project_stage_progress`, `project_events` | ✅ Low — creates 6 independent tables with foreign keys |
| `0012_damp_nick_fury.sql` | Phase 2 schema: `project_tasks` with self-referencing subtasks, indexes, and sequential task number | ✅ Low — creates 1 table with foreign keys and indexes |

`0010` is behaviour-neutral on apply: every existing employee defaults to `is_active = true`, so
nothing changes for anyone until an admin deactivates someone.

**`0009` is not optional.** `src/api/assets.ts` and `src/api/deployments.ts` already **read and
write** `acknowledged_at` / `issue_status` in shipped code. If production lacks those columns,
asset receipt-acknowledgement and issue reporting are broken there **right now**, independently of
this work.

### 1.2 ⚠️ `0009` may fail on production — verify first

Applying `0009` locally failed with:

```
duplicate column name: acknowledged_at: SQLITE_ERROR
```

because those four columns were **already present locally**, added outside the migration chain.

**Correction to an earlier note in this document:** the cause was *not* `db:push` writing to local —
`db:push` targets **remote**, and its credentials are absent. The local columns most likely came
from a manual `wrangler d1 execute --local` `ALTER TABLE`. **The true origin is unconfirmed, so
production's state is genuinely unknown and must be checked rather than assumed.**

**Before migrating production, a human should run:**

```bash
bunx wrangler d1 execute DATABASE --remote --command \
  "SELECT name FROM d1_migrations ORDER BY id;"
```

```bash
bunx wrangler d1 execute DATABASE --remote --command \
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='asset_assignments';"
```

| Finding | Action |
|---|---|
| Last migration is `0008`, and `acknowledged_at` **absent** | Normal path — `bun run db:migrate:prod` applies `0009` then `0010` |
| Last migration is `0008`, but `acknowledged_at` **present** | `0009` will fail. Reconcile as was done locally: run only the `assets` rebuild portion, then `INSERT INTO d1_migrations (name) VALUES ('0009_third_lady_vermin.sql');` — then apply `0010` |
| Anything else | Stop and re-plan |

**Take a D1 backup first** (`wrangler d1 export`). Locally this was covered by copying
`.wrangler/state/v3/d1/`; production needs a real export.

### 1.3 Nothing else is needed in the DB

Beyond `0009` and `0010`, **no manual DB change is required** for the shipped work.

- No data backfill — `is_active` defaults to `true` for every existing row.
- No seed data.
- No index rebuild beyond what `0009` recreates.
- No secret or binding changes (R2 arrives in **Phase 3**, and will need
  `bunx wrangler types` after the binding is added).

### 1.4 Local reconciliation already performed

For the record, on the local database: backed up `.wrangler/state/v3/d1/`, ran only the `assets`
rebuild portion of `0009` (preserving all **107** test assets), recorded `0009` in `d1_migrations`,
then applied `0010` normally. Local is now genuinely in sync with the migration chain — verified by
`wrangler d1 migrations list DATABASE --local` reporting **"No migrations to apply!"**, not merely
marked as such.

---

## 2. Environment separation

`wrangler.jsonc` is a single flat config — there are **no `env.staging` / `env.production` blocks**
(commit `204a44a` deliberately flattened a prior attempt). One `database_id` serves both, with
`--local` vs `--remote` as the only separation.

**This becomes a real hazard in Phase 3**, where R2 documents get written. `preview_bucket_name`
covers the bucket, but the D1 rows pointing at those objects do not have an equivalent split.
**Worth splitting environments before Phase 3 lands.**

## 3. Fixed in Phase 0 — do not reintroduce

| Bug | Status |
|---|---|
| `offboardClientDeployment` payload mismatch (`offboardDate`/`notes` vs `endDate`/`reason`) | ✅ Fixed at the caller |
| Departed reports promoting their former lead | ✅ Active-only in both places |
| Return-routing logic triplicated and inconsistent | ✅ Extracted to `asset-return-policy.ts` |
| `zod` undeclared in `package.json` | ✅ Declared `^4.4.3` |
| `worker-configuration.d.ts` stale (Clerk/Resend era) | ✅ Regenerated |

## 4. Pre-existing issues NOT fixed (deliberately out of scope)

| # | Issue | Why left | Risk |
|---|---|---|---|
| 1 | **`_authenticated.admin.assets.tsx` refresh is a no-op** — `navigate()` to the current location does not re-run the loader | Pre-existing; not in Phase 0's path | Assets tables show stale data after every mutation. **Fix:** `useRouter().invalidate()` |
| 2 | Same route has `validateSearch` but **no `loaderDeps`** | Same | Search-param changes never refetch |
| 3 | ~~**`ClientDeploymentsManager.tsx` is dead code**~~ | ✅ **Resolved** | Deleted alongside `AssignmentsView.tsx` (-1,877 LOC of dead code purged). |
| 4 | `asset-policy.test.ts` still re-declares 3 of its 4 functions locally (urgency, tier, custody) | Only the return-routing one was needed by Phase 0 | Those three test nothing that ships. Extract when touched |
| 5 | ~~`src/config/theme.ts` is dead code~~ | ✅ **Resolved** | Deleted unimported dead configuration file. |
| 6 | `QuickLogCard.tsx:32` uses UTC `toISOString()` for "today" | Pre-existing | Off-by-one near midnight. **New code must take `today` from the loader** |
| 7 | `timesheets.re_entry_note` / `re_entry_flagged_by` are **never written** by any code path | Pre-existing | Dead schema; the UI renders it but nothing sets it |
| 8 | ~~`src/components/goals/` and `src/components/notifications/` empty dirs~~ | ✅ **Resolved** | Cleaned up empty directories. |
| 9 | `notifyApprovers` notifies **every admin** for every request | Pre-existing | Will not scale; **do not reuse for EOD** |
| 10 | `useRealtimeTables` is a 10-second poll with a Supabase-shaped API whose args are discarded | Pre-existing | Misleading name; no real-time transport exists |
| 11 | `CalendarRealtimeRefresh.tsx` is dead code | Unrelated | Noise |
| 12 | `drizzle/meta/` is missing `0004`/`0005` snapshots (hand-written migrations) | Historical | `db:generate` still works; noted for archaeology |

## 5. Deferred decisions

| Decision | Deferred to | Notes |
|---|---|---|
| **AI model provider** | Phase 5 | Kept behind `ChatProvider`. Build against the stub first |
| **Email provider** | When reminders must actually leave the app | `src/lib/mail.server.ts` is a no-op stub with signature `{ to, subject, text }`. A Resend implementation existed and was removed inside refactor `65e7c6a` — recoverable from git. Cloudflare Email Sending is the stated intent ("until the Cloudflare provider is finalized"); the build output already shows `"send_email": []` |
| **`@dnd-kit` for Kanban** | After the board proves out | `updateTaskStatus` is the same endpoint either way |
| **Streaming AI responses** | After v1 | No SSE/WebSocket transport exists |
| **Virtualization / pagination** | When a view exceeds a few hundred rows | Nothing exists to build on; `display: contents` rows are incompatible with windowing |
| **Cron / `scheduled()` handler** | Not planned | `src/server.ts` does not exist but **is a supported override point** — `@tanstack/start-plugin-core` resolves `src/server.ts` by convention and falls back silently. Wrapping the default entry would allow a `scheduled` export, but `ServerEntry` is typed `{ fetch }` only, and it must be confirmed the extra export survives the Cloudflare Vite bundle |
| **Virus scanning for uploads** | Open question for the user | Workers cannot practically scan inline. Either accept, or restrict who may upload |
| **Rehire / reactivation flow** | Not requested | Currently needs a manual DB change |

## 6. Carried into Phase 1 (mandatory) · ✅ RESOLVED

- [x] Add an `owns_projects` blocker to `assessDeactivation` in `src/lib/employee-lifecycle.ts`.
- [x] Add `ownedProjectIds` to `gatherDeactivationSnapshot` in `src/api/employees.ts`.
- [x] Require a per-project new owner in `deactivateEmployee` before it proceeds.
- [x] Add the corresponding successor picker to `EmployeeDeactivateDialog`.

**This is the reason Phase 0 shipped first.** Without it, deactivating a project owner leaves an
orphaned project.

## 7. Open questions for the user

1. **Uploads and virus scanning** — accept the risk, or restrict upload rights to certain roles?
2. **Expected scale** — projects, and tasks per project. Above a few hundred rows per view,
   server-side filtering and paging must land *with* the views, not after.
3. **Environment split** — worth doing before Phase 3 writes real documents?
4. **What is production's current schema state?** A human must run the two `--remote` checks in
   §1.2 before migrating — `0009` may or may not conflict, and assuming either way is unsafe.
5. **Should `db:push` / `db:pull` / `db:studio` be renamed or removed?** They point at production
   and their names do not say so (§0).
