# Phase 1 — Project Spine, Client Context, Membership · ✅ COMPLETE

**Goal:** a project exists, has full client context, has a team whose changes are recorded over
time, moves through lifecycle stages, and has one unambiguous access rule.

**Shipped & Verified:** 2026-08-29
- Migration: `drizzle/0011_bright_payback.sql` applied locally to SQLite/D1.
- Unit tests: 78/78 passing across the test suite (`project-access.test.ts` with 9 full-matrix tests, `employee-lifecycle.test.ts` with `owns_projects` blocker tests).
- Typecheck & Lint: `tsc --noEmit` clean (code 0), `biome check` clean (code 0).
- Build: `bun run build` cleanly bundles client and SSR bundles with registered TanStack routes.

---

## 1. Backend

### 1.1 Schema — append to `src/db/schema.ts`

`companies` already exists (with an `isInternal` discriminator). **Reuse it. Do not add a second
company table.**

```ts
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    code: text("code").unique().notNull(),                    // PRJ-014, human reference
    name: text("name").notNull(),
    description: text("description"),
    projectType: text("project_type").notNull().default("client"), // 'internal' | 'client' | 'poc' | 'retainer'
    // Client context
    clientCompanyId: text("client_company_id").references(() => companies.id), // null for internal
    clientProjectName: text("client_project_name"),           // what the CLIENT calls it
    engagementModel: text("engagement_model"),                // 'fixed_bid' | 'time_and_materials' | 'retainer' | 'internal'
    contractValue: real("contract_value"),
    currency: text("currency").default("INR"),
    // State
    status: text("status").notNull().default("draft"),        // 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived'
    priority: text("priority").notNull().default("medium"),   // 'low' | 'medium' | 'high' | 'critical'
    healthOverride: text("health_override"),                  // 'green' | 'amber' | 'red' — manual override of derived signal
    currentStageKey: text("current_stage_key"),
    // Dates (text ISO YYYY-MM-DD)
    startDate: text("start_date"),
    targetEndDate: text("target_end_date"),
    actualEndDate: text("actual_end_date"),
    // People
    ownerId: text("owner_id").notNull().references(() => users.id),
    createdById: text("created_by_id").references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [
    index("projects_status_idx").on(table.status),
    index("projects_owner_idx").on(table.ownerId),
    index("projects_client_company_idx").on(table.clientCompanyId),
  ],
);

export const clientContacts = sqliteTable(
  "client_contacts",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title"),
    email: text("email"),
    phone: text("phone"),
    role: text("role").notNull().default("other"),            // 'sponsor' | 'primary' | 'technical' | 'billing' | 'other'
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    notes: text("notes"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [index("client_contacts_company_idx").on(table.companyId)],
);

// THE ACL. Also the team roster over time.
export const projectMembers = sqliteTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("contributor"),      // 'owner' | 'manager' | 'contributor' | 'viewer'
    allocationPercent: integer("allocation_percent"),         // who is on this, and how much
    billableRate: real("billable_rate"),
    joinedAt: text("joined_at"),                              // ISO date
    leftAt: text("left_at"),
    leaveReason: text("leave_reason"),                        // 'rolled_off' | 'reassigned' | 'left_company' | 'project_ended'
    replacedByUserId: text("replaced_by_user_id").references((): AnySQLiteColumn => users.id),
    addedById: text("added_by_id").references(() => users.id),
    isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [
    index("project_members_project_current_idx").on(table.projectId, table.isCurrent),
    index("project_members_user_current_idx").on(table.userId, table.isCurrent),
  ],
);

// Org-level stage definitions, admin-editable.
export const projectStages = sqliteTable(
  "project_stages",
  {
    id: text("id").primaryKey(),
    key: text("key").unique().notNull(),                      // 'planning', 'proposal', ...
    name: text("name").notNull(),
    description: text("description"),
    sequence: integer("sequence").notNull(),
    appliesToType: text("applies_to_type"),                   // null = all project types
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
);

// One row per project x stage. Doubles as the transition history.
export const projectStageProgress = sqliteTable(
  "project_stage_progress",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    stageKey: text("stage_key").notNull(),
    status: text("status").notNull().default("pending"),      // 'pending' | 'active' | 'completed' | 'skipped'
    startedAt: integer("started_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    completedById: text("completed_by_id").references(() => users.id),
    notes: text("notes"),
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [unique("project_stage_unique").on(table.projectId, table.stageKey)],
);

// Append-only timeline. Mirrors asset_history.
export const projectEvents = sqliteTable(
  "project_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),                  // 'created' | 'stage_advanced' | 'member_added' | ...
    actorId: text("actor_id").references(() => users.id),
    entityType: text("entity_type"),                          // 'task' | 'document' | 'member' | ...
    entityId: text("entity_id"),
    details: text("details"),                                 // JSON string
    createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
  },
  (table) => [index("project_events_project_created_idx").on(table.projectId, table.createdAt)],
);
```

**Seed** `project_stages` with: `planning` · `proposal` · `discovery` · `development` · `testing` ·
`deployment` · `closure` (sequence 1–7). Follow the `ensureDefaultCompany` pattern — an exported
`ensureDefaultStages(db)` called from the page-data loader.

**Reading `project_events.details`:** parse defensively, returning `{}` on malformed input — copy
`parseJsonDetails` from `getAssetHistory` in `src/api/assets.ts`.

### 1.2 Access control — `src/lib/project-access.ts` (write first)

```ts
export type ProjectRole = "owner" | "manager" | "contributor" | "viewer";
export type AccessLevel = ProjectRole;

export interface ProjectAccess {
  role: ProjectRole;
  canView: boolean;
  canContribute: boolean;   // tasks, comments, documents, daily updates
  canManage: boolean;       // stage advance, project edit, member management
  canOwn: boolean;          // archive, transfer ownership
}

/** Pure. Unit-tested exhaustively. */
export function resolveProjectAccess(
  user: { id: string; role: "user" | "lead" | "admin" },
  project: { id: string; ownerId: string },
  memberRow: { role: ProjectRole; isCurrent: boolean } | null,
): ProjectAccess | null;

/** Throws AppError("Project not found.") — never "forbidden". */
export async function assertProjectAccess(
  db: Database, user: AppUser, projectId: string, minLevel: AccessLevel,
): Promise<ProjectAccess>;

/** The scope every list query and every AI tool must start from. */
export async function visibleProjectIdsFor(db: Database, user: AppUser): Promise<string[] | "all">;
```

**Rules, in order:**

1. `user.role === "admin"` → full access to every project.
2. `projects.ownerId === user.id` → `owner`.
3. A `project_members` row with `isCurrent = true` → that row's role.
4. Otherwise → **no access**. The org chart grants nothing.

**Capability matrix:**

| Capability | owner | manager | contributor | viewer |
|---|:--:|:--:|:--:|:--:|
| View project, tasks, docs, timeline | ✓ | ✓ | ✓ | ✓ |
| Create/edit tasks, comment, upload docs, submit daily update | ✓ | ✓ | ✓ | — |
| Tick checklist items | ✓ | ✓ | own/assigned | — |
| Advance stage, edit project, manage members | ✓ | ✓ | — | — |
| Archive project, transfer ownership | ✓ | — | — | — |

> **"Not found", never "forbidden".** An error saying "you don't have permission" confirms the
> project exists. Every path — UI, server fn, AI tool — returns `{ error: "Project not found." }`.

### 1.3 Server functions — `src/api/projects.ts`

| Function | Method | Middleware | Access check | Returns |
|---|---|---|---|---|
| `getProjectsPageData` | GET | `authMiddleware` | `visibleProjectIdsFor` | `{ projects, summary, companies, today }` |
| `getProjectDetail` | GET | `authMiddleware` | `assertProjectAccess(viewer)` | `{ project, access, members, stages, progress, client, contacts }` |
| `getProjectTimeline` | GET | `authMiddleware` | `assertProjectAccess(viewer)` | `{ events }` (paged, capped) |
| `createProject` | POST | `authMiddleware` | any authed user; creator becomes `owner` | `{ success, projectId }` |
| `updateProject` | POST | `authMiddleware` | `assertProjectAccess(manager)` | `{ success }` |
| `archiveProject` | POST | `authMiddleware` | `assertProjectAccess(owner)` | `{ success }` |
| `transferProjectOwnership` | POST | `authMiddleware` | `assertProjectAccess(owner)` | `{ success }` |
| `addProjectMember` | POST | `authMiddleware` | `assertProjectAccess(manager)` | `{ success }` |
| `updateProjectMember` | POST | `authMiddleware` | `assertProjectAccess(manager)` | `{ success }` |
| `removeProjectMember` | POST | `authMiddleware` | `assertProjectAccess(manager)` | `{ success }` |
| `advanceProjectStage` | POST | `authMiddleware` | `assertProjectAccess(manager)` | `{ success, newStageKey }` |
| `getProjectStageConfig` | GET | `adminMiddleware` | — | `{ stages }` |
| `upsertProjectStage` | POST | `adminMiddleware` | — | `{ success }` |

**Every mutation writes a `project_events` row AND calls `logAuditEvent`** — mirroring `assignAsset`.

**Invariants to enforce:**

| Invariant | Implementation |
|---|---|
| A project always has ≥1 owner | Reuse the atomic `WHERE EXISTS` guard pattern from `updateEmployeeRole` (`src/api/employees.ts:74`) — refuse to remove/demote the last owner |
| `code` unique | DB unique + friendly `{ error }` on conflict |
| Members are never deleted | `removeProjectMember` sets `isCurrent = false`, `leftAt`, `leaveReason`, optional `replacedByUserId`. Their tasks/comments/updates stay attached |
| Only active employees can be added | Filter `users.isActive` in the picker query |
| Stage advance ordering | Close current stage (`completed`), open next (`active`), update `projects.currentStageKey` — in that order |

### 1.4 Feed Phase 0 the project blocker

`assessDeactivation` in `src/lib/employee-lifecycle.ts` must gain a fifth blocker:

```ts
| { code: "owns_projects"; message: string; projectIds: string[] }
```

`gatherDeactivationSnapshot` in `src/api/employees.ts` gains `ownedProjectIds`, and
`deactivateEmployee` requires a per-project new owner before proceeding. **This is a Phase 1
deliverable, not optional** — it is the reason Phase 0 exists.

### 1.5 Migration

```bash
bun run db:generate     # → drizzle/0011_*.sql  — READ IT
bunx wrangler d1 migrations apply DATABASE --local
```

---

## 2. Frontend

### 2.1 `src/routes/_authenticated.projects.tsx` — project list

```ts
const projectsSearchSchema = z.object({
  tab: z.enum(["active", "all", "archived"]).optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/projects")({
  validateSearch: (search) => projectsSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,                    // REQUIRED — assets route omits this and breaks
  loader: async ({ deps }) => ({ data: await getProjectsPageData({ data: deps }) }),
  component: ProjectsPage,
});
```

Layout: `<Page>` → `<PageHeader title="Projects" actions={<Button>New Project</Button>}>` →
`<ProjectStatsCards>` → `<PillToggle>` → `<ProjectTable>` → `<ProjectFormDialog>`.

Shows **only projects the user can see**. An empty list for a non-member is normal, not an error.

### 2.2 `src/routes/_authenticated.projects.$id.tsx` — project detail

```ts
const detailSearchSchema = z.object({
  tab: z.enum(["overview","tasks","checklist","documents","discussion","timeline"]).optional(),
  view: z.enum(["list","board","gantt","calendar"]).optional(),   // Phase 2
});
loader: async ({ params }) => {
  const data = await getProjectDetail({ data: params.id });
  if (!data || "error" in data) throw notFound();
  return { data };
}
```

Tab state in the URL, default tab represented as `undefined` so `/projects/x` stays clean:

```tsx
navigate({ to: "/projects/$id", params: { id },
  search: (prev) => ({ ...prev, tab: value === "overview" ? undefined : value }) });
```

**The `access` object from the loader drives every control's visibility.** Never rely on
`user.role` in the component — a global admin and a project manager have different project rights.

### 2.3 `src/routes/_authenticated.admin.projects.tsx` — admin config

Admin-only (the `_authenticated.admin.tsx` layout already guards `role === "admin"`).
Stage definitions CRUD, and in Phase 3 the checklist templates.

### 2.4 Components — `src/components/projects/`

| Component | Props | Notes |
|---|---|---|
| `ProjectStatsCards` | `summary` | Returns a bare fragment of `<StatCard>`; caller owns the grid |
| `ProjectTable` | `projects`, `onRefresh` | `DataTable*` wrappers + plain `<Table>` + inline `.filter()` |
| `ProjectFormDialog` | `open`, `onOpenChange`, `projectToEdit`, `companies`, `onSuccess` | `useState` per field; create/edit in one dialog keyed off `projectToEdit?.id` |
| `ProjectStatusBadge` | `status` | Driven by `PROJECT_STATUS_CONFIG` map |
| `ProjectHealthBadge` | `health` | green/amber/red; derived signal with manual override |
| `StageTracker` | `stages`, `progress`, `canManage`, `onAdvance` | Horizontal stepper; advance button gated on `canManage` |
| `MemberManagerDialog` | `projectId`, `members`, `activeUsers`, `access`, `onSuccess` | Add/edit/remove; remove asks for `leaveReason` + optional successor |
| `MemberRoleBadge` | `role` | owner/manager/contributor/viewer |
| `ClientContactsPanel` | `companyId`, `contacts`, `canManage` | CRUD for client-side people |
| `ProjectTimeline` | `events` | Reads `project_events`; parse `details` defensively |

**Refresh after every mutation:** `const router = useRouter(); router.invalidate();`

### 2.5 Navigation — `src/lib/navigation.ts`

```ts
{ href: "/projects", label: "Projects", icon: FolderKanban, allowedRoles: ["user","lead","admin"] },
{ href: "/admin/projects", label: "Project Settings", icon: Settings2, allowedRoles: ["admin"] },
```

`/admin/*` lands in the "Administration" sidebar group automatically.

---

## 3. Verification

1. `bun run db:generate` → **read the SQL** → apply locally.
2. `bun run test` — `project-access.test.ts` is the critical suite. Full matrix:
   **admin · owner · manager · contributor · viewer · non-member · removed member
   (`isCurrent = false`) · deactivated user**, against **view · contribute · manage · own**.
3. `bun run typecheck && bun run check`.
4. `bun run build` (regenerates the route tree — new routes will not typecheck until then).
5. Manual: create a project as admin → add a `viewer` and a `contributor` → sign in as each →
   confirm the viewer sees no mutation controls, and a **non-member hitting `/projects/<id>`
   directly gets not-found**.
6. **Direct RPC probe — the important one.** Call `updateProject` / `addProjectMember` from the
   browser console as a non-member. Route guards do **not** protect server functions; this is what
   verifies `assertProjectAccess` actually holds.
7. Confirm removing the last owner is refused, and that a removed member's tasks and comments
   still render with their name.
