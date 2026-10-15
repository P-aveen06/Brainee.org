# Phase 3 — Checklists, Documents (R2), Discussions · ✅ COMPLETED

**Goal:** every stage carries its checklist, every document lives in the system, and decisions are
captured where they can be found again.

**Prerequisite:** `bunx --bun shadcn@latest add checkbox` — the primitive does not exist yet.

---

## 1. Backend

### 1.1 Schema

```ts
export const projectChecklistTemplates = sqliteTable("project_checklist_templates", {
  id: text("id").primaryKey(),
  stageKey: text("stage_key").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
  sequence: integer("sequence").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const projectChecklistItems = sqliteTable(
  "project_checklist_items",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    stageKey: text("stage_key").notNull(),
    templateId: text("template_id"),                        // null = ad-hoc item
    title: text("title").notNull(),
    description: text("description"),
    isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("pending"),    // 'pending' | 'done' | 'not_applicable'
    assignedToId: text("assigned_to_id").references(() => users.id),
    dueDate: text("due_date"),
    completedById: text("completed_by_id").references(() => users.id),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    notes: text("notes"),
    sequence: integer("sequence").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [index("project_checklist_project_stage_idx").on(table.projectId, table.stageKey)],
);

export const projectDocuments = sqliteTable(
  "project_documents",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    stageKey: text("stage_key"),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category").notNull().default("other"),  // 'proposal' | 'sow' | 'contract' | 'design' | 'report' | 'minutes' | 'other'
    r2Key: text("r2_key").unique().notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    version: integer("version").notNull().default(1),
    supersedesDocumentId: text("supersedes_document_id").references((): AnySQLiteColumn => projectDocuments.id),
    status: text("status").notNull().default("final"),      // 'draft' | 'final' | 'approved' | 'superseded'
    uploadedById: text("uploaded_by_id").references(() => users.id),
    checksum: text("checksum"),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [index("project_documents_project_idx").on(table.projectId)],
);

export const projectComments = sqliteTable(
  "project_comments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    stageKey: text("stage_key"),                            // thread anchor — all nullable
    taskId: text("task_id"),
    documentId: text("document_id"),
    parentId: text("parent_id").references((): AnySQLiteColumn => projectComments.id),
    authorId: text("author_id").notNull().references(() => users.id),
    body: text("body").notNull(),
    isDecision: integer("is_decision", { mode: "boolean" }).notNull().default(false),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
    editedAt: integer("edited_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [index("project_comments_project_created_idx").on(table.projectId, table.createdAt)],
);
```

`isDecision` marks a comment as a decision record so it stays retrievable — it is what makes
"why did we choose X?" answerable later, by a human and by the assistant.

### 1.2 Checklist behaviour

- When a stage becomes `active`, instantiate `projectChecklistItems` from the active templates for
  that `stageKey`. Idempotent — skip if items already exist for that project+stage.
- **Advancing a stage with unmet `isRequired` items is blocked**, and the error names the items.
  Put this rule in a pure `src/lib/project-stage-policy.ts` with tests, so both the server fn and
  the UI's disabled state read the same source.
- Contributors may only tick items assigned to them (or that they created); managers may tick any.

### 1.3 R2 storage

**`wrangler.jsonc`** — new binding, plus a preview bucket so local dev does not write production:

```jsonc
"r2_buckets": [
  {
    "binding": "PROJECT_DOCS",
    "bucket_name": "tcc-tower-project-docs",
    "preview_bucket_name": "tcc-tower-project-docs-dev"
  }
]
```

Then **`bunx wrangler types`** — otherwise `env.PROJECT_DOCS` will not typecheck.

**Key scheme:** `projects/{projectId}/{documentId}/v{version}/{sanitizedFileName}`

**Upload** — a server fn taking `FormData`, so it keeps the same middleware/auth path as everything
else. Order matters (no transactions):

> **Put to R2 first, then insert the row.** An orphaned R2 object is recoverable garbage; a DB row
> pointing at a missing object is a broken UI.

Guards: `assertProjectAccess(contributor)` · 25 MB cap · MIME allowlist · filename sanitisation ·
reject path traversal (`..`, leading `/`) · compute a checksum.

**Download** — a server route that checks access and streams the R2 body through.

> **Never hand out public or presigned URLs.** The access check must sit in front of every fetch,
> and `r2Key` must never reach the client.

**Versioning:** a new version inserts a new row with `version = prev + 1` and
`supersedesDocumentId = prev.id`, and sets the previous row's `status = 'superseded'`. Mirrors the
existing `assets.replacedByAssetId` pattern.

> ⚠️ Confirm the exact TanStack Start `FormData` / server-route API against
> `.agents/skills/tanstack-start/SKILL.md` — this repo is on TanStack Start 1.168. **Do not assume.**

> ⚠️ **No virus scanning exists and Workers cannot practically do it inline.** These files are
> served back to colleagues. Accept this consciously, or restrict which roles may upload.

### 1.4 Server functions

`src/api/project-checklists.ts` — `getProjectChecklist`, `toggleChecklistItem`,
`createChecklistItem`, `updateChecklistItem`, `deleteChecklistItem`,
`instantiateStageChecklist` (internal helper).

`src/api/project-documents.ts` — `getProjectDocuments`, `uploadProjectDocument` (FormData),
`updateDocumentMetadata`, `supersedeDocument`, `deleteDocument` (removes the R2 object too).

`src/api/project-comments.ts` — `getProjectComments`, `createComment`, `updateComment`,
`deleteComment`, `toggleDecisionFlag`, `togglePin`.

Admin template CRUD lives on `/admin/projects`: `getChecklistTemplates`, `upsertChecklistTemplate`,
`deleteChecklistTemplate`.

---

## 2. Frontend

| Component | Notes |
|---|---|
| `ChecklistPanel` | Grouped by stage. `Checkbox` primitive (added this phase). Required items marked; blocked stage advance explains which items remain |
| `ChecklistItemDialog` | Ad-hoc item create/edit — title, description, assignee, due date, required |
| `DocumentsPanel` | `DataTable*` + plain `<Table>`: title, category badge, version, uploader, size, date. Row click opens detail |
| `DocumentUploadDialog` | `<input type="file">` — **the first in this repo**. Shows size/type limits, client-side pre-validation, upload progress via `useTransition` |
| `DocumentVersionHistory` | Walks `supersedesDocumentId` |
| `DiscussionPanel` | Threaded via `parentId`; "Mark as decision" toggle; pinned items first |
| `CommentComposer` | `Textarea` + submit; `useState` + `useTransition` + `sonner` |
| `StageChecklistSummary` | Small progress indicator on the overview tab. Reuse the linear bar from `EmployeeDetailStats.tsx:154` |

New tabs on the project detail route: `checklist`, `documents`, `discussion`.

Download links point at the streaming server route, never at R2 directly.

---

## 3. Verification

1. `wrangler types` after adding the binding; confirm `env.PROJECT_DOCS` typechecks.
2. Upload a document → confirm the R2 object exists → confirm the row's `r2Key` matches.
3. **Request the download URL while signed in as a non-member → must be refused.**
4. Confirm no `r2Key` appears anywhere in the client payload.
5. Upload a v2 → confirm v1 flips to `superseded` and history walks correctly.
6. Set a stage's template item to required, leave it unticked, attempt to advance → blocked with
   the item named.
7. Oversized file and disallowed MIME type → both rejected with a clear message.
8. Delete a document → confirm the R2 object is removed, not just the row.
