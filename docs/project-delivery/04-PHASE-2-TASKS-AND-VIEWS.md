# Phase 2 — Tasks and the Four Views · ✅ COMPLETE

**Goal:** people create tasks, get assigned tasks, and see the work as a list, a board, a Gantt
chart, or a calendar.

> **Delivered 2026-10-16:**
> - Schema table `project_tasks` added with self-referencing subtasks, per-project `task_number`, blocked reason, priority, and date ranges.
> - Applied local migration `0012_damp_nick_fury.sql`.
> - Server functions in `src/api/project-tasks.ts`: `getProjectTasks`, `getMyTasks`, `createTask`, `updateTask`, `updateTaskStatus`, `reassignTask`, `bulkReassignTasks`, `deleteTask`.
> - Task styling registry `taskStatusStyles.ts` and unit test suite `taskStatusStyles.test.ts` (80/80 passing across all suites).
> - Four interactive views on `/projects/$id`: List (filterable table), Board (Kanban columns with move menu), Gantt (timeline stepper with auto-scroll to today and unscheduled backlog tray), Calendar (month due date grid).
> - Slide-over `TaskDetailSheet` with blocked reason prompt and subtask creator.
> - Personal cross-project hub at `/my-tasks` added to primary navigation.
> - Startup-scale database seed script `scripts/seed-projects.ts` (10 projects, 13 team members, 234 realistic tasks covering all edge cases).


---

## 1. Backend

### 1.1 Schema

```ts
export const projectTasks = sqliteTable(
  "project_tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    stageKey: text("stage_key"),
    parentTaskId: text("parent_task_id").references((): AnySQLiteColumn => projectTasks.id),
    taskNumber: integer("task_number").notNull(),           // per-project sequence, human reference
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("todo"),       // 'todo' | 'in_progress' | 'blocked' | 'in_review' | 'done' | 'cancelled'
    priority: text("priority").notNull().default("medium"), // 'low' | 'medium' | 'high' | 'critical'
    assigneeId: text("assignee_id").references(() => users.id),
    createdById: text("created_by_id").references(() => users.id),
    startDate: text("start_date"),                          // ISO date — Gantt bar start
    dueDate: text("due_date"),                              // ISO date — Gantt bar end
    completedAt: integer("completed_at", { mode: "timestamp" }),
    estimateHours: real("estimate_hours"),
    actualHours: real("actual_hours"),
    blockedReason: text("blocked_reason"),
    sequence: integer("sequence").notNull().default(0),     // manual ordering within a status column
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [
    index("project_tasks_project_status_idx").on(table.projectId, table.status),
    index("project_tasks_assignee_status_idx").on(table.assigneeId, table.status),
    index("project_tasks_due_idx").on(table.dueDate),
  ],
);
```

**`taskNumber`:** allocate as `max(taskNumber) + 1` for the project inside `createTask`. D1 has no
transactions, so a race can collide — put a `unique(projectId, taskNumber)` constraint on it and
retry once on conflict. Display as `PRJ-014 #23`.

### 1.2 Server functions — `src/api/project-tasks.ts`

| Function | Method | Access check |
|---|---|---|
| `getProjectTasks` | GET | `assertProjectAccess(viewer)` |
| `getMyTasks` | GET | `authMiddleware` — scoped by `visibleProjectIdsFor` **and** `assigneeId = user.id` |
| `createTask` | POST | `assertProjectAccess(contributor)` |
| `updateTask` | POST | `assertProjectAccess(contributor)`; non-managers may only edit tasks they created or are assigned |
| `updateTaskStatus` | POST | same — **the single entry point for board moves** |
| `reassignTask` | POST | `assertProjectAccess(manager)` |
| `bulkReassignTasks` | POST | `assertProjectAccess(manager)` — used by member handoff |
| `deleteTask` | POST | `assertProjectAccess(manager)` |

> `updateTaskStatus` is deliberately its own function. The menu-move today and a future `@dnd-kit`
> drag call **the same** endpoint, so adding drag later changes only the input mechanism.

Every mutation → `project_events` row + `logAuditEvent`.
Setting status to `done` sets `completedAt`; moving off `done` clears it.
Setting `blocked` requires `blockedReason`.

### 1.3 Scale

There is **no pagination or virtualization anywhere in this repo** (landmine #2). `getProjectTasks`
must filter server-side (status, assignee, stage) and **cap the result set** (e.g. 500) with an
explicit "showing first N" signal, rather than returning everything and filtering in the client as
`AssetCatalogTable` does.

---

## 2. Frontend

### 2.1 View switching

`?view=list|board|gantt|calendar` on the project detail route, via `validateSearch` +
**`loaderDeps`** + `PillToggle`. Default (`list`) is represented as `undefined` in the URL.

### 2.2 List view

The existing table idiom: `DataTableToolbar` (search `Input` + status/assignee/priority `Select`s,
all `h-9`) → `DataTableContainer` → plain `<Table>`. Row click opens a task detail sheet;
interactive cells `e.stopPropagation()`.

### 2.3 Board view (Kanban)

Columns per status. **No drag-and-drop in this phase** — each card carries a `DropdownMenu` with
"Move to →" listing the other statuses, calling `updateTaskStatus`.

- Do **not** use `<Button>` as the card container: `[data-slot="button"]` gets a
  `translateY(-1px)` hover transform (landmine #4).
- Cards will be **square** — `border-radius: 0 !important` is global (landmine #1).
- Column layout: `grid gap-4` with `min-w-[280px]` columns inside an `overflow-x-auto` wrapper.

### 2.4 Gantt view — reuse `TeamCalendarGrid.tsx`

`src/components/admin/TeamCalendarGrid.tsx` is **~90% of a Gantt shell already**. Copy its
technique exactly:

```tsx
// Dynamic column count can't be a Tailwind class — inline style, as TeamCalendarGrid does.
const gridStyle = {
  display: "grid",
  gridTemplateColumns: `220px repeat(${days.length}, minmax(40px, 1fr))`,
  gap: "1px",
  backgroundColor: "var(--border)",   // hairline gridlines via gap-over-background
  border: "1px solid var(--border)",
  minWidth: "max-content",            // makes the grid overflow rather than squash
};
```

| Technique | Detail |
|---|---|
| Scroll container | `<DataTableContainer className="p-0"><div ref={scrollRef} className="max-w-full overflow-x-auto">` |
| Rows | `<div className="contents group">` — `display: contents` so children join the outer grid |
| Frozen label column | `sticky left-0 z-20` + opaque `bg-card` + `shadow-[1px_0_0_var(--border)]` |
| Today marker | `data-today-column` attribute + `bg-primary/10 border-x border-primary/30` |
| Auto-scroll to today | Copy the `useEffect` + `scrollTo({ left: el.offsetLeft - (w - elw)/2 })` verbatim |
| Weekend shading | `bg-weekend` |

**The one thing TeamCalendarGrid does not do:** its cells are strictly one-per-day. Gantt bars must
span columns:

```tsx
// +2 because column 1 is the sticky label column
<div style={{ gridColumn: `${startIdx + 2} / span ${lengthInDays}` }}
     className={cn("h-5 self-center", TASK_STATUS_CONFIG[task.status].dot)} />
```

Span maths reuses the existing ISO-string range test (`dateStr >= start && dateStr <= end`) from
`MonthView.getDayDetails`. Tasks with no `startDate`/`dueDate` render in a "no dates" group rather
than being silently dropped.

> ⚠️ `display: contents` rows are **incompatible with virtualization**. If boards/Gantts are
> expected to exceed a few hundred rows, choose sticky-column + absolutely-positioned rows *now*
> rather than retrofitting.

### 2.5 Calendar view

Reuse `MonthView.tsx`'s block: `grid grid-cols-7 gap-px bg-border` with `gap-px` over `bg-border`
for hairlines, tasks keyed by `dueDate`, `isToday` pill on the day number.

### 2.6 Status colour registry — `src/components/projects/taskStatusStyles.ts`

Mirror `teamCalendarStyles.ts` exactly: one frozen `as const` record of
`{ cell, dot, legend, icon }` per status, driving the badge, board card, Gantt bar and legend from
a single source. Add a `taskStatusStyles.test.ts` — `teamCalendarStyles.test.ts` is the precedent.

### 2.7 `src/routes/_authenticated.my-tasks.tsx`

Cross-project "what am I on" view. Loader calls `getMyTasks`. Grouped by project, sorted by due
date, with overdue highlighted. Add the `NavItem`.

---

## 3. Verification

1. Migration generated, read, applied.
2. `taskStatusStyles.test.ts` + task policy tests pass.
3. Board: move a card through every status; confirm `completedAt` sets and clears, and that
   `blocked` demands a reason.
4. Gantt: confirm bars span the right columns, the sticky label column stays put while scrolling
   horizontally, and the view auto-scrolls to today.
5. A `viewer` sees no move menus and no create button.
6. **Direct RPC probe:** call `updateTaskStatus` as a viewer and as a non-member — both must fail.
7. Create ~300 tasks and confirm the board and Gantt remain usable; if not, land server-side paging
   before shipping.
