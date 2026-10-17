import { sql } from "drizzle-orm";
import {
	type AnySQLiteColumn,
	check,
	index,
	integer,
	real,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	// Legacy column name retained to preserve existing users without a migration.
	authId: text("workos_id").unique().notNull(),
	name: text("name").notNull(),
	email: text("email").unique().notNull(),
	birthday: text("birthday"),
	role: text("role").notNull().default("user"),
	standardHours: integer("standard_hours").notNull().default(8),
	joinDate: text("join_date"),
	peerLeadId: text("peer_lead_id").references((): AnySQLiteColumn => users.id),
	avatarUrl: text("avatar_url"),
	isOnboarded: integer("is_onboarded", { mode: "boolean" })
		.notNull()
		.default(false),
	// Employment lifecycle. Departures are soft: hard deletes are impossible
	// (audit_logs / approvals / peer_lead_id all reference users with no action)
	// and would cascade away timesheets and leave history.
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	exitDate: text("exit_date"),
	exitReason: text("exit_reason"),
	deactivatedById: text("deactivated_by_id").references(
		(): AnySQLiteColumn => users.id,
	),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
});

export const systemLeaveTypes = sqliteTable("system_leave_types", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").unique().notNull(),
	description: text("description"),
	defaultDays: integer("default_days").notNull(),
	accrualPerYear: integer("accrual_per_year").notNull().default(0),
	applyBeforeDays: integer("apply_before_days").notNull().default(0),
	applyBeforeDaysExtended: integer("apply_before_days_extended")
		.notNull()
		.default(0),
	extendedLimitTrigger: integer("extended_limit_trigger").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
});

export const leaveBalances = sqliteTable(
	"leave_balances",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		leaveType: text("leave_type").notNull(),
		totalLimit: real("total_limit").notNull(),
		used: real("used").notNull().default(0),
		cycleStart: text("cycle_start").notNull(),
		cycleEnd: text("cycle_end").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		unique("user_leave_type_cycle_unique").on(
			table.userId,
			table.leaveType,
			table.cycleStart,
		),
	],
);

export const timesheets = sqliteTable(
	"timesheets",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		date: text("date").notNull(),
		hours: real("hours").notNull(),
		isOvertime: integer("is_overtime", { mode: "boolean" })
			.notNull()
			.default(false),
		isWeekend: integer("is_weekend", { mode: "boolean" })
			.notNull()
			.default(false),
		status: text("status").notNull().default("logged"), // 'logged' | 're_entry'
		reEntryNote: text("re_entry_note"),
		reEntryFlaggedBy: text("re_entry_flagged_by").references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		unique("user_date_unique").on(table.userId, table.date),
		index("timesheets_user_date_idx").on(table.userId, table.date),
		index("timesheets_date_idx").on(table.date),
	],
);

export const leaveRequests = sqliteTable(
	"leave_requests",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		leaveType: text("leave_type").notNull(),
		startDate: text("start_date").notNull(),
		endDate: text("end_date").notNull(),
		isHalfDayStart: integer("is_half_day_start", { mode: "boolean" })
			.notNull()
			.default(false),
		halfDayStartPeriod: text("half_day_start_period"), // 'first_half' | 'second_half'
		isHalfDayEnd: integer("is_half_day_end", { mode: "boolean" })
			.notNull()
			.default(false),
		halfDayEndPeriod: text("half_day_end_period"), // 'first_half' | 'second_half'
		totalDays: real("total_days").notNull(),
		status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected' | 'cancelled' | 'revoked' | 're_entry'
		approvedBy: text("approved_by").references(() => users.id),
		rejectedBy: text("rejected_by").references(() => users.id),
		rejectionReason: text("rejection_reason"),
		revokedBy: text("revoked_by").references(() => users.id),
		revokeReason: text("revoke_reason"),
		reEntryNote: text("re_entry_note"),
		reason: text("reason"),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("leave_requests_user_status_idx").on(table.userId, table.status),
		index("leave_requests_status_idx").on(table.status),
	],
);

export const wfhRequests = sqliteTable(
	"wfh_requests",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		date: text("date").notNull(),
		isHalfDay: integer("is_half_day", { mode: "boolean" })
			.notNull()
			.default(false),
		halfDayPeriod: text("half_day_period"), // 'first_half' | 'second_half'
		status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected' | 'cancelled' | 'revoked' | 're_entry'
		approvedBy: text("approved_by").references(() => users.id),
		rejectedBy: text("rejected_by").references(() => users.id),
		rejectionReason: text("rejection_reason"),
		revokedBy: text("revoked_by").references(() => users.id),
		revokeReason: text("revoke_reason"),
		reEntryNote: text("re_entry_note"),
		reEntryFlaggedBy: text("re_entry_flagged_by").references(() => users.id),
		reason: text("reason"),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		unique("wfh_user_date_unique").on(table.userId, table.date),
		index("wfh_requests_user_status_idx").on(table.userId, table.status),
		index("wfh_requests_status_idx").on(table.status),
	],
);

export const wfhPolicy = sqliteTable(
	"wfh_policy",
	{
		id: integer("id").primaryKey().default(1),
		annualAllowance: real("annual_allowance").notNull().default(12),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		check("wfh_policy_singleton_check", sql`${table.id} = 1`),
		check(
			"wfh_policy_allowance_check",
			sql`${table.annualAllowance} >= 0.5 AND ${table.annualAllowance} <= 365 AND ${table.annualAllowance} * 2 = CAST(${table.annualAllowance} * 2 AS INTEGER)`,
		),
	],
);

export const publicHolidays = sqliteTable("public_holidays", {
	id: text("id").primaryKey(),
	date: text("date").unique().notNull(),
	name: text("name").notNull(),
	description: text("description"),
	year: integer("year").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
});

export const notifications = sqliteTable(
	"notifications",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		type: text("type").notNull(), // 'leave_approved' | 'leave_rejected' | etc.
		title: text("title").notNull(),
		body: text("body").notNull(),
		isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
		relatedId: text("related_id"),
		relatedType: text("related_type"), // 'leave_request' | 'wfh_request' | 'timesheet'
		actionUrl: text("action_url"),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("notifications_user_read_idx").on(table.userId, table.isRead),
	],
);

export const auditLogs = sqliteTable(
	"audit_logs",
	{
		id: text("id").primaryKey(),
		actorId: text("actor_id")
			.notNull()
			.references(() => users.id),
		action: text("action").notNull(),
		entityType: text("entity_type").notNull(),
		entityId: text("entity_id").notNull(),
		oldData: text("old_data"), // JSON text stringified
		newData: text("new_data"), // JSON text stringified
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [index("audit_logs_created_at_idx").on(table.createdAt)],
);

export const companies = sqliteTable("companies", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	code: text("code").unique().notNull(),
	isInternal: integer("is_internal", { mode: "boolean" })
		.notNull()
		.default(false),
	contactEmail: text("contact_email"),
	notes: text("notes"),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
});

export const assets = sqliteTable(
	"assets",
	{
		id: text("id").primaryKey(),
		assetTag: text("asset_tag").unique().notNull(),
		name: text("name").notNull(),
		category: text("category").notNull(), // 'laptop' | 'charger' | 'bag' | 'monitor' | 'id_card' | 'phone' | 'digital_account' | 'accessory' | 'other'
		assetType: text("asset_type").notNull().default("capital_asset"), // 'capital_asset' | 'bulk_peripheral' | 'digital_account' | 'physical'
		ownerCompanyId: text("owner_company_id")
			.notNull()
			.references(() => companies.id),
		serialNumber: text("serial_number"),
		model: text("model"),
		specs: text("specs"),
		purchaseDate: text("purchase_date"),
		purchaseCost: real("purchase_cost"),
		warrantyExpiry: text("warranty_expiry"),
		accountExpiry: text("account_expiry"),
		renewalDate: text("renewal_date"),
		status: text("status").notNull().default("in_inventory"), // 'in_inventory' | 'assigned' | 'maintenance' | 'defective' | 'replaced' | 'disposed' | 'returned_to_client'
		defectReason: text("defect_reason"),
		disposalReason: text("disposal_reason"),
		disposalDate: text("disposal_date"),
		replacedByAssetId: text("replaced_by_asset_id").references(
			(): AnySQLiteColumn => assets.id,
		),
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("assets_status_idx").on(table.status),
		index("assets_category_idx").on(table.category),
		index("assets_owner_company_idx").on(table.ownerCompanyId),
		index("assets_account_expiry_idx").on(table.accountExpiry),
	],
);

export const clientDeployments = sqliteTable(
	"client_deployments",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		primaryClientId: text("primary_client_id")
			.notNull()
			.references(() => companies.id),
		endClientId: text("end_client_id").references(() => companies.id),
		roleTitle: text("role_title"),
		startDate: text("start_date").notNull(),
		endDate: text("end_date"),
		status: text("status").notNull().default("active"), // 'active' | 'completed' | 'terminated'
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("client_deployments_user_status_idx").on(table.userId, table.status),
		index("client_deployments_primary_client_idx").on(table.primaryClientId),
	],
);

export const assetAssignments = sqliteTable(
	"asset_assignments",
	{
		id: text("id").primaryKey(),
		assetId: text("asset_id")
			.notNull()
			.references(() => assets.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		clientDeploymentId: text("client_deployment_id").references(
			() => clientDeployments.id,
		),
		assignedDate: text("assigned_date").notNull(),
		returnedDate: text("returned_date"),
		conditionOut: text("condition_out").notNull().default("good"), // 'new' | 'good' | 'fair'
		conditionIn: text("condition_in"), // 'good' | 'fair' | 'damaged' | 'defective'
		returnDestination: text("return_destination"), // 'brainee_inventory' | 'client_surrendered' | 'scrapped'
		returnNotes: text("return_notes"),
		assignedByUserId: text("assigned_by_user_id").references(() => users.id),
		receivedByUserId: text("received_by_user_id").references(() => users.id),
		acknowledgedAt: integer("acknowledged_at", { mode: "timestamp" }),
		issueReportedAt: integer("issue_reported_at", { mode: "timestamp" }),
		issueDescription: text("issue_description"),
		issueStatus: text("issue_status"), // 'open' | 'investigating' | 'resolved'
		isCurrent: integer("is_current", { mode: "boolean" })
			.notNull()
			.default(true),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("asset_assignments_asset_is_current_idx").on(
			table.assetId,
			table.isCurrent,
		),
		index("asset_assignments_user_is_current_idx").on(
			table.userId,
			table.isCurrent,
		),
	],
);

export const assetHistory = sqliteTable(
	"asset_history",
	{
		id: text("id").primaryKey(),
		assetId: text("asset_id")
			.notNull()
			.references(() => assets.id, { onDelete: "cascade" }),
		eventType: text("event_type").notNull(), // 'created' | 'assigned' | 'returned' | 'reassigned' | 'maintenance_start' | 'maintenance_end' | 'marked_defective' | 'replaced' | 'disposed' | 'renewed' | 'details_updated'
		actorId: text("actor_id").references(() => users.id),
		targetUserId: text("target_user_id").references(() => users.id),
		details: text("details"), // JSON text
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("asset_history_asset_id_idx").on(table.assetId),
		index("asset_history_created_at_idx").on(table.createdAt),
	],
);

// ─── Phase 1: Project Delivery & Spine ─────────────────────────────────────

export const projects = sqliteTable(
	"projects",
	{
		id: text("id").primaryKey(),
		code: text("code").unique().notNull(), // PRJ-001, human reference
		name: text("name").notNull(),
		description: text("description"),
		projectType: text("project_type").notNull().default("client"), // 'internal' | 'client' | 'poc' | 'retainer'
		// Client context
		clientCompanyId: text("client_company_id").references(() => companies.id), // null for internal
		clientProjectName: text("client_project_name"), // what the CLIENT calls it
		engagementModel: text("engagement_model"), // 'fixed_bid' | 'time_and_materials' | 'retainer' | 'internal'
		contractValue: real("contract_value"),
		currency: text("currency").default("INR"),
		// State
		status: text("status").notNull().default("draft"), // 'draft' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived'
		priority: text("priority").notNull().default("medium"), // 'low' | 'medium' | 'high' | 'critical'
		healthOverride: text("health_override"), // 'green' | 'amber' | 'red' — manual override of derived signal
		currentStageKey: text("current_stage_key"),
		// Dates (text ISO YYYY-MM-DD)
		startDate: text("start_date"),
		targetEndDate: text("target_end_date"),
		actualEndDate: text("actual_end_date"),
		// People
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id),
		createdById: text("created_by_id").references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("projects_status_idx").on(table.status),
		index("projects_owner_idx").on(table.ownerId),
		index("projects_client_company_idx").on(table.clientCompanyId),
	],
);

export const clientContacts = sqliteTable(
	"client_contacts",
	{
		id: text("id").primaryKey(),
		companyId: text("company_id")
			.notNull()
			.references(() => companies.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		title: text("title"),
		email: text("email"),
		phone: text("phone"),
		role: text("role").notNull().default("other"), // 'sponsor' | 'primary' | 'technical' | 'billing' | 'other'
		isPrimary: integer("is_primary", { mode: "boolean" })
			.notNull()
			.default(false),
		notes: text("notes"),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [index("client_contacts_company_idx").on(table.companyId)],
);

// THE ACL. Also the team roster over time.
export const projectMembers = sqliteTable(
	"project_members",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: text("role").notNull().default("contributor"), // 'owner' | 'manager' | 'contributor' | 'viewer'
		allocationPercent: integer("allocation_percent"), // who is on this, and how much
		billableRate: real("billable_rate"),
		joinedAt: text("joined_at"), // ISO date
		leftAt: text("left_at"),
		leaveReason: text("leave_reason"), // 'rolled_off' | 'reassigned' | 'left_company' | 'project_ended'
		replacedByUserId: text("replaced_by_user_id").references(
			(): AnySQLiteColumn => users.id,
		),
		addedById: text("added_by_id").references(() => users.id),
		isCurrent: integer("is_current", { mode: "boolean" })
			.notNull()
			.default(true),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("project_members_project_current_idx").on(
			table.projectId,
			table.isCurrent,
		),
		index("project_members_user_current_idx").on(table.userId, table.isCurrent),
	],
);

// Org-level stage definitions, admin-editable.
export const projectStages = sqliteTable("project_stages", {
	id: text("id").primaryKey(),
	key: text("key").unique().notNull(), // 'planning', 'proposal', ...
	name: text("name").notNull(),
	description: text("description"),
	sequence: integer("sequence").notNull(),
	appliesToType: text("applies_to_type"), // null = all project types
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
});

// One row per project x stage. Doubles as the transition history.
export const projectStageProgress = sqliteTable(
	"project_stage_progress",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		stageKey: text("stage_key").notNull(),
		status: text("status").notNull().default("pending"), // 'pending' | 'active' | 'completed' | 'skipped'
		startedAt: integer("started_at", { mode: "timestamp" }),
		completedAt: integer("completed_at", { mode: "timestamp" }),
		completedById: text("completed_by_id").references(() => users.id),
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		unique("project_stage_unique").on(table.projectId, table.stageKey),
	],
);

// Append-only timeline. Mirrors asset_history.
export const projectEvents = sqliteTable(
	"project_events",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		eventType: text("event_type").notNull(), // 'created' | 'stage_advanced' | 'member_added' | ...
		actorId: text("actor_id").references(() => users.id),
		entityType: text("entity_type"), // 'task' | 'document' | 'member' | ...
		entityId: text("entity_id"),
		details: text("details"), // JSON string
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("project_events_project_created_idx").on(
			table.projectId,
			table.createdAt,
		),
	],
);

export const projectTasks = sqliteTable(
	"project_tasks",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		stageKey: text("stage_key"),
		parentTaskId: text("parent_task_id").references(
			(): AnySQLiteColumn => projectTasks.id,
		),
		taskNumber: integer("task_number").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		status: text("status").notNull().default("todo"),
		priority: text("priority").notNull().default("medium"),
		assigneeId: text("assignee_id").references(() => users.id),
		createdById: text("created_by_id").references(() => users.id),
		startDate: text("start_date"),
		dueDate: text("due_date"),
		completedAt: integer("completed_at", { mode: "timestamp" }),
		estimateHours: real("estimate_hours"),
		actualHours: real("actual_hours"),
		blockedReason: text("blocked_reason"),
		sequence: integer("sequence").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		unique("project_tasks_project_task_num_unique").on(
			table.projectId,
			table.taskNumber,
		),
		index("project_tasks_project_status_idx").on(table.projectId, table.status),
		index("project_tasks_assignee_status_idx").on(
			table.assigneeId,
			table.status,
		),
		index("project_tasks_due_idx").on(table.dueDate),
	],
);

// Organization-level stage checklist defaults.
export const projectChecklistTemplates = sqliteTable(
	"project_checklist_templates",
	{
		id: text("id").primaryKey(),
		stageKey: text("stage_key").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		isRequired: integer("is_required", { mode: "boolean" })
			.notNull()
			.default(false),
		sequence: integer("sequence").notNull().default(0),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
);

// Per-project checklist instances with stage and completion tracking.
export const projectChecklistItems = sqliteTable(
	"project_checklist_items",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		stageKey: text("stage_key").notNull(),
		templateId: text("template_id"),
		title: text("title").notNull(),
		description: text("description"),
		isRequired: integer("is_required", { mode: "boolean" })
			.notNull()
			.default(false),
		status: text("status").notNull().default("pending"), // 'pending' | 'done' | 'not_applicable'
		assignedToId: text("assigned_to_id").references(() => users.id),
		createdById: text("created_by_id").references(() => users.id),
		dueDate: text("due_date"),
		completedById: text("completed_by_id").references(() => users.id),
		completedAt: integer("completed_at", { mode: "timestamp" }),
		notes: text("notes"),
		sequence: integer("sequence").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("project_checklist_project_stage_idx").on(
			table.projectId,
			table.stageKey,
		),
	],
);

// R2-backed project documents with versioning.
export const projectDocuments = sqliteTable(
	"project_documents",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		stageKey: text("stage_key"),
		title: text("title").notNull(),
		description: text("description"),
		category: text("category").notNull().default("other"), // 'proposal' | 'sow' | 'contract' | 'design' | 'report' | 'minutes' | 'other'
		r2Key: text("r2_key").unique().notNull(),
		fileName: text("file_name").notNull(),
		mimeType: text("mime_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		version: integer("version").notNull().default(1),
		supersedesDocumentId: text("supersedes_document_id").references(
			(): AnySQLiteColumn => projectDocuments.id,
		),
		status: text("status").notNull().default("final"), // 'draft' | 'final' | 'approved' | 'superseded'
		uploadedById: text("uploaded_by_id").references(() => users.id),
		checksum: text("checksum"),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [index("project_documents_project_idx").on(table.projectId)],
);

// Threaded discussions, comments, and decision records.
export const projectComments = sqliteTable(
	"project_comments",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		stageKey: text("stage_key"),
		taskId: text("task_id"),
		documentId: text("document_id"),
		parentId: text("parent_id").references(
			(): AnySQLiteColumn => projectComments.id,
		),
		authorId: text("author_id")
			.notNull()
			.references(() => users.id),
		body: text("body").notNull(),
		isDecision: integer("is_decision", { mode: "boolean" })
			.notNull()
			.default(false),
		isPinned: integer("is_pinned", { mode: "boolean" })
			.notNull()
			.default(false),
		editedAt: integer("edited_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("project_comments_project_created_idx").on(
			table.projectId,
			table.createdAt,
		),
	],
);

// ─── Phase 4: Daily Updates, EOD Reports, and Work Flags ───

export const projectDailyUpdates = sqliteTable(
	"project_daily_updates",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		date: text("date").notNull(), // ISO YYYY-MM-DD
		summary: text("summary").notNull(),
		blockers: text("blockers"),
		hoursSpent: real("hours_spent"),
		status: text("status").notNull().default("draft"), // 'draft' | 'submitted'
		submittedAt: integer("submitted_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		unique("daily_update_unique").on(table.projectId, table.userId, table.date),
		index("daily_updates_project_date_idx").on(table.projectId, table.date),
	],
);

export const projectDailyUpdateItems = sqliteTable(
	"project_daily_update_items",
	{
		id: text("id").primaryKey(),
		updateId: text("update_id")
			.notNull()
			.references(() => projectDailyUpdates.id, { onDelete: "cascade" }),
		taskId: text("task_id").notNull(),
		note: text("note"),
		progressNote: text("progress_note"),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [index("daily_update_items_update_idx").on(table.updateId)],
);

export const projectEodReports = sqliteTable(
	"project_eod_reports",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		date: text("date").notNull(), // ISO YYYY-MM-DD
		generatedById: text("generated_by_id").references(() => users.id),
		contentDraft: text("content_draft"), // system/AI assembled
		contentFinal: text("content_final"), // human-edited shareable text
		status: text("status").notNull().default("draft"), // 'draft' | 'finalised'
		missingSubmitters: text("missing_submitters"), // JSON array of userIds
		finalisedAt: integer("finalised_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [unique("eod_report_unique").on(table.projectId, table.date)],
);

export const workFlags = sqliteTable(
	"work_flags",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		entityType: text("entity_type").notNull(), // 'task' | 'daily_update'
		entityId: text("entity_id").notNull(),
		flagCode: text("flag_code").notNull(), // 'possible_duplicate' | 'no_task_linked' | 'stalled' | 'vague_update' | 'needs_analysis' | 'estimate_exceeded'
		severity: text("severity").notNull().default("info"), // 'info' | 'warning'
		message: text("message").notNull(),
		evidence: text("evidence"), // JSON details
		source: text("source").notNull().default("rule"), // 'rule' | 'ai'
		status: text("status").notNull().default("open"), // 'open' | 'acknowledged' | 'dismissed'
		raisedForUserId: text("raised_for_user_id").references(() => users.id),
		resolvedById: text("resolved_by_id").references(() => users.id),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("work_flags_project_status_idx").on(table.projectId, table.status),
	],
);

// ─── Phase 5: Scoped AI Assistant ───

export const aiConversations = sqliteTable(
	"ai_conversations",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		title: text("title"),
		lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("ai_conversations_user_updated_idx").on(
			table.userId,
			table.updatedAt,
		),
	],
);

export const aiTurns = sqliteTable(
	"ai_turns",
	{
		id: text("id").primaryKey(),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => aiConversations.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		status: text("status").notNull().default("running"),
		modelId: text("model_id"),
		toolRounds: integer("tool_rounds").notNull().default(0),
		toolCalls: integer("tool_calls").notNull().default(0),
		promptTokens: integer("prompt_tokens").notNull().default(0),
		completionTokens: integer("completion_tokens").notNull().default(0),
		totalTokens: integer("total_tokens").notNull().default(0),
		toolResultBytes: integer("tool_result_bytes").notNull().default(0),
		failureCode: text("failure_code"),
		startedAt: integer("started_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		completedAt: integer("completed_at", { mode: "timestamp" }),
	},
	(table) => [
		index("ai_turns_conversation_started_idx").on(
			table.conversationId,
			table.startedAt,
		),
		index("ai_turns_user_started_idx").on(table.userId, table.startedAt),
	],
);

export const aiMessages = sqliteTable(
	"ai_messages",
	{
		id: text("id").primaryKey(),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => aiConversations.id, { onDelete: "cascade" }),
		turnId: text("turn_id").references(() => aiTurns.id, {
			onDelete: "set null",
		}),
		sequence: integer("sequence"),
		toolRound: integer("tool_round"),
		role: text("role").notNull(), // 'user' | 'assistant' | 'tool'
		content: text("content"),
		toolCalls: text("tool_calls"), // JSON string
		toolCallId: text("tool_call_id"), // set on 'tool' rows — links a tool result back to its call
		citations: text("citations"), // JSON string — record IDs the answer rests on
		modelId: text("model_id"),
		tokensIn: integer("tokens_in"),
		tokensOut: integer("tokens_out"),
		latencyMs: integer("latency_ms"),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("ai_messages_conversation_idx").on(
			table.conversationId,
			table.createdAt,
		),
	],
);

export const aiToolInvocations = sqliteTable(
	"ai_tool_invocations",
	{
		id: text("id").primaryKey(),
		messageId: text("message_id"),
		turnId: text("turn_id").references(() => aiTurns.id, {
			onDelete: "set null",
		}),
		toolRound: integer("tool_round"),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		toolName: text("tool_name").notNull(),
		args: text("args"), // JSON string
		resultRowCount: integer("result_row_count"),
		resultBytes: integer("result_bytes"),
		durationMs: integer("duration_ms"),
		success: integer("success", { mode: "boolean" }),
		deniedReason: text("denied_reason"), // non-null = the call was refused
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("ai_tool_invocations_user_created_idx").on(
			table.userId,
			table.createdAt,
		),
	],
);

export const aiProposedActions = sqliteTable(
	"ai_proposed_actions",
	{
		id: text("id").primaryKey(),
		messageId: text("message_id"),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		actionType: text("action_type").notNull(), // 'update_task_status' | 'reassign_task' | 'create_task'
		targetEntityType: text("target_entity_type").notNull(), // 'task' | 'project'
		targetEntityId: text("target_entity_id").notNull(),
		payload: text("payload"), // JSON string
		status: text("status").notNull().default("pending"), // 'pending' | 'confirmed' | 'rejected' | 'expired' | 'executing' | 'failed'
		confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
		expiresAt: integer("expires_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
		updatedAt: integer("updated_at", { mode: "timestamp" }).default(
			sql`(unixepoch())`,
		),
	},
	(table) => [
		index("ai_proposed_actions_user_status_idx").on(table.userId, table.status),
	],
);

// Per-user dashboard widget order/visibility. `layout` is a JSON array of
// { id, hidden } entries; missing rows fall back to the role default.
export const dashboardLayouts = sqliteTable("dashboard_layouts", {
	userId: text("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	layout: text("layout").notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
});
export { companyPolicyDocuments } from "./company-policy-documents";
