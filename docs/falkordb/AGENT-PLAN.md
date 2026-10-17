# Brainee.org assistant: team questions and actions

Prepared 16 October 2026. Proposed requirements and acceptance checks; these capabilities have not been implemented or verified against FalkorDB.

Companion to [PLAN.md](./PLAN.md) and [GRAPH-MODEL.md](./GRAPH-MODEL.md).

## 1. The product goal

Build an assistant that answers questions across the application using the signed-in person's permitted data, explains its sources, and performs requested actions through the same business rules as the normal screens. Initial scope is your own team, with local Docker and FalkorDB.

FalkorDB connects employees, reporting lines, projects, tasks, leave, and history. The assistant still needs explicit tools, date rules, reliable inputs, policy sources, and authorization. A graph migration alone does not provide these answers. Start with structured queries and approved policy text; embeddings, vector search, and unrestricted model-generated Cypher are not prerequisites.

## 2. Your examples become acceptance criteria

| Your question | Required behavior | Required data and limits |
|---|---|---|
| Who is on leave coming Monday? | Resolve the date in Asia/Kolkata; show the exact date, authorized names, and full/half-day absence; link accessible records | Active roster, working calendar, leave intervals and portions, operational status rules. Pending requests appear separately if authorized; do not count them as approved absence |
| What are the next days with full office strength? | Search forward and return the next three qualifying working dates, or explain why none can be established within the search window | Complete roster and schedules, holidays, leave, WFH, offsite assignments. Confirmed definition: everyone physically present in the office for their scheduled hours |
| Which projects have too much manpower? | Compare time-bounded remaining work with available allocated hours; show inputs and missing information; flag possible spare capacity only when evidence supports it | Current memberships, effective allocations, schedules, leave, remaining effort and deadlines. Headcount or open-task count alone cannot establish overstaffing |
| What is the leave policy? | Explain the effective approved policy, cite its version/sections, distinguish general rules from the user's balance and eligibility | Published policy text plus structured leave rules. If no approved policy exists, say so; sample configuration is not authoritative HR policy |
| Apply leave for me coming Wednesday | Resolve date, identify leave type and full/half day, validate eligibility/balance/overlap, show the proposed request, obtain explicit confirmation, submit through the leave domain operation, return its record and actual status | Verified session identity, current policy and balance, action preferences, proposal and operation receipts. Submission normally creates a request awaiting approval; it does not grant approval |

Examples are requirements, not instructions to submit an actual leave request now.

## 3. Existing foundation and specific gaps

The current assistant already has tools for projects, tasks, workload, team lookup, availability, leave balances/history, assets, timesheets, and proposed actions. It stores conversations, tool invocations, citations, and confirmation proposals. Reuse this foundation rather than start another chatbot.

| Inspected source | Finding and planned work |
|---|---|
| `src/lib/ai/tools/team-availability-tools.ts` | Fetches approved leave/WFH and affected users rather than a full roster; cannot prove full strength. Reject invalid supplied dates instead of silently using defaults; align absence status and half-day rules with the normal app |
| `src/lib/ai/normalization/relative-date.ts` | Does not recognize “coming Monday”; the existing “next” behavior adds another week. Define one server-side interpretation, show the absolute date, and test all tools against it |
| `src/lib/ai/tools/project-standup-tools.ts` | Workload currently sums open tasks and estimates by assignee. Include current members with zero tasks, distinguish missing estimates from zero effort, and add period/capacity calculations before drawing staffing conclusions |
| `src/lib/ai/tools/leave-tools.ts` | Leave drafting already previews policy and balances. Extend explicit day portions and handle missing leave type without guessing sick/personal leave |
| `src/api/ai-assistant-proposals.ts` | Confirms user-owned proposals through existing domain functions. Preserve validation; add an atomic operation receipt and replay/reconciliation so a timeout between submission and proposal status update cannot produce duplicate leave |
| Tool registry and system prompt | No dedicated approved leave-policy source tool was found. Add policy retrieval and remove conflicting instructions that tell the model both to use server date resolution and to calculate dates itself |

Audit every tool's access scope, not only project tools. In particular, pending-approval reads must restrict leads to their permitted reports; an admin/lead role check alone is insufficient. Team availability should disclose availability, not private reasons or sensitive leave categories unless the caller is entitled to them. Existing citations must also enforce access when opened.

## 4. Calendar and availability defaults

Use the existing Asia/Kolkata timezone and a server clock injected into tests. “Coming Monday” means the next occurrence strictly after today; show its absolute date in the answer. An ambiguous date must produce a clarification rather than silently moving a request. Use the same resolver in reads, proposals, and forms.

Use the app's operational absence predicate, including approved leave whose cancellation is still pending. Keep pending applications separate. Split days into morning/afternoon availability where day portions matter; overlapping records must not subtract capacity twice. WFH is working time, not automatically absence from work.

Suggested search default: from the next working day, up to 60 calendar days ahead, returning the first three matches. Report the searched interval and roster size. This is planned availability based on recorded schedules, not a guarantee of future attendance. Do not call a weekend/holiday “full strength” simply because no leave exists.

The denominator is the full eligible office roster normally scheduled to work on each date, respecting joining/departure dates and individual working schedules. Do not remove employees from that denominator because they have approved leave, WFH, or offsite work. Those records reduce physical presence instead. A full-strength date requires every eligible employee to be planned physically present for all their scheduled hours. Half-day leave, WFH, or offsite work prevents a full-day match; morning/afternoon counts may still be shown. An unknown office assignment or schedule produces an incomplete-data result. An empty or incomplete roster must not produce a 100% claim.

Confirmed by the user on 16 October 2026: full strength means everyone physically in the office. WFH remains working time for capacity calculations, but it does not count as office presence. Working-week and shift details still need to be supplied before calendar answers can be trusted.

## 5. Staffing analysis without guessing

Choose a date window and project scope. For each employee, calculate available working hours after holidays and leave, then apply a documented effective project allocation. Surface allocations exceeding total capacity rather than quietly normalizing them. Preserve people assigned to multiple projects in the calculation.

Compute the project's remaining effort due within that same window. Existing total estimates minus recorded actual hours may be a rough proxy only if those fields are maintained and represent compatible quantities; do not claim they are a reliable forecast. Missing deadlines, estimates, remaining-effort updates, allocations, or schedules lower coverage and can make the answer unavailable.

Show remaining effort, allocated available hours, the gap, period, source records, and data coverage. Zero hours and missing hours are different cases. A utilization threshold for “too much” must be an explicit team setting agreed before enabling that label. Until then, show the comparison and explain uncertainty. Skill requirements, deadlines, contingency, and non-task work may justify spare capacity. Do not automatically remove people from projects.

Start with project-scoped workload summaries; add a project capacity plan with dated required/remaining hours only when the team has a process to maintain it. Do not fabricate demand from membership counts or model intuition.

## 6. Policy knowledge

Introduce a separate `PolicyVersion` record for approved team policy text, with stable ID, policy key, version, effective dates, publication state, approver, and source/checksum. Structured sections carry stable citation anchors. An optional source file stays in R2; the queryable approved text/version stays associated with the graph record. Do not attach a company-wide policy to an artificial project merely to reuse project documents.

Resolve the version effective for the question's date and the caller's allowed scope. Published versions are immutable; replacements create new versions. Prevent overlapping effective published versions for the same policy scope. Policy approval here means a designated person marks the actual team policy as approved; the assistant cannot declare a document authoritative.

Use structured configuration and existing leave helpers for calculations. Use approved policy sections for explanation. When policy text and configured rules disagree, report the conflict and route it for correction; never let a language-model interpretation override the enforced submission rules. If no published source exists, answer only what the configured rules establish and label that limit.

Treat uploaded documents and comments as content, never as instructions that can alter tool permissions or authorize writes.

## 7. Action execution

```text
Signed-in request -> resolve identity, dates and missing fields
    -> preview using current rules, balance, overlap and permissions
    -> exact proposal: employee, type, dates, day portions, reason,
       chargeable days, balance impact and warnings
    -> explicit user confirmation -> revalidate -> guarded domain mutation
    -> operation receipt -> request link and actual approval status
```

Confirmed by the user on 16 October 2026: require explicit confirmation before submitting actions; read-only questions run immediately. An explicit initial request such as “apply for me” may create a draft but does not skip the confirmation step. A request lacking a required type or day portion needs that information; do not repeatedly ask for data already supplied.

Bind confirmation to a user-owned, expiring, immutable payload/version. Editing the proposal requires a fresh preview. Recheck current permissions and business state at execution; an old preview is not authorization. If meaningful dates, charge, policy, or balance impact changed, show the revised preview before proceeding.

Use the proposal ID plus payload fingerprint as the operation identity. Business write, audit, in-app notification, and receipt must be one guarded atomic graph operation. Persist the created record ID/status in the receipt; recover a failed proposal-status update from that receipt. Duplicate clicks, model retries, and network timeouts must return the original result or a truthful unknown/pending state, not create a second request. Do not say “applied” after only drafting, or “approved” after submitting.

The model cannot choose another actor, bypass approval, call arbitrary Cypher, or grant itself broader tools. Start with leave submission; extend cancellation, task updates, and asset actions individually with their own validations. An “apply for me” action always uses the verified user's identity, even when that person is an administrator.

## 8. Delivery order alongside the database migration

| Step | Deliverable | Evidence before expanding |
|---|---|---|
| A. Data contracts and calendar | Shared dates, roster/working-calendar contract, role scopes and absence predicates | Frozen-clock tests; exact-day and half-day results; invalid dates never silently default |
| B. Availability and policy | Leave-day answers, full-strength search for physical office presence, published policy retrieval | Known fixture answers with authorized citations; missing schedules/policy produce explicit limits |
| C. Leave action | Existing proposal flow through graph leave operations with durable receipts | Preview matches normal form; permission/expiry checks; one request under retries/timeouts; correct pending/approved status |
| D. Workload then capacity | Complete workload summary, followed by capacity comparison when maintained inputs exist | Hand-calculated period fixture, zero/missing distinctions, multi-project allocation and coverage checks |
| E. Remaining application tools | Migrate assets, timesheets, projects and history reads/actions through shared domain contracts | Inventory every tool's permissions, sources and failure behavior; no SQL/D1 runtime dependencies or second-database configuration |

Build A alongside migration contracts, B/C with people and approval migration, and D with project data. Build the replacement in a migration branch and test it using isolated FalkorDB fixtures and previously captured expected results. The completed app has only FalkorDB, with no database selector, D1 binding, SQL fallback, or dual writes. Final acceptance includes both the application migration and these assistant scenarios; moving chat history alone does not meet the goal.

## 9. Evaluation and release checks

Use deterministic fixtures and expected structured results for all five example questions before evaluating model phrasing. Then test paraphrases, follow-ups, and tool selection against those results; model text must not invent people, dates, totals, policy clauses, or successful writes.

Required cases: Friday “coming Monday”; Wednesday “coming Wednesday”; timezone midnight; year boundary; holidays/weekends; half-day leave/WFH; WFH or offsite work reduces presence without reducing the eligible roster; no confirmation means no action submission; pending cancellation; inactive/newly joining staff; zero staff; overlapping absences; no full-strength date in the window; unauthorized employee/project/policy; lead versus admin approval scope; missing demand/estimates; policy versions/conflicts; malicious document instructions; expired/rejected/edited proposals; balance changes after preview; concurrent duplicate submission; committed write followed by lost HTTP response; unavailable graph/model service.

Record actor, tool, date resolution, source IDs/versions, and operation outcome in the existing assistant/audit structures. Avoid unnecessary copies of leave reasons or credentials in logs. An unavailable data source must produce an unavailable answer, not a fabricated empty list or a fallback to mock data. Run these checks with named team accounts before any real team rollout.
