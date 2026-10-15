# Conventions and Landmines

These are what the repo **actually does**, verified by reading it. Not stylistic preference.
Deviating creates code that looks foreign and breaks lint/typecheck.

---

## 1. Backend

### 1.1 Schema (`src/db/schema.ts`)

| Concern | Rule |
|---|---|
| Naming | SQL `snake_case` (`text("asset_tag")`), TS `camelCase` (`assetTag`) |
| Primary key | `text("id").primaryKey()`, value from `crypto.randomUUID()` **in app code**. No autoincrement, no `$defaultFn` |
| Timestamps | `integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`)`. Both nullable. **`updatedAt` is never auto-updated by SQL** — pass `updatedAt: new Date()` on every write |
| Date-only | `text` ISO `YYYY-MM-DD`. Never a timestamp |
| Booleans | `integer(name, { mode: "boolean" }).notNull().default(false)` |
| Money / fractions | `real()` |
| **Enums** | Plain `text()` with a **trailing comment listing the literals**. Enforcement is the zod validator in `src/api/`. No `pgEnum`, no `check()` (only `wfh_policy` uses `check`) |
| **Soft deletes** | **None.** Lifecycle is a `status` column; superseded rows use an `isCurrent` boolean (see `asset_assignments`) |
| Relations | **`relations()` and `db.query.*` are never used.** Every read is explicit `.select({...}).leftJoin(...)` |
| Self-FK | Needs the return annotation: `text("x_id").references((): AnySQLiteColumn => users.id)` |
| Indexes | Third callback arg as an **array**: `(table) => [index(...), unique(...)]` |

### 1.2 Server functions (`src/api/<domain>.ts`)

File layout: imports → non-server helpers → `// ─── Schemas ───` zod block → `// ─── Server Functions ───`.

```ts
export const doThing = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])                              // ALWAYS one of the three
  .inputValidator((data: unknown) => doThingSchema.parse(data))
  .handler(async ({ data: input, context }) => {
    try {
      const db = createDb(env.DATABASE);                      // inside handler, never module scope
      const admin = context.user;                             // never read the session directly
      if (!thing) return { error: "Thing not found." };       // expected failure
      await logAuditEvent(db, { actorId: admin.id, action: "update", entityType: "things", entityId: thing.id, newData: {...} });
      return { success: true };
    } catch (err) {
      return toClientError(err, "Failed to do thing.");        // unexpected failure
    }
  });
```

- Reads are `method: "GET"`, mutations `method: "POST"`.
- Read-only GETs generally **skip** the try/catch.
- `updateXSchema = createXSchema.extend({ id: z.string() })`.
- Single-scalar input: `.inputValidator((data: unknown) => z.string().parse(data))`.
- Call sites pass the payload **nested**: `await doThing({ data: {...} })`.
- Cross-module DB helpers are plain exported async functions (see `ensureDefaultCompany` in
  `src/api/assets.ts`, imported by `deployments.ts`).

> ⚠️ **`src/lib/server-fn.ts` says it plainly:** server functions are publicly reachable RPC
> endpoints and **route guards do NOT protect them**. Every server function needs a middleware.

### 1.3 Authorization

Three roles: `user | lead | admin` on `users.role`.
**`lead` is derived at read time** in `src/lib/current-user.server.ts` — if any *active* user has
`peerLeadId = you`, your in-memory role is upgraded. There is no roles table.

| Middleware | Allows |
|---|---|
| `authMiddleware` | Any signed-in, still-employed user |
| `approverMiddleware` | `lead` or `admin` (leads scoped to direct reports **at the call site**) |
| `adminMiddleware` | `admin` only |

Row-level "self-or-admin" checks happen **inside** the handler after `authMiddleware`
(see `acknowledgeAssetReceipt` in `src/api/assets.ts`).

### 1.4 D1 has no transactions

`db.transaction()` is not available here. Multi-write handlers issue sequential `await`s.
**Order the authoritative write last** when a partial failure should be retryable, and make each
step idempotent. Document the ordering in a comment.

### 1.5 Migrations

```bash
bun run db:generate                                   # emits drizzle/NNNN_*.sql + snapshot + journal entry
# READ THE EMITTED SQL BEFORE APPLYING
bunx wrangler d1 migrations apply DATABASE --local
bunx wrangler d1 migrations apply DATABASE --remote   # production
```

> ⛔ **Never run `bun run db:migrate:prod`, `bun run deploy`, or any `wrangler ... --remote`.**
> Production is human-run only. See `00-OVERVIEW-AND-STATUS.md` §0.

> ⚠️ **Never use `bun run db:push`.** It writes `schema.ts` straight to the database with no
> migration file — **and it targets PRODUCTION**, because `drizzle.config.ts` uses
> `driver: "d1-http"`. The same is true of `db:pull` and `db:studio`. Changing a column *default*
> makes drizzle rebuild the whole table (`PRAGMA foreign_keys=OFF` → `__new_*` → `INSERT…SELECT` →
> drop → rename). Safe, but review it.

### 1.6 Policy modules and tests

Business rules go in a **pure** `src/lib/<domain>-policy.ts` with a `.test.ts` that
**imports the real module**.

> ⚠️ Follow `leave-policy.test.ts` / `wfh-policy.test.ts`, **not** `asset-policy.test.ts` —
> the latter re-declares its logic locally and therefore tests nothing that ships.

Vitest config only picks up `src/**/*.test.ts` — **`.test.tsx` files are not run.**
Environment is `node`, so no component tests today.

---

## 2. Frontend

### 2.1 Data flow — router loaders only

**React Query is installed and has ZERO usages.** Do not introduce it.

```
createServerFn (GET) → route loader → Route.useLoaderData()
       → mutation calls the server fn inside useTransition()
       → router.invalidate()
```

- Route context comes from `beforeLoad` and is read with `Route.useRouteContext()`
  (that is how `user`, `notifications`, `pendingApprovalCount` reach `Shell` without a refetch).
- `loaderDeps: ({ search }) => search` is **required** for a loader to re-run on search changes.
- Client-side result branching is always `if ("error" in res && res.error)`.

> ⚠️ **Refresh must be `useRouter().invalidate()`.**
> `_authenticated.admin.assets.tsx` uses `navigate()` to the *current* location, which is a no-op
> in TanStack Router — its tables show stale data after every mutation. Do not copy it.
> 17 other call sites do it correctly.

### 2.2 Routing conventions (`src/routes/`, flat dot-notation)

| Pattern | Meaning |
|---|---|
| `_authenticated.foo.tsx` | `_` = pathless layout; contributes a guard + `<Outlet/>`, no URL segment |
| `a.b.c.tsx` | `.` is a path separator → `/a/b/c` |
| `$id` | Route param → `params.id` |
| `.index` | Matches the parent path exactly |
| `$.tsx` | Splat |
| `-foo.test.ts` | `-` prefix = **excluded** from the route tree (used to co-locate tests) |

`src/routeTree.gen.ts` is generated by the vite plugin. **A new route file will not typecheck
until the tree regenerates** — run `bun run build` (or `bun run dev`) after adding one.

### 2.3 Forms — no library

No react-hook-form, no zodResolver, no shadcn `<Form>`. The pattern is:

```tsx
const [isPending, startTransition] = useTransition();
const [field, setField] = useState(initial ?? "");

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (!field.trim()) { toast.error("Please fill in all required fields."); return; }
  startTransition(async () => {
    try {
      const res = await someServerFn({ data: { field: field.trim() } });
      if ("error" in res && res.error) { toast.error(res.error); return; }
      toast.success("Saved"); onOpenChange(false); onSuccess();
    } catch (_err) { toast.error("Failed to save"); }
  });
};
```

Markup: `<Dialog><DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">`,
fields in `grid grid-cols-1 sm:grid-cols-2 gap-4`, each field
`<div className="space-y-1.5"><Label htmlFor>…<span className="text-destructive">*</span></Label>…</div>`,
closing with `<DialogFooter>`. Reusable mutation logic goes in a co-located hook
(`useEmployeeEdit.ts`, `useRequestActions.ts`), not a library.

### 2.4 Tables — no TanStack Table

Plain `<Table>` primitives inside `DataTableContainer` / `DataTableToolbar` / `DataTableFilters` /
`DataTableActions`, filtered with a single inline `.filter()` predicate. Filter state is local
`useState`; only the *tab/view* lives in the URL. Row click opens a detail drawer; interactive
cells call `e.stopPropagation()`. Destructive delete uses native `confirm()` — there is no
AlertDialog primitive.

### 2.5 UI library is base-ui, NOT Radix

`@base-ui/react`. Two differences that break copy-pasted shadcn snippets:

- Composition is `render={<Link to="..." />}`, **not** `asChild`.
- `<Select>` needs an explicit children-render inside `<SelectValue>`, and `onValueChange`
  **can fire with an empty string** — always guard: `onValueChange={(v) => { if (v) setX(v); }}`.

### 2.6 Page shell

```tsx
<Page>                                   {/* min-w-0 space-y-6 — do NOT re-add container/padding */}
  <PageHeader title="…" description="…" actions={…} leading={…} />
  <StatsRow />                           {/* grid gap-4 md:grid-cols-2 xl:grid-cols-4 of <StatCard> */}
  <PillToggle items={TABS} value={tab} onChange={handleTabChange} />
  {tab === "x" && <XTable … />}
  <TopLevelDialogs … />
</Page>
```

`Shell.tsx` already supplies the outer container, max-width and padding.
`PageHeader.title` is a `ReactNode` — inline badges are fine.
Stat rows: the child returns a bare fragment of `<StatCard>`s and the **caller owns the grid**
(see `PersonalStatsGrid` / `KpiCards`).

### 2.7 Status-colour registry

Mirror `src/components/admin/teamCalendarStyles.ts`: one frozen `as const` record mapping a
semantic key to a bundle of class strings, one per render context.

```ts
export const TASK_STATUS_CONFIG = {
  in_progress: {
    cell:   "border-status-logged-foreground/30 bg-status-logged text-status-logged-foreground",
    dot:    "bg-status-logged-foreground",
    legend: "bg-status-logged-foreground",
    icon:   Loader,
  },
  blocked: { /* pending/tentative variants use /NN opacity + border-dashed */ },
} as const;
```

Convention: `bg-status-X` = pale fill · `text-status-X-foreground` = readable text **and** the
solid colour for dots/bars/legends · `/NN` opacity for hover and pending · `border-dashed` for
tentative. One map drives the badge, the board card, the Gantt bar and the legend.

Available tokens (from `src/styles.css`): core shadcn set, `success` `warning` `info`, `weekend`,
`asset-capital` `asset-peripheral` `asset-digital`, `chart-1..5`, brand (`coral` `action-blue`
`deep-green` `dark-navy` `soft-stone` `pale-green` `pale-blue` `slate-muted` `ink` `hairline`),
and `status-{logged,leave,sick,personal,festival,wfh,holiday,pending,reentry}` each with a
`-foreground` pair.

> ⚠️ `src/config/theme.ts` is **dead code** — zero importers, and its header names a file that
> does not exist. `src/styles.css` is the source of truth.

### 2.8 Charts

Recharts is used exactly once (`StatsTimelineChart.tsx`). There is no shadcn `ui/chart.tsx`.
The idiom: fixed-height wrapper + `<ResponsiveContainer width="100%" height="100%">`, and
**theming via raw `var(--token)` strings passed to SVG props** (`stroke="var(--border)"`), never
Tailwind classes. Dark mode is then free. Gradient `<defs>` ids must be unique per chart instance.

---

## 3. Landmines

| # | Landmine | Consequence |
|---|---|---|
| 1 | **`border-radius: 0px !important`** on `*, ::before, ::after` in `styles.css`, and every `--radius-*` is 0 | Every `rounded-*` class in the repo is a **no-op**. Kanban cards and Gantt bars will be square. Only `[data-slot="avatar*"]` is exempt. To round something you must add a `data-slot` exception in `styles.css` |
| 2 | **No virtualization or pagination anywhere** | Every table renders all rows and filters client-side. A board/Gantt with hundreds of items is the first thing here to need windowing — and the `display: contents` row trick is **incompatible** with it. Filter server-side and cap result sets from day one |
| 3 | **No drag-and-drop anywhere** — no library, no native handlers | Kanban DnD is entirely net-new. Hence "menu moves now, `@dnd-kit` later" |
| 4 | `[data-slot="button"]` gets `transform: translateY(-1px)` on hover | Do not use `<Button>` as a drag handle |
| 5 | Popovers/dropdowns forced to `z-index: 1000 !important` | A drag overlay must beat that |
| 6 | `QuickLogCard.tsx:32` computes today via `new Date().toISOString()` (**UTC**) while the server uses timezone-aware `getTodayIsoDate()` | Off-by-one near midnight. **New features must take `today` from the loader payload**, as the assets module does |
| 7 | `notifyApprovers` notifies **every admin** for every request | Do not reuse it for per-project daily fan-out; target members directly |
| 8 | `isRequestNotification` in `NotificationBell.tsx:39` classifies by `type.startsWith("leave_"\|"wfh_")` | A new `eod_*` type silently falls outside the "Requests" and styled filters — update that branch |
| 9 | Vitest `include` is `src/**/*.test.ts` only | `.test.tsx` files are silently not run |
| 10 | `tsconfig.json` sweeps in gitignored `main_source/` | Breaks repo-wide `tsc` if that folder is present |
