# Company Brain repair checklist

18 October 2026. Reconciles the user's 20 findings with the prior 100-question evaluation. Chat remains the primary workflow; finding related work across different wording is the user's highest evaluation priority. All implementation and engine verification are local. Existing unrelated working-tree changes are preserved.

## Verified outcome

- Local MiniLM embeddings, FalkorDB vector/full-text indexes and explicit graph expansion are running. Runtime reads local model files; company text is not sent to an embedding provider.
- The 20-paraphrase retrieval corpus found every expected task in the top five: recall@5 **1.00**, mean reciprocal rank **0.85**. Six of twenty targets ranked second; ranking still has room to improve. This small synthetic corpus is not a production quality estimate.
- A disposable graph with 1,000 tasks indexed in **4,356 ms**. Fifteen queries across three payment paraphrases all found the target in the top ten; median **7 ms**, p95 **20 ms**. Timings exclude model answer generation and do not establish large-company capacity.
- All **22** local checks for earlier chat regressions pass. The running demo has **175** semantic passages, zero index failures, ten projects and **zero document versions**.
- App: **298 tests / 54 files**, TypeScript and Worker build pass. Graph: six boundary tests and two disposable-engine integration tests pass. Python: twelve unit tests and six disposable-engine integration tests pass.
- The original 100 questions are retained with a rubric. **A new 100-question chat score has not been produced.** Automatic approval review blocked use of the configured external chat provider pending user approval. Retrieval and tool-contract results cannot substitute for that score.

## Evaluation regressions

| ID | Root cause and repair | Verification / remaining limit |
|---|---|---|
| E1 | Optional blank status hid valid projects. Normalize optional blank arguments; list-project handler also ignores blank status. | All evaluated roles retain expected counts and resolve each project by name/code in live local checks. |
| E2 | Optional blank task ID rejected implementation context. | Parser regression passes. |
| E3 | Leave request history triggered creation intent; blank status hid history. | Intent regression and Anika's approved 19 October leave check pass. |
| E4 | Ten per-project calls exceeded the six-call round budget. | One paginated portfolio tool covers each section across permitted projects. All five sections cover the architect's ten projects; model selection still needs the chat rerun. |
| E5 | My-task results omitted assignee/effort. | Projection includes both; own-assignment checks pass for all evaluated roles. |
| E6 | Role/name filters excluded other reporting roles. | Dedicated reporting tool returns all five Aditi direct reports for HR. |
| E7 | Project/checklist stages, count definitions and history were conflated; answers could be clipped. | Explicit semantics/completeness and final-answer budget increased from 1,024 to 4,096 tokens. Cross-answer consistency still needs the rerun. |
| E8 | Previous raw capture was incomplete/clipped and had no predefined rubric. | Retained 100 prompts; resumable harness records complete answers, evidence and audit. Real turn loop/tools, but no HTTP middleware or browser verification. Rerun/scoring pending approval. |

## All 20 GraphRAG findings

| User ID | Implemented repair | Verification / remaining gap |
|---|---|---|
| 1 | Pinned local CPU embeddings and native cosine vector search. | Real encoder and engine tests pass; no embedding-provider calls. |
| 2 | Parent-task traversal, source/project edges, linked task comments and evidence paths. | Engine tests pass. Requirement, blocker-dependency and expertise graphs lack authoritative edges; broader organizational modeling remains open. |
| 3 | Reciprocal-rank fusion, exact-title boost and decision/source context. | Recall/MRR retained. Completeness is disclosed separately; calibrated relevance/confidence is not implemented. |
| 4 | Deterministic feature vocabulary plus semantic matching. | Payments, refunds, SSO, notifications and ingestion paraphrases pass without assistant synonyms. Not an exhaustive company ontology. |
| 5 | Better precedent candidates feed task-family expansion. | Corpus, root/leaf effort and structured reuse tests pass. Diverse real precedents remain unverified. |
| 6 | Scheduled backfill drains three due documents every five minutes using a configured administrator identity. | Job/authorization tests pass; local identity configured. No documents exist in the demo; populated R2 backlog and deployed scheduler unverified. |
| 7 | XLSX cells, PPTX slides, local image/scanned-PDF OCR, existing DOCX/PDF/text extraction, bounded inputs and locations. | OCR/office fixtures pass. English OCR only; legacy XLS/PPT, handwriting and complex layout accuracy not guaranteed. |
| 8 | Durable checksum-specific attempts, backoff, five-attempt exhaustion and recovery; storage errors do not abort the queue. | Checks cover retry state/reset, missing sources and unsupported outcomes. Populated scheduled ingestion remains unverified. |
| 9 | Citation chips open an authenticated current-version passage with coordinates. | URL, checksum/version and location tests pass. Native source viewer navigation to original PDF/slide coordinates remains future work. |
| 10 | Saved chat notices disclose absent/partial documents, degraded semantics and partial portfolio pages. | Deterministic tests pass. Live search reports zero documents. |
| 11 | Adaptation records matched/changed scope, assumptions, source effort, scale and extra hours. | Actuals preferred; missing totals unknown; intermediate tasks cannot inherit sibling effort. Tests pass. |
| 12 | Evidence confidence and missing-hour explanations remain separate from proposed hours. | Incomplete data stays null. Confidence describes support, not statistically calibrated estimate accuracy. |
| 13 | Up to ten editable destination task proposals through normal authorized creation. | Draft/access/schema tests and engine creation pass. Separate confirmation per task; bulk confirmation and hierarchy reconstruction remain open. New cards need browser interaction verification. |
| 14 | Source task/project, assumptions and DERIVED_FROM links persist. | Engine verifies links and rejects mismatched source projects. Edits cannot replace provenance or destination. |
| 15 | Expected-match corpus, per-case rank/latency, irrelevant alternatives, no-match case and original answer rubric. | Retrieval passes. Full 100-answer correctness/completeness/provenance/access/consistency scoring pending. |
| 16 | Nonidentical wording and related vocabulary against the real encoder/index. | 20 paraphrases and irrelevant-query rejection pass; broader held-out questions needed. |
| 17 | Native indexes, bounded batches/candidates, query embedding cache and disposable benchmark. | 1,000-task results retained. Concurrent load, large documents and substantially larger graphs unmeasured. |
| 18 | Private freshness/failure/count/latency diagnostics and search contribution/coverage. | Running index ready, 175 passages, zero failures. Historical dashboards, alerts and SLOs remain open. |
| 19 | Local Docker services and Worker artifact build; deployment assessment updated. | Hosting/networking/cost decision open. CLAUDE.md forbids production access/deployment; nothing deployed. |
| 20 | Docker access restored; authoritative local graph and semantic search verified. | Ten projects, zero documents. External company docs/tickets/chats and production coverage unverified. |

## Evidence and boundaries

- [Original evaluation](company-brain-question-evaluation-2026-10-18.md)
- [Original 100-question corpus and rubric](company-brain-evaluation-corpus.json)
- [22 live local regression results](company-brain-regressions-2026-10-18.json)
- [Per-paraphrase retrieval and scale measurements](company-brain-retrieval-verification-2026-10-18.json)
- [Implementation and local setup](../../services/graphrag/README.md)
- [Deployment boundaries](../falkordb/GRAPHRAG-DEPLOYMENT.md)

Backup predates derived-index writes: `.local/backups/falkordb/graph-2026-10-18T04-14-21-322Z.rdb`. No application graph was deleted/reset. Delivery retrieval remains company-wide for active employees, excludes HR projections, and grants no project mutation rights.

We cannot assign a defensible percentage to the Company Brain goal yet. Remaining proof gaps include a scored chat rerun, real source coverage/synchronization, broader organizational relationships and operational deployment/performance evidence.
