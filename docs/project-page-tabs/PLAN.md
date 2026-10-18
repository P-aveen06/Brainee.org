# Project Page: 11 Tabs → 5

**Problem:** the project detail page has eleven top-level tabs. Three scroll off-screen on a laptop with no indication they exist.
**Scope:** `src/routes/_authenticated.projects.$id.tsx` and `src/components/projects/`. Nothing else in the app is touched.

---

## 1. What's actually wrong

The eleven tabs are declared in `ProjectHeaderSection.tsx:28`:

```
Tasks · Overview · Updates · EOD · Flags · Checklists ·
Documents · Discussions · Team · Client · Timeline
```

`PageTabs` (`src/components/ui/page-tabs.tsx`) wraps them in `overflow-x-auto` with `whitespace-nowrap`. So the layout doesn't break — instead the strip becomes a **horizontal scroller with no affordance**. No fade edge, no arrows, no partial-tab peeking. At roughly 105px per tab with icons, eleven need about 1,150px; with the sidebar expanded that overflows on a typical laptop.

The result: **Team, Client and Timeline are functionally invisible.** A user has to guess that a tab strip scrolls.

---

## 2. The finding that changes the plan

I read all eleven panels before proposing a grouping. Three things came out of it that make this much simpler than "merge some tabs":

### The Overview tab is already a summary of other tabs

`ProjectOverviewTab.tsx` renders:

| Section | Duplicates |
|---|---|
| Checklist progress widget (`:59`) | the **Checklists** tab |
| "Client Engagement Summary" (`:127`) | the **Client** tab |
| "Team (n)" roster with a **Manage** link (`:171`) | the **Team** tab |

That Manage link calls `onManageMembers()`, which is wired to `onTabChange("members")` — Overview literally navigates you to another tab to do the thing it's showing you. The page has already half-solved its own problem: Overview aggregates, and three tabs exist only to hold the full version of what Overview summarises.

### The Client tab is entirely read-only

`ClientContactsPanel` takes `client`, `clientProjectName`, `engagementModel`, `contractValue`, `currency`, `contacts`. **No `access` prop, no `onSuccess`, no buttons, no dialogs.** 170 lines of pure display, occupying a top-level tab.

### The Team tab is already dialog code

`MemberManagerPanel` is exported from **`MemberManagerDialog.tsx`**. The member management UI was written as a dialog and is being rendered as a tab.

### And two panels already share state

`DailyUpdatesPanel` and `EodPanel` both receive `selectedDate` and `onDateChange`, and both render their own prev/next day navigation. Today a user picks a date on Updates, switches to the EOD tab, and the date persists — but they must switch tabs to see the other half of the same day. Those two are one screen that got split.

**So the grouping isn't arbitrary.** Four of the eleven tabs are misclassified in ways the code already shows.

---

## 3. The solution — five tabs

| # | Tab | Contains | Was |
|---|---|---|---|
| 1 | **Tasks** | list · board · gantt · calendar | Tasks (unchanged) |
| 2 | **Daily** | Flags · Updates · EOD | Updates + EOD + Flags |
| 3 | **Checklists** | stage-gated checklist | Checklists (unchanged) |
| 4 | **Files & Discussion** | Documents · Discussions | Documents + Discussions |
| 5 | **Overview** | project detail, client, team, timeline | Overview + Client + Team + Timeline |

Order keeps **Tasks first and default**, so the most-travelled path is unchanged.

Five tabs fit at any width with room to spare. No horizontal scroller, no hidden tabs.

---

## 4. Inside each merged tab

### Tab 2 — Daily

One date control at the top, shared by both date-scoped panels instead of each rendering its own:

```
[ ‹ ]  Thu 16 Oct 2026  [ › ]  [ Today ]

( Flags ⁴ )  ( Updates )  ( EOD )     ← segmented control
─────────────────────────────────────
  selected panel
```

- **Segmented control**, not nested tabs — visually a pill row, the same pattern the Tasks view pills already use.
- **Flags first**, with a count badge, because an open flag is the thing that needs attention. It's also the item that was most buried before.
- **One wrinkle, stated plainly:** `WorkFlagsPanel` is *not* date-scoped — it takes flags plus its own open/all filter. So the date control **hides when Flags is selected**. Slightly irregular, but the alternative is either a sixth tab for Flags or burying flags in Overview where nobody looks. The badge on the Daily tab means the count is visible from anywhere on the page.
- The prev/next day logic currently duplicated in `EodPanel.tsx:37` and `DailyUpdatesPanel.tsx:75` moves up to the shared header — one call site instead of two.

### Tab 4 — Files & Discussion

Two panels, side by side on wide screens, stacked below `lg`:

```
┌──────────────────┬──────────────────┐
│  Documents       │  Discussion      │
│  (upload, list)  │  (thread)        │
└──────────────────┴──────────────────┘
```

No segmented control — both are useful at once. Discussions frequently reference a document, and a two-column layout lets you read one while writing the other. `DocumentsPanel` is 188 lines and `DiscussionPanel` 258; both are already self-contained.

### Tab 5 — Overview

Overview keeps its current three-section layout and **absorbs the three tabs it was already summarising**:

| Current Overview section | Becomes |
|---|---|
| Checklist progress | unchanged — links to the Checklists tab |
| Project Details & Scope | unchanged |
| Client Engagement Summary | **expands** to hold `ClientContactsPanel` inline — it's read-only, so it's just content |
| Team (n) + Manage link | roster inline; **Manage opens `MemberManagerDialog` as a dialog**, which is what the component was written to be |
| — | **Activity** — `ProjectTimeline` as the last section, collapsed by default |

Net effect: Overview goes from a summary that sends you elsewhere to a page that actually answers the question. Client stops being a tab because it was never interactive. Team stops being a tab because it was always a dialog. Timeline becomes a section because it's a read-only event log nobody navigates to deliberately.

---

## 5. URL compatibility — the part that will bite if missed

`_authenticated.projects.$id.tsx:22` validates search params with a **zod enum listing all eleven tab values**:

```ts
tab: z.enum(["tasks","overview","updates","eod","flags","checklists",
             "documents","discussions","members","client","timeline"]).optional()
```

`z.enum` **throws** on an unknown value. So if the enum is narrowed to five, every existing `?tab=documents` link — in bookmarks, in notification `actionUrl`s, in Slack messages — starts failing validation rather than degrading.

**Solution: keep accepting all eleven, map the six retired values onto the new five.** No redirects, no broken links, ever.

```ts
// src/components/projects/project-tabs.ts   (new, pure, tested)

export const TABS = [
  { value: "tasks",       label: "Tasks" },
  { value: "daily",       label: "Daily" },
  { value: "checklists",  label: "Checklists" },
  { value: "files",       label: "Files & Discussion" },
  { value: "overview",    label: "Overview" },
] as const;

/** Legacy ?tab= values still arriving from bookmarks and notifications. */
const LEGACY: Record<string, { tab: TabKey; section?: string }> = {
  updates:     { tab: "daily", section: "updates" },
  eod:         { tab: "daily", section: "eod" },
  flags:       { tab: "daily", section: "flags" },
  documents:   { tab: "files" },
  discussions: { tab: "files" },
  members:     { tab: "overview" },
  client:      { tab: "overview" },
  timeline:    { tab: "overview" },
};

export function resolveTab(raw: string | undefined): {
  tab: TabKey;
  section?: string;
} {
  if (!raw) return { tab: "tasks" };
  if (TABS.some((t) => t.value === raw)) return { tab: raw as TabKey };
  return LEGACY[raw] ?? { tab: "tasks" };
}
```

The search schema keeps the full eleven-value enum (plus the three new ones), so nothing throws. `resolveTab` runs once in the component. A new `section` param carries the Daily segment, so `?tab=daily&section=eod` is linkable — and an old `?tab=eod` link lands on exactly the same view.

**This is the module to write tests for first.** Eleven legacy values, five current values, one undefined, one garbage value → thirteen assertions, and every old link in the company keeps working.

---

## 6. Files touched

| File | Change |
|---|---|
| `project-tabs.ts` | **new** — `TABS`, `LEGACY`, `resolveTab`, `TabKey` |
| `project-tabs.test.ts` | **new** — the thirteen assertions above |
| `ProjectHeaderSection.tsx` | `TABS` moves out to `project-tabs.ts`; keeps `VIEW_PILLS` |
| `ProjectTabsContent.tsx` | switch goes 11 cases → 5 |
| `ProjectDailyTab.tsx` | **new** — shared date header + segmented control + the three panels |
| `ProjectFilesTab.tsx` | **new** — two-column wrapper |
| `ProjectOverviewTab.tsx` | absorbs client contacts, inline roster, member dialog, timeline section |
| `_authenticated.projects.$id.tsx` | search schema gains `section`; uses `resolveTab` |
| `EodPanel.tsx` · `DailyUpdatesPanel.tsx` | **date navigation removed** — now supplied by the Daily tab header |

**Deleted: nothing.** Every panel component survives; only their parents change. `ClientContactsPanel`, `MemberManagerPanel` and `ProjectTimeline` get new callers, not new code.

`ProjectOverviewTab` is currently 224 lines and will grow. If it passes 300 it splits into `OverviewClientSection.tsx` and `OverviewTeamSection.tsx` — per the file-length rule in `CLAUDE.md`.

---

## 7. Build sequence

### Phase 1 — The mapping, test-first

`project-tabs.ts` and its tests. Nothing rendered yet.

> **Gate:** all thirteen assertions pass. Every legacy value resolves to a real tab.

### Phase 2 — Wire the five tabs, no merging yet

Point `ProjectHeaderSection` at the new `TABS`, use `resolveTab` in the route, and have `ProjectTabsContent` render **existing panels temporarily stacked** inside the merged tabs. Ugly for one commit, but the URL layer is proven before any layout work.

> **Gate:** all eleven old URLs land on the right tab. Five tabs render, no horizontal scroll at 1280px.

### Phase 3 — Daily

Build `ProjectDailyTab` with the shared date header and segmented control. Strip the duplicated day navigation out of `EodPanel` and `DailyUpdatesPanel`.

> **Gate:** changing the date updates both Updates and EOD. `?tab=daily&section=eod` deep-links correctly. `?tab=eod` still works. The date control hides on Flags. The flag count badge shows on the tab.

### Phase 4 — Files & Discussion

`ProjectFilesTab`, two columns above `lg`, stacked below.

> **Gate:** upload works, discussion posting works, no layout break at 768px or 375px.

### Phase 5 — Overview

Absorb client contacts and the roster; wire Manage to the dialog; add the collapsed Activity section.

> **Gate:** everything previously on Client, Team and Timeline is reachable from Overview. Member management still writes correctly. `ProjectOverviewTab` is under 300 lines or has been split.

### Phase 6 — The affordance, and a check for stragglers

Add a fade edge to `PageTabs` anyway — cheap insurance for any other page that grows. Then grep for hardcoded `?tab=` links elsewhere in the app (notifications, the AI assistant's `actionUrl`s, `page-context.ts`) and confirm each still resolves.

> **Gate:** `tsc`, `biome check`, full suite pass. No hardcoded tab link anywhere resolves to a dead value.

---

## 8. What I deliberately did not merge

| Kept separate | Why |
|---|---|
| **Tasks** | The most-used tab, four view modes, its own filters. Merging it with anything makes the primary workflow worse. |
| **Checklists** | Looks like Tasks but isn't — stage-scoped, has `not_applicable`, and gates stage advancement (`project-stage-policy.ts`). Different concept, different lifecycle. Folding it into Tasks would confuse two things that behave differently. |
| **Flags into Overview** | Considered and rejected. An open flag needs attention; Overview is where things go to be glanced at. Flags sits in Daily with a badge instead. |
| **Documents into Overview** | Documents has upload, supersede and versioning — it's an active workspace, not reference material. |

Also unaddressed here, because it's a separate question: **the four task view modes** (list, board, gantt, calendar). Gantt and Calendar answer nearly the same question and both need maintaining — the blank-row bug we fixed recently was Gantt-only. Worth checking usage before deciding, and it doesn't block any of the above.

---

## 9. The one call that's yours, not mine

The **Daily** grouping assumes Updates, EOD and Flags are one rhythm — which is how the code reads (shared date state, flags generated from update scanning). If your team treats EOD as a separate formal ritual from casual daily updates, then Daily should hold Updates + Flags and **EOD stays its own tab**. That's six tabs instead of five, which is still fine — the problem was eleven, not six.

Everything else here follows from what the code already does. That one is about how people work, and you'd know better than I would.
