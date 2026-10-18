# Project delivery Graph RAG

Uses the published FalkorDB `graphrag-sdk==1.4.0` with a custom SDK
`RetrievalStrategy` over Brainee's existing graph. Business records and their IDs
remain authoritative; no parallel database or generated ontology is introduced.

## Local startup

From the repository root:

```sh
bun run graph:setup  # only for a new local environment
bun run graph:backup
bun run graph:up
bun run dev
```

Compose starts the SDK on the private graph network at `graphrag:3200`.
Only the Node graph service calls it. Both services use the existing private
`GRAPH_SERVICE_TOKEN`; the SDK uses the application database account.
`GRAPHRAG_SERVICE_URL` is set in Compose. No SDK secrets reach the browser or model.
The initial image build installs the SDK's native dependencies and can take several minutes.

The Worker remains TypeScript and streams document bytes over HTTP. Python,
extraction, chunking, and graph traversal run in the backend container. Hosting
that backend and FalkorDB is a separate decision from Cloudflare Worker hosting.
See [deployment assessment](../../docs/falkordb/GRAPHRAG-DEPLOYMENT.md).

## Assistant tools

- `search_delivery_knowledge`: company-wide discovery using local semantic vectors,
  indexed full-text search, explicit vocabulary expansion and graph links across tasks, projects, discussions,
  decisions, current documents, submitted updates, and project contributors.
- `get_implementation_context`: task family, leaf estimate/actual totals,
  missing-hour counts, project decisions, document references, updates, and people.
- `read_document_passages`: SDK chunked source passages, with version and passage
  citations. Indexes an existing file on first read if needed.

Try: **"Have we built payments or checkout before? Find the implementation,
show the task breakdown and original estimates, and explain what we could reuse."**

Relevant concepts include payment, checkout, billing, gateway, transaction,
webhook, and refund. Search relevance leads; both completed and in-progress work
are returned with their status. The assistant should expand useful matches and
read document passages before adapting an estimate.

Active employees can read these delivery projections across projects. Existing
project mutation rights remain enforced. People projections omit HR information.
`propose_reusable_breakdown` adapts up to ten discovered source tasks into separately
editable destination task proposals. Destination contribution rights are checked before
drafting and again on confirmation. Historical estimates/actuals, matched/changed scope,
assumptions and missing effort are kept separate. Confirmed tasks preserve source IDs,
adaptation assumptions and a `DERIVED_FROM` edge. Assignment is a separate workflow.

## Documents and freshness

New uploads/versions attempt indexing after the file and graph record are saved.
Extraction failure returns `pending` without losing the uploaded file; a passage
read retries. Indexing verifies SHA-256 against the current source, writes derived
DocumentVersion properties, and rejects superseded versions.
Search reads current document text only when its indexed checksum matches.

Supported text: PDF, DOCX, XLSX, PPTX, UTF-8 plain text, Markdown, CSV and JSON.
PNG/JPEG/WebP images and scanned PDF pages use local Tesseract OCR (English).
Locations retain page, slide, sheet/cell or paragraph coordinates. ZIP and SVG
remain unsupported. Status distinguishes unsupported, empty, pending, failed,
unindexed, indexed and truncated text. Extraction keeps at most 1,000,000
characters, 60 PDF pages and 20 million pixels per OCR image/page; oversized,
malformed and unsupported contents are never invented. OCR accuracy still needs
review for handwriting, complex tables and non-English documents.

The Worker scheduled handler drains up to three current documents every five minutes
when `DELIVERY_INDEX_ACTOR_SUBJECT` is explicitly set to an active administrator's
auth subject. The private graph service verifies that identity on every queue access.
The Worker streams original R2 bytes; source keys never enter the model. Failed attempts
have exponential backoff, five-attempt exhaustion, safe error categories and reset on
checksum change. To retry an exhausted source explicitly, use on-demand passage reading
or the administrator's existing resumable `index_delivery_documents` tool.
Ordinary interactive searches never launch backfills. Without a configured job identity,
the handler reports `not_configured`; uploads and first passage reads still index files.
No scheduler or service is deployed by this change.

## Retrieval limits

The image downloads the pinned `sentence-transformers/all-MiniLM-L6-v2` model
at revision `1110a243fdf4706b3f48f1d95db1a4f5529b4d41`. Runtime embedding uses CPU,
local model files only, and normalized 384-dimensional vectors. Company text is
never sent to an embedding provider. Derived `DeliverySearchEntry` nodes and
FalkorDB vector/full-text indexes stay in the same application graph; checksum-checked
index setup changes no authoritative business records. A background sweep refreshes
changed source passages every 30 seconds in bounded pages/batches. Every returned
candidate is rehydrated and its fingerprint checked against the current source,
so stale, deleted, superseded or inactive evidence cannot be replayed from old vectors.
Source relationships expand related tasks and explicitly linked comments; inferred
dependencies and expertise are not presented as facts. Rank fusion combines lexical
and semantic ranks, exact-title/source specificity, and graph-linked context.
Evidence pages include `hasMore` and
`nextOffset`. A task selects its root family; project decisions/documents/updates
are clearly labeled project context and do not imply feature-specific linkage.
Leaf totals exclude parent estimates and preserve missing-hour counts.
The authenticated `/ready` response includes index state, freshness, failures,
query count and latest semantic latency. Search includes latency, source contribution,
candidate bounds and document coverage. Chat saves explicit incomplete-coverage notices.
Passage citation chips open the current authenticated source passage and coordinates;
superseded sources are rejected.

## Verification

```sh
python -m venv .venv
.venv/bin/pip install -r services/graphrag/requirements.txt
PYTHONPATH=services/graphrag .venv/bin/python -m unittest discover \
  -s services/graphrag/tests -p 'test_*.py'
```

`integration_delivery.py` uses a **dedicated disposable FalkorDB container**
exposed on loopback. Set `GRAPH_TEST_PORT` to that container's port, then run:

```sh
GRAPH_TEST_PORT=6379 PYTHONPATH=services/graphrag .venv/bin/python \
  -m unittest discover -s services/graphrag/tests -p 'integration_*.py'
```

It creates/deletes only random `brainee_test_rag_*` graphs. Do not point it at
production or an application database. Checks cover cross-project payments
search, task-family estimates, document freshness, private-field omission,
deactivated actors, and HTTP authentication/operation restrictions.

`tests/retrieval_corpus.json` contains 20 paraphrases across five feature families,
including nonidentical wording and irrelevant alternatives. Integration tests emit
retained recall@5, reciprocal rank and per-question latency, plus changed-source rejection.
`tests/benchmark_delivery.py` measures an explicit disposable graph with 1,000 tasks
by default (`GRAPH_BENCH_RECORDS`, bounded 100–10,000); it emits indexing time,
target recall@10, median and p95 latency. These are synthetic measurements, not a
production performance guarantee.

`bun run scripts/company-brain-regression.ts` verifies the evaluation's project,
personal-history, reporting, assignee and portfolio failures against the explicit
local demo without writing business records. It saves structured results in
`docs/reports/company-brain-regressions-2026-10-18.json`. The original 100 questions
are retained with a scoring rubric in `docs/reports/company-brain-evaluation-corpus.json`;
retrieval/contract tests do not constitute a newly passed 100-question chat evaluation.

After approval to use the configured external chat provider,
`bun run scripts/company-brain-chat-evaluation.ts` reruns those 100 questions through
the real assistant turn loop and local graph tools, preserving full answers,
tool results and audit rows in JSONL. It never confirms proposed mutations and
resumes already retained cases. Worker HTTP authentication, rate-limit middleware
and browser rendering are outside that harness; rubric scoring is a separate review.
