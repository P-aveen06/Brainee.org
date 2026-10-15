# Three Portals: Placement, Contents, and Sequence

**Portals:** Employee Referral · Capability Development · Company Policies
**Decisions taken:** HR administers all three · Policies includes acknowledgement tracking · Capability covers all four modules · three employee-facing sidebar rows in one group

---

## 0. Your objection was right

I had put **Referrals** as the second row of the top group, above Projects. That was wrong, and my reasoning was wrong too.

The rule I applied — *one item doesn't justify a group* — holds when there's one item **forever**. That's the case with the current Management group, which has held exactly one link (Approvals) for its whole life. But Referrals isn't a lone item; it's the first of three you've already committed to. So the group should exist from day one, and the other two join it as they land.

Nothing employee-facing sits above Projects. The new group goes **below** the work items, because referring a candidate, reviewing your development plan, and reading a policy are all things you do occasionally — not the reason you open the app.

---

## 1. The sidebar, final

```
[Brainee.org]                                    ← logo · collapse toggle

  Dashboard
  Brainee.org Brain

PROJECTS
  Projects
  My Tasks

PEOPLE
  My Attendance
  Team Calendar
  Organization
  Approvals              ⁴                     ← moved · lead, admin

MY WORKPLACE                                   ← NEW · all roles
  Referrals
  My Development
  Policies               ⁴                     ← badge = outstanding acknowledgements

HR                                             ← NEW · hr, admin
  HR Console

ADMIN                                          ← admin
  Assets
  Administration

──────────────────────────
  Notifications
  Theme
  [Avatar] Charan  ▸                           ← dropdown: Profile · Sign out
```

| Role | Now | Final |
|---|---|---|
| user | 7 | **10** |
| lead | 8 | **11** |
| hr | — | **11** |
| admin | 12 | **14** |

### One change from what you saw in the questions

The ownership option you picked showed **four separate HR rows** — Referral Queue, Requisitions, Capability Admin, Policy Admin. I'd make that **one row: HR Console**, with four tabs inside.

Reasoning: four rows would put admins at 17 sidebar items, and it repeats exactly the problem I flagged in the Administration group — some settings are tabs in a console, others are their own rows, with no rule telling you which. A single HR Console with tabs *is* the rule: **employee-facing things are rows; administration is a console.**

```
HR Console  ·  Referrals | Requisitions | Capability | Policies
```

Cost: HR clicks one extra time to switch between administering referrals and administering policies. Worth it for a consistent model and three fewer rows. **Say the word if you'd rather have the four rows** — it's a one-line change either way, and it's your call, not a technical constraint.

### Badges

Two rows carry counts, and both are load-bearing rather than decorative:

- **Policies** — number of policies awaiting *your* acknowledgement. This is how acknowledgement compliance actually gets driven; an email people ignore is not.
- **Approvals** — unchanged.

`My Development` deliberately has no badge. Once goals, plans, training requests and certificate expiries all count, the number becomes noise. Those obligations surface on the Dashboard instead (§5).

---

## 2. Portal 1 — Referrals

Fully specified in [`docs/referral-portal/PLAN.md`](../referral-portal/PLAN.md). Only the placement changes:

| Screen | Route | Where |
|---|---|---|
| My referrals | `/referrals` | **My Workplace** row |
| Submit | `/referrals/new` | CTA on the above |
| HR queue | `/hr/referrals` | HR Console → Referrals tab |
| Requisitions | `/hr/requisitions` | HR Console → Requisitions tab |

3 tables · 5 routes · 2 pure logic modules. Unchanged otherwise.

---

## 3. Portal 2 — Capability Development

You selected all four modules. **I need to flag the size before anything else:** this is not one portal, it's four products sharing a sidebar row. Roughly **ten tables** against the referral portal's three, and module D is a performance-management system.

That is your call to make and I'm planning all four as asked — but I'd strongly recommend shipping them in the order below rather than together, because a half-built capability portal with four empty sections is worse than one section that works.

### What goes in it

#### Module A — Skills matrix + growth plans *(the core)*

The thing that makes this a "capability development" portal rather than a training log.

```
skills                    id · name · category · description · isActive
user_skills               userId · skillId · selfLevel 1-5 · leadLevel 1-5
                          · assessedAt · assessedById
growth_plans              id · userId · periodLabel · status(draft|active|closed)
                          · leadId · createdAt · closedAt
growth_plan_goals         id · planId · title · description · skillId?
                          · targetDate · status(open|done|dropped) · reviewNotes
```

| Screen | Who |
|---|---|
| **My Development** → *Skills* — self-rate, see lead's rating beside yours | employee |
| **My Development** → *Plan* — goals, target dates, progress | employee |
| Team skills + plans awaiting my review | lead |
| HR Console → Capability → all plans, skill gaps by team | hr |

Leads rate and review their own reports only — reuse the existing `peerLeadId` scoping that `approverMiddleware` call sites already use.

#### Module B — Training catalogue + enrolment

```
training_courses          id · code · title · provider · format · durationHours
                          · costMinor · currency · isActive
training_enrolments       id · courseId · userId
                          · status(requested|approved|rejected|enrolled|completed|cancelled)
                          · requestedAt · decidedById · decidedAt · completedAt
                          · certificateR2Key · notes
```

Employee browses, requests; HR approves (there's cost involved, so it's not a lead decision); completion recorded with an optional certificate upload.

**Open question:** should a lead endorse a request before HR sees it? Two-step approval is more work and the leave-approval flow already exists as a pattern if you want it. Default in this plan: HR approves directly.

#### Module C — Certifications + expiry *(smallest, quickest)*

```
certifications            id · userId · name · issuer · issuedDate · expiryDate
                          · evidenceR2Key · fileName · verifiedById · verifiedAt
```

Structurally identical to the **Accounts & Renewals** tab you already have in Assets — same expiry-scan shape, same derived-tab pattern as referral expiry. Cheapest module to build because the pattern is already in the codebase twice.

#### Module D — Goals / performance cycles *(heaviest)*

```
review_cycles             id · name · periodStart · periodEnd
                          · status(draft|open|mid_review|final|closed)
cycle_participants        id · cycleId · userId · leadId · status
                          · selfSubmittedAt · leadSubmittedAt · finalRating
                          · hrCalibrationNotes
cycle_goals               id · participantId · title · weight · targetOutcome
                          · selfRating · leadRating · comments
```

**My honest read:** this is a performance-management system, not a capability one. Performance ratings feed compensation and exit decisions; skills and training don't. Folding them into one portal means the page an employee visits to browse a training course is also the page that holds their rating — which changes how safely people use the development half.

I'd build it, but as its own portal with its own sidebar row, and last. Flagging once; planned below either way.

### Recommended order within the portal

| Order | Module | Why here |
|---|---|---|
| 1 | **A — Skills + plans** | The actual point of the portal. Without it the row is a training list. |
| 2 | **C — Certifications** | Smallest, and the expiry pattern already exists twice in the codebase. |
| 3 | **B — Training** | Needs the budget and approval-route decisions above. |
| 4 | **D — Performance cycles** | Heaviest, most sensitive, and arguably separate. |

**My Development** ships with only the tabs that exist. It does not ship with four tabs where three say "coming soon."

---

## 4. Portal 3 — Company Policies

Library plus acknowledgement tracking. The simplest of the three to build and the one with the clearest payoff — it's the only reason a portal beats a shared drive.

### Data

```
policies                  id · code(POL-0001) · title · category · description
                          · ownerDepartment · version
                          · status(draft|published|superseded)
                          · r2Key · fileName · mimeType · sizeBytes
                          · effectiveDate · publishedAt · publishedById
                          · supersedesPolicyId
                          · acknowledgementRequired bool
                          · acknowledgementDueDate

policy_acknowledgements   id · policyId · userId · acknowledgedAt · policyVersion
                          UNIQUE (policyId, userId, policyVersion)
```

Two details that matter:

- **`policyVersion` is on the acknowledgement, not just the policy.** Acknowledging v2 must not count as acknowledging v3. Without this column, republishing a policy silently marks everyone compliant.
- **The UNIQUE constraint** makes acknowledgement idempotent — a double-click cannot create two rows.

### Screens

**`/policies` — employee.** Grouped by category, current versions only. Anything requiring your acknowledgement is pinned to the top with a due date and an **I have read this** button. Superseded versions are hidden; version history is available on the detail view for anyone who wants it.

```
⚠ ACTION REQUIRED
  Code of Conduct v2       Acknowledge by 30 Sep        [ I have read this ]

LEAVE & ATTENDANCE
  Leave Policy v3          ✓ You acknowledged 12 Aug
  WFH Policy v2            ✓ You acknowledged 4 Jul

HIRING
  Referral Policy v2       —
```

**HR Console → Policies.** Upload, publish, supersede, set an acknowledgement requirement and due date. Plus the compliance view, which is the whole point:

```
Code of Conduct v2        47 / 62 acknowledged     [ View 15 outstanding ]
```

The outstanding list names people, so HR can chase individuals rather than emailing everyone again.

### Deliberately not built

Draft → review → approve workflow. You picked the acknowledgement option, not the approval-workflow one. `status` still has a `draft` value so a policy can be staged before publishing, but there is no multi-party sign-off. If that's needed later it's an additive change.

---

## 5. Dashboard: where obligations surface

Three portals generate personal obligations, and the sidebar can only carry so many badges. One consolidated card on the Dashboard:

```
┌─ Needs your attention ──────────────────────┐
│  Acknowledge Code of Conduct v2   by 30 Sep │
│  2 development goals due this month         │
│  AWS certification expires in 21 days       │
└─────────────────────────────────────────────┘
```

This is the right home for it: the Dashboard is already where a user starts, and the card is empty (and hidden) when nothing is outstanding — so it earns its space only when it has something to say.

It also means none of the three portals needs email reminders to function, which is the same reasoning that let the referral portal ship without cron.

**Caveat:** the Dashboard is already the densest page in the app — six-plus panels. This card should go **near the top and replace nothing**, but it's one more reason to do the dashboard-density pass in the navigation review.

---

## 6. Shared infrastructure

With three portals confirmed, four things are worth building once. Two of them are already at their third copy.

| # | Thing | Why now |
|---|---|---|
| 1 | **The `hr` role** | One role, four HR Console tabs. Built in the referral phase; the other two portals add tabs, not roles. |
| 2 | **`src/lib/r2-documents.server.ts`** | Upload + checksum + sanitise + gated download already exists twice (project docs, assets). Résumés make three; training certificates four; policy files five. Extract it taking a bucket binding, a key prefix, an allowed-MIME set and a size cap. |
| 3 | **Sequential code allocation** | `REF-nnnn`, `REQ-nnnn`, `POL-nnnn` — same `max+1` with retry-on-unique as `getNextTaskNumber`. Extract from the referral build into `src/lib/sequential-code.server.ts`. |
| 4 | **The derived-obligations pattern** | Referral expiry, retention due, certificate expiry, policy acknowledgement due, growth-plan review due — five instances of *"query what's overdue, show it as a filtered tab and a dashboard count."* Worth a small shared helper rather than five hand-rolled versions. |

**And one thing not to build:** a shared `portal_items` table or a generic "portal" abstraction. The three domains have nothing in common at the data layer — a referral, a skill rating and a policy document share no fields worth unifying. Shared plumbing pays off; a shared schema would cost more than the duplication saves.

---

## 7. Sequence across all three

Ordered so each phase ships something usable and the shared pieces get extracted at the moment they'd otherwise be duplicated.

| Phase | What | Ships |
|---|---|---|
| **1** | `hr` role · nav restructure · **P0 mobile-nav fix** · P1 label and sign-out fixes | Nothing user-visible from the portals, but the mobile app becomes navigable |
| **2** | **Referrals**, complete | Employees can refer; HR can screen, track and pay out |
| **3** | Extract `r2-documents` + `sequential-code` + the obligations helper | No new features — refactor while there are exactly two callers of each |
| **4** | **Policies** (library + acknowledgement) + the Dashboard obligations card | Highest value per unit of work of the three |
| **5** | **Capability A** — skills + growth plans | *My Development* becomes real |
| **6** | **Capability C** — certifications | Reuses the phase-3 obligations helper |
| **7** | **Capability B** — training catalogue | After the approval-route question is settled |
| **8** | **Performance cycles** — as its own portal, own row, own decision | Separate product |

Why Policies before Capability: it's about **three tables** against Capability Module A's four plus a lead-review flow, and every employee touches it. It's also the best test of the acknowledgement-plus-dashboard pattern before Capability leans on the same machinery.

Why phase 3 sits in the middle: at that point each shared helper has exactly two real callers, which is when an abstraction can be designed from evidence instead of guessed at.

---

## 8. Questions still open

Ranked by how much they'd change the work. None of them block phases 1–4.

1. **Should performance cycles be part of Capability Development at all?** My read is no — ratings feed compensation, and mixing them with a training browser changes how safely people use the development half. Planned as a separate portal in phase 8; tell me if you want it merged.
2. **Training approval: HR only, or lead-endorses-then-HR?** Default in this plan is HR only. The two-step version exists already in the leave-approval flow if you want it.
3. **Four HR rows or one HR Console?** §1. I recommend the console; it's a one-line change either way.
4. **Skill levels: 1–5 numeric, or named bands** (Novice / Practitioner / Expert)? Named bands are usually better received but need a fixed vocabulary agreed up front.
5. **Does `Organization` still deserve a sidebar row?** It's a static reporting chart most people view once, and it now sits alongside nine other rows. Not urgent; worth revisiting when the sidebar is next open.
