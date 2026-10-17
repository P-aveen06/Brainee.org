# Brainee.org graph model

Companion to [PLAN.md](./PLAN.md). Proposed model for one team; prepared 16 October 2026. The full domain model remains a design specification. The initial identity/index migration is installed; field, relationship and domain-operation migration is still pending.

## 1. Five ideas you need

| Graph term | In this app |
|---|---|
| Node | A person, project, task, leave request, or other identifiable record |
| Label | The record's type, such as `Employee` or `Project` |
| Property | A value on a record, such as `name`, `status`, or `dueDate` |
| Relationship | A named connection, such as a task being assigned to an employee |
| Cypher | The language the backend uses to find or update connected records |

You can inspect these connections visually, but the existing app remains forms, lists, charts, and workflows. A graph database does not require graph diagrams on every screen.

```text
(Employee)-[:REPORTS_TO]->(Employee)

(Employee)-[:HAS_MEMBERSHIP]->(ProjectMembership)-[:IN_PROJECT]->(Project)
                                                    role, joinedAt, leftAt

(Project)-[:HAS_TASK]->(Task)-[:ASSIGNED_TO]->(Employee)
                        |
                        +--[:PARENT_TASK]->(Task)

(AssetAssignment)-[:FOR_ASSET]->(Asset)-[:OWNED_BY]->(Company)
        |
        +--[:ASSIGNED_TO]->(Employee)

(Employee)-[:REQUESTED]->(LeaveRequest)-[:USES_BALANCE]->(LeaveBalance)
```

An arrow is just a defined direction that queries can follow in either direction. It does not itself grant permission.

## 2. Modeling decisions

**Use nodes for relationships with their own business history.** A project membership has a role, dates, allocation, and a stable ID. An asset assignment has custody, condition, acknowledgment, and return history. Those are records worth keeping, so they become nodes with connections rather than temporary arrows that get overwritten.

Use a plain `REPORTS_TO` relationship for the current manager because that is the current field's meaning. Keep changes in audit events. Do not add full reporting-line history as a new product feature during this migration. A membership can be historical without granting present access.

Keep `Employee` separate from `Company`: the current companies table represents your organization, customers, and asset owners. It is not a tenant registry. One graph contains this team's records and its client companies; a client's company node does not grant that client access.

All source table fields must be accounted for in the importer/DTO manifest, including nullable fields, status strings, flags, serialized JSON, and creator/reviewer/replacement references. The table below describes the structural mapping; it is not permission to drop fields that are not repeated here.

## 3. All 37 current tables and their destinations

| # | Current table | Graph record | Main connections |
|---|---|---|---|
| 1 | `users` | `Employee` | `REPORTS_TO` manager; optional `DEACTIVATED_BY` employee |
| 2 | `system_leave_types` | `LeaveType` | Referenced by balances and requests; retain current slug/name resolution |
| 3 | `leave_balances` | `LeaveBalance` | `FOR_EMPLOYEE`, `OF_LEAVE_TYPE`; retain start/end cycle properties |
| 4 | `timesheets` | `Timesheet` | `FOR_EMPLOYEE`, optional `FLAGGED_BY` |
| 5 | `leave_requests` | `LeaveRequest` | Employee `REQUESTED` it; `USES_BALANCE`, `OF_LEAVE_TYPE`; reviewer/approver/revoker references |
| 6 | `wfh_requests` | `WfhRequest` | Employee `REQUESTED` it; reviewer/approver/revoker/flagger references |
| 7 | `wfh_policy` | `WfhPolicy` | One policy node with stable singleton key |
| 8 | `public_holidays` | `Holiday` | Date/year properties, preserving recurring-holiday behavior |
| 9 | `notifications` | `Notification` | `FOR_EMPLOYEE`; optional typed `ABOUT` target; retain `relatedId`, `relatedType`, and action URL |
| 10 | `audit_logs` | `AuditEvent` | `BY_ACTOR`, optional typed `ABOUT`; retain before/after JSON and historical target IDs |
| 11 | `companies` | `Company` | Internal/client classification; referenced as client, asset owner, or deployment company |
| 12 | `assets` | `Asset` | `OWNED_BY` company, optional `REPLACED_BY` asset |
| 13 | `client_deployments` | `ClientDeployment` | `FOR_EMPLOYEE`, `PRIMARY_CLIENT`, optional `END_CLIENT` |
| 14 | `asset_assignments` | `AssetAssignment` | `FOR_ASSET`, `ASSIGNED_TO`, optional `FOR_DEPLOYMENT`; assigned-by/received-by references |
| 15 | `asset_history` | `AssetEvent` | `FOR_ASSET`, optional `BY_ACTOR` and `TARGET_EMPLOYEE` |
| 16 | `projects` | `Project` | `OWNED_BY` employee, optional `FOR_CLIENT` company and `CREATED_BY` employee |
| 17 | `client_contacts` | `ClientContact` | `AT_COMPANY`; preserve role/contact/active properties |
| 18 | `project_members` | `ProjectMembership` | Employee `HAS_MEMBERSHIP`; membership `IN_PROJECT`; optional replaced-by/added-by references |
| 19 | `project_stages` | `StageDefinition` | Ordered definitions with stable `key`; not copied separately for every task |
| 20 | `project_stage_progress` | `StageProgress` | Project `HAS_STAGE`; `OF_STAGE` definition; optional `COMPLETED_BY` |
| 21 | `project_events` | `ProjectEvent` | `IN_PROJECT`, optional `BY_ACTOR`, typed target plus preserved target IDs |
| 22 | `project_tasks` | `Task` | Project `HAS_TASK`; optional `ASSIGNED_TO`, `PARENT_TASK`, `IN_STAGE`, `CREATED_BY` |
| 23 | `project_checklist_templates` | `ChecklistTemplate` | `FOR_STAGE`; preserve active/required/order properties |
| 24 | `project_checklist_items` | `ChecklistItem` | Project `HAS_CHECKLIST_ITEM`; `FOR_STAGE`; optional `FROM_TEMPLATE`, assignee/creator/completer |
| 25 | `project_documents` | `DocumentVersion` | `IN_PROJECT`, optional `IN_STAGE`, `UPLOADED_BY`, `SUPERSEDES`; R2 object key remains a property |
| 26 | `project_comments` | `Comment` | `IN_PROJECT`, `AUTHORED_BY`; optional `REPLIES_TO`, `ON_TASK`, `ON_DOCUMENT`, `IN_STAGE` |
| 27 | `project_daily_updates` | `DailyUpdate` | `IN_PROJECT`, `BY_EMPLOYEE`; retain date, status, summary, blockers, hours |
| 28 | `project_daily_update_items` | `DailyUpdateItem` | Update `HAS_ITEM`; item `ON_TASK`; notes remain on the item |
| 29 | `project_eod_reports` | `EodReport` | `IN_PROJECT`, optional `GENERATED_BY`; preserve draft/final content and missing-submitter snapshot |
| 30 | `work_flags` | `WorkFlag` | `IN_PROJECT`, typed `ABOUT`; optional `RAISED_FOR` and `RESOLVED_BY`; evidence JSON retained |
| 31 | `ai_conversations` | `Conversation` | `OWNED_BY` employee; `HAS_TURN` and `HAS_MESSAGE` |
| 32 | `ai_turns` | `AssistantTurn` | `IN_CONVERSATION`, `BY_EMPLOYEE`; status, budgets, timestamps, failure code |
| 33 | `ai_messages` | `Message` | `IN_CONVERSATION`, optional `IN_TURN`; sequence/tool-round/content/citation snapshots retained |
| 34 | `ai_tool_invocations` | `ToolInvocation` | `BY_EMPLOYEE`, optional `IN_TURN`, `FOR_MESSAGE`; retain tool args/result metadata and denials |
| 35 | `ai_proposed_actions` | `ProposedAction` | `OWNED_BY` employee; optional `FOR_MESSAGE`, typed `TARGETS`; confirmation/expiry/payload retained |
| 36 | `dashboard_layouts` | `DashboardLayout` | `FOR_EMPLOYEE`; one layout per employee, JSON layout property |
| 37 | `company_policy_documents` | `CompanyPolicyDocument` | `UPLOADED_BY` employee; preserve independent company-wide scope, R2 key, metadata and download permissions |

Add only the infrastructure records needed for operation safety: `SchemaMigration` and `OperationReceipt`. Receipt records store the operation ID, input fingerprint, actor, status, and result needed to reconcile retries. They are not a general event-sourcing rewrite.

Old polymorphic references sometimes have an ID but no SQL foreign key. Before creating their graph edges, validate the expected label and parent project. During fixture import, report missing references rather than silently connect an ID to the wrong record type. Preserve audit/citation snapshots even if an old referenced record is unavailable.

For `PARENT_TASK`, preserve task hierarchy; do not invent a new task-dependency feature or change Gantt semantics. Add a separate dependency relationship only in a later feature if the product needs it.

## 4. IDs, values, and API compatibility

- Use a required `id` string on each record label; keep existing IDs during import. Never expose FalkorDB's internal node/relationship IDs in URLs or store them as durable business references.
- Enforce identity uniqueness per label. Old SQL IDs are not guaranteed to be globally unique across tables; a policy's ID `1` must not collide with another label's ID `1`.
- Normalize the singleton policy ID to a documented string; the adapter preserves any existing numeric API contract. Derive dashboard layout identity deterministically from its employee ID.
- Use relationships as the canonical links. Where uniqueness/search requires `employeeId`, `projectId`, or an active key property, maintain it in the same mutation and verify it agrees with the relationships. This limited duplication supports constraints; it must not drift.
- Preserve display email; add a separate normalized email key for login/uniqueness. Detect case-variant existing emails in the dry run before enabling that stricter constraint; do not merge accounts automatically.
- Keep enum/status values and JSON snapshots unchanged initially. Structured JSON that is not traversed belongs in a serialized property, not hundreds of extra nodes.
- Store date-only values as ISO strings and instants as epoch milliseconds. Keep existing `Asia/Kolkata` day boundaries and birthday-based leave cycles. Half-day arithmetic and existing decimal behavior must match tests.
- Preserve real numeric values for hours, money, and allowance fields during migration; changing accounting precision is a separate behavior change. Validate ranges and round only where current policy already does so.
- Treat an absent optional graph property as the API's documented `null`, not an unexpected `undefined`. Reconstruct existing `Date` values or wire formats at the app boundary.

FalkorDB has its own supported Cypher/type system; do not assume every Neo4j example or SQL type carries over. Test the exact scalar/JSON/date conversions with the pinned client. [Data types](https://docs.falkordb.com/datatypes/).

## 5. Constraints and indexes

For every record label: required and unique `id`. Also enforce the business keys below. Use supporting exact-match indexes and mandatory constraints for required key components. A unique constraint alone does not enforce a missing value. Constraint creation is asynchronous; migrations wait for `OPERATIONAL` and stop on `FAILED`. [Constraint behavior](https://docs.falkordb.com/commands/graph.constraint-create).

| Record | Business uniqueness to preserve or explicitly add |
|---|---|
| Employee | `authId`; normalized email after duplicate preflight |
| LeaveType | Existing `slug` |
| LeaveBalance | Employee + leave-type key + cycle start |
| Timesheet | Employee + date |
| WfhRequest | Employee + date |
| WfhPolicy | Singleton key |
| Holiday | Existing date key; preserve current recurring-year rules |
| Company | Existing code |
| Asset | Existing asset tag |
| Project | Existing project code |
| StageDefinition | Existing stage key |
| StageProgress | Project + stage key |
| Task | Project + task number |
| DocumentVersion | Existing R2 object key |
| DailyUpdate | Project + employee + date |
| EodReport | Project + date |
| DashboardLayout | Employee |
| ProjectMembership | At most one current membership per employee/project; keep all historical records |
| AssetAssignment | At most one current assignment per asset; keep all historical records |
| OperationReceipt | Operation ID |

Use composite constraints where the pinned engine supports and verifies them. A scalar deterministic key encoding the same components is the specified fallback, with collision-safe encoding and tests. Current-membership/current-assignment uniqueness uses an optional `activeKey`: set it only while current, remove it when closing the history record. All other mandatory components remain required. Duplicate current records in old fixtures require an import report; do not pick one silently.

Start with lookup indexes on record IDs and business keys, plus filtered access paths actually used by the app: task assignee/status/due date, project status, membership employee/current state, employee/date attendance, notification employee/read state, asset status/category/expiry, and project/date updates. Use query plans to verify anchor indexes. Do not create vector/full-text indexes merely because they are available. [Indexing reference](https://docs.falkordb.com/cypher/indexing).

Graph edges do not enforce all business rules. Service queries must enforce relationship cardinality, allowed label pairs, valid parent references, no reporting/task cycles, active employee rules, and role checks. Run a consistency validator after every import and during backup restoration.

## 6. Queries you can understand

These read examples illustrate the model; they are not executable application endpoints and do not replace authorization. The application uses fixed templates and binds `$employeeId`/`$projectId` as parameters. [Parameterized queries](https://docs.falkordb.com/commands/graph.query).

```cypher
// Who is this employee's current manager?
MATCH (employee:Employee {id: $employeeId})-[:REPORTS_TO]->(manager:Employee)
RETURN manager.id, manager.name
```

```cypher
// Which active memberships does this employee have?
MATCH (employee:Employee {id: $employeeId})-[:HAS_MEMBERSHIP]->
      (membership:ProjectMembership)-[:IN_PROJECT]->(project:Project)
WHERE membership.isCurrent = true
RETURN project.id, project.name, membership.role
```

```cypher
// What work is assigned to this employee in one already-authorized project?
MATCH (project:Project {id: $projectId})-[:HAS_TASK]->
      (task:Task)-[:ASSIGNED_TO]->(:Employee {id: $employeeId})
RETURN task.id, task.title, task.status
ORDER BY task.title, task.id
LIMIT 100
```

The real project-list operation combines active memberships, project ownership, and the current global administrator rule. The example membership query by itself is not the full authorization policy. A manager's position in `REPORTS_TO` grants no automatic project access.

## 7. Mutations that must be designed together

```text
Approve leave:
  active actor + permission + pending request + correct cycle + enough balance
       -> approve request + increment used balance + audit + notification
       -> operation receipt/result
  all guards before writes, all changes in ONE query

Create task:
  actor/project access + valid active assignee + valid same-project parent/stage
       -> increment project's task counter + create task + project event + audit
       -> operation receipt/result

Assign asset:
  actor permission + valid employee/deployment + asset available
       -> create current assignment + update asset status + history + audit
       -> operation receipt/result
```

Initialize each project counter from the imported maximum task number; update it and create the task in one query. Validate all required references and business guards before any write clause: a later `MATCH`/filter returning no rows is not a query error that automatically rolls back earlier successful clauses. Check the expected result/cardinality and record a receipt in the same successful write.

FalkorDB documents query-level atomicity and serialized writes per graph. Prove those guarantees for our pinned version with constraint-error, concurrent, and ambiguous-timeout tests. Do not infer that `Promise.all`, a pipeline, or multiple separate calls provide business rollback. Do not rely on Redis `MULTI`/`EXEC` to undo runtime errors across independent commands. [FalkorDB concurrency](https://docs.falkordb.com/design/concurrency), [Redis transaction semantics](https://redis.io/docs/latest/develop/using-commands/transactions/).

For edits, use a record version checked and incremented in the same query. For access-sensitive writes, recheck current active membership/role inside that mutation, not only in an earlier read. For retries, receipt lookup and creation belong to the atomic operation; do not create an operation claim that can strand the business write silently.

Deactivation retains Employee, history, comments, and audits. Enforce departure blockers/successor ownership and current asset custody before committing access changes; never use a broad `DETACH DELETE` to reproduce SQL cascades. Project archive similarly preserves history. Existing explicit document/comment/task deletion contracts need targeted tests and their documented retention behavior.

## 8. First demonstration and learning checkpoint

Use a disposable test graph to create two employees, one project, one membership, and one task. Show the same records in the app and in the graph viewer. Demonstrate that a different employee cannot open that project, double task creation does not reuse a number, and records survive container recreation. These are test fixtures, not records for your clean team graph.

Explain the graph by following those few connections. Only after this demonstration and the runtime/constraint proofs pass do we expand the same patterns to leave, assets, documents, and assistant data. If a required capability is not supported, revise the written design before continuing.


## 9. Assistant additions beyond the existing 37 tables

The migration mapping above preserves current data. The assistant requirements in [AGENT-PLAN.md](./AGENT-PLAN.md) additionally need authoritative policy and complete calendar inputs. These are new product data, not fields assumed to exist already.

| Addition | Proposed model and reason |
|---|---|
| Approved policy | Independent `PolicyVersion` node with policy key, version, effective dates, publication state, approver, stable section anchors, source checksum and optional R2 key. Optional `COVERS_LEAVE_TYPE` connections to `LeaveType`; not a project document. Store approved queryable text with version/section provenance |
| Working calendar | Versioned `TeamWorkSchedule` configuration with timezone, working days/hours and effective dates; reuse holidays and employee standard hours. Record employee schedule/office assignments with effective dates when exceptions or physical-presence queries require them. Unknown assignments remain unknown, not inferred |
| Capacity evidence | Reuse memberships/allocations, tasks, leave and schedules first. Add a dated `ProjectCapacityPlan` linked to `Project` only when the team maintains required/remaining hours for a period. Missing inputs block an overstaffing claim |
| Assistant execution | Reuse `ProposedAction` and `OperationReceipt`; a receipt retains payload fingerprint and resulting record ID/status. Commit the domain write plus receipt atomically, then reconcile conversational status from the receipt |

Give each new entity a stable ID and mandatory/unique constraints following the same migration rules. Published policy versions are immutable; prevent overlapping effective versions for the same scope in guarded writes. Apply source-level permissions before returning policy text or citations. Preserve calendar versions used by historical results.

Availability is a computed view over the complete eligible roster, schedules, holiday dates, operational leave statuses and day portions, WFH, and known offsite assignments. Do not persist an authoritative `FULL_STRENGTH_ON` relationship or let an empty absence query imply everyone is present. The user confirmed that full strength means everyone physically in the office. Keep the eligible normally scheduled office roster as the denominator; leave, WFH and offsite work reduce physical presence rather than removing people from that roster. Unknown schedule/location data blocks a positive full-strength claim.

The model selects named authorized tools; those tools perform parameterized queries and deterministic calculations. It does not receive unrestricted graph credentials or decide that a graph path grants access. Assistant features remain subject to the same domain operations as the normal application. The user confirmed explicit confirmation before action submissions; retain the immutable proposal, actor, confirmation and resulting operation receipt as separate lifecycle facts.
