# Graph model

One graph contains this team and its clients. Every existing application record maps to a labeled node. `shared/graph/models.json` records all fields, defaults, nullable values, business keys and references; typed declarations live under `src/db/models/`.

## Record mapping

| Application record | Graph label |
|---|---|
| `ai_conversations` | `Conversation` |
| `ai_messages` | `Message` |
| `ai_proposed_actions` | `ProposedAction` |
| `ai_tool_invocations` | `ToolInvocation` |
| `ai_turns` | `AssistantTurn` |
| `asset_assignments` | `AssetAssignment` |
| `asset_history` | `AssetEvent` |
| `assets` | `Asset` |
| `audit_logs` | `AuditEvent` |
| `client_contacts` | `ClientContact` |
| `client_deployments` | `ClientDeployment` |
| `companies` | `Company` |
| `company_policy_documents` | `CompanyPolicyDocument` |
| `dashboard_layouts` | `DashboardLayout` |
| `leave_balances` | `LeaveBalance` |
| `leave_requests` | `LeaveRequest` |
| `notifications` | `Notification` |
| `project_checklist_items` | `ChecklistItem` |
| `project_checklist_templates` | `ChecklistTemplate` |
| `project_comments` | `Comment` |
| `project_daily_update_items` | `DailyUpdateItem` |
| `project_daily_updates` | `DailyUpdate` |
| `project_documents` | `DocumentVersion` |
| `project_eod_reports` | `EodReport` |
| `project_events` | `ProjectEvent` |
| `project_members` | `ProjectMembership` |
| `project_stage_progress` | `StageProgress` |
| `project_stages` | `StageDefinition` |
| `project_tasks` | `Task` |
| `projects` | `Project` |
| `public_holidays` | `Holiday` |
| `system_leave_types` | `LeaveType` |
| `timesheets` | `Timesheet` |
| `users` | `Employee` |
| `wfh_policy` | `WfhPolicy` |
| `wfh_requests` | `WfhRequest` |
| `work_flags` | `WorkFlag` |

## Relationships and writes

Employees connect through `REPORTS_TO`. An employee has `HAS_MEMBERSHIP` links to membership records, which connect `IN_PROJECT` to projects. Projects have `HAS_TASK` links; tasks connect through `ASSIGNED_TO`, `PARENT_TASK` and `CREATED_BY`. Leave and WFH requests connect to the employee through `REQUESTED`; leave requests also use `OF_LEAVE_TYPE` and `USES_BALANCE`. Asset assignments retain custody history through `FOR_ASSET`, `ASSIGNED_TO` and optional `FOR_DEPLOYMENT`.

Other declared references become typed relationships using `shared/graph/relationships.ts`. Reference fields remain on nodes for stable API responses and joins. Polymorphic audit/citation targets without a declared reference remain historical ID/JSON properties; do not assume every stored identifier has a graph edge. Relationship direction does not grant permission.

Creation/update validates declared references and refreshes their edges in the same query. Deleting a conversation removes its messages/turns and clears nullable turn references on retained tool logs. Employee deletion is prohibited; use the existing deactivation workflow. Other domain workflows keep their existing checks and cleanup order.

## Identity and integrity

Business IDs remain strings; timestamps are stored as epoch milliseconds and decoded back to Date values. The API keeps WFH policy ID 1 and dashboard layout user keys. Unique constraints cover every original business key, plus one active membership per employee/project and one current assignment per asset. Required fields are mandatory graph constraints. Schema markers are checksum-checked before use.

Leave approval/revocation and the balance change are one query. Leave/WFH requests check overlaps in their write query. Task creation allocates its project number and adds its task/event/audit together. Existing assistant proposals still require confirmation before the shared domain workflow submits an action. There is no automatic retry of arbitrary writes after a timeout.

## Sample data

The explicit seed uses stable sample IDs and insert-if-missing semantics. It preserves existing edits and the test account identity. Sample company policy allowances are illustrative. No real employee data or uploaded files are seeded.
