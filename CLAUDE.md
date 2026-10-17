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
- **Database:** FalkorDB in local Docker, accessed through the private Node graph service
- **Auth:** Temporary local email/password test login with signed sessions
- **UI:** shadcn/ui (base-nova style) + Tailwind CSS v4
- **Package manager:** Bun

### Production is off-limits

**Never touch production. This overrides any other instruction in this file.**

Do not deploy, write deployed Worker secrets, run Wrangler commands with `--remote`, or connect to a production graph. This includes read-only production queries.

All work stays local: Docker graphs, `bun run dev`, tests and `bun run build`. Deployment and production changes are human-run steps. If a task requires production, stop and ask.

### FalkorDB and local data

- FalkorDB is the only application database. Do not add a selector, dual writes, SQL fallback or D1 binding.
- Typed fields and references: `shared/graph/models.json`; models: `src/db/models/`; parameterized query compiler: `shared/graph/`.
- The Worker calls the private graph service through `src/db/transport.server.ts`, deriving identity from the signed session. Tokens stay server-side. Preserve existing middleware and domain access checks.
- Schema changes are additive/checksum-checked. Use `bun run graph:migrate`, review constraints, then `bun run graph:test` locally.
- Use `bun run graph:backup` before data changes. Never delete the active volume or graph without explicit instruction.
- `bun run graph:seed` explicitly adds fictional samples; it must not run on startup or overwrite existing records.
- Keep new code files under 300 lines and verify app/service types, tests and app build. Production remains off-limits.

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
- `src/db/schema.ts` exports the typed graph models
- Use `biome` for formatting and linting (`bun run check`, `bun run format`)
- Server functions in `src/api/` by domain
