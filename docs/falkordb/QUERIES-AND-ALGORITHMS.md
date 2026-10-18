# Cypher queries and graph algorithms

This reference describes the implemented product, with read-only Cypher examples and links to complete runtime operations. Queries target the local FalkorDB `brainee_dev` graph. `$name` denotes a driver-bound parameter, not string interpolation. Example projections are shortened for readability; the linked source is authoritative.

Application traffic follows signed-session server functions → private Node graph service → FalkorDB. The service accepts structured operations, not raw Cypher from callers. The model selects tools and supplies data; it does not generate executable Cypher. Python delivery reads include an active-employee guard. These examples are documentation, not an independent authorization interface.

## 1. Identity and project access

**Identity resolution:** `$subject` comes from the verified signed session, not a caller-provided employee ID.

```cypher
MATCH (u:Employee {authId:$subject})
WHERE u.isActive = true
RETURN u.id AS id, u.role AS role
```

Source: [resolveActor / accessScope](../../services/graph/src/data-executor.ts). The service also detects direct reports when resolving an ordinary user's effective lead role, and rechecks active identity/stored role in query guards.

Ordinary project visibility is administrator → all projects, owner → owned projects, otherwise current membership → member projects. The following equivalent inspection query uses `$actorId` resolved by the service:

```cypher
MATCH (actor:Employee {id:$actorId}) WHERE actor.isActive=true
MATCH (p:Project)
WHERE actor.role='admin' OR p.ownerId=actor.id
   OR size([(actor)-[:HAS_MEMBERSHIP]->(m:ProjectMembership)
            -[:IN_PROJECT]->(p) WHERE m.isCurrent=true | m.id]) > 0
RETURN p.id AS id, p.code AS code, p.name AS name
ORDER BY code
```

The app implements this through typed queries in [visibleProjectIdsFor / resolveProjectAccess](../../src/lib/project-access.ts); [accessScope](../../services/graph/src/data-executor.ts) adds restrictions in compiled queries, including joined records. Reporting lines grant no project access. Domain operations enforce viewer/contributor/manager/owner requirements.

Company-wide **delivery retrieval** has a separate explicit read policy: active employees may search delivery projections across projects. Those projections omit HR fields, credentials and file storage keys. This does not grant mutation access to discovered projects.

## 2. Hybrid delivery search

Used by `search_delivery_knowledge` for previous implementations, project discovery, contributors and reusable evidence. Search covers tasks, comments (decisions/discussions), current documents, submitted updates, projects and active current project members.

Sources: [fixed projections and lexical fallback](../../services/graphrag/delivery/graph.py), [vector/full-text index](../../services/graphrag/delivery/semantic.py), [rank fusion](../../services/graphrag/delivery/retrieval.py), [vocabulary expansion](../../services/graphrag/delivery/vocabulary.py), [local encoder](../../services/graphrag/delivery/encoder.py).

### Full-text candidates

`$searchText` is an OR expression constructed from at most 64 sanitized word tokens; `$modelId` identifies the pinned encoder, and `$limit` is capped at 500. The production query also returns fingerprint, passage text and character offset for validation.

```cypher
MATCH (actor:Employee {id:$actorId}) WHERE actor.isActive=true WITH actor
CALL db.idx.fulltext.queryNodes('DeliverySearchEntry',$searchText)
YIELD node,score
WHERE node.complete=true AND node.modelId=$modelId
RETURN node.sourceId AS sourceId, node.projectId AS projectId,
       node.kind AS kind, score
ORDER BY score DESC LIMIT $limit
```

When no indexed passages are available, fixed per-kind queries match expanded terms with `toLower(body) CONTAINS term`, rank by matched-term count and apply a candidate limit. Model-supplied concepts remain parameter values.

### Vector candidates

The local encoder uses pinned `sentence-transformers/all-MiniLM-L6-v2`, normalized **384-dimensional** vectors and CPU inference. Derived source text is chunked into 900-character passages at 750-character strides (150-character overlap).

```cypher
MATCH (actor:Employee {id:$actorId}) WHERE actor.isActive=true WITH actor
CALL db.idx.vector.queryNodes(
  'DeliverySearchEntry','embedding',$limit,vecf32($vector)
)
YIELD node,score
WHERE node.modelId=$modelId AND node.complete=true AND score<=0.72
RETURN node.sourceId AS sourceId, node.projectId AS projectId,
       node.kind AS kind, 1-score AS similarity
ORDER BY score ASC
```

Here the vector procedure's score is treated as cosine distance: lower is better, and returned similarity is `1-score`. Full-text scores use their own scale. The schema creates a cosine vector index with `dimension:384` and `efRuntime:100`, a full-text index on `text`, and an index on `key`; [SemanticIndex.setup](../../services/graphrag/delivery/semantic.py) checksum-checks the definitions.

### Rank fusion and bounded expansion

1. Extract up to 24 query terms/concepts, then expand the explicit domain vocabulary.
2. Set candidate ceiling to `min(500, max(50, offset + limit + 1))`; each indexed channel requests up to `min(500, ceiling * 3)` passages and rehydrates source records.
3. Reject hits with changed source fingerprints or sources that are deleted, superseded or ineligible under the current projection. Deduplicate by source kind, source ID and project ID.
4. Fuse lexical and semantic ranks with `score += 1 / (60 + rank)`, where rank starts at 1. For each channel in which it appears, an exact-title match receives `+0.03` and a decision receives `+0.002`. Sort by descending score, then project code and ID.
5. From task matches among the first 12 ranked records, expand at most 30 hierarchy-related records and 20 explicitly task-linked comments. New graph-linked records receive `0.006`; existing records retain their score and gain an evidence path.
6. Sort again and return the requested page, `hasMore`, `nextOffset`, sources, document coverage and retrieval diagnostics.

Pagination is over the bounded retrieved pool, not an exhaustive scan of all possible matches. Completed and in-progress work can both match; relevance and recorded status are separate facts.

## 3. Graph expansion and evidence paths

Task hierarchy edges point **child → parent**. Retrieval expands two hops upward and two hops downward through a shared ancestor, staying within the project. `$ids` are ranked seed task IDs; `$ceiling` is 30 in this search path. This shortened projection shows the actual traversal:

```cypher
MATCH (actor:Employee {id:$actorId}) WHERE actor.isActive=true WITH actor
MATCH (p:Project)-[:HAS_TASK]->(seed:Task) WHERE seed.id IN $ids
MATCH (seed)-[:PARENT_TASK*0..2]->(parent:Task)
      <-[:PARENT_TASK*0..2]-(n:Task)
WHERE n.projectId=p.id AND parent.projectId=p.id AND n.id<>seed.id
RETURN DISTINCT seed.id AS fromId, parent.id AS viaId, n.id AS toId
ORDER BY toId LIMIT $ceiling
```

The runtime result includes `evidencePath` with the seed, shared ancestor, related task and `PARENT_TASK` relation. Explicit task comments are found separately (`$ceiling` is 20):

```cypher
MATCH (actor:Employee {id:$actorId}) WHERE actor.isActive=true WITH actor
MATCH (p:Project)-[:HAS_TASK]->(t:Task) WHERE t.id IN $ids
MATCH (n:Comment)-[:IN_PROJECT]->(p) WHERE n.taskId=t.id
RETURN t.id AS taskId, n.id AS commentId, n.body AS body,
       n.isDecision AS isDecision
ORDER BY commentId LIMIT $ceiling
```

Source: [related_tasks / linked_evidence](../../services/graphrag/delivery/graph.py). `Comment.taskId` is the explicit link used here. A comment's project membership alone does not establish evidence about every feature. The product records hierarchy/contributions, not inferred dependency or expertise edges.

For peer consultation, the fixed task projections follow `(task:Task)-[:ASSIGNED_TO]->(employee:Employee)` and return the recorded assignee alongside the matching functionality. The implementation context also returns active current project members. A task assignment supplies a direct recorded connection; project membership supplies broader team context. The assistant can use these sources to identify a relevant colleague and prepare questions for discussion.

## 4. Implementation context and effort rollups

`get_implementation_context` resolves the project by ID/code. When `$taskId` is provided, it selects that task's root family, including siblings; without a task it reads the project's tasks. Context sections paginate tasks, decisions/discussions, current documents, submitted updates and active current members.

Find a root, bounded at 50 parent hops:

```cypher
MATCH (actor:Employee {id:$actorId}) WHERE actor.isActive=true WITH actor
MATCH (seed:Task {id:$taskId})-[:PARENT_TASK*0..50]->(root:Task)
WHERE seed.projectId=$projectId AND root.projectId=$projectId
  AND root.parentTaskId IS NULL
RETURN root.id LIMIT 1
```

Sum **leaf tasks only**, avoiding duplicate parent/child effort:

```cypher
MATCH (actor:Employee {id:$actorId}) WHERE actor.isActive=true WITH actor
MATCH (root:Task {id:$rootId})<-[:PARENT_TASK*0..50]-(t:Task)
WHERE t.projectId=$projectId WITH DISTINCT t
WITH t, size([(t)<-[:PARENT_TASK]-(child:Task)
              WHERE child.projectId=$projectId | child.id])=0 AS leaf
RETURN count(t) AS taskCount,
  sum(CASE WHEN leaf THEN 1 ELSE 0 END) AS leafTaskCount,
  sum(CASE WHEN leaf THEN coalesce(t.estimateHours,0) ELSE 0 END) AS estimatedHours,
  sum(CASE WHEN leaf THEN coalesce(t.actualHours,0) ELSE 0 END) AS actualHours,
  sum(CASE WHEN leaf AND t.estimateHours IS NULL THEN 1 ELSE 0 END) AS missingLeafEstimates,
  sum(CASE WHEN leaf AND t.actualHours IS NULL THEN 1 ELSE 0 END) AS missingLeafActuals
```

Source: [implementation_context](../../services/graphrag/delivery/context.py). Totals use the full selected family independently of the task display page. Python postprocessing returns `null` when every leaf lacks a value; partially known totals retain missing counts. `completeEstimates` requires at least one leaf and no missing estimates. Parent estimates remain visible on individual records. Decisions/documents/updates are project context unless explicit links establish a narrower connection.

For reusable breakdowns, [adaptEstimate](../../src/lib/ai/adapted-estimate.ts) prefers recorded actual hours over the original estimate, then computes `round((baseline * factor + additionalHours) * 10) / 10`. The factor is bounded to 0.25–4 and extra hours to 0–1,000; unknown baselines remain `null`. [The reuse tool](../../src/lib/ai/tools/reusable-breakdown-tool.ts) retains original values, changed scope and assumptions, and marks confidence as limited when actuals or complete family evidence are missing.

## 5. Current documents and source freshness

`read_document_passages` uses a current document, extracts/indexes it on demand if needed, and returns passage/version citations. R2 remains the original-file store; derived text lives on `DocumentVersion`. A simplified current-text query is:

```cypher
MATCH (actor:Employee {id:$actorId}) WHERE actor.isActive=true WITH actor
MATCH (d:DocumentVersion {id:$documentId})-[:IN_PROJECT]->(:Project)
WHERE d.status <> 'superseded'
RETURN d.id AS id, d.version AS version,
  CASE WHEN d.deliveryTextChecksum=d.checksum
       THEN d.deliveryText ELSE null END AS text,
  d.deliveryLocations AS locations
```

Sources: [lookup / coverage](../../services/graphrag/delivery/graph.py), [passage indexing](../../services/graphrag/delivery/documents.py), [extraction limits](../../services/graphrag/delivery/extraction.py), [Node queue](../../services/graph/src/delivery-retrieval.ts).

Indexing verifies source-byte SHA-256 and rejects superseded versions. The semantic sweep refreshes changed projections every 30 seconds in bounded pages/batches. Both search channels rehydrate hits and compare fingerprints with current source text before returning evidence. Extracted passages retain page/slide/sheet/paragraph locations. Incomplete, unsupported, pending and failed coverage is surfaced rather than treated as evidence of absence. See the [GraphRAG README](../../services/graphrag/README.md) for extraction and scheduling details.

## 6. Deterministic briefings and reporting

These tools use the typed query layer and TypeScript calculations before the model writes a narrative:

| Operation | Implemented calculation | Source |
| --- | --- | --- |
| `get_work_brief` | Load up to 100 visible projects and up to 500 each of tasks, memberships and today's submitted updates. Open excludes `done`/`cancelled`; overdue is open with `dueDate < today`; blocked is open with `status='blocked'`. Own priorities sort by due date, capped at 12. Cap hits mark scope as truncated. | [data](../../src/lib/ai/tools/work-brief-data.ts), [calculations](../../src/lib/ai/tools/work-brief-tool.ts) |
| Staffing / update coverage | Sum current visible membership allocation per person; identify current non-viewer members lacking today's submitted update. HR project allocation/count is unknown (`null`). Include approved leave overlapping today through today + 7 days and approved WFH within that range. | [work brief](../../src/lib/ai/tools/work-brief-tool.ts) |
| `get_reporting_structure` | Resolve one active manager by exact ID/name, then unique partial name; disambiguate multiple matches. Return all active employees with matching `peerLeadId`, across system roles. This is a direct-report lookup. | [reporting tool](../../src/lib/ai/tools/reporting-structure-tool.ts) |

The briefing exposes stored `healthOverride` as project health; its blocker/overdue counts are not a predictive health algorithm. Staffing reflects recorded allocation over visible projects, not inferred expertise or a full capacity forecast.

## 7. Atomic writes and business constraints

These operations depend on Cypher writes. Application workflows prepare validated values, perform domain checks and bind actor identity. Links below contain complete queries, including their guards.

| Operation | Query behavior / invariant | Implementation |
| --- | --- | --- |
| Typed CRUD | Allowlisted labels/fields/expressions compile to parameterized Cypher. Reads scope joined models; writes validate references, refresh edges and compute current-record business keys in the same statement. | [read compiler](../../shared/graph/read-cypher.ts), [write compiler](../../shared/graph/write-cypher.ts), [executor](../../services/graph/src/data-executor.ts) |
| Create task / reuse task | Validate active actor, destination contribution rights, parent project, eligible assignee and optional source. Allocate `max(project.taskCounter, max(existing taskNumber)) + 1`; create task, hierarchy/assignee/reuse edges, project event and audit together. | [createTaskOperation](../../services/graph/src/task-operation.ts) |
| Assign / reassign task | Task forms save `assigneeId`; the typed write compiler refreshes the `ASSIGNED_TO` relationship. The dedicated reassignment operation requires manager access and records a project event. Task creation can also carry a reviewed assignee; reusable breakdown proposals leave assignment separate. | [task form](../../src/components/projects/TaskFormDialog.tsx), [task edit](../../src/api/project-tasks-crud.ts), [reassignment](../../src/api/project-tasks-status.ts), [edge refresh](../../shared/graph/write-cypher.ts) |
| Reusable breakdown | Draft up to ten source tasks as editable proposals; recheck destination rights on confirmation. Preserve source IDs/assumptions and `(new:Task)-[:DERIVED_FROM]->(source:Task)` provenance. Assignment is separate. | [reuse tool](../../src/lib/ai/tools/reusable-breakdown-tool.ts), [task write](../../services/graph/src/task-operation.ts) |
| Leave approval / revocation | Approval matches a pending request and sufficient cycle balance, then updates request status and `balance.used` together. Admin revocation accepts approved/pending-cancellation requests and restores balance without going below zero. | [peopleOperation](../../services/graph/src/people-operations.ts) |
| Leave / WFH submission | Half-day slots encode first/second halves; overlap uses `existingStart <= requestedEnd AND existingEnd >= requestedStart`. Pending, approved and pending-cancellation requests reserve overlap slots. WFH checks duplicate date/cycle policy; leave checks type and remaining balance in its write. | [request operations](../../services/graph/src/request-operations.ts) |
| Schema integrity | Required/unique identities and business keys; unique current membership per employee/project and current asset assignment; additive checksum-checked migrations. Derived indexes have their own checksum marker. | [identity schema](../../services/graph/src/schema.ts), [business rules](../../services/graph/src/business-rules.ts), [migrations](../../services/graph/src/migrations.ts) |

Assistant proposals require confirmation before the shared mutation workflow executes. Arbitrary writes are not automatically retried after a timeout. Employees are deactivated rather than deleted; conversation deletion has explicit message/turn cleanup. See [graph model](GRAPH-MODEL.md) for relationship and deletion semantics.

## Verification

From the repository root, with the local stack running:

```sh
bun run graph:health
bun run graph:test
```

The integration suite uses randomly named disposable graphs and covers migrations, relationships, references, permissions, concurrent task numbering, leave/WFH overlap, balances and repeatable fixtures. [GraphRAG verification](../../services/graphrag/README.md#verification) covers retrieval, task-family estimates, document freshness and a synthetic benchmark using a dedicated disposable container.

