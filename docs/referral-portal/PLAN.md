# Employee Referral Portal — Implementation Plan

**Source of truth:** Referral Policy Annex → *Employee Referral — Form & Tracking Spec*
**Target:** Brainee.org (TanStack Start · Cloudflare Workers · D1 + Drizzle · WorkOS · shadcn base-nova)
**Status:** ready to build

---

## Decisions taken

| # | Question | Decision |
|---|---|---|
| D1 | HR/TA and Finance are not roles this app has | **Add `hr` to the role enum.** No capability table. |
| D2 | Spec references an ATS for duplicate checking | **No ATS.** Requisitions live in-app. `ats_sourced` stays as an HR-selectable flag. |
| D3 | Two notifications are time-triggered; Worker has no cron | **No cron in v1.** Due items are *derived on read* as HR queue tabs. Email reminders deferred. |
| D4 | "To the second" timestamps can tie, and the tie decides money | **Store milliseconds**, break ties on `(submittedAt, referralCode)`. Free, one-word change. |

### One assumption you should confirm

You said "add a HR role" — singular. The spec also lists **Finance** as a read-only actor for approved payouts.

I have **not** added a `finance` role. The payout view is gated to `admin` for v1, on the reasoning that finance approvers in an org this size are typically already admins, and a second role means a second set of nav entries, a second middleware, and a second column-scoping rule for one read-only screen.

If Finance genuinely needs to be separate from admin, say so — it is a ~30-minute addition following exactly the same pattern as `hr`, and it is much cheaper to do now than after payouts are live.

---

## What "the simple way" changed

Recorded so the reasoning survives, and so the deferred items are deliberate rather than forgotten.

| Was planned | Now | Why |
|---|---|---|
| `user_capabilities` table + `capabilityMiddleware` factory | `hr` in the role enum + `hrMiddleware` | One concept instead of two. Costs a wider blast radius (see below) but the app already thinks in roles. |
| 4 new tables | **3 tables** — `referral_events` dropped | `audit_logs` + `logAuditEvent` already exist and already record actor, entity, before and after. The HR timeline renders from a filtered query over it. Non-negotiable 7 is satisfied without a new table. |
| New `REFERRAL_DOCS` R2 bucket | Reuse `PROJECT_DOCS` under a `referrals/` key prefix | Removes a production provisioning step entirely. All R2 access is server-side through the binding and gated in the handler, so the bucket is not the security boundary. **Tradeoff:** if you ever set a bucket-level lifecycle or retention rule for candidate PII, you will need to split it out. Noted, not solved. |
| 9 API modules | **5** | Split by lifecycle stage, still under 300 lines each. |
| 6 lib modules | **2** (+2 test files) | Code allocation, notification wrappers and job runners inlined at their single call site. |
| Cron-driven reminders | Derived tabs in the HR queue | No spike needed, nothing can be missed, and email reminders slot in later without changing the queries. |
| 7 phases | **5** | |

### The cost of the role decision

`hr` is a fourth value in a three-value enum that is declared in **four places** and consumed by 24 role checks. None of it is hard, but all of it has to be done together or HR users get a broken app:

| File | Change |
|---|---|
| `src/lib/navigation.ts:16` | `export type Role = "user" \| "lead" \| "admin" \| "hr"` |
| `src/lib/auth-utils.server.ts:4` | Same type, **declared a second time**. Consolidate — import from `navigation.ts` rather than adding a fourth value to a duplicate. |
| `src/components/admin/useEmployeeEdit.ts:17` | `const ROLES = ["user", "lead", "admin", "hr"] as const` — this is what the admin UI offers when changing someone's role. |
| `src/api/employees.ts:33` | `z.enum(["user", "lead", "admin", "hr"])` — server-side validation of role changes. |

Nav filtering is `allowedRoles.includes(role)`, so it **fails closed**: an `hr` user sees no navigation at all until `"hr"` is added to the `allowedRoles` array of every item they should see. That is the good failure mode, but it means the nav pass is not optional.

The 19 `role === "admin"` and 5 `role === "lead"` checks are all left alone. HR is not an admin and is not an approver. If HR should also approve leave, that is a separate decision — do not let it ride along with this.

---

## 1. Data model

Three tables added to `src/db/schema.ts`. Additive only; nothing existing is altered. Conventions followed: text UUID primary keys, `integer(…, { mode: "timestamp" })` with `unixepoch()` defaults, ISO `YYYY-MM-DD` strings for calendar dates, enum values listed in an inline comment.

### 1.1 `job_requisitions`

HR-maintained. The source for form field 7, and the carrier of the role band so the referrer never touches banding.

```
id             text pk
code           text unique notNull      REQ-0001
title          text notNull
department     text
roleBandId     text → referral_role_bands.id
employmentType text notNull             full_time | contract_to_ft | contract | intern | part_time
status         text notNull default 'open'   open | on_hold | closed
openedAt       integer timestamp
closedAt       integer timestamp
createdById    text → users.id
createdAt      integer timestamp default unixepoch()
updatedAt      integer timestamp default unixepoch()

index job_requisitions_status_idx (status)
```

### 1.2 `referral_role_bands`

```
id               text pk
key              text unique notNull      band_a | band_b | band_c
label            text notNull
bonusAmountMinor integer                  NULLABLE — blank until approved (spec §9.1)
currency         text notNull default 'INR'
isActive         integer bool notNull default true
createdAt        integer timestamp default unixepoch()
updatedAt        integer timestamp default unixepoch()
```

Money in **minor units as an integer**. No floats, ever. `bonusAmountMinor` nullable is spec §9.1 expressed in the schema rather than in a comment — the payout step blocks on a null instead of defaulting to zero.

### 1.3 `referrals`

The core record. One table, because every field is 1:1 with the referral and the pipeline is linear.

```
--- identity & submission (never updated after insert) ---
id                    text pk
referralCode          text unique notNull      REF-0001
referrerId            text notNull → users.id
submittedAt           integer notNull          server clock, MILLISECONDS
expiresAt             integer notNull          submittedAt + 180d

--- candidate ---
candidateName         text notNull
candidateEmail        text notNull             lowercased + trimmed — the match key
candidateEmailDisplay text notNull             as typed, for display
candidatePhone        text
resumeR2Key           text unique notNull
resumeFileName        text notNull
resumeMimeType        text notNull
resumeSizeBytes       integer notNull
resumeChecksum        text

--- referrer declarations (screen 1) ---
requisitionId         text notNull → job_requisitions.id
roleBandId            text → referral_role_bands.id     snapshot at submit
consentConfirmed      integer bool notNull              HARD GATE
relationship          text notNull      none | family | former_colleague | friend | financial
referrerIsHiringPanel integer bool notNull              form field 10
fitNotes              text                              ≤ 1000 chars

--- screening (screen 2) ---
conflictFlag          text notNull default 'pending_check'
                      none | duplicate_we_are_first | duplicate_we_are_later
                      | agency_earlier | ats_sourced | applied_within_6_months
referrerConflict      text notNull default 'none'
                      none | hiring_manager | panel_interviewer | recruiter
eligibilityCode       text                              computed, ADVISORY
eligibilityComputedAt integer timestamp
hrDecision            text notNull default 'pending_review'
                      pending_review | eligible | not_eligible
hrDecisionById        text → users.id
hrDecisionAt          integer timestamp
decisionNotes         text

--- pipeline & outcome (screen 3) ---
pipelineStatus        text notNull default 'submitted'
                      submitted | screening | interviewing | offered | joined | closed
employmentType        text              set at offer
joinedDate            text              ISO date — starts the 90-day clock
retentionDueDate      text              joinedDate + 90d
blockersAt90          text              none | candidate_notice | candidate_pip
                                        | referrer_notice | referrer_exited
exitReason            text              n/a | resigned | terminated_performance
                                        | terminated_conduct | company_initiated_non_performance
retentionStatus       text notNull default 'pending'    pending | cleared | forfeited
bonusAmountMinor      integer           snapshot on clearing
payoutAction          text notNull default 'not_due'    not_due | approved | withheld
payoutDate            text
payoutBatch           text

createdAt             integer timestamp default unixepoch()
updatedAt             integer timestamp default unixepoch()

index referrals_referrer_idx       (referrerId)
index referrals_candidate_idx      (candidateEmail)
index referrals_submitted_idx      (submittedAt)
index referrals_pipeline_idx       (pipelineStatus)
index referrals_retention_due_idx  (retentionDueDate)
index referrals_expires_idx        (expiresAt)
```

`company_initiated_non_performance` exists as a distinct `exitReason` value even though no rule uses it yet — spec §5 asks for exactly that, so the data is there when the rule lands.

The last two indexes are what make the derived HR tabs (D3) cheap.

### 1.4 Immutability enforced in the database

Non-negotiable 1 asks for an immutable timestamp. Application discipline cannot guarantee that. Drizzle will not generate a trigger, so it is hand-added to the generated migration file — which is exactly the "read the generated SQL before applying" step `CLAUDE.md` already mandates.

```sql
CREATE TRIGGER referrals_submitted_at_immutable
BEFORE UPDATE ON referrals
WHEN NEW.submitted_at <> OLD.submitted_at
BEGIN
  SELECT RAISE(ABORT, 'submitted_at is immutable');
END;

CREATE TRIGGER referrals_code_immutable
BEFORE UPDATE ON referrals
WHEN NEW.referral_code <> OLD.referral_code
BEGIN
  SELECT RAISE(ABORT, 'referral_code is immutable');
END;
```

### 1.5 The audit trail

No new table. Every mutation calls the existing helper:

```ts
await logAuditEvent(db, {
  actorId: context.user.id,
  action: "referral_screening_set",
  entityType: "referral",
  entityId: referral.id,
  oldData: { hrDecision: prev.hrDecision, conflictFlag: prev.conflictFlag },
  newData: { hrDecision: next.hrDecision, conflictFlag: next.conflictFlag },
});
```

The HR timeline on the detail screen is a query over `audit_logs` filtered to `entityType = 'referral'` and that `entityId`, joined to `users` for the actor name — the same shape `AuditLogTable.tsx` already renders. Who changed what, when, from what, to what. That is non-negotiable 7, using something that already exists and is already tested.

---

## 2. Pure logic modules

Written **first**, before any route or component. No database, no I/O, no `Date.now()` inside them — every input is passed in. This is the only version of the policy that can be exhaustively tested, and it is the part where being wrong costs money.

### 2.1 `src/lib/referral-eligibility.ts` (+ `.test.ts`)

```ts
export type Disposition = "void" | "review" | "ok";

export interface EligibilityVerdict {
  code: string;        // machine value, stored in eligibilityCode
  label: string;       // plain language — shown to HR, and to the referrer when void
  disposition: Disposition;
}

export interface EligibilityInput {
  consentConfirmed: boolean;
  appliedWithinSixMonths: boolean;
  referrerConflict: "none" | "hiring_manager" | "panel_interviewer" | "recruiter";
  conflictFlag: string;
  relationship: string | null;
  employmentType: string | null;   // null until offer
}

export function evaluateEligibility(input: EligibilityInput): EligibilityVerdict;
```

Rules in the spec's exact order, **first match wins**:

| # | Condition | Code | Disposition |
|---|---|---|---|
| 1 | Consent not confirmed | `no_consent` | **VOID** |
| 2 | Applied within 6 months | `applied_recently` | **VOID** |
| 3 | Referrer conflict is not None | `referrer_conflict` | **VOID** |
| 4 | Agency submitted earlier | `agency_first` | **VOID** |
| 5 | Duplicate, later timestamp | `later_timestamp` | **VOID** |
| 6 | Employment type not full-time or contract-to-FT | `not_full_time` | **VOID** |
| 7 | ATS – recruiter sourced | `ats_sourced` | REVIEW |
| 8 | Relationship not disclosed | `relationship_undisclosed` | REVIEW |
| 9 | Otherwise | `checks_passed` | OK |

Three things that are easy to get wrong and are therefore explicit:

- **The order is load-bearing.** A referral that is both consent-less *and* a later duplicate must report the consent failure — that is the reason the referrer can act on, and it would have voided the referral regardless of timing.
- **Rule 6 needs data that does not exist yet.** `employmentType` is set at offer. When it is `null` the rule is skipped, so a freshly submitted referral never reads `not_full_time`. The verdict is recomputed on every write that touches an input; `eligibilityComputedAt` records when.
- **The verdict never writes `hrDecision`.** Enforced structurally: the function returns a value, and the screening handler stores it in `eligibilityCode` only. There is no code path from one column to the other. That is non-negotiable 5.

Tests: one per rule, one per precedence pair where several conditions hold at once, plus the null-employment-type path.

### 2.2 `src/lib/referral-policy.ts` (+ `.test.ts`)

Dates and the employee-facing status mapping. Uses `addIsoDays` and `getTodayIsoDate` from `leave-policy.ts` — **never** `toISOString().split("T")[0]`, so this portal is IST-correct from the first commit instead of repeating the bug we just cleared out of the stats modules.

```ts
expiryFor(submittedAtMs: number): number            // +180 days
retentionDueDateFor(joinedDate: string): string     // +90 days
isExpired(expiresAtMs: number, nowMs: number): boolean
appliedWithinSixMonths(priorApplicationDate: string, today: string): boolean

/** Total, reproducible ordering for competing claims. D4. */
winnerOf(claims: Array<{ submittedAt: number; referralCode: string }>): claim

/** Collapses the internal pipeline to what the referrer is allowed to see. */
employeeVisibleStatus(r: {
  pipelineStatus: string;
  hrDecision: string;
}): "Submitted" | "In process" | "Offered" | "Joined" | "Closed" | "Not eligible";
```

`employeeVisibleStatus` is a separate derived value, **not** `pipelineStatus` passed through. `screening`, `interviewing` and `offered` collapse toward *In process* / *Offered*; any `hrDecision = not_eligible` maps to *Not eligible* regardless of pipeline state. Unit-tested, so the mapping cannot drift as pipeline states are added later.

---

## 3. Module layout

Split by lifecycle stage rather than CRUD verb, so each file has one screen's worth of reasons to change. Every file stays under 300 lines. This is the shape `src/lib/ai/` uses, and the shape `src/api/assets.ts` failed to — the file where an authorization hole hid through a whole review.

```
src/api/
  referrals-schema.ts        zod schemas + FormData parser
  referrals-submit.ts        submitReferral — the write path in §5
  referrals-queries.ts       getMyReferrals, getScreeningQueue, getReferralDetail
  referrals-hr.ts            setScreening, setPipeline, recordRetention, setPayout
  requisitions.ts            requisition + role band CRUD (admin)

src/lib/
  referral-eligibility.ts    + referral-eligibility.test.ts
  referral-policy.ts         + referral-policy.test.ts

src/routes/
  _authenticated.referrals.index.tsx        screen 4 — my referrals
  _authenticated.referrals.new.tsx          screen 1 — submit
  _authenticated.hr.referrals.index.tsx     screen 2 — queue
  _authenticated.hr.referrals.$id.tsx       screens 2 + 3 — detail
  _authenticated.hr.requisitions.tsx        requisitions + bands
  api.referrals.$id.resume.download.tsx     gated résumé download

src/components/referrals/
  ReferralForm.tsx
  MyReferralsList.tsx
  ScreeningQueueTable.tsx
  EligibilityVerdictPanel.tsx
  ScreeningDecisionForm.tsx
  PipelinePanel.tsx
  RetentionCheckDialog.tsx
  ReferralAuditTimeline.tsx
```

The Finance payout view is a tab on `_authenticated.hr.referrals.index.tsx` gated to `admin`, not a separate route. If Finance becomes its own role it graduates to `_authenticated.finance.payouts.tsx`.

### Résumé storage

`PROJECT_DOCS` bucket, key `referrals/{referralId}/{uuid}/{sanitizedFileName}`. Reuses `sanitizeFileName` and `computeChecksum` from `project-documents-schema.ts`.

Constraints per spec field 6, which are **tighter** than the project-document defaults and therefore need their own constants — do not reuse `ALLOWED_MIME_TYPES`:

```ts
export const RESUME_MAX_BYTES = 10 * 1024 * 1024;   // 10 MB, not 25
export const RESUME_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
```

The download route mirrors the hardened document route: HR/admin guard, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and `Content-Length` from `object.size` — all three of which that route only got right after the last review.

---

## 4. Access control

> "An employee must never see another employee's referrals, or any candidate's feedback, scores or compensation."

Server functions are publicly reachable RPC endpoints. Route guards do **not** protect them — `src/lib/server-fn.ts` says so in its own header comment. Every rule below is enforced inside the handler.

### New middleware

```ts
/** HR or admin. Admins retain full access everywhere, as elsewhere in the app. */
export const hrMiddleware = createMiddleware({ type: "function" })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    if (context.user.role !== "hr" && context.user.role !== "admin") {
      throw new AppError("You are not allowed to perform this action.");
    }
    return next();
  });
```

Placed in `src/lib/server-fn.ts` beside the existing three, following the identical shape.

### Guard matrix

| Server function | Guard | Row scope | Column scope |
|---|---|---|---|
| `submitReferral` | `authMiddleware` | writes own only — `referrerId` from session, **never** from input | n/a |
| `getMyReferrals` | `authMiddleware` | `eq(referrerId, session.id)` | **explicit 5-field select** |
| `getScreeningQueue` | `hrMiddleware` | all | all |
| `getReferralDetail` | `hrMiddleware` | all | all |
| `setScreening` | `hrMiddleware` | all | all |
| `setPipeline` | `hrMiddleware` | all | all |
| `recordRetention` | `hrMiddleware` | all | all |
| `setPayout` | `hrMiddleware` | all | all |
| `getApprovedPayouts` | `adminMiddleware` | `payoutAction = 'approved'` | no candidate PII, no notes |
| `downloadResume` | `hrMiddleware` | any | n/a |
| requisition / band CRUD | `adminMiddleware` | all | all |

### Column scoping is written out, not omitted

`getMyReferrals` selects exactly five things:

```ts
.select({
  candidateName:  referrals.candidateName,
  roleTitle:      jobRequisitions.title,
  submittedAt:    referrals.submittedAt,
  expiresAt:      referrals.expiresAt,
  pipelineStatus: referrals.pipelineStatus,   // mapped through employeeVisibleStatus
  hrDecision:     referrals.hrDecision,       // mapped, never returned raw
})
```

A bare `.select()` would ship `decisionNotes`, `conflictFlag` and `bonusAmountMinor` to the browser the moment anyone opened devtools. The bonus amount is omitted from the response **entirely** — not nulled — until `payoutAction = 'approved'`. That is non-negotiable 4.

---

## 5. The submit path

The one write where getting the order wrong has consequences. `multipart/form-data`, parsed the way `project-documents-schema.ts` already does it.

```
 1  parse FormData → zod          reject on any missing required field
 2  CONSENT GATE                  consentConfirmed !== true → hard reject
 3  relationship gate             must be one of 5 values; empty is not a value
 4  requisition check             exists AND status = 'open'
 5  résumé validation             PDF/DOC/DOCX, ≤10 MB, checksum computed
 6  submittedAt = Date.now()      server clock, milliseconds, never from input
 7  allocate REF-nnnn             max+1, retry once on UNIQUE collision
 8  R2 put                        PROJECT_DOCS, key contains the new referral id
 9  insert referral               roleBandId snapshotted from the requisition
10  duplicate scan                same candidateEmail → set conflictFlag on BOTH rows
11  compute eligibility           advisory only → eligibilityCode
12  logAuditEvent                 action: referral_submitted
13  createNotification            referrer: code + 180-day expiry date
14  return { referralCode, expiresAt }
```

Notes on the steps that are not obvious:

- **Steps 2 and 3 run before anything is persisted or uploaded.** A rejected submission must leave no row and no orphaned R2 object. The disabled submit button is a convenience; step 2 is the gate.
- **Step 7 reuses the retry pattern from `getNextTaskNumber`** in `project-task-create.server.ts`. D1 has no sequences; `max+1` with a single recompute-and-retry on UNIQUE violation is the established approach here and it survives concurrent submits.
- **Step 10 writes to both rows.** A duplicate is a relationship, and HR needs to see it from whichever side they open. Earlier claim → `duplicate_we_are_first`; later → `duplicate_we_are_later`, decided by the D4 ordering. With no ATS, this compares referrals to referrals only.
- **Field 10 answered Yes does not block submission.** It sets `referrerIsHiringPanel`, which HR turns into a `referrerConflict` value at screening, which feeds rule 3 and voids the bonus. The referral itself proceeds — exactly as the spec says.
- **R2 orphan risk is accepted.** Step 8 before step 9 means a failed insert can leave a stray object whose key references a nonexistent referral, findable by a later sweep. The alternative ordering leaves a row pointing at a missing file, which is worse for HR.

---

## 6. Screens

### Screen 1 — Submit (`/referrals/new`, any authenticated user)

All eleven fields per spec §2, built from `src/components/ui` primitives only — `Input`, `Textarea`, `Select`, `Checkbox`, `Button`. No raw `<select>`.

- Fields 1–2 read-only from session.
- Field 7 `Select` populated from open requisitions. No free text.
- **Field 9 opens with nothing selected.** `none` is a real option in the list. The Select has no `defaultValue`. Non-negotiable 3.
- Field 8 checkbox with the consent wording rendered verbatim beside it; submit disabled until ticked.
- On success: a confirmation panel showing the referral code and the expiry date, per spec §2.

### Screen 2 — HR queue (`/hr/referrals`, HR + admin)

`DataTableContainer` list with filters on status, role and eligibility outcome. **Plus the three derived tabs that replace cron (D3):**

| Tab | Query |
|---|---|
| All | no filter |
| Needs screening | `hrDecision = 'pending_review'` |
| Expiring soon | `expiresAt` within 14 days AND not yet closed |
| Retention due | `retentionDueDate <= today` AND `retentionStatus = 'pending'` |

Both time-based obligations are visible every time HR opens the page, with a count badge. Nothing is missed, and no scheduler exists yet to go wrong. When email reminders are added later, they read the same two queries.

### Screen 3 — Detail (`/hr/referrals/$id`, HR + admin)

Four stacked panels: candidate + résumé download · **eligibility verdict** (computed, clearly labelled advisory) · screening decision form · pipeline and outcome. Plus `ReferralAuditTimeline` reading from `audit_logs`.

The verdict panel shows the computed disposition and its plain-language label, with the HR decision as a visibly separate control directly beneath it. The system never auto-rejects.

`recordRetention` is a dialog rather than inline fields, because it writes six columns at once — blockers, exit reason, retention status, bonus snapshot, payout action — and half-completed retention data is worse than none.

### Screen 4 — My referrals (`/referrals`, any authenticated user)

Candidate name, role, submitted date, expiry date, status. Nothing else, enforced by the select list in §4, not by the component.

---

## 7. Notifications

Four in v1, all through `createNotification` in `src/lib/notifications.server.ts`, which already writes the in-app row and queues the email via `waitUntil` so a mail failure can never fail the mutation.

| Trigger | To | Fired from |
|---|---|---|
| Submission received | Referrer | `submitReferral` step 13 |
| Marked not eligible | Referrer | `setScreening` when `hrDecision → not_eligible` |
| Candidate joined | Referrer | `setPipeline` when `joinedDate` is set |
| Retention cleared | Referrer + admins | `recordRetention` on `cleared` |

Deferred to a later phase (D3): the 14-day expiry and 90-day retention emails to HR. Both obligations remain **visible** as queue tabs in the meantime.

> "Send promptly — a silent denial reads as arbitrary."

That line in the spec is a requirement, so it is treated as one. The not-eligible notification carries the verdict's `label` — the plain-language string — never the `code`. Each void reason needs a written sentence, reviewed by HR before launch:

| Code | Sentence to the referrer |
|---|---|
| `no_consent` | *We could not proceed because candidate consent was not confirmed.* |
| `applied_recently` | *This candidate applied to us within the last 6 months, so the referral is not eligible.* |
| `referrer_conflict` | *You are part of the hiring process for this role, so the referral bonus does not apply.* |
| `agency_first` | *An agency submitted this candidate before your referral.* |
| `later_timestamp` | *Another employee referred this candidate first.* |
| `not_full_time` | *This hire is not a full-time or contract-to-full-time role.* |

That copy is a Phase 4 deliverable, not an afterthought. Draft above; HR owns the final wording.

---

## 8. Reporting

Five aggregates per spec §8, on the HR queue page. All single queries against the indexed columns — no new tables, no materialised counts.

1. Referrals by status, by month — `GROUP BY pipelineStatus, strftime('%Y-%m', submittedAt/1000, 'unixepoch')`
2. Conversion rate: submitted → joined
3. Referral hires as a share of total hires *(needs a total-hires source; use `users.joinDate` for v1 and note the approximation)*
4. Bonus committed vs paid — `SUM(bonusAmountMinor)` split on `payoutAction`
5. Time from submission to decision — `AVG(hrDecisionAt - submittedAt)`

---

## 9. Build sequence

Five phases. Each ends at a state you can actually check. Everything is local; migrations are `--local` throughout.

### Phase 1 — The role

Add `hr` to all four declaration points in the table above. Consolidate the duplicate `Role` type. Add `hrMiddleware`. Add `"hr"` to `allowedRoles` on every existing nav item HR should see.

> **Gate:** an `hr` user can sign in and use the app normally; `adminMiddleware` still rejects them; `hrMiddleware` accepts both `hr` and `admin`; unit tests cover all three.

### Phase 2 — Schema and migration

Three tables into `schema.ts`. `bun run db:generate`, **read the generated SQL**, hand-add the two triggers from §1.4, then `bunx wrangler d1 migrations apply DATABASE --local`. Seed script: role bands with null amounts, two or three open requisitions.

> **Gate:** migration applies clean locally; a manual `UPDATE referrals SET submitted_at = …` is rejected by the trigger.

### Phase 3 — Pure logic

`referral-eligibility.ts` and `referral-policy.ts`, test-first. The rule table in §2.1 *is* the test list. No routes, no database, no components.

> **Gate:** every rule and every precedence pair has a passing test. This phase is small in volume and large in consequence — it is where the policy actually becomes code.

### Phase 4 — Employee side

`submitReferral` with the full 14-step path. `getMyReferrals` with its explicit column list. The form, the consent gate, the status list, the résumé download route. Void-reason copy written and signed off.

> **Gate:** a referral submits end to end and the résumé downloads. Submitting with consent unticked is rejected **server-side with the client check bypassed**. A second employee cannot read the first's referral by id. Verify the last two by calling the server function directly, not through the UI.

### Phase 5 — HR side, payouts, reporting

Queue with filters and the three derived tabs. Detail screen, screening, pipeline, retention dialog, audit timeline. Requisition and band admin. Admin payout view. The five reports.

> **Gate:** the computed verdict is visible and clearly advisory; HR can override in both directions; every `not_eligible` has a stored reason; the timeline shows who changed what and when; `tsc`, `biome check` and the full suite pass.

### Handover, not a phase

Production steps are written up and **handed over**, never run from here:

```bash
# Human-run, deliberately, by the maintainer:
bun run db:migrate:prod        # applies the referral migration remotely
# then, in the admin UI: grant the hr role to the first HR users
```

No new bucket to provision — that is what reusing `PROJECT_DOCS` bought.

---

## 10. Non-negotiables → mechanism

A requirement with no named mechanism is a hope. Each of the seven, and the specific thing that enforces it.

| # | Requirement | Enforced by |
|---|---|---|
| 1 | Server-side timestamp, immutable, to the second | `Date.now()` in the handler, never an input field, **plus a D1 `BEFORE UPDATE` trigger that aborts on change**. Stored in ms per D4. |
| 2 | Consent is a hard gate on submit | Step 2 of the submit path, before any write or upload. The disabled button is convenience; the server check is the gate. |
| 3 | Relationship has no blank state | `notNull` column + zod enum with no default + a `Select` with no `defaultValue`, where `none` is a real option. |
| 4 | Referrer never sets the band or sees the bonus | `roleBandId` snapshotted server-side from the requisition and absent from the submit schema. `getMyReferrals` omits the amount until `payoutAction = 'approved'`. |
| 5 | Eligibility computed and advisory; HR decides | Two separate columns — `eligibilityCode` and `hrDecision` — and no code path writes the second from the first. |
| 6 | Every void has a recorded reason | `hrDecision = 'not_eligible'` requires a non-null `eligibilityCode` **or** `decisionNotes`; the handler rejects the write otherwise. |
| 7 | Full audit trail | `logAuditEvent` on every mutation with `oldData`/`newData`, rendered as the detail-screen timeline. |

---

## 11. Fields without automation

> "Build the fields, not the automation."

| Open item (spec §9) | Built as |
|---|---|
| Bonus amounts | `referral_role_bands.bonusAmountMinor` nullable and admin-editable. UI shows "Not set"; the payout step **blocks on a null** rather than defaulting to zero. |
| ATS-sourced candidates | A `conflictFlag` value HR can select, mapping to **REVIEW**. No void path exists for it in code, so it cannot start auto-voiding by accident. |
| Relationship non-disclosure | Rule 8 returns REVIEW. Same protection. |
| Contractor conversion after 180 days | `expiresAt` is a **stored** column, not computed, plus an HR-only "extend expiry" action that writes an audit row with a reason. Neither reset-on-conversion nor never-reset is hard-coded. |
| Split payout for repeat quick exits | Out of scope. `bonusAmountMinor` being per-referral rather than a lookup means a split can be expressed later with no migration. |
| Who may refer | **No check on the referrer at submit.** Interns, contractors and probation employees can all submit. When the rule lands it becomes rule 0 in the eligibility engine — one function, one test. |

---

## 12. The two portals after this one

Capability Development and Company Policies have no spec yet, so nothing is built for them. Two pieces of *this* build should be written to be reusable, because both will need them and retrofitting is the expensive path:

- **A document-storage helper.** The résumé upload/download/checksum/sanitise code will be the third copy of this pattern after project documents and assets. Extract `src/lib/r2-documents.server.ts` taking a bucket binding and a key prefix. Company Policies is almost entirely a document portal; it should inherit this rather than write a fourth copy.
- **The derived-obligations pattern.** "Show what's due as a filtered tab instead of relying on a scheduler" applies directly to policy acknowledgement reminders and capability-plan review dates.

**One caution.** Do not design the referral schema to be "generic enough" for the other two. Shared *infrastructure* pays off; a shared `portal_items` table would not — the three domains have nothing in common at the data layer, and the abstraction would cost more than the duplication saves. Keep the tables specific and the plumbing shared.

Since the role model is now enum-based rather than capability-based, each new portal that needs a distinct actor will add another role. That is fine for one or two more. If a third or fourth portal wants its own actor, revisit the capability table then — the decision is deferred, not foreclosed.
