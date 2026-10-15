# Navigation & Sidebar Review

**Scope:** the whole app's navigation — the sidebar component, every top-level destination, page titling, active state, mobile behaviour, and where sign-out lives.
**Read from:** `AppSidebar.tsx`, `Shell.tsx`, `navigation.ts`, `ui/sidebar.tsx`, `use-mobile.ts`, and every route's `PageHeader`.

---

## The headline: there is no way to open the navigation on a phone

This came out of reading the shell, and it outranks everything else in this document.

**Three facts, each verifiable in the code:**

1. `Shell.tsx` renders exactly two things: `<AppSidebar />` and `<SidebarInset>`. **There is no topbar.** No header bar, no hamburger, nothing above the page content.
2. The only `SidebarTrigger` in the entire app is at `AppSidebar.tsx:98` — **inside `SidebarHeader`, inside the sidebar itself.** A grep for `SidebarTrigger` across `src/` returns that one hit plus the component definition. No route renders one.
3. Below 768px (`use-mobile.ts:3`), `ui/sidebar.tsx:184` renders the sidebar as a `Sheet` whose open state starts **`false`** (`:69`). `SidebarRail` — the other toggle — is `hidden … sm:flex` (`:295`), so it doesn't exist below 640px. The desktop sidebar wrapper is `hidden md:block` (`:212`).

Put together: **on a phone, the sidebar sheet is closed on load, and the only control that opens it is inside the closed sheet.**

A mobile user who lands on any page — from a notification email, a shared link, a bookmark — cannot navigate anywhere. The only escapes are the browser back button and the floating ⌘J assistant button, which is not navigation.

**Basis:** this is a code-level certainty from the three facts above, not a browser reproduction — the app requires WorkOS sign-in to reach the shell locally. The evidence is unambiguous, but if you want it demonstrated before it's fixed, open any page at 375px width.

**Fix (small):** a slim sticky header rendered by `Shell` on mobile only, containing a `SidebarTrigger` and the page title. Roughly fifteen lines. It also gives the app a place to put breadcrumbs later, which §2 argues it needs.

---

## 1. Current state

### The sidebar, top to bottom

| Region | Contents | Notes |
|---|---|---|
| Header | Brainee.org logo + collapse toggle | Logo becomes the expand button when collapsed — nice touch |
| Content | 5 groups, 7–12 items by role | |
| Footer | Notification bell · theme toggle · avatar → `/profile` | |
| Rail | Edge-drag toggle | Desktop only |

Collapse mode is `collapsible="icon"`, so the desktop sidebar shrinks to icons with tooltips. That part works well.

### Items by role

| Role | Items | Groups |
|---|---|---|
| user | 7 | 3 |
| lead | 8 | 4 |
| admin | 12 | 5 |

```
Workspace           Dashboard · Brainee.org Brain
Projects & Delivery Projects · My Tasks
Schedule & People   My Attendance · Team Calendar · Organization
Management          Approvals                                 (lead, admin)
Administration      Assets & Devices · Project Settings ·
                    Admin Stats · Admin Console               (admin)
```

---

## 2. The sidebar and the pages disagree about where you are 🔴

There is **no topbar and no breadcrumbs** (`Shell.tsx` — sidebar plus content, nothing else). So the sidebar label and the page's own `PageHeader` title are the *only* two orientation signals a user gets. In five of twelve cases, they don't match:

| Sidebar says | The page's H1 says |
|---|---|
| Organization | **"Levels"** |
| Admin Stats | **"Executive Command Center"** |
| Project Settings | **"Project Lifecycle & Checklist Configuration"** |
| Assets & Devices | "Assets & Device Management" |
| Dashboard | "Welcome back, {firstName}" |
| My Attendance | "My Attendance" ✓ *(but the page's first tab is labelled "Calendar")* |

You click **Organization** and arrive at a page called **Levels**. You click **Admin Stats** and arrive at **Executive Command Center**. Nothing on either page tells you they're the same thing you clicked.

The Dashboard case is fine and deliberate — a greeting is a reasonable H1 for a home page. The other four are drift.

**Fix:** the page title should be the sidebar label, verbatim. `PageHeader` already takes a `description` prop, which is exactly where the longer phrasing belongs:

```tsx
// before
<PageHeader title="Levels"
  description="View organizational levels and reporting relationships in the team." />

// after
<PageHeader title="Organization"
  description="Organizational levels and reporting relationships." />
```

Four one-line edits. This is the cheapest high-impact change in the document.

---

## 3. Sign out takes two navigations and isn't discoverable 🟠

The footer avatar is a plain `<Link to="/profile">` (`AppSidebar.tsx:148`) — **not** a dropdown menu. Sign out exists only as a button inside `_authenticated.profile.tsx:54`.

So signing out is: click your face → land on Profile → find the button. Nothing anywhere says "sign out". Every app users have muscle memory for puts this behind the avatar.

**Fix:** make the footer avatar a `DropdownMenu` with **Profile** and **Sign out**. `DropdownMenu` is already in `src/components/ui`, and `logoutUser` is already exported from `src/api/auth`. The profile page keeps its button; this just adds the expected path.

---

## 4. Nested pages leave the sidebar with nothing highlighted 🟠

`isRouteActive` (`AppSidebar.tsx:26`) special-cases two exact matches and uses `startsWith` for everything else:

```ts
if (href === "/")      return pathname === "/";
if (href === "/admin") return pathname === "/admin";
return pathname === href || pathname.startsWith(`${href}/`);
```

The `/admin` exact-match exists so it doesn't light up for `/admin/assets`. But it also means that on **`/admin/employees/123`** — a real 465-line destination — no nav item matches. `/admin` fails the exact test; `/admin/assets`, `/admin/projects` and `/admin/stats` don't prefix-match. The sidebar shows **no active item at all**.

Same for `/profile`: it isn't a nav item, and the footer avatar isn't wired into the active-state logic.

**Fix:** give nav items an optional `activeFor?: string[]` of extra path prefixes, so `Admin Console` claims `/admin/employees`. Alternatively invert the rule: longest-matching prefix wins, which removes the need for the two special cases entirely. The second is cleaner but touches all twelve items — worth doing while the file is open anyway.

---

## 5. Icon collisions 🟠

Icons are recognition shortcuts. Duplicates cancel that out.

- **`LayoutDashboard` appears twice in the same sidebar** — Dashboard (`navigation.ts:43`) and Admin Stats (`:129`). Two rows, identical glyph.
- **`CheckSquare` appears three times** across the app — the Approvals nav item, the project **Tasks** tab, and the project **Checklists** tab.

`lucide-react` has `BarChart3` / `TrendingUp` for stats and `ClipboardCheck` / `ListChecks` for checklists. Ten minutes.

---

## 6. The Management group holds exactly one item 🟠

A group header, its label, and its vertical spacing — for a single link (Approvals).

Approvals *is* approving leave and WFH requests, which is precisely what **Schedule & People** covers. Fold it in and the group disappears. Leads and admins go from 4 groups to 3 with no loss.

This is also the rule that should stop a one-item group being created for Referrals.

---

## 7. Overlapping destinations worth questioning 🟡

Not bugs — worth deciding on.

**Three places answer "who's around?"**

| Destination | Answers |
|---|---|
| `/organization` ("Levels") | who reports to whom |
| `/team-calendar` | who's out, and when |
| Dashboard → `TeamAvailabilityPanel` | who's out today |

The dashboard panel is a subset of `/team-calendar`. That's fine — a dashboard summarising a destination is normal. But `Organization` is a static reporting chart that most people look at roughly once, and it currently occupies the same sidebar weight as pages people use daily.

**`/my-tasks` vs `/projects`.** My Tasks is a cross-project filter over the same task data, with its own KPI grid. It earns its slot — the cross-project view genuinely isn't reachable from a single project. Just noting the two aren't independent, so a change to task fields touches both.

**Two entry points to the assistant.** A **Brainee.org Brain** nav item plus the global ⌘J floating drawer, with the drawer hiding itself on `/assistant`. Coherent, and both have a reason to exist. Worth flagging only because the drawer's thread still doesn't survive a page reload, so the two entry points can appear to disagree about what conversation you're in.

---

## 8. No global search or command palette 🟡

Twelve top-level destinations, plus deep pages that aren't in the nav at all: employee detail, project detail, asset detail drawers. Reaching a specific employee is Administration → Employees tab → scan or filter the table.

The ⌘J assistant is adjacent to this — you can ask it to find someone — but it's a conversation, not navigation, and it doesn't take you there.

Not urgent. Listed because it's the thing that scales instead of adding sidebar rows, and three new portals are coming.

---

## 9. Admin's twelve items mix two mental models 🟠

Four Administration entries, one of which (`/admin`) is itself a five-tab console. So an admin hunting for a setting must remember whether it's a *tab in the console* or a *page in the sidebar* — and there's no rule:

- **Admin Console** `/admin` → Employees · Holidays · Leave Config · WFH · Audit
- **Admin Stats** `/admin/stats` → a page
- **Project Settings** `/admin/projects` → a page
- **Assets & Devices** `/admin/assets` → a page with its own 3 tabs

There are also **four redirect-only routes** (`admin.audit`, `admin.employees.index`, `admin.holidays`, `admin.settings`) that forward legacy URLs to `/admin?tab=…`. Good practice, and the pattern to reuse for any consolidation below.

---

## 10. Proposed sidebar

Including the referral portal and the HR role.

```
[Brainee.org]                              ← logo · collapse

  Dashboard
  Referrals                              ← new · all roles
  Brainee.org Brain

PROJECTS
  Projects
  My Tasks

PEOPLE
  My Attendance
  Team Calendar
  Organization
  Approvals              ⁴               ← moved here · lead, admin

HR                                       ← new · hr, admin
  Referral Queue
  Requisitions

ADMIN                                    ← admin
  Assets
  Administration                         ← console + Stats + Project Settings

──────────────────────────
  Notifications
  Theme
  [Avatar] Charan  ▸                     ← dropdown: Profile · Sign out
```

| Role | Now | Proposed |
|---|---|---|
| user | 7 | **8** |
| lead | 8 | **9** |
| hr | — | **10** |
| admin | 12 | **11** |

Admin *drops* by one despite three new features, because Stats and Project Settings become tabs in Administration.

Two deliberate choices:

- **The first group loses its "Workspace" label.** Items at the top of a sidebar don't need a header to explain that they're the main things. Removes a row of chrome.
- **Referrals sits in the top group, not a new one.** One item does not justify a group — the same rule that removes Management. When Capability Development and Company Policies arrive, the three become a **People & Growth** group.

One call that's yours: **Project Settings** could equally go under Projects rather than Administration, since it configures project lifecycles and checklist templates. I put it in Administration because it's admin-only and grouping by permission is easier to reason about — but grouping by subject would put it with Projects. Either is defensible.

---

## 11. Plan

### P0 — Broken (do first)

| # | Change | Effort |
|---|---|---|
| 1 | **Mobile header with a `SidebarTrigger`** in `Shell.tsx`, mobile-only | ~15 lines |

> **Verify:** at 375px, every page shows a header with a working menu button; the sheet opens, navigates, and closes. Confirm at 767px and 768px — the breakpoint boundary.

### P1 — Cheap and high-impact (one sitting, ~1 hour)

| # | Change | Files |
|---|---|---|
| 2 | Page titles match sidebar labels — Organization, Admin Stats, Project Settings, Assets | 4 route files |
| 3 | Footer avatar becomes a dropdown with **Profile** and **Sign out** | `AppSidebar.tsx` |
| 4 | Fix both icon collisions | `navigation.ts`, `ProjectHeaderSection.tsx` |
| 5 | Settle calendar naming — *My Attendance* / *Team Attendance*, or both "Calendar" | `navigation.ts` + 2 routes |
| 6 | Fold Approvals into **People**; delete the Management group | `navigation.ts` |

> **Verify:** every sidebar label appears verbatim as the H1 of the page it opens. Sign out works from the dropdown. No glyph appears twice.

### P2 — Correctness

| # | Change |
|---|---|
| 7 | Longest-prefix-wins active state, replacing the two special cases; `/admin/employees/123` highlights Administration |
| 8 | Add a scroll affordance to `PageTabs` — a fade edge — as insurance for any page that grows tabs |

### P3 — With the referral build

| # | Change |
|---|---|
| 9 | `"hr"` added to `allowedRoles` on every item HR should see |
| 10 | **Referrals** in the top group, all roles |
| 11 | **HR** group with Referral Queue + Requisitions |
| 12 | Icons for the new items — not `CheckSquare`, not `LayoutDashboard` |

### P4 — Consolidation, its own change

| # | Change | Note |
|---|---|---|
| 13 | Admin Stats becomes a tab in Administration | Add a redirect stub for `/admin/stats`, matching the four already in the repo |
| 14 | Project Settings moves into Administration (or Projects — your call) | Same redirect treatment |

### P5 — Later, if it earns it

| # | Change |
|---|---|
| 15 | Command palette (⌘K) for cross-app navigation and jumping to a person, project or asset |

---

## What I'd do this week

**Item 1 today** — mobile navigation is unreachable, and it's fifteen lines.

**Items 2–6 in one sitting** — about an hour, no logic changes, and they clear five of the complaints in this document.

Everything else can wait for the referral work or a dedicated pass.

---

## Explicitly not proposed

- No change to the design system — it's coherent and documented in `CLAUDE.md`.
- No new sidebar library. `ui/sidebar.tsx` is 726 lines of shadcn and the collapse-to-icon behaviour is good; the gaps are in what the app renders *around* it, not in the component.
- No removal of the assistant nav item. Two entry points to one feature is defensible.
- No verdict on `/organization`'s sidebar weight. It's low-traffic, but demoting it is a product call, not a structural one.
