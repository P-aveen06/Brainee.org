# Brainee.org — Master Plan

One ordered roadmap covering everything discussed: outstanding code findings, the navigation rebuild, the project-page tab consolidation, and the three new portals.

**This document is the sequence.** Detailed specs live in their own files, linked at each step. Where earlier documents proposed a different navigation structure, **this one is authoritative**.

| Detail document | Covers |
|---|---|
| [`navigation/REVIEW.md`](navigation/REVIEW.md) | Sidebar findings, mobile-nav defect, page-title drift |
| [`project-page-tabs/PLAN.md`](project-page-tabs/PLAN.md) | Project detail 11 tabs → 5, URL compatibility |
| [`referral-portal/PLAN.md`](referral-portal/PLAN.md) | Referral data model, eligibility engine, submit path |
| [`referral-portal/UX-AND-IA.md`](referral-portal/UX-AND-IA.md) | Referral screen behaviour |
| [`portals/PLAN.md`](portals/PLAN.md) | Portal contents and shared infrastructure |

---

## Decisions — all settled

| # | Question | Decision |
|---|---|---|
| 1 | Company-wide leave *types* visible via the assistant? | **Yes — by design.** Matches the team calendar. W4 closed, no code change. |
| 2 | Separate `finance` role? | **No.** Payout view stays admin-gated. |
| 3 | Performance cycles — own portal or part of Capability? | **Part of Capability**, as module D. No separate sidebar row. |
| 4 | Training approval route? | **HR only.** No lead endorsement step. |
| 5 | Skill levels? | **Named bands**, not 1–5 numeric. Vocabulary to be agreed. |
| 6 | HR Console — one row or four? | **One row, four tabs.** |
| 7 | Project page — EOD inside Daily? | **Merged into Daily.** |
| 8 | Project Settings location? | **Under Projects**, not Administration. |

> On 6 and 7: your "merge" answered one of them and the other's default was also *merge*, so both land the same way regardless. Flagging in case you meant something different for either.

### Two new items from this round

| | Item | Where it landed |
|---|---|---|
| **N1** | Universal search — *"where are the improvements like universal search?"* | Was phase 8f, dead last. **Moved to phase 4.** See below. |
| **N2** | Collapsible sidebar group titles | **Added to phase 1.** Design in §Phase 1e. |

---

## Current state

```
tsc --noEmit   clean
biome check    clean
tests          169 passing / 31 files
```

17 of the 19 code-review findings are resolved. What remains is W1–W3; W4 is now closed as by-design.

---

## Track W — Outstanding from the code review

| # | Item | File | Severity |
|---|---|---|---|
| **W1** | `rejectAiProposedAction` lost its atomic status guard. The final update is `.where(eq(id, target.id))` with no status condition, so a concurrent confirm can be overwritten to `rejected` after it already executed. Ownership is still safe — the preceding select scopes by `userId`. **Fix:** add `eq(status, target.status)` to the update's WHERE. | `api/ai-assistant-proposals.ts:220` | 🟠 |
| **W2** | The task **update** path writes `input.assigneeId` raw, while **create** now runs the full `resolveTaskAssignee` ladder. Not a regression; the two paths disagree. Low risk — the AI cannot propose reassignment and the UI dropdown is member-constrained. | `api/project-tasks-crud.ts:68` | 🟡 |
| **W3** | No per-user rate limit on assistant turns. The turn budget caps calls *within* a turn; nothing caps turns per hour. | `lib/ai/turn-budget.ts` | 🟡 |
| ~~W4~~ | ~~Leave-type visibility~~ — **closed, by design.** | — | ✅ |

**Do W1 now.** W2–W3 ride along with any phase.

---

## Phase 1 — Navigation foundation

### 1a. The mobile defect 🔴

**There is currently no way to open the navigation below 768px.** `Shell.tsx` renders no topbar; the only `SidebarTrigger` sits inside the sidebar's own header; the mobile sheet starts closed; `SidebarRail` is hidden below 640px. A phone user landing from a link or notification cannot navigate anywhere.

Fix: a mobile-only sticky header in `Shell.tsx` with a `SidebarTrigger` and the page title. ~15 lines.

> **Verify:** at 375px every page shows a working menu button. Check 767px and 768px.

### 1b. The `hr` role

Four declaration points, all changed together or HR users get a broken app:

| File | Change |
|---|---|
| `lib/navigation.ts:16` | `Role` gains `"hr"` |
| `lib/auth-utils.server.ts:4` | **duplicate `Role` type** — consolidate, import from `navigation.ts` |
| `components/admin/useEmployeeEdit.ts:17` | `ROLES` gains `"hr"` |
| `api/employees.ts:33` | `z.enum([...])` gains `"hr"` |

Plus `hrMiddleware` in `lib/server-fn.ts`, and `"hr"` on `allowedRoles` for every item HR should see. Nav filtering **fails closed** — an `hr` user sees nothing until this is done.

The 19 `role === "admin"` and 5 `role === "lead"` checks stay untouched.

### 1c. The sidebar rebuild

```
[Brainee.org]

  Dashboard
  Brainee.org Brain

PROJECTS                         ▾
  Projects
  My Tasks
  Project Settings                    ← moved here per decision 8 · admin

PEOPLE                           ▾
  My Attendance
  Team Calendar
  Organization
  Approvals              ⁴            ← moved from Management, which is deleted

MY WORKPLACE                     ▾    ← new · populated across phases 3–6
  Referrals                           ← phase 3

HR                               ▾    ← hr, admin
  HR Console                          ← phase 3

ADMIN                            ▾    ← admin
  Assets
  Administration

──────────────
  Notifications
  Theme
  [Avatar] Name ▸                     ← dropdown: Profile · Sign out
```

### 1d. The cheap fixes

About an hour together, no logic changes:

| Fix | Detail |
|---|---|
| Page titles match sidebar labels | `Organization` (page says **"Levels"**), `Admin Stats` (**"Executive Command Center"**), `Project Settings` (**"Project Lifecycle & Checklist Configuration"**), `Assets`. Long phrasing moves to `PageHeader`'s existing `description` prop. |
| Sign out | Footer avatar becomes a `DropdownMenu` with Profile and Sign out. Today it's a plain link, and sign-out is buried on `/profile`. |
| Icon collisions | `LayoutDashboard` on two rows of the same sidebar; `CheckSquare` on three things. |
| Calendar naming | Nav says "My Attendance", route is `/calendar`, the page's tab says "Calendar". Pick one word for the pair. |
| Active state | `/admin/employees/123` highlights **nothing**. Replace the two exact-match special cases with longest-prefix-wins. |
| `PageTabs` affordance | Add a fade edge. Insurance for any page that grows tabs. |

### 1e. Collapsible group titles 🆕

**Yes — and the pieces are already in the codebase.**

`src/components/ui/collapsible.tsx` exists, and `SidebarGroupLabel` is built on `useRender`, so it can render *as* a `CollapsibleTrigger` without wrapping it in an extra element.

```
PROJECTS                    ▾        ← click the label to collapse
  Projects
  My Tasks
  Project Settings

PEOPLE                      ▸        ← collapsed
MY WORKPLACE                ▾
  Referrals
  My Development
  Policies
```

**Design**

| Aspect | Decision |
|---|---|
| Trigger | The group label itself, with a chevron that rotates. Whole row clickable, not just the icon. |
| Default | All groups expanded. Collapsing is opt-in per person. |
| Persistence | Follow the pattern already in `ui/sidebar.tsx:86` — the sidebar stores its own open state in a `sidebar_state` cookie for 7 days. Add a `sidebar_groups` cookie holding the collapsed group ids. Same mechanism, same lifetime, survives reloads. |
| First group | **Not collapsible.** Dashboard and Brainee.org Brain sit in an unlabelled group — there's no title to click, and they should always be reachable. |
| Accessibility | The trigger is a real `button` with `aria-expanded`; chevron rotation respects `prefers-reduced-motion`. |

**One constraint worth knowing.** In icon-collapsed mode, `SidebarGroupLabel` is already styled `group-data-[collapsible=icon]:opacity-0` and `-mt-8` (`ui/sidebar.tsx:406`) — group titles are invisible there by design. So collapsible groups must be **disabled in icon mode**, or a collapsed group becomes permanently unreachable with no header to click. The two collapse mechanisms are complementary: icon mode compresses everything horizontally, group collapse compresses vertically.

**Why this matters more after decision 8.** Putting Project Settings under Projects keeps it as a row rather than folding it into Administration, so admins land at **15 rows**. Group collapse is what makes 15 comfortable — an admin who rarely touches Assets collapses ADMIN and stops seeing it.

> **Gate:** every sidebar label appears verbatim as the H1 of the page it opens. Sign out works from the dropdown. No glyph appears twice. Collapsed groups survive a reload. Icon mode still shows every item.

---

## Phase 2 — Project page: 11 tabs → 5

Detailed in [`project-page-tabs/PLAN.md`](project-page-tabs/PLAN.md). Independent of everything else.

| New tab | Absorbs |
|---|---|
| **Tasks** | unchanged, stays default |
| **Daily** | Flags · Updates · **EOD** — merged per decision 7, under one shared date control |
| **Checklists** | unchanged |
| **Files & Discussion** | Documents + Discussions |
| **Overview** | Overview + Client + Team + Timeline |

The grouping follows what the code already shows: Overview already summarises Checklists, Client and Team — its "Manage" link literally navigates to another tab; `ClientContactsPanel` is entirely read-only; `MemberManagerPanel` is exported from `MemberManagerDialog.tsx`; Updates and EOD already share `selectedDate`.

**The part that will bite if missed:** the route validates `?tab=` with a **zod enum of all eleven values**, and `z.enum` throws on unknown input. Narrow it to five and every bookmarked `?tab=documents` link — including notification `actionUrl`s — starts erroring. Keep accepting all eleven and map the six retired values through a pure `resolveTab()`, written and tested **first**.

> **Gate:** all eleven legacy URLs resolve correctly. No horizontal scroll at 1280px.

---

## Phase 3 — Referral portal

Detailed in [`referral-portal/PLAN.md`](referral-portal/PLAN.md). **3 tables** — `job_requisitions`, `referral_role_bands`, `referrals`. The timeline reads from the existing `audit_logs`; no `referral_events` table.

| | What | Gate |
|---|---|---|
| 3a | Schema + migration, with hand-added D1 triggers making `submitted_at` and `referral_code` immutable | A manual `UPDATE` on `submitted_at` is rejected by the database |
| 3b | Pure logic — `referral-eligibility.ts`, `referral-policy.ts`, test-first | Every rule and precedence pair has a passing test |
| 3c | Employee side — submit, my referrals, résumé download | Consent-unticked submission rejected **server-side with the client check bypassed**; a second employee cannot read the first's referral by id |
| 3d | HR side — queue with four derived tabs, screening, pipeline, retention, payout | Verdict visible and clearly advisory; HR can override both ways; every void has a stored reason |

**Nav:** `Referrals` row added to My Workplace; `HR Console` row added with Referrals and Requisitions tabs.

**Amendment:** requisition CRUD moves to `hrMiddleware` — requisitions are HR's daily work. Role bands stay `adminMiddleware`; that's money. Otherwise HR needs an admin account to do their job.

**Per decision 2:** no `finance` role. The payout view is a tab in HR Console, admin-gated.

---

## Phase 4 — Shared infrastructure + universal search

**Two things, both infrastructure-shaped.**

### 4a. Extract the duplicated helpers

Placed here deliberately: each has exactly two real callers now, which is when an abstraction can be designed from evidence rather than guessed at. Do it before Policies writes a third copy.

| Extract | Currently duplicated in |
|---|---|
| `lib/r2-documents.server.ts` — upload, checksum, sanitise, gated download | project documents · assets · résumés → will be training certificates and policy files |
| `lib/sequential-code.server.ts` — `max+1` with retry-on-unique | `getNextTaskNumber` · `generateNextProjectCode` · `REF-nnnn` → will be `POL-nnnn` |
| The derived-obligations helper — *"query what's overdue, show it as a filtered tab and a dashboard count"* | referral expiry · retention due → will be certificate expiry, acknowledgement due, plan review due |

### 4b. Universal search (⌘K) 🆕

**You were right to ask where this went.** It was phase 8f — dead last. That was wrong for two reasons: the app is about to grow from 12 to 15 sidebar rows, and the pages people most often want are the ones *not* in the nav at all — a specific employee, a specific project, a specific asset. Reaching an employee today is Administration → Employees tab → scan the table.

Moving it here, rather than to phase 1, because it's a **registry**: each portal contributes its own searchable entries as it ships. Built last, it would need retrofitting into all three.

**Design**

| Aspect | Decision |
|---|---|
| Trigger | ⌘K / Ctrl+K, plus a search affordance in the mobile header from 1a |
| Sources at launch | Nav destinations · projects · tasks · employees · assets |
| Extended by | Referrals (3) · policies (5) · skills and courses (6) — each portal registers its own provider |
| Scoping | **Results are permission-scoped server-side.** A `user` searching must never see an asset record or another employee's referral. Same rule as every other server function — the palette calls a guarded search endpoint, it does not filter client-side. |
| Relationship to ⌘J | ⌘K navigates, ⌘J converses. Adjacent keys, different jobs — worth confirming both feel distinct in use. |

**Cost note:** this is the largest single item in phase 4 and the only genuinely new feature in it. If phase 4 needs to stay small, 4b can split into its own phase between 4 and 5 — but not back to the end.

> **Gate:** existing tests pass unchanged after 4a. Search returns nothing a `user` isn't permitted to see, verified by calling the endpoint directly as a non-admin.

---

## Phase 5 — Company Policies

Library plus acknowledgement tracking. Ahead of Capability because it's smaller, every employee touches it, and it proves the acknowledgement-plus-dashboard machinery Capability will lean on.

**2 tables**

```
policies                 code(POL-nnnn) · title · category · version
                         · status(draft|published|superseded) · r2Key
                         · effectiveDate · supersedesPolicyId
                         · acknowledgementRequired · acknowledgementDueDate

policy_acknowledgements  policyId · userId · acknowledgedAt · policyVersion
                         UNIQUE (policyId, userId, policyVersion)
```

**`policyVersion` lives on the acknowledgement**, so acknowledging v2 doesn't silently mark you compliant on v3 — without it, republishing marks all 62 people compliant. The UNIQUE constraint makes acknowledgement idempotent against a double-click.

**Screens:** `/policies` grouped by category, anything needing acknowledgement pinned at the top. HR Console → Policies for upload, publish, supersede, plus the compliance view that **names** who hasn't acknowledged, so HR can chase individuals rather than emailing everyone again.

**Also here:** the Dashboard **Needs your attention** card, consolidating obligations from all portals, hidden when empty. This is what lets every portal ship without email reminders.

---

## Phase 6 — Capability Development

**Four modules, per your decisions.** Roughly ten tables — this is four products sharing a sidebar row. *My Development* launches with only the tabs that exist, never with "coming soon".

| | Module | Tables |
|---|---|---|
| 6a | **Skills matrix + growth plans** — the core | `skills`, `user_skills`, `growth_plans`, `growth_plan_goals` |
| 6b | **Certifications + expiry** — smallest, reuses 4a's obligations helper | `certifications` |
| 6c | **Training catalogue + enrolment** — **HR approves directly** per decision 4 | `training_courses`, `training_enrolments` |
| 6d | **Performance cycles** — **merged in** per decision 3, as a tab in My Development | `review_cycles`, `cycle_participants`, `cycle_goals` |

**Skill levels are named bands** per decision 5. The vocabulary needs agreeing before 6a starts — it's a fixed enum in the schema and changing it later means a migration plus re-rating everyone. Common shape: *Aware → Working → Practitioner → Expert → Coach*. Four or five bands; more than five and raters stop distinguishing them.

**On 6d, once, for the record.** Merging performance cycles means the page where someone browses a training course also holds their rating. Ratings feed compensation and exit decisions; skills and training don't. That may change how candidly people use the development half. Your call is taken and it's built as a tab — but consider whether the *rating* portion needs to be visible only during an open cycle rather than permanently.

---

## Phase 7 — Consolidation and polish

| # | Item |
|---|---|
| 7a | Admin Stats becomes a tab in Administration, with a redirect stub matching the four already in the repo. Project Settings **stays a row under Projects** per decision 8. |
| 7b | Dashboard density pass — six-plus panels with actions (Quick Log) and ambient info (Birthdays) at equal weight. |
| 7c | Review the four task view modes. Gantt and Calendar largely answer the same question and both need maintaining — the blank-row bug was Gantt-only. |
| 7d | Does `Organization` still deserve a row? Static chart, viewed roughly once. Group collapse from 1e may make this moot. |
| 7e | File-length debt: `assets.ts` 1532 · `DeploymentsAndAssignmentsView.tsx` 1468 · `projects.ts` 1339 · `AssetCatalogTable.tsx` 851 — all well over the 300-line rule in `CLAUDE.md`. `assets.ts` is where the authorization hole hid through an entire review. |

---

## The sidebar, end state

```
                                     user  lead   hr  admin
  Dashboard                            ✓     ✓     ✓     ✓
  Brainee.org Brain                            ✓     ✓     ✓     ✓
PROJECTS                         ▾
  Projects                             ✓     ✓     ✓     ✓
  My Tasks                             ✓     ✓     ✓     ✓
  Project Settings                                       ✓
PEOPLE                           ▾
  My Attendance                        ✓     ✓     ✓     ✓
  Team Calendar                        ✓     ✓     ✓     ✓
  Organization                         ✓     ✓     ✓     ✓
  Approvals              ⁴                   ✓           ✓
MY WORKPLACE                     ▾
  Referrals                            ✓     ✓     ✓     ✓
  My Development                       ✓     ✓     ✓     ✓
  Policies               ⁴             ✓     ✓     ✓     ✓
HR                               ▾
  HR Console                                       ✓     ✓
ADMIN                            ▾
  Assets                                                 ✓
  Administration                                         ✓
                                     ────  ────  ────  ────
                                       11    12    12    15
```

Admin sits at 15 rather than 12, because Project Settings stays a row per decision 8. **Group collapse (1e) is what makes that comfortable** — and ⌘K (4b) means nobody has to hunt the list anyway.

**HR Console is one row, four tabs** — Referrals · Requisitions · Capability · Policies. The rule: *employee-facing things are rows; administration is a console.*

---

## Remaining open items

Only two, both small and neither blocking.

| # | Item | Needed by |
|---|---|---|
| 1 | **Skill band vocabulary** — the exact names, four or five of them. Fixed enum; changing it later means a migration plus re-rating everyone. | Phase 6a |
| 2 | **Category list for policies** — Leave & Attendance, Hiring, Code of Conduct, Security, …? Cheap to change, but the list shapes the employee-facing page. | Phase 5 |

---

## Suggested order of attack

**This week:** W1 (regression) → 1a (mobile navigation is unreachable, ~15 lines) → 1d (the hour of cheap fixes).

**Then:** 1b, 1c and 1e to unblock everything else. Phase 2 can run in parallel — it touches no shared files.

**Then:** phase 3, the referral portal.

Phases 4–7 are sequenced but not urgent, and 6–7 will benefit from seeing how 3 and 5 land.
