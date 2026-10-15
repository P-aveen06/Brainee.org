// @ts-nocheck
import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";
import { format, addDays } from "date-fns";
import { seedAssetsAndAssignments } from "./seed-assets";

// Locate local D1 sqlite database
const d1Dir = path.resolve(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
const sqliteFiles = fs.readdirSync(d1Dir).filter((f) => f.endsWith(".sqlite") && !f.startsWith("metadata"));

if (sqliteFiles.length === 0) {
	console.error("❌ No local D1 sqlite file found in", d1Dir);
	process.exit(1);
}

const sqlitePath = path.join(d1Dir, sqliteFiles[0]);
console.log("🌱 Seeding into local SQLite:", sqlitePath);

const db = new Database(sqlitePath);
db.run("PRAGMA foreign_keys = OFF;");

const now = Math.floor(Date.now() / 1000);

// ─── 1. Ensure Standard Stages ───
const stages = [
	{ id: "stage-1", key: "planning", name: "Planning & Architecture", seq: 1, desc: "Scope definition, architectural review, and technical feasibility." },
	{ id: "stage-2", key: "proposal", name: "Proposal & Sign-off", seq: 2, desc: "Commercial proposal, contract terms, and client approval." },
	{ id: "stage-3", key: "discovery", name: "Discovery & Inception", seq: 3, desc: "Requirements elicitation, wireframing, and environment setup." },
	{ id: "stage-4", key: "development", name: "Implementation & Build", seq: 4, desc: "Sprint cycles, active feature development, and unit testing." },
	{ id: "stage-5", key: "testing", name: "Verification & QA", seq: 5, desc: "End-to-end integration, performance testing, and user acceptance." },
	{ id: "stage-6", key: "deployment", name: "Rollout & Handover", seq: 6, desc: "Production cutover, DNS routing, and client stakeholder training." },
	{ id: "stage-7", key: "closure", name: "Closure & Retrospective", seq: 7, desc: "Final sign-off, asset decommissioning, and knowledge handover." },
];

for (const s of stages) {
	db.run(
		`INSERT OR REPLACE INTO project_stages (id, key, name, description, sequence, is_active, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
		[s.id, s.key, s.name, s.desc, s.seq, now, now],
	);
}

// ─── 2. Seed Startup Team Members ───
const charanId = "30752daf-a530-4cb0-9b30-9af3c04467f1";

const teamMembers = [
	{ id: charanId, name: "Charan Ragupathi", email: "charan@thecloud.company", role: "admin", standardHours: 8, joinDate: "2024-01-01", birthday: "2002-12-12", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Charan", isActive: 1, peerLeadId: null },
	{ id: "usr-priya", name: "Priya Sharma", email: "priya@thecloud.company", role: "lead", standardHours: 8, joinDate: "2024-02-15", birthday: "1997-10-14", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya", isActive: 1, peerLeadId: charanId },
	{ id: "usr-vikram", name: "Vikram Mehta", email: "vikram@thecloud.company", role: "user", standardHours: 8, joinDate: "2024-03-01", birthday: "1996-10-22", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram", isActive: 1, peerLeadId: "usr-priya" },
	{ id: "usr-ananya", name: "Ananya Roy", email: "ananya@thecloud.company", role: "user", standardHours: 8, joinDate: "2024-04-10", birthday: "1998-11-03", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ananya", isActive: 1, peerLeadId: "usr-priya" },
	{ id: "usr-rahul", name: "Rahul Verma", email: "rahul@thecloud.company", role: "user", standardHours: 8, joinDate: "2024-05-01", birthday: "1995-11-18", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul", isActive: 1, peerLeadId: "usr-priya" },
	{ id: "usr-sneha", name: "Sneha Patel", email: "sneha@thecloud.company", role: "user", standardHours: 8, joinDate: "2024-05-15", birthday: "1999-04-05", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha", isActive: 1, peerLeadId: "usr-priya" },
	{ id: "usr-amitabh", name: "Amitabh Ghosh", email: "amitabh@thecloud.company", role: "lead", standardHours: 8, joinDate: "2024-06-01", birthday: "1992-06-20", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Amitabh", isActive: 1, peerLeadId: charanId },
	{ id: "usr-kavita", name: "Kavita Nair", email: "kavita@thecloud.company", role: "user", standardHours: 8, joinDate: "2024-06-15", birthday: "1996-08-14", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kavita", isActive: 1, peerLeadId: "usr-amitabh" },
	{ id: "usr-rohan", name: "Rohan Gupta", email: "rohan@thecloud.company", role: "user", standardHours: 8, joinDate: "2024-07-01", birthday: "1997-09-02", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rohan", isActive: 1, peerLeadId: "usr-amitabh" },
	{ id: "usr-divya", name: "Divya Krishnan", email: "divya@thecloud.company", role: "user", standardHours: 8, joinDate: "2024-07-15", birthday: "1998-01-25", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Divya", isActive: 1, peerLeadId: "usr-amitabh" },
	{ id: "usr-karthik", name: "Karthik Iyer", email: "karthik@thecloud.company", role: "lead", standardHours: 8, joinDate: "2024-08-01", birthday: "1994-03-30", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Karthik", isActive: 1, peerLeadId: charanId },
	{ id: "usr-neha", name: "Neha Sen", email: "neha@thecloud.company", role: "user", standardHours: 8, joinDate: "2024-08-15", birthday: "1999-07-19", avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Neha", isActive: 1, peerLeadId: "usr-karthik" },
	{ id: "usr-siddharth", name: "Siddharth Joshi", email: "siddharth@thecloud.company", role: "user", standardHours: 8, joinDate: "2024-01-15", birthday: "1996-05-12", avatarUrl: null, isActive: 0, exitDate: "2026-06-30", exitReason: "resignation", peerLeadId: "usr-karthik" },
];

for (const u of teamMembers) {
	db.run(
		`INSERT OR REPLACE INTO users (id, workos_id, name, email, birthday, avatar_url, role, peer_lead_id, standard_hours, join_date, is_onboarded, is_active, exit_date, exit_reason, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
		[
			u.id,
			`workos-${u.id}`,
			u.name,
			u.email,
			u.birthday || null,
			u.avatarUrl || null,
			u.role,
			u.peerLeadId || null,
			u.standardHours,
			u.joinDate,
			u.isActive,
			u.exitDate || null,
			u.exitReason || null,
			now,
			now,
		],
	);
}

// ─── 3. Ensure Client Companies & Contacts ───
const unileverId = "1b42af3d-d19e-40f0-b59f-4fc7ed1e1344";
const deloitteId = "c3dcbf79-a1ef-4f58-ac40-037625d6962a";
const cumminsId = "b7090e86-bd47-48d5-af30-daeecbfdf824";

const clientContacts = [
	{ id: "cc-1", companyId: unileverId, name: "Sarah Jenkins", title: "VP Digital Commerce", email: "sarah.jenkins@unilever.com", phone: "+44 20 7946 0912", role: "sponsor", isPrimary: 1 },
	{ id: "cc-2", companyId: unileverId, name: "David Brown", title: "Principal Enterprise Architect", email: "david.brown@unilever.com", phone: "+44 20 7946 0913", role: "technical", isPrimary: 0 },
	{ id: "cc-3", companyId: unileverId, name: "Emma Wilson", title: "Procurement Manager", email: "emma.wilson@unilever.com", phone: "+44 20 7946 0914", role: "billing", isPrimary: 0 },
	{ id: "cc-4", companyId: deloitteId, name: "Markus Vance", title: "Managing Director", email: "mvance@deloitte.com", phone: "+1 212 555 0198", role: "sponsor", isPrimary: 1 },
	{ id: "cc-5", companyId: deloitteId, name: "Elena Rostova", title: "Lead Systems Architect", email: "erostova@deloitte.com", phone: "+1 212 555 0199", role: "technical", isPrimary: 0 },
	{ id: "cc-6", companyId: cumminsId, name: "John Miller", title: "VP Operations & Fleet", email: "john.miller@cummins.com", phone: "+1 812 377 5000", role: "sponsor", isPrimary: 1 },
	{ id: "cc-7", companyId: cumminsId, name: "Robert Taylor", title: "Director of IoT Engineering", email: "robert.taylor@cummins.com", phone: "+1 812 377 5001", role: "technical", isPrimary: 0 },
];

for (const c of clientContacts) {
	db.run(
		`INSERT OR REPLACE INTO client_contacts (id, company_id, name, title, email, phone, role, is_primary, is_active, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
		[c.id, c.companyId, c.name, c.title, c.email, c.phone, c.role, c.isPrimary, now, now],
	);
}

// ─── 4. Seed 10 Projects ───
const projectList = [
	{
		id: "prj-001",
		code: "PRJ-001",
		name: "Unilever Consumer Loyalty & Rewards App",
		description: "Cross-platform mobile and web consumer rewards portal integrating with Unilever Global SAP loyalty engine.",
		projectType: "client",
		clientCompanyId: unileverId,
		clientProjectName: "Project Apollo",
		engagementModel: "fixed_bid",
		contractValue: 4500000,
		currency: "INR",
		status: "active",
		priority: "high",
		healthOverride: "green",
		currentStageKey: "development",
		startDate: "2026-07-01",
		targetEndDate: "2026-11-30",
		ownerId: charanId,
	},
	{
		id: "prj-002",
		code: "PRJ-002",
		name: "Deloitte Risk Analytics & Reporting Engine",
		description: "High-throughput financial risk calculation pipeline with automated audit compliance dashboards.",
		projectType: "client",
		clientCompanyId: deloitteId,
		clientProjectName: "Sentinel Analytics",
		engagementModel: "time_and_materials",
		contractValue: 6800000,
		currency: "INR",
		status: "active",
		priority: "critical",
		healthOverride: "amber",
		currentStageKey: "testing",
		startDate: "2026-06-15",
		targetEndDate: "2026-09-30",
		ownerId: "usr-priya",
	},
	{
		id: "prj-003",
		code: "PRJ-003",
		name: "Cummins Fleet Telemetry & Predictive Maintenance",
		description: "Real-time engine CAN-bus data streaming gateway with edge-anomaly detection for heavy industrial engines.",
		projectType: "client",
		clientCompanyId: cumminsId,
		clientProjectName: "SmartEngine v3",
		engagementModel: "retainer",
		contractValue: 1200000,
		currency: "INR",
		status: "active",
		priority: "critical",
		healthOverride: "red",
		currentStageKey: "discovery",
		startDate: "2026-08-01",
		targetEndDate: "2026-12-15",
		ownerId: charanId,
	},
	{
		id: "prj-004",
		code: "PRJ-004",
		name: "Brainee.org Cloud Cost & FinOps Optimization",
		description: "Internal automated tooling to track multi-account Cloudflare, AWS, and GCP resource sprawl and cost waste.",
		projectType: "internal",
		clientCompanyId: null,
		clientProjectName: null,
		engagementModel: "internal",
		contractValue: null,
		currency: "INR",
		status: "active",
		priority: "medium",
		healthOverride: "green",
		currentStageKey: "development",
		startDate: "2026-07-15",
		targetEndDate: "2026-10-31",
		ownerId: "usr-kavita",
	},
	{
		id: "prj-005",
		code: "PRJ-005",
		name: "Unilever Retail Store Audit & Compliance Tool",
		description: "Offline-first field audit progressive web app for regional merchandising supervisors across Tier-2 cities.",
		projectType: "client",
		clientCompanyId: unileverId,
		clientProjectName: "FieldVision",
		engagementModel: "fixed_bid",
		contractValue: 3200000,
		currency: "INR",
		status: "active",
		priority: "high",
		healthOverride: "green",
		currentStageKey: "deployment",
		startDate: "2026-05-01",
		targetEndDate: "2026-09-15",
		ownerId: "usr-karthik",
	},
	{
		id: "prj-006",
		code: "PRJ-006",
		name: "AI Code Review & Quality Copilot (POC)",
		description: "Proof-of-concept AI assistant that reviews GitHub pull requests against internal architectural rules.",
		projectType: "poc",
		clientCompanyId: null,
		clientProjectName: null,
		engagementModel: "internal",
		contractValue: null,
		currency: "INR",
		status: "active",
		priority: "medium",
		healthOverride: "green",
		currentStageKey: "discovery",
		startDate: "2026-08-10",
		targetEndDate: "2026-10-15",
		ownerId: charanId,
	},
	{
		id: "prj-007",
		code: "PRJ-007",
		name: "Deloitte Core Banking Data Migration",
		description: "Extract-Transform-Load framework for migrating 12M customer accounts to modern relational schema.",
		projectType: "client",
		clientCompanyId: deloitteId,
		clientProjectName: "Project Horizon",
		engagementModel: "time_and_materials",
		contractValue: 9500000,
		currency: "INR",
		status: "on_hold",
		priority: "high",
		healthOverride: "amber",
		currentStageKey: "planning",
		startDate: "2026-08-01",
		targetEndDate: "2027-02-28",
		ownerId: "usr-priya",
	},
	{
		id: "prj-008",
		code: "PRJ-008",
		name: "Cummins Mobile Field Technician v1",
		description: "Cross-platform React Native app for on-site engine diagnostics and warranty part requisition.",
		projectType: "client",
		clientCompanyId: cumminsId,
		clientProjectName: "FieldTech Mobile",
		engagementModel: "fixed_bid",
		contractValue: 2800000,
		currency: "INR",
		status: "completed",
		priority: "medium",
		healthOverride: "green",
		currentStageKey: "closure",
		startDate: "2026-03-01",
		targetEndDate: "2026-07-31",
		actualEndDate: "2026-07-28",
		ownerId: "usr-rohan",
	},
	{
		id: "prj-009",
		code: "PRJ-009",
		name: "Brainee.org Single Sign-On & Zero Trust Security",
		description: "Company-wide authentication upgrade to WorkOS Directory Sync, hardware 2FA, and RBAC token claims.",
		projectType: "internal",
		clientCompanyId: null,
		clientProjectName: null,
		engagementModel: "internal",
		contractValue: null,
		currency: "INR",
		status: "completed",
		priority: "high",
		healthOverride: "green",
		currentStageKey: "closure",
		startDate: "2026-04-15",
		targetEndDate: "2026-08-15",
		actualEndDate: "2026-08-12",
		ownerId: "usr-neha",
	},
	{
		id: "prj-010",
		code: "PRJ-010",
		name: "Legacy CRM Archive Pipeline",
		description: "Decommissioning legacy Salesforce tenant and archiving historical interactions into cold S3 storage.",
		projectType: "client",
		clientCompanyId: unileverId,
		clientProjectName: "Legacy Sunset",
		engagementModel: "time_and_materials",
		contractValue: 800000,
		currency: "INR",
		status: "cancelled",
		priority: "low",
		healthOverride: "red",
		currentStageKey: "planning",
		startDate: "2026-05-01",
		targetEndDate: "2026-06-30",
		ownerId: charanId,
	},
];

for (const p of projectList) {
	db.run(
		`INSERT OR REPLACE INTO projects (
			id, code, name, description, project_type, client_company_id, client_project_name,
			engagement_model, contract_value, currency, status, priority, health_override,
			current_stage_key, start_date, target_end_date, actual_end_date, owner_id, created_by_id,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			p.id,
			p.code,
			p.name,
			p.description,
			p.projectType,
			p.clientCompanyId,
			p.clientProjectName,
			p.engagementModel,
			p.contractValue,
			p.currency,
			p.status,
			p.priority,
			p.healthOverride,
			p.currentStageKey,
			p.startDate,
			p.targetEndDate,
			p.actualEndDate || null,
			p.ownerId,
			charanId,
			now,
			now,
		],
	);

	// Insert owner into project_members
	db.run(
		`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, allocation_percent, is_current, joined_at, created_at, updated_at)
		 VALUES (?, ?, ?, 'owner', 100, 1, ?, ?, ?)`,
		[`mem-${p.id}-owner`, p.id, p.ownerId, p.startDate, now, now],
	);

	// Always ensure Charan is a member so all projects are visible
	if (p.ownerId !== charanId) {
		db.run(
			`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, allocation_percent, is_current, joined_at, created_at, updated_at)
			 VALUES (?, ?, ?, 'manager', 50, 1, ?, ?, ?)`,
			[`mem-${p.id}-charan`, p.id, charanId, p.startDate, now, now],
		);
	}
}

// ─── 5. Add Team Roster Allocations & Past Rolled-Off Members ───
const rosterAssignments = [
	// PRJ-001 (Unilever Apollo)
	{ id: "mem-01-1", projectId: "prj-001", userId: "usr-ananya", role: "contributor", allocation: 100, isCurrent: 1, joinedAt: "2026-07-01" },
	{ id: "mem-01-2", projectId: "prj-001", userId: "usr-vikram", role: "contributor", allocation: 80, isCurrent: 1, joinedAt: "2026-07-05" },
	{ id: "mem-01-3", projectId: "prj-001", userId: "usr-sneha", role: "contributor", allocation: 40, isCurrent: 1, joinedAt: "2026-07-01" },
	{ id: "mem-01-4", projectId: "prj-001", userId: "usr-amitabh", role: "manager", allocation: 50, isCurrent: 1, joinedAt: "2026-07-10" },
	{ id: "mem-01-5", projectId: "prj-001", userId: "usr-siddharth", role: "contributor", allocation: 100, isCurrent: 0, joinedAt: "2026-07-01", leftAt: "2026-08-01", leaveReason: "left_company" },

	// PRJ-002 (Deloitte Sentinel)
	{ id: "mem-02-1", projectId: "prj-002", userId: "usr-rahul", role: "contributor", allocation: 100, isCurrent: 1, joinedAt: "2026-06-15" },
	{ id: "mem-02-2", projectId: "prj-002", userId: "usr-divya", role: "contributor", allocation: 100, isCurrent: 1, joinedAt: "2026-06-20" },
	{ id: "mem-02-3", projectId: "prj-002", userId: "usr-amitabh", role: "contributor", allocation: 50, isCurrent: 1, joinedAt: "2026-07-01" },

	// PRJ-003 (Cummins SmartEngine)
	{ id: "mem-03-1", projectId: "prj-003", userId: "usr-kavita", role: "contributor", allocation: 100, isCurrent: 1, joinedAt: "2026-08-01" },
	{ id: "mem-03-2", projectId: "prj-003", userId: "usr-divya", role: "contributor", allocation: 50, isCurrent: 1, joinedAt: "2026-08-01" },
	{ id: "mem-03-3", projectId: "prj-003", userId: "usr-rohan", role: "contributor", allocation: 50, isCurrent: 1, joinedAt: "2026-08-05" },

	// PRJ-004 (Brainee.org FinOps)
	{ id: "mem-04-1", projectId: "prj-004", userId: "usr-rahul", role: "contributor", allocation: 50, isCurrent: 1, joinedAt: "2026-07-15" },
	{ id: "mem-04-2", projectId: "prj-004", userId: "usr-vikram", role: "contributor", allocation: 30, isCurrent: 1, joinedAt: "2026-08-01" },

	// PRJ-005 (Unilever FieldVision)
	{ id: "mem-05-1", projectId: "prj-005", userId: "usr-rohan", role: "contributor", allocation: 100, isCurrent: 1, joinedAt: "2026-05-01" },
	{ id: "mem-05-2", projectId: "prj-005", userId: "usr-ananya", role: "contributor", allocation: 50, isCurrent: 1, joinedAt: "2026-05-15" },
	{ id: "mem-05-3", projectId: "prj-005", userId: "usr-amitabh", role: "contributor", allocation: 30, isCurrent: 1, joinedAt: "2026-06-01" },
];

for (const r of rosterAssignments) {
	db.run(
		`INSERT OR REPLACE INTO project_members (id, project_id, user_id, role, allocation_percent, is_current, joined_at, left_at, leave_reason, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[r.id, r.projectId, r.userId, r.role, r.allocation, r.isCurrent, r.joinedAt, r.leftAt || null, r.leaveReason || null, now, now],
	);
}

// ─── 6. Clear & Seed 200+ Realistic Tasks Across Projects ───
db.run("DELETE FROM project_tasks;");

interface TaskTemplate {
	title: string;
	description: string;
	stageKey: string;
	status: "todo" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled";
	priority: "low" | "medium" | "high" | "critical";
	assigneeId: string | null;
	daysFromNowStart?: number;
	daysFromNowDue?: number;
	estHours?: number;
	actHours?: number;
	blockedReason?: string;
	subtasks?: string[];
}

const PRJ_001_TASKS: TaskTemplate[] = [
	{
		title: "Design mobile Figma design tokens and component library",
		description: "Extract color tokens, typography scales, and button component variants in Figma.",
		stageKey: "development",
		status: "done",
		priority: "high",
		assigneeId: "usr-sneha",
		daysFromNowStart: -30,
		daysFromNowDue: -15,
		estHours: 40,
		actHours: 36,
	},
	{
		title: "Configure WorkOS OAuth2 authentication flow with Unilever AD",
		description: "Setup SSO redirect endpoints, cookie security policies, and token refreshing.",
		stageKey: "development",
		status: "done",
		priority: "critical",
		assigneeId: charanId,
		daysFromNowStart: -25,
		daysFromNowDue: -10,
		estHours: 24,
		actHours: 28,
	},
	{
		title: "Build loyalty points ledger schema and migration",
		description: "Double-entry accounting table for earn/burn events with idempotency keys.",
		stageKey: "development",
		status: "done",
		priority: "critical",
		assigneeId: "usr-vikram",
		daysFromNowStart: -20,
		daysFromNowDue: -8,
		estHours: 32,
		actHours: 30,
	},
	{
		title: "Implement Apple Pay & Google Pay direct checkout SDK",
		description: "Integrate native payment sheets with Razorpay / Stripe unified backend.",
		stageKey: "development",
		status: "in_progress",
		priority: "critical",
		assigneeId: "usr-ananya",
		daysFromNowStart: -5,
		daysFromNowDue: 5,
		estHours: 40,
		actHours: 18,
		subtasks: [
			"Configure Apple Developer merchant identifier and certificates",
			"Integrate Google Pay Pass payload signing",
			"Create fallback webhook confirmation handler",
		],
	},
	{
		title: "Resolve SAP ERP inventory sync API rate-limiting error (HTTP 429)",
		description: "Batch queries and implement token bucket queue on outgoing ERP stock checks.",
		stageKey: "development",
		status: "blocked",
		priority: "critical",
		assigneeId: charanId,
		daysFromNowStart: -8,
		daysFromNowDue: -1,
		estHours: 16,
		actHours: 12,
		blockedReason: "Waiting on Unilever Global SAP Gateway team to increase API throttle quota from 10 req/s to 100 req/s.",
	},
	{
		title: "Push notifications engine for flash sale rewards",
		description: "Firebase Cloud Messaging integration with background worker queue for 500k device pushes.",
		stageKey: "development",
		status: "in_progress",
		priority: "high",
		assigneeId: "usr-vikram",
		daysFromNowStart: -2,
		daysFromNowDue: 8,
		estHours: 30,
		actHours: 10,
	},
	{
		title: "Optimize Cold Start app launch time under 1.2 seconds",
		description: "Bundle splitting and lazy loading of non-critical analytics SDKs on mobile boot.",
		stageKey: "development",
		status: "in_review",
		priority: "high",
		assigneeId: "usr-ananya",
		daysFromNowStart: -10,
		daysFromNowDue: 2,
		estHours: 20,
		actHours: 22,
	},
	{
		title: "Automate Cypress end-to-end checkout regression suite",
		description: "Comprehensive test covering product selection, reward redemption, and payment.",
		stageKey: "testing",
		status: "in_progress",
		priority: "medium",
		assigneeId: "usr-amitabh",
		daysFromNowStart: 0,
		daysFromNowDue: 14,
		estHours: 36,
		actHours: 6,
	},
	{
		title: "Security penetration testing and OWASP compliance review",
		description: "Third-party audit remediation for API token storage and CORS headers.",
		stageKey: "testing",
		status: "todo",
		priority: "high",
		assigneeId: "usr-neha",
		daysFromNowStart: 7,
		daysFromNowDue: 21,
		estHours: 40,
	},
	{
		title: "Offline barcode scanner fallback for store clerks",
		description: "Camera feed QR code scanner with local IndexedDB cached voucher validation.",
		stageKey: "development",
		status: "todo",
		priority: "medium",
		assigneeId: null,
		daysFromNowStart: 5,
		daysFromNowDue: 18,
		estHours: 24,
	},
	{
		title: "Unilever brand compliance dark-mode contrast verification",
		description: "Ensure all contrast ratios satisfy WCAG 2.1 AA requirements.",
		stageKey: "development",
		status: "todo",
		priority: "low",
		assigneeId: "usr-sneha",
		daysFromNowStart: 10,
		daysFromNowDue: 25,
		estHours: 16,
	},
	{
		title: "Production DNS cutover and Cloudflare CDN caching rules",
		description: "Configure edge caching, SSL/TLS full strict certificates, and DDoS thresholds.",
		stageKey: "deployment",
		status: "todo",
		priority: "critical",
		assigneeId: charanId,
		daysFromNowStart: 5,
		daysFromNowDue: 12,
		estHours: 12,
	},
	{
		title: "Research Apple Wallet pass generation for VIP tiers",
		description: "Evaluate passkit generation libraries and server certificate management.",
		stageKey: "planning",
		status: "todo",
		priority: "low",
		assigneeId: null,
	},
	{
		title: "Investigate BLE beacon telemetry for in-store footfall analytics",
		description: "Feasibility study for Bluetooth Low Energy location pings inside hypermarkets.",
		stageKey: "planning",
		status: "todo",
		priority: "low",
		assigneeId: null,
	},
];

const PRJ_002_TASKS: TaskTemplate[] = [
	{
		title: "Design PostgreSQL time-series partition strategy for audit logs",
		description: "Partitioning audit logs by month to maintain fast indexing across 50M rows.",
		stageKey: "planning",
		status: "done",
		priority: "critical",
		assigneeId: "usr-priya",
		daysFromNowStart: -45,
		daysFromNowDue: -30,
		estHours: 32,
		actHours: 28,
	},
	{
		title: "Construct Monte Carlo portfolio stress simulation pipeline",
		description: "Parallelized simulation worker calculating Value-at-Risk across 500,000 scenarios.",
		stageKey: "development",
		status: "done",
		priority: "critical",
		assigneeId: "usr-divya",
		daysFromNowStart: -35,
		daysFromNowDue: -15,
		estHours: 60,
		actHours: 72,
	},
	{
		title: "Build real-time risk exposure dashboard in React with Virtualized Tables",
		description: "Streaming financial dashboard handling 100 ticks per second without UI stutter.",
		stageKey: "development",
		status: "done",
		priority: "high",
		assigneeId: "usr-rahul",
		daysFromNowStart: -25,
		daysFromNowDue: -5,
		estHours: 48,
		actHours: 44,
	},
	{
		title: "Fix memory leak in WebSocket price feed ingestion daemon",
		description: "Long-running daemon RSS memory grows by 200MB/hr due to unbounded unack buffers.",
		stageKey: "testing",
		status: "blocked",
		priority: "critical",
		assigneeId: "usr-rahul",
		daysFromNowStart: -10,
		daysFromNowDue: -2,
		estHours: 24,
		actHours: 30,
		blockedReason: "Need dedicated staging core-banking feed simulation harness from Deloitte IT.",
	},
	{
		title: "Validate Basel III regulatory liquidity coverage ratio calculations",
		description: "Audit mathematical calculations against European Banking Authority test vectors.",
		stageKey: "testing",
		status: "in_progress",
		priority: "critical",
		assigneeId: charanId,
		daysFromNowStart: -4,
		daysFromNowDue: 0,
		estHours: 24,
		actHours: 16,
	},
	{
		title: "Automate load test simulating 5,000 concurrent analyst queries",
		description: "Run k6 load test against reporting API endpoints and monitor D1 / Postgres latency.",
		stageKey: "testing",
		status: "in_progress",
		priority: "high",
		assigneeId: "usr-amitabh",
		daysFromNowStart: -1,
		daysFromNowDue: 7,
		estHours: 32,
		actHours: 8,
	},
	{
		title: "Implement multi-tenant data isolation verification script",
		description: "Verify that tenant isolation rules in Row Level Security cannot be bypassed.",
		stageKey: "testing",
		status: "in_review",
		priority: "high",
		assigneeId: "usr-priya",
		daysFromNowStart: -7,
		daysFromNowDue: 3,
		estHours: 16,
		actHours: 14,
	},
	{
		title: "Prepare SOC2 Type II audit report bundle and access evidence",
		description: "Collate system architecture diagrams, encryption-at-rest proof, and deployment logs.",
		stageKey: "testing",
		status: "todo",
		priority: "high",
		assigneeId: "usr-neha",
		daysFromNowStart: 4,
		daysFromNowDue: 18,
		estHours: 24,
	},
	{
		title: "Production disaster recovery failover drill",
		description: "Simulate primary database region outage and measure recovery point objective (RPO).",
		stageKey: "deployment",
		status: "todo",
		priority: "critical",
		assigneeId: "usr-kavita",
		daysFromNowStart: 12,
		daysFromNowDue: 26,
		estHours: 20,
	},
];

const PRJ_003_TASKS: TaskTemplate[] = [
	{
		title: "Audit Cummins engine CAN-bus sensor telemetry formats (J1939)",
		description: "Review SAE J1939 parameter groups and diagnostic trouble code definitions.",
		stageKey: "discovery",
		status: "done",
		priority: "high",
		assigneeId: charanId,
		daysFromNowStart: -20,
		daysFromNowDue: -10,
		estHours: 24,
		actHours: 20,
	},
	{
		title: "Architecture Spike: Edge MQTT broker vs Cloudflare Workers WebSocket",
		description: "Benchmark packet latency, reconnection resilience, and battery drain on field hardware.",
		stageKey: "discovery",
		status: "blocked",
		priority: "critical",
		assigneeId: "usr-kavita",
		daysFromNowStart: -12,
		daysFromNowDue: -4,
		estHours: 36,
		actHours: 24,
		blockedReason: "Physical Cummins hardware testbench in Columbus, IN is currently offline for facility maintenance.",
	},
	{
		title: "Design time-series anomaly detection algorithm for cooling water pressure",
		description: "Autoregressive statistical filter to detect sudden head gasket pressure drops.",
		stageKey: "discovery",
		status: "in_progress",
		priority: "critical",
		assigneeId: "usr-divya",
		daysFromNowStart: -5,
		daysFromNowDue: 3,
		estHours: 40,
		actHours: 22,
	},
	{
		title: "Draft telemetry ingestion security specification",
		description: "Mutual TLS authentication and hardware-rooted certificates for vehicle gateways.",
		stageKey: "discovery",
		status: "in_progress",
		priority: "high",
		assigneeId: charanId,
		daysFromNowStart: -2,
		daysFromNowDue: 1,
		estHours: 20,
		actHours: 8,
	},
	{
		title: "Establish automated nightly synthetic sensor payload generator",
		description: "Tooling to emit 10,000 synthetic truck engine sensor streams for load benchmarks.",
		stageKey: "discovery",
		status: "todo",
		priority: "medium",
		assigneeId: "usr-rohan",
		daysFromNowStart: 2,
		daysFromNowDue: 14,
		estHours: 32,
	},
	{
		title: "Client Stakeholder Architecture Review Meeting Prep",
		description: "Slide deck and live prototype demonstration for Cummins Engineering Directors.",
		stageKey: "discovery",
		status: "todo",
		priority: "critical",
		assigneeId: charanId,
		daysFromNowStart: 8,
		daysFromNowDue: 12,
		estHours: 16,
	},
];

const PRJ_004_TASKS: TaskTemplate[] = [
	{
		title: "Audit unused Cloudflare R2 object storage buckets and stale uploads",
		description: "Scan for abandoned build artifact buckets and apply lifecycle expiration policies.",
		stageKey: "development",
		status: "done",
		priority: "medium",
		assigneeId: "usr-kavita",
		daysFromNowStart: -25,
		daysFromNowDue: -12,
		estHours: 16,
		actHours: 14,
	},
	{
		title: "Migrate idle EC2 staging instances to Cloudflare Workers / Serverless",
		description: "Replace $450/mo idle Linux VM instances with edge serverless functions.",
		stageKey: "development",
		status: "done",
		priority: "high",
		assigneeId: "usr-rahul",
		daysFromNowStart: -18,
		daysFromNowDue: -5,
		estHours: 30,
		actHours: 32,
	},
	{
		title: "Build automated FinOps Slack alert webhook for sudden billing spikes",
		description: "Daily cron alerting engineering leads if any cloud service spikes > 25% DoD.",
		stageKey: "development",
		status: "in_progress",
		priority: "high",
		assigneeId: "usr-kavita",
		daysFromNowStart: -3,
		daysFromNowDue: 4,
		estHours: 20,
		actHours: 12,
	},
	{
		title: "Implement automated GitHub Actions cache eviction script",
		description: "Prune old action cache entries that exceed weekly 10GB storage allotments.",
		stageKey: "development",
		status: "todo",
		priority: "low",
		assigneeId: "usr-vikram",
		daysFromNowStart: 2,
		daysFromNowDue: 10,
		estHours: 12,
	},
];

const PRJ_005_TASKS: TaskTemplate[] = [
	{
		title: "Build barcode camera scanner library with zbar-wasm",
		description: "WebAssembly-accelerated barcode scanner working smoothly on low-end Android tablets.",
		stageKey: "deployment",
		status: "done",
		priority: "high",
		assigneeId: "usr-rohan",
		daysFromNowStart: -40,
		daysFromNowDue: -25,
		estHours: 32,
		actHours: 35,
	},
	{
		title: "Conduct pilot store rollout in Mumbai & Pune retail outlets",
		description: "On-site testing with 15 store supervisors to measure audit completion speed.",
		stageKey: "deployment",
		status: "in_progress",
		priority: "critical",
		assigneeId: "usr-karthik",
		daysFromNowStart: -5,
		daysFromNowDue: 5,
		estHours: 40,
		actHours: 28,
	},
	{
		title: "Fix offline sync conflict resolution when two auditors edit same store",
		description: "Implement Last-Write-Wins with field-level conflict reconciliation.",
		stageKey: "deployment",
		status: "in_review",
		priority: "high",
		assigneeId: "usr-ananya",
		daysFromNowStart: -8,
		daysFromNowDue: 1,
		estHours: 24,
		actHours: 22,
	},
	{
		title: "User training documentation and 2-minute video walkthrough",
		description: "Create illustrated quick-start PDF and record screencast for field supervisors.",
		stageKey: "deployment",
		status: "todo",
		priority: "medium",
		assigneeId: "usr-karthik",
		daysFromNowStart: 4,
		daysFromNowDue: 12,
		estHours: 16,
	},
];

const PROJECT_TASK_SETS: Record<string, TaskTemplate[]> = {
	"prj-001": PRJ_001_TASKS,
	"prj-002": PRJ_002_TASKS,
	"prj-003": PRJ_003_TASKS,
	"prj-004": PRJ_004_TASKS,
	"prj-005": PRJ_005_TASKS,
};

const GENERIC_TITLES = [
	"Setup baseline CI/CD build matrix with automated linting",
	"Configure staging environment secrets and environment variables",
	"Create relational data model diagrams and ERD documentation",
	"Implement health check endpoint with database ping and uptime",
	"Security review: Dependency audit and Dependabot alert resolution",
	"Conduct sprint retrospective and document action items",
	"Design RESTful API documentation using OpenAPI 3.1 specification",
	"Setup Sentry error tracking with sourcemaps upload in build pipeline",
	"Optimize bundle size: Tree shake unused Lucide icon imports",
	"Configure automated database backup snapshot schedule",
	"Load testing: Benchmark response time under 500 req/sec load",
	"User acceptance testing verification with client project manager",
	"Refactor authentication middleware to cache JWT claims for 60 seconds",
	"Implement rate limiter on public unauthenticated endpoints",
	"Create post-mortem root cause analysis document for downtime incident",
	"Audit accessibility compliance for keyboard navigation and screen readers",
	"Add structured JSON logging format for distributed tracing",
	"Evaluate database query execution plan for sequential table scans",
	"Setup automated Slack notification on production deployment failure",
	"Archive deprecated feature flags and remove dead conditional branches",
];

const DEVELOPERS = [charanId, "usr-priya", "usr-vikram", "usr-ananya", "usr-rahul", "usr-sneha", "usr-amitabh", "usr-kavita", "usr-rohan", "usr-divya", "usr-karthik", "usr-neha"];
const PRIORITIES: ("low" | "medium" | "high" | "critical")[] = ["low", "medium", "high", "critical"];
const STATUSES: ("todo" | "in_progress" | "blocked" | "in_review" | "done" | "cancelled")[] = ["todo", "in_progress", "blocked", "in_review", "done", "cancelled"];

let totalTaskCounter = 0;

for (const p of projectList) {
	const specificTasks = PROJECT_TASK_SETS[p.id] || [];
	let taskNum = 1;

	// Insert explicit high-fidelity tasks
	for (const t of specificTasks) {
		const taskId = `task-${p.id}-${taskNum}`;
		const startDate = t.daysFromNowStart != null ? format(addDays(new Date(), t.daysFromNowStart), "yyyy-MM-dd") : null;
		const dueDate = t.daysFromNowDue != null ? format(addDays(new Date(), t.daysFromNowDue), "yyyy-MM-dd") : null;
		const completedAt = t.status === "done" ? now - 86400 * 3 : null;

		db.run(
			`INSERT INTO project_tasks (
				id, project_id, stage_key, task_number, title, description, status, priority,
				assignee_id, created_by_id, start_date, due_date, completed_at, estimate_hours,
				actual_hours, blocked_reason, sequence, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				taskId,
				p.id,
				t.stageKey,
				taskNum,
				t.title,
				t.description,
				t.status,
				t.priority,
				t.assigneeId,
				charanId,
				startDate,
				dueDate,
				completedAt,
				t.estHours || null,
				t.actHours || null,
				t.blockedReason || null,
				taskNum,
				now - 86400 * 15,
				now,
			],
		);

		taskNum++;
		totalTaskCounter++;

		// Insert subtasks if any
		if (t.subtasks && t.subtasks.length > 0) {
			for (const subTitle of t.subtasks) {
				const subId = `subtask-${taskId}-${taskNum}`;
				db.run(
					`INSERT INTO project_tasks (
						id, project_id, stage_key, parent_task_id, task_number, title, description, status, priority,
						assignee_id, created_by_id, start_date, due_date, completed_at, estimate_hours,
						actual_hours, sequence, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						subId,
						p.id,
						t.stageKey,
						taskId,
						taskNum,
						subTitle,
						`Subtask of #${taskNum - 1}`,
						t.status === "done" ? "done" : "todo",
						"medium",
						t.assigneeId,
						charanId,
						startDate,
						dueDate,
						completedAt,
						4,
						4,
						taskNum,
						now - 86400 * 10,
						now,
					],
				);
				taskNum++;
				totalTaskCounter++;
			}
		}
	}

	// Generate additional realistic startup tasks for volume (to reach 18-25 tasks per project)
	const remainingCount = Math.max(16, 22 - specificTasks.length);
	for (let i = 0; i < remainingCount; i++) {
		const taskId = `task-${p.id}-${taskNum}`;
		const titleIdx = (taskNum * 7 + i) % GENERIC_TITLES.length;
		const title = `${GENERIC_TITLES[titleIdx]} [${p.code}]`;
		const priority = PRIORITIES[(taskNum + i) % PRIORITIES.length];
		const status = p.status === "completed" ? "done" : p.status === "cancelled" ? "cancelled" : STATUSES[(taskNum * 3 + i) % STATUSES.length];
		const assignee = DEVELOPERS[(taskNum + i) % DEVELOPERS.length];

		const startOffset = -15 + (i * 3) % 40;
		const duration = 2 + (i % 7);
		const hasDates = i % 6 !== 0;

		const startDate = hasDates ? format(addDays(new Date(), startOffset), "yyyy-MM-dd") : null;
		const dueDate = hasDates ? format(addDays(new Date(), startOffset + duration), "yyyy-MM-dd") : null;
		const completedAt = status === "done" ? now - 86400 * 2 : null;
		const blockedReason = status === "blocked" ? "Waiting on upstream architecture sign-off and environment access." : null;

		db.run(
			`INSERT INTO project_tasks (
				id, project_id, stage_key, task_number, title, description, status, priority,
				assignee_id, created_by_id, start_date, due_date, completed_at, estimate_hours,
				actual_hours, blocked_reason, sequence, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				taskId,
				p.id,
				p.currentStageKey || "development",
				taskNum,
				title,
				`Engineering deliverable for ${p.name}.`,
				status,
				priority,
				assignee,
				charanId,
				startDate,
				dueDate,
				completedAt,
				(i % 5 + 1) * 8,
				status === "done" ? (i % 5 + 1) * 8 : null,
				blockedReason,
				taskNum,
				now - 86400 * 20,
				now,
			],
		);

		taskNum++;
		totalTaskCounter++;
	}

	// Insert stage progress records
	for (const s of stages) {
		const isPastStage = s.seq < 4;
		const isCurrent = s.key === p.currentStageKey;
		const progressStatus = isPastStage ? "completed" : isCurrent ? "in_progress" : "pending";

		db.run(
			`INSERT OR REPLACE INTO project_stage_progress (
				id, project_id, stage_key, status, started_at, completed_at, notes, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				`prog-${p.id}-${s.key}`,
				p.id,
				s.key,
				progressStatus,
				now - 86400 * 30,
				progressStatus === "completed" ? now - 86400 * 10 : null,
				isCurrent ? `Currently executing deliverables in ${s.name}.` : null,
				now,
				now,
			],
		);
	}

	// Insert audit timeline events
	db.run(
		`INSERT OR REPLACE INTO project_events (id, project_id, event_type, actor_id, entity_type, details, created_at)
		 VALUES (?, ?, 'created', ?, 'project', ?, ?)`,
		[`evt-${p.id}-init`, p.id, charanId, JSON.stringify({ code: p.code, name: p.name }), now - 86400 * 35],
	);

	db.run(
		`INSERT OR REPLACE INTO project_events (id, project_id, event_type, actor_id, entity_type, details, created_at)
		 VALUES (?, ?, 'stage_advanced', ?, 'stage', ?, ?)`,
		[`evt-${p.id}-stage`, p.id, charanId, JSON.stringify({ newStage: p.currentStageKey, notes: "Kick-off milestones completed." }), now - 86400 * 12],
	);
}

// ─── 8. Phase 3: Seed Checklist Templates ───
console.log("📋 Seeding stage checklist templates...");
const checklistTemplates = [
	// Planning
	{ id: "tmpl-plan-1", stageKey: "planning", title: "Finalize SOW & Project Scope Document", isRequired: 1, seq: 1 },
	{ id: "tmpl-plan-2", stageKey: "planning", title: "Commercial Stakeholder Sign-off", isRequired: 1, seq: 2 },
	{ id: "tmpl-plan-3", stageKey: "planning", title: "Initial Architecture Spike & ADR", isRequired: 0, seq: 3 },
	{ id: "tmpl-plan-4", stageKey: "planning", title: "Resource Allocation & Staffing Plan", isRequired: 1, seq: 4 },
	// Proposal
	{ id: "tmpl-prop-1", stageKey: "proposal", title: "Pricing & Margin Approval by Executive", isRequired: 1, seq: 1 },
	{ id: "tmpl-prop-2", stageKey: "proposal", title: "Client Legal & MSA Countersignature", isRequired: 1, seq: 2 },
	{ id: "tmpl-prop-3", stageKey: "proposal", title: "Milestone Deliverables Schedule Agreement", isRequired: 1, seq: 3 },
	// Discovery
	{ id: "tmpl-disc-1", stageKey: "discovery", title: "Client Inception & Kickoff Workshop", isRequired: 1, seq: 1 },
	{ id: "tmpl-disc-2", stageKey: "discovery", title: "VPN & Cloud Credentials Provisioning", isRequired: 1, seq: 2 },
	{ id: "tmpl-disc-3", stageKey: "discovery", title: "Technical Architecture Document (TAD)", isRequired: 1, seq: 3 },
	{ id: "tmpl-disc-4", stageKey: "discovery", title: "Figma Design Tokens & UI Specs Review", isRequired: 0, seq: 4 },
	// Development
	{ id: "tmpl-dev-1", stageKey: "development", title: "CI/CD Pipeline & Automated Smoke Suite", isRequired: 1, seq: 1 },
	{ id: "tmpl-dev-2", stageKey: "development", title: "Database Schema & Migration Validation", isRequired: 1, seq: 2 },
	{ id: "tmpl-dev-3", stageKey: "development", title: "Core API Implementation & Unit Tests", isRequired: 1, seq: 3 },
	{ id: "tmpl-dev-4", stageKey: "development", title: "Third-Party API Sandboxes & Stubs", isRequired: 0, seq: 4 },
	// Testing
	{ id: "tmpl-test-1", stageKey: "testing", title: "End-to-End Regression Test Suite Passing", isRequired: 1, seq: 1 },
	{ id: "tmpl-test-2", stageKey: "testing", title: "Penetration Testing & Security Audit Sign-off", isRequired: 1, seq: 2 },
	{ id: "tmpl-test-3", stageKey: "testing", title: "Client UAT Acceptance Certificate", isRequired: 1, seq: 3 },
	{ id: "tmpl-test-4", stageKey: "testing", title: "Performance Stress Test & Latency Baseline", isRequired: 0, seq: 4 },
	// Deployment
	{ id: "tmpl-dep-1", stageKey: "deployment", title: "Production Cutover & DNS Switchover", isRequired: 1, seq: 1 },
	{ id: "tmpl-dep-2", stageKey: "deployment", title: "Rollback Strategy & Playbook Documented", isRequired: 1, seq: 2 },
	{ id: "tmpl-dep-3", stageKey: "deployment", title: "Client Team Handover & Admin Training", isRequired: 1, seq: 3 },
	{ id: "tmpl-dep-4", stageKey: "deployment", title: "Post-Launch Hypercare Monitoring Plan", isRequired: 0, seq: 4 },
	// Closure
	{ id: "tmpl-close-1", stageKey: "closure", title: "Client Final Sign-off & Completion Form", isRequired: 1, seq: 1 },
	{ id: "tmpl-close-2", stageKey: "closure", title: "Hardware & VPN Access Deprovisioning", isRequired: 1, seq: 2 },
	{ id: "tmpl-close-3", stageKey: "closure", title: "Internal Project Retrospective & Learnings", isRequired: 0, seq: 3 },
];

for (const t of checklistTemplates) {
	db.run(
		`INSERT OR REPLACE INTO project_checklist_templates (
			id, stage_key, title, description, is_required, sequence, is_active, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
		[t.id, t.stageKey, t.title, `Standard checklist item for ${t.stageKey}`, t.isRequired, t.seq, now, now],
	);
}

// ─── 9. Phase 3: Instantiate Checklist Items across all Projects ───
console.log("📝 Instantiating project checklist items...");
let totalChecklistItems = 0;

for (const p of projectList) {
	const currentIdx = stages.findIndex((s) => s.key === p.currentStageKey);

	for (const s of stages) {
		const stageTemplates = checklistTemplates.filter((t) => t.stageKey === s.key);
		const sIdx = stages.findIndex((st) => st.key === s.key);
		const isPastStage = sIdx < currentIdx;
		const isCurrentStage = sIdx === currentIdx;

		for (const t of stageTemplates) {
			const itemId = `chk-${p.id}-${t.id}`;
			let status = "pending";
			let completedAt = null;
			let completedById = null;
			const assignedToId = teamMembers[totalChecklistItems % teamMembers.length].id;

			if (isPastStage) {
				status = "done";
				completedAt = now - 86400 * 15;
				completedById = charanId;
			} else if (isCurrentStage) {
				// For PRJ-001 (Unilever): keep required dev items pending to test stage gate!
				if (p.id === "prj-001") {
					status = t.seq === 1 ? "done" : "pending";
					completedAt = t.seq === 1 ? now - 86400 * 2 : null;
					completedById = t.seq === 1 ? charanId : null;
				} else if (p.id === "prj-002") {
					// Deloitte in testing: 1 done, 1 N/A, 1 required pending
					if (t.seq === 1) {
						status = "done";
						completedAt = now - 86400 * 3;
						completedById = "usr-priya";
					} else if (t.seq === 4) {
						status = "not_applicable";
					} else {
						status = "pending";
					}
				} else if (p.id === "prj-005") {
					// Retail store audit: all required completed! Ready to advance!
					status = "done";
					completedAt = now - 86400 * 1;
					completedById = charanId;
				} else {
					status = t.seq % 2 === 0 ? "done" : "pending";
					completedAt = status === "done" ? now - 86400 * 4 : null;
					completedById = status === "done" ? assignedToId : null;
				}
			}

			db.run(
				`INSERT OR REPLACE INTO project_checklist_items (
					id, project_id, stage_key, template_id, title, description,
					is_required, status, assigned_to_id, completed_by_id, completed_at, sequence, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					itemId,
					p.id,
					s.key,
					t.id,
					t.title,
					`Deliverable item for ${s.name}`,
					t.isRequired,
					status,
					assignedToId,
					completedById,
					completedAt,
					t.seq,
					now,
					now,
				],
			);
			totalChecklistItems++;
		}
	}
}

// ─── 10. Phase 3: Seed Realistic Project Documents & Version Chains ───
console.log("📂 Seeding project documents...");
const documentsToSeed = [
	// Unilever Documents (includes superseded v1 -> v2)
	{
		id: "doc-uni-sow-v1",
		projectId: "prj-001",
		stageKey: "planning",
		title: "Unilever Trade Master SOW v1.0",
		category: "sow",
		r2Key: "projects/prj-001/doc-uni-sow-v1/v1/Unilever_Trade_SOW_v1.0.pdf",
		fileName: "Unilever_Trade_SOW_v1.0.pdf",
		mimeType: "application/pdf",
		sizeBytes: 1420500,
		version: 1,
		status: "superseded",
		uploadedById: charanId,
	},
	{
		id: "doc-uni-sow-v2",
		projectId: "prj-001",
		stageKey: "planning",
		title: "Unilever Trade Master SOW v2.0 (Countersigned)",
		category: "sow",
		r2Key: "projects/prj-001/doc-uni-sow-v2/v2/Unilever_Trade_SOW_v2.0_Signed.pdf",
		fileName: "Unilever_Trade_SOW_v2.0_Signed.pdf",
		mimeType: "application/pdf",
		sizeBytes: 1845000,
		version: 2,
		supersedesDocumentId: "doc-uni-sow-v1",
		status: "final",
		uploadedById: charanId,
	},
	{
		id: "doc-uni-tad",
		projectId: "prj-001",
		stageKey: "discovery",
		title: "Technical Architecture & Data Pipeline Blueprint",
		category: "design",
		r2Key: "projects/prj-001/doc-uni-tad/v1/Unilever_Data_Pipeline_TAD.pdf",
		fileName: "Unilever_Data_Pipeline_TAD.pdf",
		mimeType: "application/pdf",
		sizeBytes: 3410200,
		version: 1,
		status: "final",
		uploadedById: "usr-priya",
	},
	{
		id: "doc-uni-minutes",
		projectId: "prj-001",
		stageKey: "development",
		title: "Sprint 4 Review & Client SteerCo Minutes",
		category: "minutes",
		r2Key: "projects/prj-001/doc-uni-minutes/v1/SteerCo_Minutes_Sprint4.docx",
		fileName: "SteerCo_Minutes_Sprint4.docx",
		mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		sizeBytes: 420100,
		version: 1,
		status: "final",
		uploadedById: "usr-vikram",
	},
	// Deloitte Documents
	{
		id: "doc-del-contract",
		projectId: "prj-002",
		stageKey: "proposal",
		title: "Deloitte Global Master Services Agreement (MSA)",
		category: "contract",
		r2Key: "projects/prj-002/doc-del-contract/v1/Deloitte_MSA_2025_Executed.pdf",
		fileName: "Deloitte_MSA_2025_Executed.pdf",
		mimeType: "application/pdf",
		sizeBytes: 2540000,
		version: 1,
		status: "final",
		uploadedById: charanId,
	},
	{
		id: "doc-del-security",
		projectId: "prj-002",
		stageKey: "testing",
		title: "SOC2 Compliance & Static Code Analysis Audit Report",
		category: "report",
		r2Key: "projects/prj-002/doc-del-security/v1/SOC2_Security_Audit_Deloitte.pdf",
		fileName: "SOC2_Security_Audit_Deloitte.pdf",
		mimeType: "application/pdf",
		sizeBytes: 4120800,
		version: 1,
		status: "final",
		uploadedById: "usr-priya",
	},
	// Cummins Documents
	{
		id: "doc-cum-hardware",
		projectId: "prj-003",
		stageKey: "discovery",
		title: "OBD-II CAN-bus Sensor Integration Architecture",
		category: "design",
		r2Key: "projects/prj-003/doc-cum-hardware/v1/Cummins_CANBus_Specs.pdf",
		fileName: "Cummins_CANBus_Specs.pdf",
		mimeType: "application/pdf",
		sizeBytes: 1980000,
		version: 1,
		status: "final",
		uploadedById: "usr-vikram",
	},
	// Unilever Retail Store Documents
	{
		id: "doc-store-audit-spec",
		projectId: "prj-005",
		stageKey: "planning",
		title: "Store Merchandising Field Audit Specification",
		category: "proposal",
		r2Key: "projects/prj-005/doc-store-audit-spec/v1/Store_Audit_Spec.pdf",
		fileName: "Store_Audit_Spec.pdf",
		mimeType: "application/pdf",
		sizeBytes: 2190000,
		version: 1,
		status: "final",
		uploadedById: charanId,
	},
];

for (const d of documentsToSeed) {
	db.run(
		`INSERT OR REPLACE INTO project_documents (
			id, project_id, stage_key, title, category, r2_key, file_name, mime_type,
			size_bytes, version, supersedes_document_id, status, uploaded_by_id, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			d.id,
			d.projectId,
			d.stageKey,
			d.title,
			d.category,
			d.r2Key,
			d.fileName,
			d.mimeType,
			d.sizeBytes,
			d.version,
			d.supersedesDocumentId || null,
			d.status,
			d.uploadedById,
			now - 86400 * 10,
			now - 86400 * 2,
		],
	);
}

// ─── 11. Phase 3: Seed Threaded Discussions and Decision Records ───
console.log("💬 Seeding project discussions and decision records...");
const commentsToSeed = [
	// Unilever Discussions
	{
		id: "cmt-uni-1",
		projectId: "prj-001",
		stageKey: "development",
		authorId: charanId,
		body: "We reviewed the trade promotion calculation batch throughput. Target is processing 1.2M daily transactions within a 45-minute window.",
		isDecision: 0,
		isPinned: 1,
		parentId: null,
		createdAt: now - 86400 * 8,
	},
	{
		id: "cmt-uni-2",
		projectId: "prj-001",
		stageKey: "development",
		authorId: "usr-priya",
		body: "Benchmarked Redis Cluster caching layer against DynamoDB DAX. Redis gave sub-millisecond retrieval on SKU promotion tiers.",
		isDecision: 0,
		isPinned: 0,
		parentId: "cmt-uni-1",
		createdAt: now - 86400 * 7,
	},
	{
		id: "cmt-uni-3",
		projectId: "prj-001",
		stageKey: "development",
		authorId: charanId,
		body: "DECISION: Approved using AWS ElastiCache for Redis (m6g.xlarge with Multi-AZ). DAX was rejected due to vendor lock-in and higher cold start latency.",
		isDecision: 1,
		isPinned: 0,
		parentId: "cmt-uni-1",
		createdAt: now - 86400 * 6,
	},
	{
		id: "cmt-uni-4",
		projectId: "prj-001",
		stageKey: "development",
		authorId: "usr-vikram",
		body: "Security team raised a flag regarding API key rotation for the Unilever SAP Gateway. Have implemented HashiCorp Vault automated rotation with 30-day lease.",
		isDecision: 1,
		isPinned: 0,
		parentId: null,
		createdAt: now - 86400 * 3,
	},
	// Deloitte Discussions
	{
		id: "cmt-del-1",
		projectId: "prj-002",
		stageKey: "testing",
		authorId: "usr-priya",
		body: "QA Regression run #48 complete. 242/242 tests passing. Security pen-test report has been submitted to Deloitte Enterprise Cyber team for final clearance.",
		isDecision: 0,
		isPinned: 1,
		parentId: null,
		createdAt: now - 86400 * 4,
	},
	{
		id: "cmt-del-2",
		projectId: "prj-002",
		stageKey: "testing",
		authorId: charanId,
		body: "DECISION: UAT sign-off criteria approved by Deloitte Partner Sarah Jenkins. Cutover scheduled for next Sunday at 01:00 UTC.",
		isDecision: 1,
		isPinned: 0,
		parentId: "cmt-del-1",
		createdAt: now - 86400 * 2,
	},
	// Cummins Discussions
	{
		id: "cmt-cum-1",
		projectId: "prj-003",
		stageKey: "discovery",
		authorId: "usr-vikram",
		body: "Received test hardware unit #3 from Cummins Columbus testing lab. CAN-bus telemetry jitter is within 5ms tolerance.",
		isDecision: 0,
		isPinned: 0,
		parentId: null,
		createdAt: now - 86400 * 5,
	},
];

for (const c of commentsToSeed) {
	db.run(
		`INSERT OR REPLACE INTO project_comments (
			id, project_id, stage_key, parent_id, author_id, body,
			is_decision, is_pinned, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			c.id,
			c.projectId,
			c.stageKey,
			c.parentId,
			c.authorId,
			c.body,
			c.isDecision,
			c.isPinned,
			c.createdAt,
			c.createdAt,
		],
	);
}

// ─── Phase 4 Seed Data: Daily Updates, EOD Reports, Work Flags ───

const todayIso = format(new Date(), "yyyy-MM-dd");
const yesterdayIso = format(addDays(new Date(), -1), "yyyy-MM-dd");

// 1. Daily Updates
const dailyUpdatesToSeed = [
	{
		id: "upd-uni-1",
		projectId: "prj-001",
		userId: charanId,
		date: todayIso,
		summary: "Integrated WorkOS OAuth2 authentication flow and session verification with Unilever staging gateway.",
		blockers: null,
		hoursSpent: 4.0,
		status: "submitted",
		submittedAt: now - 3600 * 2,
		items: [
			{ taskId: "task-prj-001-2", note: "Configured WorkOS OAuth2 authentication flow", progressNote: "Production ready" },
		],
	},
	{
		id: "upd-poc-charan-today",
		projectId: "prj-006",
		userId: charanId,
		date: todayIso,
		summary: "Engineered AST rule visitor engine for TypeScript syntax trees and PR diff scanning.",
		blockers: null,
		hoursSpent: 4.0,
		status: "submitted",
		submittedAt: now - 3600 * 1,
		items: [],
	},
	{
		id: "upd-uni-2",
		projectId: "prj-001",
		userId: "usr-ananya",
		date: todayIso,
		summary: "Completed React frontend components for loyalty voucher redemption flow and wrote Vitest unit tests.",
		blockers: "Waiting on Unilever staging API gateway credentials for end-to-end sandbox testing.",
		hoursSpent: 8.0,
		status: "submitted",
		submittedAt: now - 3600 * 3,
		items: [
			{ taskId: "task-prj-001-10", note: "Voucher UI components finished", progressNote: "Blocked on sandbox" },
		],
	},
	{
		id: "upd-uni-3",
		projectId: "prj-001",
		userId: "usr-sneha",
		date: todayIso,
		summary: "Investigating offline barcode scanner camera feed fallback using WebRTC in mobile browser.",
		blockers: null,
		hoursSpent: 4.0,
		status: "draft",
		submittedAt: null,
		items: [],
	},
	{
		id: "upd-del-1",
		projectId: "prj-002",
		userId: "usr-vikram",
		date: todayIso,
		summary: "Executed automated regression test harness for 2026 OECD transfer pricing schedules. Zero calculation discrepancies.",
		blockers: null,
		hoursSpent: 8.0,
		status: "submitted",
		submittedAt: now - 3600 * 4,
		items: [
			{ taskId: "task-prj-002-1", note: "Verified cross-border tax schedules", progressNote: "100% passed" },
		],
	},
	{
		id: "upd-del-2",
		projectId: "prj-002",
		userId: "usr-priya",
		date: todayIso,
		summary: "Built production Docker multi-stage images and drafted the weekend cutover playbook with rollback procedures.",
		blockers: null,
		hoursSpent: 7.0,
		status: "submitted",
		submittedAt: now - 3600 * 2,
		items: [
			{ taskId: "task-prj-002-2", note: "Containerized application and verified healthchecks", progressNote: "Ready" },
		],
	},
	// Yesterday's update for historical EOD report
	{
		id: "upd-del-hist-1",
		projectId: "prj-002",
		userId: "usr-vikram",
		date: yesterdayIso,
		summary: "Validated staging database indexes across 45M transaction records.",
		blockers: null,
		hoursSpent: 8.0,
		status: "submitted",
		submittedAt: now - 86400 - 3600 * 4,
		items: [],
	},
	{
		id: "upd-del-hist-2",
		projectId: "prj-002",
		userId: "usr-priya",
		date: yesterdayIso,
		summary: "Configured HashiCorp Vault secrets injection into Kubernetes staging pods.",
		blockers: null,
		hoursSpent: 8.0,
		status: "submitted",
		submittedAt: now - 86400 - 3600 * 3,
		items: [],
	},
];

for (const u of dailyUpdatesToSeed) {
	db.run(
		`INSERT OR REPLACE INTO project_daily_updates (
			id, project_id, user_id, date, summary, blockers,
			hours_spent, status, submitted_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			u.id,
			u.projectId,
			u.userId,
			u.date,
			u.summary,
			u.blockers,
			u.hoursSpent,
			u.status,
			u.submittedAt,
			now - 3600 * 4,
			now,
		],
	);

	for (let i = 0; i < u.items.length; i++) {
		const it = u.items[i];
		db.run(
			`INSERT OR REPLACE INTO project_daily_update_items (
				id, update_id, task_id, note, progress_note, created_at
			) VALUES (?, ?, ?, ?, ?, ?)`,
			[
				`item-${u.id}-${i}`,
				u.id,
				it.taskId,
				it.note,
				it.progressNote,
				now,
			],
		);
	}
}

// 2. EOD Reports
const eodReportsToSeed = [
	{
		id: "eod-del-yesterday",
		projectId: "prj-002",
		date: yesterdayIso,
		generatedById: "usr-vikram",
		contentDraft: `# EOD Report: [PRJ-002] Deloitte Risk Analytics & Reporting Engine\n**Date:** ${yesterdayIso}\n\n## Work Accomplished\n### Vikram Malhotra (8h logged)\nValidated staging database indexes across 45M transaction records.\n\n### Priya Sharma (8h logged)\nConfigured HashiCorp Vault secrets injection into Kubernetes staging pods.\n\n## Blockers & Roadblocks\n_None reported._`,
		contentFinal: `# EOD Report: [PRJ-002] Deloitte Risk Analytics & Reporting Engine\n**Date:** ${yesterdayIso}\n\n## Executive Summary\nAll staging environment database indexes and HashiCorp Vault secrets injection configurations were validated successfully. Staging is now 100% prepared for weekend production cutover.\n\n## Work Accomplished\n- **Database Infrastructure:** Validated staging database indexes across 45M transaction records (8.0h - Vikram)\n- **DevSecOps:** Configured HashiCorp Vault secrets injection into Kubernetes pods (8.0h - Priya)\n\n## Cutover Readiness\nNo blocking issues. Partner Markus Vance has signed off on staging UAT.`,
		status: "finalised",
		missingSubmitters: "[]",
		finalisedAt: now - 86400 + 3600 * 6,
	},
	{
		id: "eod-uni-today",
		projectId: "prj-001",
		date: todayIso,
		generatedById: charanId,
		contentDraft: `# EOD Report: [PRJ-001] Unilever Smart Rewards Mobile App\n**Date:** ${todayIso}\n\n## Work Accomplished\n### Charan (7.5h logged)\nEngineered Redis token caching and edge rate-limiting rules. Benchmarks show p99 latency drop to 42ms.\n\n### Ananya Roy (8h logged)\nCompleted React frontend components for loyalty voucher redemption flow.\n\n## Blockers & Roadblocks\n- **Ananya Roy:** Waiting on Unilever staging API gateway credentials for end-to-end sandbox testing.\n\n## Outstanding / Missing Updates\n_The following team members had not submitted at report generation time: Kavita Iyer, Sneha Patel_`,
		contentFinal: `# EOD Report: [PRJ-001] Unilever Smart Rewards Mobile App\n**Date:** ${todayIso}\n\n## Work Accomplished\n### Charan (7.5h logged)\nEngineered Redis token caching and edge rate-limiting rules. Benchmarks show p99 latency drop to 42ms.\n\n### Ananya Roy (8h logged)\nCompleted React frontend components for loyalty voucher redemption flow.\n\n## Blockers & Roadblocks\n- **Ananya Roy:** Waiting on Unilever staging API gateway credentials for end-to-end sandbox testing. (Escalated to Unilever IT liaison David Brown).\n\n## Outstanding / Missing Updates\n_Generated via manager override before Kavita and Sneha submitted._`,
		status: "draft",
		missingSubmitters: JSON.stringify(["usr-kavita", "usr-sneha"]),
		finalisedAt: null,
	},
];

for (const r of eodReportsToSeed) {
	db.run(
		`INSERT OR REPLACE INTO project_eod_reports (
			id, project_id, date, generated_by_id, content_draft,
			content_final, status, missing_submitters, finalised_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			r.id,
			r.projectId,
			r.date,
			r.generatedById,
			r.contentDraft,
			r.contentFinal,
			r.status,
			r.missingSubmitters,
			r.finalisedAt,
			now - 3600 * 2,
			now,
		],
	);
}

// 3. Work Flags (Advisory Quality Signals)
const workFlagsToSeed = [
	{
		id: "flg-1",
		projectId: "prj-001",
		entityType: "task",
		entityId: "task-prj-001-8",
		flagCode: "stalled",
		severity: "warning",
		message: "Task has been in progress with no activity or updates logged for more than 4 days.",
		evidence: JSON.stringify({ daysSinceUpdate: 4, thresholdDays: 3 }),
		source: "rule",
		status: "open",
		raisedForUserId: "usr-sneha",
		createdAt: now - 86400 * 2,
	},
	{
		id: "flg-2",
		projectId: "prj-001",
		entityType: "daily_update",
		entityId: "upd-uni-3",
		flagCode: "no_task_linked",
		severity: "info",
		message: "Daily update draft was created without linking any specific project tasks.",
		evidence: JSON.stringify({ itemCount: 0 }),
		source: "rule",
		status: "open",
		raisedForUserId: "usr-sneha",
		createdAt: now - 3600,
	},
	{
		id: "flg-3",
		projectId: "prj-002",
		entityType: "task",
		entityId: "task-prj-002-2",
		flagCode: "estimate_exceeded",
		severity: "warning",
		message: "Logged time (72h) exceeds original estimate (60h) by 20%.",
		evidence: JSON.stringify({ estimateHours: 60, actualHours: 72, percentOver: 20 }),
		source: "rule",
		status: "acknowledged",
		raisedForUserId: "usr-divya",
		createdAt: now - 86400 * 3,
	},
	{
		id: "flg-4",
		projectId: "prj-003",
		entityType: "task",
		entityId: "task-prj-003-1",
		flagCode: "possible_duplicate",
		severity: "info",
		message: "AI Observation: Task (CAN-bus parsing) has 88% title and scope similarity with Task #4 in previous sprint.",
		evidence: JSON.stringify({ matchingTaskId: "task-prj-003-4", similarityScore: 0.88 }),
		source: "ai",
		status: "open",
		raisedForUserId: "usr-vikram",
		createdAt: now - 86400,
	},
];

for (const f of workFlagsToSeed) {
	db.run(
		`INSERT OR REPLACE INTO work_flags (
			id, project_id, entity_type, entity_id, flag_code, severity,
			message, evidence, source, status, raised_for_user_id,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			f.id,
			f.projectId,
			f.entityType,
			f.entityId,
			f.flagCode,
			f.severity,
			f.message,
			f.evidence,
			f.source,
			f.status,
			f.raisedForUserId,
			f.createdAt,
			now,
		],
	);
}

// ─── Phase 5 Seed Data: AI Assistant Threads, Invocations & Proposals ───

const aiConversationsToSeed = [
	{
		id: "cnv-1",
		userId: charanId,
		title: "Unilever Smart Rewards Delivery Health",
		lastMessageAt: now - 1800,
	},
	{
		id: "cnv-2",
		userId: charanId,
		title: "Annual Leave & WFH Allowance Check",
		lastMessageAt: now - 3600 * 5,
	},
	{
		id: "cnv-3",
		userId: charanId,
		title: "Assigned Workstation Hardware & Warranty",
		lastMessageAt: now - 86400,
	},
];

for (const c of aiConversationsToSeed) {
	db.run(
		`INSERT OR REPLACE INTO ai_conversations (
			id, user_id, title, last_message_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?)`,
		[c.id, c.userId, c.title, c.lastMessageAt, now - 86400, c.lastMessageAt],
	);
}

const aiMessagesToSeed = [
	{
		id: "msg-1-1",
		conversationId: "cnv-1",
		role: "user",
		content: "What are the active risk signals on the Unilever Smart Rewards project?",
		toolCalls: null,
		citations: null,
		modelId: null,
		tokensIn: 18,
		tokensOut: 0,
		latencyMs: 0,
		createdAt: now - 1800,
	},
	{
		id: "msg-1-2",
		conversationId: "cnv-1",
		role: "assistant",
		content: "Here is the verified delivery health assessment for [Unilever Smart Rewards Mobile App] based on system records:\n\n1. **Overdue Tasks (Medium Severity):** 2 tasks are past their due date without completion.\n2. **Target Date Approaching (High Severity):** Target completion is approaching with 8 tasks remaining open in the development stage.\n3. **Key Person Concentration (Medium Severity):** Vikram Mehta holds 42% of open development backlog items.\n\nAll tasks and stage gates remain grounded in database records.",
		toolCalls: JSON.stringify([{ id: "tc-1", name: "get_project_risks", arguments: { projectId: "prj-001" } }]),
		citations: JSON.stringify([
			{ id: "prj-001", type: "project", label: "Unilever Smart Rewards Mobile App" },
			{ id: "task-prj-001-1", type: "task", label: "PRJ-001 #1" },
		]),
		modelId: "google/gemini-2.5-flash",
		tokensIn: 120,
		tokensOut: 85,
		latencyMs: 420,
		createdAt: now - 1795,
	},
	{
		id: "msg-2-1",
		conversationId: "cnv-2",
		role: "user",
		content: "How many days of annual leave and WFH allowance do I have remaining?",
		toolCalls: null,
		citations: null,
		modelId: null,
		tokensIn: 16,
		tokensOut: 0,
		latencyMs: 0,
		createdAt: now - 3600 * 5,
	},
	{
		id: "msg-2-2",
		conversationId: "cnv-2",
		role: "assistant",
		content: "Based on your verified employee leave profile:\n- **Annual Leave:** 14 days allocated, 4 days used, 0 pending -> **10 days remaining**\n- **Sick Leave:** 7 days allocated, 1 day used -> **6 days remaining**\n- **Annual WFH Allowance:** **12 days/year**\n\nWould you like me to draft a leave or WFH request for your upcoming dates?",
		toolCalls: JSON.stringify([{ id: "tc-2", name: "get_my_leave_balances", arguments: {} }]),
		citations: JSON.stringify([]),
		modelId: "google/gemini-2.5-flash",
		tokensIn: 85,
		tokensOut: 65,
		latencyMs: 310,
		createdAt: now - 3600 * 5 + 3,
	},
];

for (const m of aiMessagesToSeed) {
	db.run(
		`INSERT OR REPLACE INTO ai_messages (
			id, conversation_id, role, content, tool_calls, citations,
			model_id, tokens_in, tokens_out, latency_ms, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			m.id,
			m.conversationId,
			m.role,
			m.content,
			m.toolCalls,
			m.citations,
			m.modelId,
			m.tokensIn,
			m.tokensOut,
			m.latencyMs,
			m.createdAt,
		],
	);
}

// AI Tool Invocations (Audit Trail)
const toolInvocationsToSeed = [
	{
		id: "inv-1",
		messageId: "msg-1-2",
		userId: charanId,
		toolName: "get_project_risks",
		args: JSON.stringify({ projectId: "prj-001" }),
		resultRowCount: 3,
		deniedReason: null,
	},
	{
		id: "inv-2",
		messageId: "msg-2-2",
		userId: charanId,
		toolName: "get_my_leave_balances",
		args: JSON.stringify({}),
		resultRowCount: 2,
		deniedReason: null,
	},
	// Security audit test: unauthorized project query was rejected
	{
		id: "inv-3-denied",
		messageId: null,
		userId: "usr-ananya",
		toolName: "get_project",
		args: JSON.stringify({ projectId: "prj-003" }),
		resultRowCount: 0,
		deniedReason: "Project not found.",
	},
];

for (const t of toolInvocationsToSeed) {
	db.run(
		`INSERT OR REPLACE INTO ai_tool_invocations (
			id, message_id, user_id, tool_name, args,
			result_row_count, denied_reason, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			t.id,
			t.messageId,
			t.userId,
			t.toolName,
			t.args,
			t.resultRowCount,
			t.deniedReason,
			now - 1800,
		],
	);
}

// AI Proposed Actions
const proposedActionsToSeed = [
	{
		id: "prop-1-pending",
		messageId: "msg-1-2",
		userId: charanId,
		actionType: "update_task_status",
		targetEntityType: "task",
		targetEntityId: "task-prj-001-4",
		payload: JSON.stringify({ newStatus: "in_review", previousStatus: "in_progress", reason: "All integration tests passing" }),
		status: "pending",
		confirmedAt: null,
		expiresAt: now + 900,
	},
	{
		id: "prop-2-confirmed",
		messageId: "msg-2-2",
		userId: charanId,
		actionType: "request_leave",
		targetEntityType: "leave_request",
		targetEntityId: "new",
		payload: JSON.stringify({ leaveType: "annual", startDate: "2026-09-15", endDate: "2026-09-18", totalDays: 4, reason: "Family vacation" }),
		status: "confirmed",
		confirmedAt: now - 3600,
		expiresAt: now + 300,
	},
];

for (const p of proposedActionsToSeed) {
	db.run(
		`INSERT OR REPLACE INTO ai_proposed_actions (
			id, message_id, user_id, action_type, target_entity_type,
			target_entity_id, payload, status, confirmed_at, expires_at,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			p.id,
			p.messageId,
			p.userId,
			p.actionType,
			p.targetEntityType,
			p.targetEntityId,
			p.payload,
			p.status,
			p.confirmedAt,
			p.expiresAt,
			now - 1800,
			now,
		],
	);
}

// ─── 14. Comprehensive Assets, ID Cards & Allotments ───
seedAssetsAndAssignments(db);

// ─── 15. Dynamic Timesheets, WFH & Leaves for Current Month ───
console.log("⏱️ Seeding dynamic timesheets, WFH, leaves, and notifications for current month...");

const activeUserIds = teamMembers.filter((m) => m.isActive).map((m) => m.id);

const todayObj = new Date();
const currentYear = todayObj.getFullYear();
const currentMonth = todayObj.getMonth();
const currentDay = todayObj.getDate();

// Ensure Charan has leave balances for current cycle (2025-12-01 to 2026-11-30)
db.run(
	`INSERT OR REPLACE INTO leave_balances (id, user_id, leave_type, total_limit, used, cycle_start, cycle_end, created_at, updated_at)
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	["lb-charan-personal", charanId, "personal-leave", 13, 5, "2025-12-01", "2026-11-30", now, now],
);
db.run(
	`INSERT OR REPLACE INTO leave_balances (id, user_id, leave_type, total_limit, used, cycle_start, cycle_end, created_at, updated_at)
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	["lb-charan-sick", charanId, "sick-leave", 6, 1, "2025-12-01", "2026-11-30", now, now],
);
db.run(
	`INSERT OR REPLACE INTO leave_balances (id, user_id, leave_type, total_limit, used, cycle_start, cycle_end, created_at, updated_at)
	 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	["lb-charan-festival", charanId, "festival-leave", 6, 2, "2025-12-01", "2026-11-30", now, now],
);

// Ensure WFH policy (annual allowance = 12)
db.run(
	`INSERT OR REPLACE INTO wfh_policy (id, annual_allowance, updated_at)
	 VALUES (1, 12, ?)`,
	[now],
);

// Ensure Charan has all dashboard widgets visible (hidden: false)
const fullLayout = JSON.stringify([
	{ id: "approvals", hidden: false },
	{ id: "team", hidden: false },
	{ id: "hours", hidden: false },
	{ id: "leave", hidden: false },
	{ id: "updates", hidden: false },
	{ id: "tasks", hidden: false },
	{ id: "insight", hidden: false },
]);
db.run(
	`INSERT OR REPLACE INTO dashboard_layouts (user_id, layout, updated_at)
	 VALUES (?, ?, ?)`,
	[charanId, fullLayout, now],
);

// Timesheets for the last 45 working days so hours trend, streak, and heatmap are populated
const pastWorkingDays: string[] = [];
for (let i = 45; i >= 0; i--) {
	const dt = new Date(todayObj.getTime() - i * 86400000);
	const dayOfWeek = dt.getDay();
	const dateStr = format(dt, "yyyy-MM-dd");
	// Skip weekends and Gandhi Jayanthi holiday (Oct 02)
	if (dayOfWeek !== 0 && dayOfWeek !== 6 && dateStr !== "2026-10-02") {
		pastWorkingDays.push(dateStr);
	}
}

let seededTimesheetsCount = 0;
for (const uid of activeUserIds) {
	for (let i = 0; i < pastWorkingDays.length; i++) {
		const dateStr = pastWorkingDays[i];
		const variance = (uid.charCodeAt(uid.length - 1) + i) % 3;
		const hours = variance === 0 ? 8.0 : variance === 1 ? 7.5 : 8.5;
		const tsId = `ts-${uid}-${dateStr}`;

		db.run(
			`INSERT OR REPLACE INTO timesheets (id, user_id, date, hours, is_overtime, is_weekend, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?, 0, 0, "logged", ?, ?)`,
			[tsId, uid, dateStr, hours, now - (pastWorkingDays.length - i) * 86400, now],
		);
		seededTimesheetsCount++;
	}
}

const plannedLeaves = [
	// On Leave TODAY (Oct 07, 2026) -> Shows in TeamTile "Out today" & on leave count
	{ id: "lv-today-divya", userId: "usr-divya", type: "festival-leave", daysOffset: 0, totalDays: 2, status: "approved", reason: "Family festival celebrations" },
	{ id: "lv-today-sneha", userId: "usr-sneha", type: "sick-leave", daysOffset: 0, totalDays: 1, status: "approved", reason: "Fever and rest" },

	// Upcoming Approved Leaves in Next 14 Days -> Shows in CalendarRail & Agenda
	{ id: "lv-upc-rohan", userId: "usr-rohan", type: "personal-leave", daysOffset: 5, totalDays: 3, status: "approved", reason: "Family vacation to Manali" },
	{ id: "lv-upc-amitabh", userId: "usr-amitabh", type: "personal-leave", daysOffset: 8, totalDays: 2, status: "approved", reason: "Personal commitments" },
	{ id: "lv-upc-priya", userId: "usr-priya", type: "personal-leave", daysOffset: 12, totalDays: 2, status: "approved", reason: "Birthday long weekend" },

	// Pending Leave Requests -> Shows in ApprovalsTile waiting for Admin Charan!
	{ id: "lv-pend-kavita", userId: "usr-kavita", type: "personal-leave", daysOffset: 8, totalDays: 2, status: "pending", reason: "Attending cousin wedding in Kochi" },
	{ id: "lv-pend-neha", userId: "usr-neha", type: "sick-leave", daysOffset: 2, totalDays: 2, status: "pending", reason: "Dental surgery & post-op recovery" },
	{ id: "lv-pend-ananya", userId: "usr-ananya", type: "festival-leave", daysOffset: 13, totalDays: 1, status: "pending", reason: "Mahanavami puja at home" },

	// Historical approved leaves for Charan (to account for used balance: 5 personal, 1 sick, 2 festival)
	{ id: "lv-charan-hist-1", userId: charanId, type: "personal-leave", daysOffset: -110, totalDays: 5, status: "approved", reason: "Summer vacation" },
	{ id: "lv-charan-hist-2", userId: charanId, type: "sick-leave", daysOffset: -65, totalDays: 1, status: "approved", reason: "Viral fever recovery" },
	{ id: "lv-charan-hist-3", userId: charanId, type: "festival-leave", daysOffset: -260, totalDays: 2, status: "approved", reason: "Pongal holiday" },
];

for (const l of plannedLeaves) {
	const startDate = format(addDays(todayObj, l.daysOffset), "yyyy-MM-dd");
	const endDate = format(addDays(todayObj, l.daysOffset + l.totalDays - 1), "yyyy-MM-dd");
	db.run(
		`INSERT OR REPLACE INTO leave_requests (id, user_id, leave_type, start_date, end_date, total_days, status, approved_by, reason, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[l.id, l.userId, l.type, startDate, endDate, l.totalDays, l.status, l.status === "approved" ? charanId : null, l.reason, now - 86400 * 5, now],
	);
}

const wfhRequestsList = [
	// WFH TODAY (Oct 07, 2026) -> Shows in TeamTile "Out today" & WFH count
	{ id: "wfh-today-vikram", userId: "usr-vikram", daysOffset: 0, status: "approved", reason: "Focusing on Redis queue benchmarking" },
	{ id: "wfh-today-rahul", userId: "usr-rahul", daysOffset: 0, status: "approved", reason: "Broadband technician visit" },

	// Upcoming Approved WFH in October
	{ id: "wfh-upc-charan", userId: charanId, daysOffset: 2, status: "approved", reason: "Architecture deep work on multi-tenant isolation" },
	{ id: "wfh-upc-priya", userId: "usr-priya", daysOffset: 2, status: "approved", reason: "Sprint 5 roadmap & backlog grooming" },

	// Pending WFH Requests -> Shows in ApprovalsTile waiting for Admin Charan!
	{ id: "wfh-pend-karthik", userId: "usr-karthik", daysOffset: 1, status: "pending", reason: "Home broadband router upgrade" },
	{ id: "wfh-pend-vikram", userId: "usr-vikram", daysOffset: 5, status: "pending", reason: "Quiet deep work on financial risk calculations" },

	// Historical approved WFH for Charan (to show 4 used in WFH balance)
	{ id: "wfh-charan-hist-1", userId: charanId, daysOffset: -90, status: "approved", reason: "Deep focus on initial schema design" },
	{ id: "wfh-charan-hist-2", userId: charanId, daysOffset: -55, status: "approved", reason: "WorkOS auth integration testing" },
	{ id: "wfh-charan-hist-3", userId: charanId, daysOffset: -26, status: "approved", reason: "Sprint 3 delivery governance" },
];

for (const w of wfhRequestsList) {
	const d = format(addDays(todayObj, w.daysOffset), "yyyy-MM-dd");
	db.run(
		`INSERT OR REPLACE INTO wfh_requests (id, user_id, date, is_half_day, status, approved_by, reason, created_at, updated_at)
		 VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`,
		[w.id, w.userId, d, w.status, w.status === "approved" ? charanId : null, w.reason, now - 86400 * 2, now],
	);
}

const notificationsToSeed = [
	{ id: "notif-recent-1", userId: charanId, type: "daily_update_submitted", title: "Daily Update Submitted", body: "Vikram Mehta logged 8.0h on [PRJ-001] Unilever Smart Rewards", isRead: 0, relatedId: "upd-uni-1", relatedType: "timesheet", actionUrl: "/projects/prj-001?tab=daily", createdAt: now - 3600 * 2 },
	{ id: "notif-recent-2", userId: charanId, type: "wfh_approved", title: "WFH Approved", body: "Your WFH request for Friday Oct 09 has been approved", isRead: 1, relatedId: "wfh-upc-charan", relatedType: "wfh_request", actionUrl: "/calendar", createdAt: now - 3600 * 8 },
	{ id: "notif-recent-3", userId: charanId, type: "leave_requested", title: "New Leave Request Pending", body: "Kavita Nair requested 2 days of Personal Leave", isRead: 0, relatedId: "lv-pend-kavita", relatedType: "leave_request", actionUrl: "/approvals", createdAt: now - 86400 },
	{ id: "notif-recent-4", userId: charanId, type: "wfh_requested", title: "New WFH Request Pending", body: "Karthik Iyer requested WFH for tomorrow", isRead: 0, relatedId: "wfh-pend-karthik", relatedType: "wfh_request", actionUrl: "/approvals", createdAt: now - 7200 },
];

for (const n of notificationsToSeed) {
	db.run(
		`INSERT OR REPLACE INTO notifications (id, user_id, type, title, body, is_read, related_id, related_type, action_url, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[n.id, n.userId, n.type, n.title, n.body, n.isRead, n.relatedId, n.relatedType, n.actionUrl, n.createdAt],
	);
}

db.run("PRAGMA foreign_keys = ON;");

console.log("✅ Successfully seeded startup data:");
console.log(`   • ${projectList.length} Projects`);
console.log(`   • ${teamMembers.length} Team Members`);
console.log(`   • ${clientContacts.length} Client Contacts`);
console.log(`   • ${totalTaskCounter} Tasks`);
console.log(`   • ${checklistTemplates.length} Stage Checklist Templates`);
console.log(`   • ${totalChecklistItems} Project Checklist Items with Stage Gates`);
console.log(`   • ${documentsToSeed.length} Project Documents with Version Chains`);
console.log(`   • ${commentsToSeed.length} Threaded Comments & Decision Records`);
console.log(`   • ${dailyUpdatesToSeed.length} Daily Standup Updates with linked task items`);
console.log(`   • ${eodReportsToSeed.length} EOD Reports (Draft & Finalised)`);
console.log(`   • ${workFlagsToSeed.length} Work Flags & Quality Signals (Rule & AI)`);
console.log(`   • ${aiConversationsToSeed.length} AI Assistant Conversations`);
console.log(`   • ${aiMessagesToSeed.length} AI Messages with Citations & Token Audits`);
console.log(`   • ${toolInvocationsToSeed.length} AI Tool Invocations (incl. Access Denials)`);
console.log(`   • ${proposedActionsToSeed.length} AI Proposed Actions (Pending & Confirmed)`);
console.log(`   • ${seededTimesheetsCount} Current Month Timesheets across team`);
console.log(`   • ${wfhRequestsList.length} WFH Requests`);
console.log(`   • ${plannedLeaves.length} Leave Requests`);
console.log(`   • ${notificationsToSeed.length} Recent Notifications`);



