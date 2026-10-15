# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project Conventions

### Framework & Stack

- **Framework:** TanStack Start — for doubts, refer to the installed skill at `.agents/skills/tanstack-start/SKILL.md`
- **Runtime:** Cloudflare Workers via `@cloudflare/vite-plugin`
- **Database:** Cloudflare D1 (SQLite) with Drizzle ORM
- **Auth:** Temporary local email/password test login with signed sessions
- **UI:** shadcn/ui (base-nova style) + Tailwind CSS v4
- **Package manager:** Bun

### Production is off-limits

**Never touch production. This overrides any other instruction in this file.**

Do not run, and do not suggest running as a next step:

- `bun run db:migrate:prod` / any `wrangler ... --remote`
- `bun run deploy` / `wrangler deploy`
- `bun run db:push` (see below — it bypasses migrations entirely)
- `wrangler secret put`, or any command that writes to the deployed Worker or the remote D1

This includes **read-only** queries against `--remote`. There is no staging environment — one
`database_id` serves local and production — so a "harmless look" is still a production connection.

All work lands **locally only**: `--local` migrations, `bun run dev`, `bun run build`.
Deploying and migrating production are **human-run steps**, done deliberately by the maintainer.
When work is ready, say so and hand over the exact commands — do not run them.

If a task appears to require production, stop and ask.

### Cloudflare D1 & Wrangler

- Keep the D1 binding name in `wrangler.jsonc` consistent with code (e.g. if binding is `"DATABASE"`, use `env.DATABASE` not `env.DB`).
- Drizzle migrations output to `drizzle/`; `wrangler.jsonc` `migrations_dir` points there.
- After schema changes: `bun run db:generate` → **read the generated SQL** → `bunx wrangler d1 migrations apply DATABASE --local`
- **Never use `bun run db:push`.** It writes `schema.ts` straight to the database with no migration
  file. It has already been used here and desynced local D1 from `drizzle/`, producing columns that
  existed in shipped code but in no migration. Always `db:generate` → review → `migrations apply`.
- Schema changes are **additive and reversible by preference**: no destructive `DROP COLUMN` /
  `DROP TABLE` on a table holding data without saying so explicitly first. There are no soft
  deletes in this schema and several tables cascade — deleting a user destroys their timesheet and
  leave history.

### shadcn/ui

- Add components with: `bunx --bun shadcn@latest add <component>`
- Components land in `src/components/ui/`
- Path aliases `@/` and `#/` both resolve to `src/`

### Code Style & Component Architecture

- **File Length Constraint:** No code file should exceed 300 lines of code. Large monolithic views must be decomposed into focused subcomponents, dialogs, and domain sub-modules.
- **UI Components:** Always use standard design system primitives in `src/components/ui/` (`Button`, `Input`, `Checkbox`, `Badge`, `DropdownMenu`, `PillToggle`, `Dialog`, `Sheet`, `Select`, `Table`, `Card`, etc.). Do not build ad-hoc raw `<input>`, `<button>`, `<select>`, or CSS hover dropdowns.
- **ClickUp Design System Identity:** Dense productive AI SaaS aesthetics.
  - **Ink-black CTAs:** Primary actions use ink-black (`#202020`) with font weight 800 and `rounded-xl` (14px). Primary CTA is always black, never purple.
  - **Secondary Actions:** Pale lavender-grey (`#F1F1F9`) with purple text (`#7612FA`), `rounded-xl`.
  - **Rounded Modular Architecture:** Rounded geometry scale (`rounded-sm: 6px`, `rounded-md: 8px`, `rounded-lg: 12px`, `rounded-xl: 14px`, `rounded-2xl: 20px`, `rounded-section: 32px`, `pill: 9999px`).
  - **Subtle Elevation:** Soft elevation (`shadow-[0_1px_3px_rgba(0,0,0,0.10)]`) on white cards over canvas (`#FFFFFF`) or surface (`#F8F9FA`) with thin borders (`#CFCFCF`).
  - **Typography Hierarchy:** Plus Jakarta Sans for everything (display, headlines, body, compact UI; headlines tightly tracked at `-0.035em` to `-0.04em`); no Inter; Sometype Mono for taxonomy labels, module chips, and data codes.
  - **AI & Super Agent:** Pale purple containers (`#EFEDFD`), AI pink (`#FA12E3`) & cyan (`#12D0FA`) accents, and interactive action snippets.
  - **Brand Gradients:** ClickUp gradient marks combining purple-to-blue (`#6647F0` to `#0091FF`) and pink-to-orange (`#FF02F0` to `#F76808`).
- Route files go in `src/routes/` (file-based routing)
- DB schema lives in `src/db/schema.ts`
- Use `biome` for formatting and linting (`bun run check`, `bun run format`)
- Server functions in `src/api/` by domain
