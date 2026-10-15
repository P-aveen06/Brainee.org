# Project Delivery Module + Scoped AI Assistant

**Living plan and status document.** Update the status tables as phases land.

| | |
|---|---|
| **Started** | 2026-08-29 |
| **Branch** | `new-features` |
| **Current phase** | All Phases (0–5) Complete |
| **Last verified** | 2026-08-29 — Biome clean (0 errors/0 warnings), `tsc --noEmit` clean, 113/113 tests passed, build OK (3.82s SSR build, 10 projects, 234 tasks, 7 daily updates, 2 EOD reports, 4 work flags, 3 AI conversations, 4 AI messages, 3 tool invocations, 2 proposed actions, all active files < 300 LOC) |

---

## 0. ⛔ Production is off-limits

**No agent or automated step touches production. Ever.** All work lands locally.
Deploying and migrating production are **human-run steps**, performed deliberately by the maintainer.

| Never run | Run instead |
|---|---|
| `bun run db:migrate:prod` | `bun run db:migrate:local` |
| `bun run deploy` / `wrangler deploy` | `bun run build` (verify only) |
| `wrangler ... --remote` (**including read-only**) | `wrangler ... --local` |
| `bun run db:push` | `bun run db:generate` → review SQL → apply locally |

**There is no staging environment.** `wrangler.jsonc` is a single flat config with one
`database_id`; `--local` vs `--remote` is the only separation. A "harmless look" at `--remote` is
still a production connection.

> ⚠️ **`db:push`, `db:pull` and `db:studio` target PRODUCTION, not local.** `drizzle.config.ts`
> uses `driver: "d1-http"` with `CLOUDFLARE_*` credentials — they connect to the remote D1 over
> HTTP. `db:studio` opens a GUI onto live company data. See `08-OPEN-ITEMS-AND-DEBT.md` §1.

---

## 1. Why this exists

Brainee.org is today an HR/operations app: leave, WFH, timesheets, holidays, employees, IT assets.
The company now needs to run **project delivery** in the same app — projects with full client
context, lifecycle stages, checklists, documents, discussions, tasks, a daily EOD ritual, and an
AI assistant available to every role.

Three requirements drive the hard parts of the design:

1. **"Capture all info, every doc, every step."** The system must *be* the project record, not a
   form with a few fields. This is why there is an append-only event timeline and real R2 document
   storage rather than a `notes` column.
2. **"People move off projects, people leave the job."** The app had **no concept of an employee
   leaving**. Without it every project accumulates ghost owners and departed leads keep receiving
   approval routing forever. This is why Phase 0 exists and shipped first.
3. **"The AI must never hallucinate and never go off topic."** This is an architectural
   requirement, not a prompt. It is solved by making the model *structurally unable* to invent
   facts — see [§7 Anti-hallucination](#7-phase-5--ai-assistant).

## 2. Decisions locked in

| Decision | Choice | Why it matters |
|---|---|---|
| Sequencing | Full data model designed up front, shipped in phases | Later phases never force a schema rewrite |
| Chatbot grounding | **Permission-scoped DB tools**, not RAG | Access control enforced in SQL, not by prompting |
| Documents | **Real uploads to R2** | Self-contained; own versioning and access checks |
| Model provider | **Deferred** | Kept behind one interface; decided at Phase 5 |
| Project access | **Explicit membership only** | Admins see all; the org chart grants nothing |
| Timesheets | **Untouched** | Daily updates are a separate per-project record |
| AI writes | **Propose → human confirms** | No autonomous mutations; audit shows a real actor |
| Work flags | On the **work item**, visible to the employee | No scoring, no hidden performance file |
| Offboarding | **App-wide employee lifecycle** | First employee-state concept in the app |
| Kanban | **Menu-based moves now**, `@dnd-kit` later | Same server fn either way; nothing wasted |
| EOD scheduling | **Computed on view** + manual nudge | No cron exists; always accurate |
| EOD delivery | Editable, copyable text saved in-system | Reminders ride existing in-app notifications |

## 3. Phase status

| Phase | Scope | BE | FE | Status |
|---|---|---|---|---|
| **0** | Employee lifecycle (departures) | ✅ | ✅ | **Complete** |
| **1** | Project spine, client context, membership | ✅ | ✅ | **Complete** |
| **2** | Tasks + list/board/gantt/calendar views | ✅ | ✅ | **Complete** |
| **3** | Checklists, R2 documents, discussions | ✅ | ✅ | **Complete** |
| **4** | Daily updates + EOD reports + work flags | ✅ | ✅ | **Complete** |
| **5** | AI assistant (read tools, proposals, guardrails) | ✅ | ✅ | **Complete** |

## 4. Documents in this folder

| File | Contents |
|---|---|
| `00-OVERVIEW-AND-STATUS.md` | This file — why, decisions, phase status |
| `01-CONVENTIONS.md` | Non-negotiable repo conventions + known landmines |
| `02-PHASE-0-EMPLOYEE-LIFECYCLE.md` | **Shipped.** Every file, function and query changed |
| `03-PHASE-1-PROJECT-SPINE.md` | Projects, clients, membership, stages, access control |
| `04-PHASE-2-TASKS-AND-VIEWS.md` | Tasks + the four views (list/board/gantt/calendar) |
| `05-PHASE-3-CHECKLISTS-DOCS-DISCUSSIONS.md` | Checklists, R2 documents, comments |
| `06-PHASE-4-EOD-AND-FLAGS.md` | Daily updates, EOD reports, work flags |
| `07-PHASE-5-AI-ASSISTANT.md` | Tools, guardrails, anti-hallucination, proposals |
| `08-OPEN-ITEMS-AND-DEBT.md` | Known bugs, deferred decisions, deployment cautions |

## 5. Complete target data model

15 tables exist today. Phase 0 added 4 columns to `users`. Phases 1–5 add **18 tables**.

| Phase | Table | Purpose |
|---|---|---|
| 0 | *(users +4 cols)* | `is_active`, `exit_date`, `exit_reason`, `deactivated_by_id` |
| 1 | `projects` | The project record + client commercial context |
| 1 | `client_contacts` | People on the client side |
| 1 | `project_members` | **The ACL** and the team roster over time |
| 1 | `project_stages` | Org-level lifecycle stage definitions |
| 1 | `project_stage_progress` | Per-project stage state + transition history |
| 1 | `project_events` | Append-only timeline ("every step") |
| 2 | `project_tasks` | Work items, with subtasks |
| 3 | `project_checklist_templates` | Per-stage checklist defaults |
| 3 | `project_checklist_items` | Per-project checklist instances |
| 3 | `project_documents` | R2-backed documents with versioning |
| 3 | `project_comments` | Threaded discussion + decision records |
| 4 | `project_daily_updates` | Per-person, per-project, per-day submission |
| 4 | `project_daily_update_items` | Links an update to the tasks worked |
| 4 | `project_eod_reports` | Generated + hand-edited EOD text |
| 4 | `work_flags` | Advisory observations on tasks/updates |
| 5 | `ai_conversations` | Chat threads |
| 5 | `ai_messages` | Turns, with citations |
| 5 | `ai_tool_invocations` | Security audit trail (incl. denials) |
| 5 | `ai_proposed_actions` | Pending writes awaiting human confirmation |

## 6. Route map (target)

| Route | Access | Phase |
|---|---|---|
| `/access-ended` | Deactivated only | 0 ✅ |
| `/projects` | All roles (own projects only) | 1 ✅ |
| `/projects/$id` | Project members | 1 ✅ |
| `/admin/projects` | Admin (stage + template config) | 1 ✅ |
| `/my-tasks` | All roles | 2 ✅ |
| `/assistant` | All roles | 5 |

## 7. Navigation additions

`src/lib/navigation.ts` is a single flat `NAV_ITEMS` array; `AppSidebar` auto-partitions by
`/admin` prefix. Adding a module is one object.

```ts
{ href: "/projects",  label: "Projects",  icon: FolderKanban, allowedRoles: ["user","lead","admin"] },
{ href: "/my-tasks",  label: "My Tasks",  icon: ListChecks,   allowedRoles: ["user","lead","admin"] },
{ href: "/assistant", label: "Assistant", icon: Sparkles,     allowedRoles: ["user","lead","admin"] },
{ href: "/admin/projects", label: "Project Settings", icon: Settings2, allowedRoles: ["admin"] },
```

> `allowedRoles` is **cosmetic only**. Real enforcement is `beforeLoad` + server-fn middleware.
> A count badge needs a hardcoded branch in `AppSidebar.tsx` — `NavItem` has no badge field.
