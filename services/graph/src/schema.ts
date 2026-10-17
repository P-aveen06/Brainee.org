import { createHash } from "node:crypto";

export const tableLabels = {
	users: "Employee",
	system_leave_types: "LeaveType",
	leave_balances: "LeaveBalance",
	timesheets: "Timesheet",
	leave_requests: "LeaveRequest",
	wfh_requests: "WfhRequest",
	wfh_policy: "WfhPolicy",
	public_holidays: "Holiday",
	notifications: "Notification",
	audit_logs: "AuditEvent",
	companies: "Company",
	assets: "Asset",
	client_deployments: "ClientDeployment",
	asset_assignments: "AssetAssignment",
	asset_history: "AssetEvent",
	projects: "Project",
	client_contacts: "ClientContact",
	project_members: "ProjectMembership",
	project_stages: "StageDefinition",
	project_stage_progress: "StageProgress",
	project_events: "ProjectEvent",
	project_tasks: "Task",
	project_checklist_templates: "ChecklistTemplate",
	project_checklist_items: "ChecklistItem",
	project_documents: "DocumentVersion",
	project_comments: "Comment",
	project_daily_updates: "DailyUpdate",
	project_daily_update_items: "DailyUpdateItem",
	project_eod_reports: "EodReport",
	work_flags: "WorkFlag",
	ai_conversations: "Conversation",
	ai_turns: "AssistantTurn",
	ai_messages: "Message",
	ai_tool_invocations: "ToolInvocation",
	ai_proposed_actions: "ProposedAction",
	dashboard_layouts: "DashboardLayout",
	company_policy_documents: "CompanyPolicyDocument",
} as const;

export interface Constraint {
	label: string;
	property: string;
	type: "MANDATORY" | "UNIQUE";
}

const labels = [
	...Object.values(tableLabels),
	"SchemaMigration",
	"OperationReceipt",
];
const identityConstraints: Constraint[] = labels.flatMap((label) => [
	{ label, property: "id", type: "MANDATORY" },
	{ label, property: "id", type: "UNIQUE" },
]);

export const constraints: Constraint[] = [
	...identityConstraints,
	...["authId", "emailKey"].flatMap((property) => [
		{ label: "Employee", property, type: "MANDATORY" as const },
		{ label: "Employee", property, type: "UNIQUE" as const },
	]),
];

export const migrationId = "0001-record-identities";
export const migrationChecksum = createHash("sha256")
	.update(JSON.stringify(constraints))
	.digest("hex");

export interface ConstraintRow {
	type: string;
	label: string;
	properties: string[];
	status: string;
}

export function sameConstraint(row: ConstraintRow, expected: Constraint) {
	return (
		row.type === expected.type &&
		row.label === expected.label &&
		row.properties.length === 1 &&
		row.properties[0] === expected.property
	);
}

export function constraintsReady(rows: ConstraintRow[]) {
	return (
		rows.every((row) => row.status === "OPERATIONAL") &&
		constraints.every((expected) =>
			rows.some(
				(row) => sameConstraint(row, expected) && row.status === "OPERATIONAL",
			),
		)
	);
}
