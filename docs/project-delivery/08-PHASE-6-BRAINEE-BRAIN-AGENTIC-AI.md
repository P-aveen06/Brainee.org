# Phase 6 — Brainee.org Brain Agentic Workspace Intelligence

## Objective

Upgrade the completed Phase 5 assistant from a single-hop tool caller into a bounded, secure
workspace agent that can investigate related records, understand the authenticated screen context,
compare meeting transcripts with project truth, and prepare confirmation-gated business actions.

This phase intentionally excludes visual polish. The work is backend orchestration, domain
intelligence, security, grounding, page context, transcript analysis, tests, and observability.

## Product contract

Brainee.org Brain must:

- perform read-only investigation without asking permission;
- resolve ordinary project names, human leave terms, brands, and relative dates;
- chain dependent tool calls in one user turn;
- compute dates, counts, balances, health metrics, and working days in backend code;
- understand the current screen without trusting client-supplied authorization data;
- compare a transcript with accessible project records and classify new information, possible
  contradictions, decisions, actions, risks, dependencies, and open questions;
- require explicit confirmation for every business mutation;
- stop at deterministic cost, call, result-size, and duration budgets;
- distinguish an empty result from an error and answer honestly;
- accumulate model usage and grounding evidence across the entire turn.

The system reduces hallucination risk; it does not claim that free-form model output can be made
mathematically hallucination-free.

## Execution order

1. Proposal security and deterministic domain normalization.
2. Bounded multi-hop turn execution and cumulative accounting.
3. Reliable turn persistence and complete history reconstruction.
4. Verified assistant context across authenticated screens.
5. Transcript extraction, project comparison, and proposed updates.
6. Evaluation suite, observability, and measured tool-catalog optimization.

## 1. Bounded multi-hop turn engine

Each user turn supports up to three tool rounds followed by exactly one final synthesis call.

```text
user request
  -> completion with tools
  -> execute authorized bounded calls
  -> persist assistant call + matching tool results
  -> accumulate evidence, proposals, tokens, bytes, and latency
  -> repeat when the model needs more evidence
  -> completion without tools when answered or budget exhausted
  -> validate and persist visible answer
```

Initial limits:

```ts
MAX_TOOL_ROUNDS = 3
MAX_TOTAL_TOOL_CALLS = 16
MAX_TOOL_CALLS_PER_ROUND = 6
MAX_TOOL_RESULT_ROWS = 100
MAX_TOOL_RESULT_BYTES = 128_000
MAX_CONVERSATION_HISTORY_ROWS = 80
MAX_TURN_DURATION_MS = 25_000
```

Rules:

- Tools remain available after rounds one and two.
- Identical calls in one turn are deduplicated.
- Dropped and denied calls are audited.
- A forced final completion never receives tools.
- Reaching a limit produces a best-effort grounded answer, not another tool call.
- Token usage is summed across every completion, including the initial routing call.
- Tool-result size is budgeted in addition to call count.

Implementation is split across `assistant-turn.ts`, `turn-tool-round.ts`, `turn-budget.ts`, and
`turn-history.ts` so the orchestration remains reviewable.

## 2. Reliable persistence

Multi-hop history cannot be reconstructed from the last ten arbitrary rows or timestamp ordering.
Use complete turns and deterministic sequence numbers.

Add an `ai_turns` table with status, model, rounds, calls, cumulative token usage, result bytes,
latency, timestamps, and failure code. Add `turn_id`, `sequence`, and `tool_round` to
`ai_messages`; add turn/round/duration/result-size fields to `ai_tool_invocations`.

All schema changes are additive. Generate and review a Drizzle migration, then apply it only to the
local D1 database during development.

History selection must never start with an orphaned tool result or remove half of a tool exchange.
The provider history query is capped at 80 persisted message/tool rows, then drops any incomplete
oldest turn prefix before sending the messages to the model.

## 3. Deterministic domain intelligence

### Relative dates

Backend code resolves `today`, `tomorrow`, `day after tomorrow`, weekday expressions, and supported
partial dates against `Asia/Kolkata`. Ambiguous phrases return structured ambiguity rather than a
guessed date.

### Leave preview

Proposal and confirmation share one preview/validation path for configured leave type, dates,
weekends, holidays, overlap, balance, notice rules, full-day defaults, required reason, and exact
business days. Confirmation reruns validation because state may have changed after proposal.

### Metrics

Tools return precomputed asset group counts, project-health metrics, task counts, leave balances,
availability, workload, overdue totals, and approval totals. The model explains values but does not
calculate them.

## 4. Tool strategy

Keep the existing domain tools while multi-hop execution is introduced. They already encode useful
capability and authorization boundaries. Standardize their result envelope with data, structured
facts, grounded records, proposal draft, row count, truncation, and result bytes.

Only after evaluations pass should a smaller facade be compared against the existing catalog:

- `search_workspace`
- `get_project_context`
- `get_my_work`
- `get_people_availability`
- `get_asset_inventory`
- `propose_action`

Facade tools delegate to domain services; they do not contain a universal SQL switch. Existing
tools are retired only after a capability matrix proves that projects, tasks, risks, checklists,
documents, discussions, timelines, standups, EOD, workload, leave, approvals, assets, and
timesheets remain covered.

## 5. Authorization

Authorization is application-enforced query scoping, not native SQLite row-level security. Define
explicit project, task, people, leave, approval, asset, document, discussion, and transcript scopes.

Client-supplied IDs, filters, roles, and screen context are untrusted. Every tool reloads the target
and derives permissions from the authenticated user. Sensitive nonexistent and unauthorized records
return the same external not-found response. Detailed denial reasons stay in the audit trail.

## 6. Proposed-action security

Proposals use a discriminated allowlist. Unknown action types are rejected and never marked
confirmed. Confirmation atomically claims a pending proposal, parses its action-specific schema,
rechecks ownership and current authorization, reruns domain validation, executes through the same
core function as the normal UI, and records confirmed or failed status.

Statuses are `pending`, `executing`, `confirmed`, `rejected`, `expired`, and `failed`. Repeated or
concurrent confirmation cannot execute the underlying mutation twice. The acting user always comes
from authenticated context.

## 7. Turn-wide grounding

Accumulate record IDs, labels, structured facts, and tool-result hashes across all rounds. Citation
validation checks the complete evidence set. Important numerical statements come from structured
facts. Untrusted task, comment, document, discussion, and transcript text remains data regardless of
embedded instructions.

Tool-result delimiters are defense in depth, not a security boundary. Limit raw text, sanitize
internal paths and storage keys, and never expose a record the caller could not query directly.

## 8. AI on every authenticated screen

Every screen may register an `AssistantPageContext` containing route ID, screen name, primary entity,
selected entity IDs, active tab, filters, search query, and date range. The global assistant sends
this context with a message.

The server validates the schema, reloads entities from D1, applies domain authorization, removes
unverified IDs, and supplies only verified context to the turn engine. Context narrows a request; it
never grants access.

Supported contextual work includes dashboard briefings, portfolio comparison, project health,
task explanation and decomposition, calendar capacity, approval summaries, asset analysis, and
admin anomaly summaries. Read operations may run autonomously; allowed mutations remain proposals.

## 9. Transcript intelligence

Text transcripts are supported first. Audio/video requires a separate speech-to-text stage before
analysis. Long transcripts are chunked by speaker/topic/size while preserving timestamp and speaker
source spans.

The pipeline:

```text
verified project context
  + transcript chunks
  -> structured claim extraction
  -> entity/date resolution
  -> authorized project evidence retrieval
  -> comparison
  -> findings report
  -> optional confirmation-gated updates
```

Extract decisions, actions, deadlines, statuses, ownership, risks, issues, dependencies, scope
changes, requirements, and open questions. Classify comparisons as `confirmed`, `new_information`,
`possible_contradiction`, `project_data_may_be_stale`, `duplicate`, `unverifiable`, or
`requires_clarification`.

A contradiction is a mismatch requiring review, not a declaration that either source is true.
Every finding includes transcript source span, compared project evidence, and confidence. Suggested
task/risk/decision/date/owner/status updates are proposals only.

Initial analysis may be on demand. Durable project memory stores reviewed transcripts and insights;
only accepted insights become project facts.

## 10. Project-management intelligence scope

Priority 1: daily briefings, status-report drafts, risk detection, decision register, meeting-to-work
conversion, missing-update detection, and verified project Q&A.

Priority 2: task decomposition, dependency analysis, change-impact analysis, workload/capacity, and
milestone readiness.

Priority 3: cross-project risks, shared team dependencies, portfolio comparison, and historical
delivery patterns after sufficient reliable data exists.

Priority 4: proactive briefing and reminder drafts. Proactive features initially create suggestions;
they do not autonomously notify people or mutate records.

Employee performance scoring, unrestricted HR access, autonomous approvals, destructive admin
actions, and confident forecasting from sparse data are out of scope.

## 11. Verification

Unit tests cover date resolution, ambiguous matching, shared leave preview, budgets, deduplication,
proposal idempotency, context validation, transcript claim schemas, and comparison classification.

Stub-provider integration tests cover search-to-detail chaining, empty results, alternate lookup after
tool failure, malformed arguments, provider timeout, budget exhaustion, cumulative usage, complete
history replay, cross-round citations, restricted resources, screen-context spoofing, and transcript
comparison.

Acceptance scenarios:

- `Apply for sick leave tomorrow` produces one correct full-day proposal without questioning.
- `How many Acer?` returns a backend-computed authorized total and model groups.
- `How is Unilever doing?` chains discovery and project metrics in one turn.
- `What needs attention here?` uses verified current-screen context.
- A transcript reports new information, possible contradictions, decisions, actions, risks, and open
  questions with both transcript and project evidence.
- Unknown, expired, duplicate, or unauthorized proposal confirmation cannot mutate data.

Local verification:

```bash
bun run check
bun run typecheck
bun run test
bun run build
```

Schema work additionally uses reviewed generated SQL and the local D1 migration command only.

## Implementation status — 2026-08-30

Delivered in the first execution slice:

- bounded three-round/eight-call orchestration, duplicate-call suppression, forced synthesis, and
  cumulative token/result-byte accounting;
- deterministic turn, message, invocation, proposal, and evidence persistence through an additive
  migration applied to local D1;
- allowlisted, atomically claimed proposal execution for leave, task status, task creation, and
  asset issues through the same authorized application services as the normal UI;
- backend relative-date and leave-type normalization plus shared leave preview/confirmation rules;
- server-verified route, project, task, and permitted employee page context for the global assistant;
- text-transcript claim comparison for deadlines, owners, status, risks, issues, decisions,
  dependencies, requirements, and action items;
- confirmation-gated creation of project tasks from clear transcript action items;
- deterministic routing for leave applications and cancellations, including confirmation-gated
  cancellation of real pending or approved leave requests;
- explicit 8-second tool, 15-second provider, 25-second server-turn, and 32-second client timeout
  boundaries with persisted timeout/interruption failures and stale-turn recovery;
- backend-grouped asset inventory totals and bounded result samples;
- unit coverage for normalization, proposal schemas, page context, turn budgets, and transcript
  comparison.

Remaining execution slices:

- register route-specific selected rows, tabs, filters, date ranges, and search state on every
  authenticated feature screen; the verified context contract and global route context are ready;
- add audio/video upload and speech-to-text before the existing text-transcript comparison stage;
- persist reviewed transcripts, decisions, risks, and accepted insights as durable project memory;
- expand confirmation-gated actions for owners, due dates, risks, decisions, and dependencies;
- add stub-provider multi-round integration tests, operational dashboards, retention controls, and
  measured tool-catalog optimization.

## Definition of done

Phase 6 is complete when multi-hop reads are bounded and audited; cumulative usage is enforced;
history is deterministic; domain calculations are shared and exact; screen context is server
verified; transcripts can be compared with authorized project data; possible contradictions are
evidence-backed; mutations are idempotent proposals; and all local checks pass.
