# Phase 4 — Daily Updates, EOD Reports, Work Flags · ✅ COMPLETE

**Goal:** everyone logs what they did on each project each day; the EOD report is assembled only
once everyone has submitted; managers can nudge the people who haven't; and redundant or thin work
gets flagged on the work item, never on the person.

**Prior art:** none. `timesheets` captures `{ date, hours }` and nothing else; `re_entry_note` is
dead schema never written by any code path; there is no standup/EOD concept anywhere in the repo.

---

## 1. Backend

### 1.1 Schema

```ts
export const projectDailyUpdates = sqliteTable(
  "project_daily_updates",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),                            // ISO YYYY-MM-DD
    summary: text("summary").notNull(),
    blockers: text("blockers"),
    hoursSpent: real("hours_spent"),
    status: text("status").notNull().default("draft"),       // 'draft' | 'submitted'
    submittedAt: integer("submitted_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [
    unique("daily_update_unique").on(table.projectId, table.userId, table.date),
    index("daily_updates_project_date_idx").on(table.projectId, table.date),
  ],
);

// What makes an EOD report verifiable rather than free prose.
export const projectDailyUpdateItems = sqliteTable(
  "project_daily_update_items",
  {
    id: text("id").primaryKey(),
    updateId: text("update_id").notNull().references(() => projectDailyUpdates.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull(),
    note: text("note"),
    progressNote: text("progress_note"),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [index("daily_update_items_update_idx").on(table.updateId)],
);

export const projectEodReports = sqliteTable(
  "project_eod_reports",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    generatedById: text("generated_by_id").references(() => users.id),
    contentDraft: text("content_draft"),                     // system/AI assembled
    contentFinal: text("content_final"),                     // human-edited, the shareable text
    status: text("status").notNull().default("draft"),       // 'draft' | 'finalised'
    missingSubmitters: text("missing_submitters"),           // JSON array of userIds at generation time
    finalisedAt: integer("finalised_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [unique("eod_report_unique").on(table.projectId, table.date)],
);

// Advisory observations. Never a score.
export const workFlags = sqliteTable(
  "work_flags",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),               // 'task' | 'daily_update'
    entityId: text("entity_id").notNull(),
    flagCode: text("flag_code").notNull(),                   // 'possible_duplicate' | 'no_task_linked' | 'stalled' | 'vague_update' | 'needs_analysis' | 'estimate_exceeded'
    severity: text("severity").notNull().default("info"),    // 'info' | 'warning'
    message: text("message").notNull(),
    evidence: text("evidence"),                              // JSON — the record ids the flag rests on
    source: text("source").notNull().default("rule"),        // 'rule' | 'ai'
    status: text("status").notNull().default("open"),        // 'open' | 'acknowledged' | 'dismissed'
    raisedForUserId: text("raised_for_user_id").references(() => users.id),
    resolvedById: text("resolved_by_id").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [index("work_flags_project_status_idx").on(table.projectId, table.status)],
);
```

### 1.2 The EOD flow

1. Each **current** project member submits a daily update: tasks worked (via
   `projectDailyUpdateItems`) + summary + blockers.
2. The EOD page **computes on view** who has and hasn't submitted. No scheduler — always accurate,
   no cron to add.
3. **The report is not generated until everyone has submitted.** If anyone is missing, the page
   names them and offers **"Remind"**, which calls `createNotification` per person. That path
   already fans out to email via `waitUntil(sendMail(...))`, so reminders start emailing the moment
   a provider is wired into `src/lib/mail.server.ts` — **no new plumbing needed now**.
4. A manager may **override and generate anyway**; `missingSubmitters` records who was absent.
5. The generated report is **editable text** saved to `contentFinal`, with a copy button so it can
   be pasted to a client or anyone else. **Nothing is auto-sent outside the app.**

### 1.3 Pure policy — `src/lib/eod-policy.ts`

```ts
export interface EodSubmissionState {
  expected: { userId: string; name: string }[];   // current members with contribute rights
  submitted: string[];
  missing: { userId: string; name: string }[];
  allSubmitted: boolean;
  canGenerate: boolean;                            // allSubmitted || callerIsManager
}
export function resolveEodSubmissionState(input): EodSubmissionState;

/** Deterministic skeleton — the AI only rewrites wording. See Phase 5. */
export function assembleEodSkeleton(input): EodReportSkeleton;
```

Both pure, both unit-tested, both imported by the server fn **and** the AI layer. `viewer`-role
members are not expected to submit.

### 1.4 Rule-based flags — `src/lib/work-flag-rules.ts`

Deterministic, **no model involved**:

| Code | Rule |
|---|---|
| `no_task_linked` | A submitted update with zero `projectDailyUpdateItems` |
| `stalled` | Task `in_progress` for > N days with no update referencing it |
| `estimate_exceeded` | `actualHours > estimateHours * threshold` |

`possible_duplicate`, `vague_update` and `needs_analysis` involve the AI (Phase 5) and are
**advisory and dismissible**.

### 1.5 Server functions

`src/api/project-daily-updates.ts` — `getMyDailyUpdate`, `saveDailyUpdate` (upsert on the unique
key), `submitDailyUpdate`, `getProjectDailyUpdates`.

`src/api/project-eod.ts` — `getEodStatus`, `generateEodReport`, `saveEodReport`,
`finaliseEodReport`, `remindMissingSubmitters`.

`src/api/work-flags.ts` — `getWorkFlags`, `acknowledgeWorkFlag`, `dismissWorkFlag`.

> ⚠️ **Do not reuse `notifyApprovers` for EOD fan-out** — it notifies **every admin** for every
> request and will not scale to a daily per-project nudge. Target project members directly.

> ⚠️ New `eod_*` notification types must be added to `isRequestNotification` in
> `NotificationBell.tsx:39`, which classifies by `type.startsWith("leave_" | "wfh_")`. Otherwise
> they fall outside both the "Requests" and styled filters.

> ⚠️ Take **today's date from the loader payload** (server, timezone-aware `getTodayIsoDate()`),
> never `new Date().toISOString()` on the client — see landmine #6.

---

## 2. Frontend

| Component | Notes |
|---|---|
| `DailyUpdateCard` | Dashboard card: "Log your day" per project the user is on. Task multi-select from their open tasks, summary `Textarea`, blockers, optional hours |
| `DailyUpdateDialog` | Fuller editor from the project page; draft/submit split |
| `EodStatusPanel` | Submitted vs missing, with avatars. **Generate disabled until all submitted**, unless the viewer can manage |
| `EodReportEditor` | `Textarea` bound to `contentFinal`, **Copy** button (`navigator.clipboard`), Regenerate, Finalise |
| `RemindMissingButton` | Fires `remindMissingSubmitters`; shows who will be notified before sending |
| `WorkFlagBadge` | On task rows and update cards; severity-coloured via a config map |
| `WorkFlagPanel` | Open flags for a project; acknowledge/dismiss; **shows `evidence`** so "this looks redundant" is always answerable with "compared to what" |

**Visibility:** flags are shown to the **manager and the person the flag concerns**. Flags attach to
the *work item*, never to a person. There is no per-person aggregation, ranking or score anywhere
in the schema — deliberately, so this cannot quietly become a performance file.

---

## 3. Verification & Test Results

- [x] **Expected Submitter Resolution**: `eod-policy.test.ts` verifies viewers (`role = 'viewer'`) and rolled-off members (`isCurrent = false`) are excluded.
- [x] **Missing Submitters & Gating**: Generation blocked when contributors are missing; manager override permits generation while recording `missingSubmitters` JSON.
- [x] **Direct Nudge Reminders**: `remindMissingSubmitters` targets missing members directly with in-app notification (`eod_reminder`) rows without spamming admins.
- [x] **Verifiable Standup Updates**: `projectDailyUpdateItems` links daily updates to backlog task items; updates upsert on `(projectId, userId, date)`.
- [x] **Editable EOD Text**: `EodReportEditor` binds to `contentFinal`, supports Copy to Clipboard via `navigator.clipboard`, Regenerate, and Manager Finalise.
- [x] **Rule-Based Work Flags**: `checkNoTaskLinked`, `checkStalledTask`, and `checkEstimateExceeded` evaluated deterministically without AI dependency.
- [x] **Dashboard Integration**: `DailyUpdateCard` mounted on dashboard for employees to quickly log standups across all assigned active projects.
- [x] **All Files < 300 LOC**: Decomposed into modular components and sub-APIs, adhering strictly to line count limits.
- [x] **Test Suite**: 101/101 tests passing (`vitest run`).

