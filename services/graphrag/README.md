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

- `search_delivery_knowledge`: company-wide discovery using model-expanded
  concepts and parameterized graph searches across tasks, projects, discussions,
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
Task assignment and bulk conversion of estimates into new tasks are outside this slice.

## Documents and freshness

New uploads/versions attempt indexing after the file and graph record are saved.
Extraction failure returns `pending` without losing the uploaded file; a passage
read retries. Indexing verifies SHA-256 against the current source, writes only
three derived DocumentVersion properties, and rejects superseded versions.
Search reads current document text only when its indexed checksum matches.

Supported text: PDF (SDK PdfLoader), DOCX, UTF-8 plain text, Markdown, CSV, JSON.
Images, scanned PDFs without embedded text, spreadsheets, presentations, and ZIP
archives do not gain invented contents. Status distinguishes unsupported, empty,
unindexed, indexed, and truncated text. Text extraction keeps at most 1,000,000
characters; passage responses disclose truncation. No OCR is included.

Existing file contents are not indexed at startup. Search returns indexing
coverage and still searches document titles/descriptions. Read a discovered file
on demand, or ask the assistant as an administrator to run `index_delivery_documents`
one file per call (offset; returns outcomes and nextOffset). This derived-text
backfill is explicit and resumable; ordinary searches never launch it automatically.
Reindex failures remain visible as `pending` and can be retried.

## Retrieval limits

This version uses concept overlap plus explicit graph traversal. It does **not**
create embedding vectors, perform vector similarity search, infer dependencies,
or infer expertise. Synonyms come from the existing assistant model; retrieval
itself needs no additional model key. Evidence pages include `hasMore` and
`nextOffset`. A task selects its root family; project decisions/documents/updates
are clearly labeled project context and do not imply feature-specific linkage.
Leaf totals exclude parent estimates and preserve missing-hour counts.

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
