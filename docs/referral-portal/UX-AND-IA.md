# Referral UX Placement + Information Architecture Review

**Two things in one document:** where the referral screens belong in the existing app, and what the existing navigation gets wrong — because putting four new screens into an IA that already has problems is how the problems compound.

Everything below is read from the current code, not assumed. File and line references throughout.

---

## Part 1 — Current information architecture

### Navigation as it stands (`src/lib/navigation.ts`)

| Group | Items | Visible to |
|---|---|---|
| **Workspace** | Dashboard `/` · Brainee.org Brain `/assistant` | all |
| **Projects & Delivery** | Projects `/projects` · My Tasks `/my-tasks` | all |
| **Schedule & People** | My Attendance `/calendar` · Team Calendar `/team-calendar` · Organization `/organization` | all |
| **Management** | Approvals `/approvals` | lead, admin |
| **Administration** | Assets & Devices `/admin/assets` · Project Settings `/admin/projects` · Admin Stats `/admin/stats` · Admin Console `/admin` | admin |

Item counts by role: **user 7 items / 3 groups · lead 8 / 4 · admin 12 / 5.**

### Second-level structure

| Page | Second level | Count |
|---|---|---|
| Project detail `/projects/$id` | Tasks · Overview · Updates · EOD · Flags · Checklists · Documents · Discussions · Team · Client · Timeline | **11 tabs** |
| ↳ inside Tasks | list · board · gantt · calendar | 4 view pills |
| Admin Console `/admin` | Employees · Holidays · Leave Config · Work From Home · Audit | 5 tabs |
| Assets `/admin/assets` | Inventory Catalog · Deployments & Assignments · Accounts & Renewals | 3 tabs |
| My Attendance `/calendar` | Calendar · Requests | 2 tabs |
| My Tasks `/my-tasks` | status filter tabs + project filter + search | — |
| Dashboard `/` | KPI cards → daily update → 3-card row → 2-card row | 4 regions, 6+ panels |

There are also **four redirect-only routes** — `admin.audit`, `admin.employees.index`, `admin.holidays`, `admin.settings` — that exist purely to forward legacy URLs to `/admin?tab=…`. Harmless, but it means the route list is larger than the actual IA.

---

## Part 2 — Where the referral screens go

### The four screens, and what kind of thing each one is

| Spec screen | Kind | Deserves a nav entry? |
|---|---|---|
| 1 · Submit a referral | An **action** | No — a CTA on screen 4 |
| 4 · My referrals | A **place** the employee returns to | **Yes** |
| 2 · HR screening queue | A **place** HR works in daily | **Yes** |
| 3 · Pipeline & outcome | A **drill-down** from the queue | No — it's `/hr/referrals/$id` |

Four screens, **two** nav entries. This is the single most important decision in the whole placement, and it's the one the app currently gets wrong elsewhere: `/admin/stats` and `/admin/projects` are both nav entries for things that are sections of something else.

### Placement

```
Workspace
  Dashboard              /
  Brainee.org Brain              /assistant
  Referrals              /referrals            ← NEW · all roles

HR                                              ← NEW GROUP · hr + admin
  Referral Queue         /hr/referrals
  Requisitions           /hr/requisitions
```

**Why `Referrals` goes in Workspace and not a new group.** Referring someone is employee self-service — the same category as the dashboard and the assistant. More importantly, a brand-new group holding exactly one item is the exact smell I'm flagging in the Management group below. When Capability Development and Company Policies arrive, the three of them together earn a group — call it **People & Growth** — and Referrals moves there. One item does not.

**Why HR gets its own group immediately.** It's a new role with a new surface, and it will hold at least two items on day one. It's also the group the other two portals' admin sides will land in.

### Route naming

| Route | Screen | Guard |
|---|---|---|
| `/referrals` | My referrals (screen 4) + "Refer someone" CTA | any authenticated |
| `/referrals/new` | Submit form (screen 1) | any authenticated |
| `/hr/referrals` | Screening queue (screen 2) | hr, admin |
| `/hr/referrals/$id` | Detail — screening + pipeline (screens 2 and 3) | hr, admin |
| `/hr/requisitions` | Requisitions + role bands | hr (requisitions), admin (bands) |

The `/hr/` prefix mirrors the existing `/admin/` convention, so the URL says who a page is for. Worth doing now rather than after the other portals add more HR-facing pages.

### One refinement to the build plan

`PLAN.md` §4 puts requisition CRUD behind `adminMiddleware`. On reflection that's wrong for how the work actually splits: **requisitions are HR's job** (they open and close roles daily), while **bonus bands are money** and belong to admin. So:

- `/hr/requisitions` — requisition CRUD under `hrMiddleware`
- Role bands + amounts — a tab in the Admin Console under `adminMiddleware`

This also avoids HR needing an admin account to do their normal work, which would quietly defeat the point of adding the role.

### Screen-level UX rules

**`/referrals` — My referrals.** A single table: candidate, role, submitted, expires, status. Primary CTA top-right, ink-black per the design system: **Refer a candidate**. Empty state does the explaining — what the programme is, the 180-day window, and the same CTA. No tabs; one person's referral list will not need filtering for years.

**`/referrals/new` — Submit.** A full page, not a dialog. Eleven fields including a file upload and a consent gate is too much for a modal, and a page gives the confirmation state (referral code + expiry date, per spec §2) somewhere to live. Single column, ~640px, grouped as *Candidate → Role → Declarations → Consent*. Consent checkbox sits immediately above the submit button, not buried mid-form.

**`/hr/referrals` — Queue.** Four filter tabs — Needs screening · Expiring soon · Retention due · All — with count badges on the first three. This is the cron replacement from `PLAN.md` D3, and it's also just better queue design: the two time-based obligations are visible every time HR opens the page rather than depending on an email being noticed.

**`/hr/referrals/$id` — Detail.** Four stacked panels on one scrolling page, **no tabs**: Candidate & résumé → Eligibility verdict → Screening decision → Pipeline & outcome. Plus the audit timeline. Tabs here would hide the verdict from the person making the decision, which is precisely the wrong thing to hide.

---

## Part 3 — What needs improvement in the current app

Ranked by how much they cost a user day to day.

### 1. Project detail has eleven tabs 🔴

`src/components/projects/ProjectHeaderSection.tsx:28` — Tasks, Overview, Updates, EOD, Flags, Checklists, Documents, Discussions, Team, Client, Timeline.

`PageTabs` (`src/components/ui/page-tabs.tsx`) wraps them in `overflow-x-auto` with `whitespace-nowrap`. So they don't break the layout — they become a **horizontal scroller with no affordance**: no fade edge, no arrows, no indication that more tabs exist. At roughly 105px per tab with icons, eleven tabs need ~1,150px; with the sidebar expanded that overflows on any typical laptop. The last two or three tabs — Team, Client, Timeline — are effectively undiscoverable unless you happen to scroll a tab strip.

They also aren't eleven distinct concerns. They're about five:

| Proposed tab | Absorbs | Rationale |
|---|---|---|
| **Tasks** | Tasks | Default. Keeps its 4 view pills. |
| **Plan** | Checklists, Timeline | Stage gates and schedule are the same question: are we on track? |
| **Daily** | Updates, EOD, Flags | One standup rhythm, currently split across three tabs. Flag count as a badge. |
| **Files & Discussion** | Documents, Discussions | Both are "things people said and attached". |
| **Team & Client** | Team, Client, Overview meta | All the people and the commercial context. |

Five tabs fit comfortably at any width. Inside a merged tab, use section headings or a secondary pill row — **not** another tab layer.

I'd treat the exact grouping as yours to decide. The principle is what matters: **group by activity, not by entity**, and cap top-level tabs at six.

### 2. The Tasks view has four view modes, two of which overlap 🟠

`VIEW_PILLS` offers list · board · gantt · calendar. Gantt is a date-scaled timeline; Calendar is a month grid of the same dated tasks. They answer nearly the same question, and maintaining both means every task-rendering bug gets fixed twice — the blank-row bug we just fixed was in Gantt only.

Worth checking usage before cutting. If Calendar view is rarely used, dropping it removes a whole component and a rendering surface.

### 3. The admin surface uses two different mental models 🟠

Four nav entries under Administration, but one of them (`/admin`) is itself a five-tab console. So an admin looking for a setting has to remember whether it's a *tab in the console* or a *page in the sidebar*, with no rule distinguishing them:

- **Admin Console** `/admin` → Employees, Holidays, Leave Config, WFH, Audit
- **Admin Stats** `/admin/stats` → a page
- **Project Settings** `/admin/projects` → a page
- **Assets & Devices** `/admin/assets` → a page that has its own 3 tabs

Suggested: two entries, not four. **Administration** (the console, absorbing Stats as a tab) and **Assets** (a genuine domain with its own three tabs). *Project Settings* becomes a settings affordance inside the Projects area, where the person configuring projects already is — not a sidebar destination.

That takes admins from 12 nav items to 10, and removes the "which model is this?" pause.

### 4. Icon collisions 🟠

Icons are recognition shortcuts; duplicates cancel that out.

- `LayoutDashboard` is used for **both** Dashboard `/` and Admin Stats `/admin/stats` (`navigation.ts:43` and `:129`). Two sidebar rows with the same glyph.
- `CheckSquare` is used for the **Approvals** nav item, the **Tasks** tab, and the **Checklists** tab — three different things, one icon.

### 5. Label and route disagree, twice 🟡

- Nav says **"My Attendance"**, route is `/calendar`, and the page's own first tab is labelled **"Calendar"**.
- Its sibling is **"Team Calendar"** at `/team-calendar`.

So the same concept is "attendance" in one place and "calendar" in the other. Pick one word. If they're a pair, they should read as a pair: *My Attendance* / *Team Attendance*, or *My Calendar* / *Team Calendar*.

### 6. Inconsistent naming patterns 🟡

"Assets & Devices" (devices *are* assets — the "&" adds nothing), "Admin Console", "Admin Stats", "Project Settings", "Brainee.org Brain". Some names are places, some are tools, two are prefixed with their own section name, one is a product name. A sidebar reads better when every entry is the same kind of noun.

### 7. The Management group holds exactly one item 🟡

A group header, its spacing, and its visual weight for a single link (Approvals). Either fold Approvals into *Schedule & People* — it's approving leave and WFH, which is what that group is about — or drop the group chrome for single-item groups.

This is the same rule that keeps a new one-item group from being created for Referrals.

### 8. The dashboard is the densest page in the app 🟡

`_authenticated.index.tsx` renders KPI cards → daily update section → a 3-card row (Quick Log, Team Availability, Upcoming Leaves) → a 2-card row (Recent Requests, Birthdays). Six-plus panels on the first screen a user sees every morning.

Nothing here is *wrong* — it's worth asking which of those six a person actually acts on. Quick Log and the daily update are actions; Birthdays is ambient. They currently get comparable visual weight.

### 9. Two entry points to the assistant 🟢

A **Brainee.org Brain** nav item and a global ⌘J floating drawer, with the drawer hiding itself on `/assistant`. That's coherent, and both have a reason to exist. Worth noting only because the drawer's thread still doesn't survive a page reload — a user who reloads sees an empty drawer over a live conversation, which reads as the two entry points disagreeing.

---

## Part 4 — Over-complicated or overcrowded, specifically

You asked for this list directly. Ordered by how much a user feels it.

1. **Eleven tabs on the project page**, three of which are off-screen behind a scroller with no affordance. This is the one to fix.
2. **Four ways to view the same task list**, two of which (gantt, calendar) largely overlap.
3. **Four admin nav entries** for what is conceptually two areas, with no rule for which settings live where.
4. **Two calendars named inconsistently**, one of which calls itself two different things.
5. **Six-plus panels on the dashboard**, with actions and ambient information at the same weight.
6. **A nav group containing one link.**
7. **Three tab layers stacked in one place**: `/admin/assets` is a nav item → three tabs → and Deployments is a 1,468-line view with its own internal sections. Depth without signposting.

None of these are broken. They're the accumulation of features landing one at a time without a pass over the whole — which is normal, and is exactly the moment before three new portals get added.

---

## Part 5 — The plan

Deliberately split so the referral work isn't blocked on an IA cleanup, and the cleanup isn't rushed to fit the referral timeline.

### Track A — Ships with the referral portal

These are additive and carry no risk to existing screens.

| # | Change | Files |
|---|---|---|
| A1 | Add `"hr"` to `allowedRoles` on every nav item HR should see | `navigation.ts` |
| A2 | Add **Referrals** `/referrals` to the Workspace group, all roles | `navigation.ts` |
| A3 | Add the **HR** group with Referral Queue + Requisitions, `["hr","admin"]` | `navigation.ts` |
| A4 | Pick two unused icons for the new items — **not** `CheckSquare` or `LayoutDashboard` | `navigation.ts` |
| A5 | Build the five referral routes per Part 2, two nav entries only | `src/routes/` |
| A6 | Move requisition CRUD to `hrMiddleware`; role bands stay admin | `PLAN.md` §4 amendment |

**Verify:** an `hr` user sees Workspace, Projects, Schedule & People, and HR — and does *not* see Administration. A `user` sees Referrals and not the HR group.

### Track B — The IA pass, separately

Sequenced cheapest-first so early items ship even if the track stalls.

| # | Change | Effort | Risk |
|---|---|---|---|
| B1 | Fix the two icon collisions | minutes | none |
| B2 | Settle calendar naming — *My Attendance* / *Team Attendance*, or both "Calendar" | minutes | none |
| B3 | Rename "Assets & Devices" → **Assets**; normalise the other labels | minutes | none |
| B4 | Fold Approvals into *Schedule & People*, drop the Management group | small | low |
| B5 | Add a scroll affordance to `PageTabs` — fade edge or arrows | small | none |
| B6 | Absorb Admin Stats into the console as a tab; move Project Settings into the Projects area | medium | low — the redirect-stub pattern already in the repo handles old URLs |
| B7 | **Regroup project tabs from 11 to 5** | largest | medium — touches `ProjectHeaderSection`, `ProjectTabsContent`, and the `?tab=` search param |
| B8 | Review the 4 task view modes; drop Calendar if usage doesn't justify it | medium | low |
| B9 | Rank the dashboard panels by whether they're actionable; demote the ambient ones | medium | low |

**B5 before B7.** The scroll affordance is a few lines and makes the current eleven tabs usable immediately; the regroup can then be done properly rather than urgently.

**B7 needs URL care.** `?tab=documents` links exist in people's bookmarks and notifications. Merged tabs need the old values mapped to the new ones in the route's search parsing — the same trick the four `admin.*` redirect stubs already use.

### What I'd do first

**B1, B2, B3 in one sitting** — under an hour, entirely cosmetic, and they remove three of the seven complaints in Part 4.

Then Track A alongside the referral build.

Then **B7** as its own focused change with the project page's users in the room, because eleven-to-five is a judgment call about how that team actually works, and I'd rather they made it than I did.

### Explicitly not proposed

- No redesign of the design system — it's coherent and documented in `CLAUDE.md`.
- No change to the `/admin/` URL structure beyond B6.
- No new abstractions for the two future portals. When Capability Development and Company Policies have specs, Referrals moves out of Workspace and the three form a **People & Growth** group. Until then, one item does not justify a group — the same rule that makes the current Management group worth removing.
