import { and, desc, eq, inArray, ne } from "@/db/graph-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createDb, type Database } from "../db";
import {
	clientContacts,
	companies,
	projectChecklistItems,
	projectEvents,
	projectMembers,
	projectStageProgress,
	projectStages,
	projects,
	users,
} from "../db/schema";
import { logAuditEvent } from "../lib/audit.server";
import { getTodayIsoDate } from "../lib/leave-policy";
import {
	assertProjectAccess,
	visibleProjectIdsFor,
} from "../lib/project-access";
import { assessStageChecklist } from "../lib/project-stage-policy";
import {
	AppError,
	adminMiddleware,
	authMiddleware,
	toClientError,
} from "../lib/server-fn";
import { ensureStageChecklistInstantiated } from "./project-checklists-helper";

// ─── Helpers ───

export function parseJsonDetails(
	details: string | null,
): Record<string, unknown> {
	if (!details) return {};
	try {
		const parsed = JSON.parse(details);
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}

/** Standard 7 lifecycle stages seeded if not already present. */
export const DEFAULT_STAGES = [
	{
		sequence: 1,
		key: "planning",
		name: "Planning",
		description:
			"Initial scoping, project setup, team resourcing and feasibility",
	},
	{
		sequence: 2,
		key: "proposal",
		name: "Proposal",
		description:
			"Client commercial proposal, contract terms and SOW preparation",
	},
	{
		sequence: 3,
		key: "discovery",
		name: "Discovery",
		description:
			"Requirements gathering, solution architecture and stakeholder signoff",
	},
	{
		sequence: 4,
		key: "development",
		name: "Development",
		description:
			"Active sprint execution, engineering and feature implementation",
	},
	{
		sequence: 5,
		key: "testing",
		name: "Testing & QA",
		description: "Verification, bug resolution, client UAT and quality signoff",
	},
	{
		sequence: 6,
		key: "deployment",
		name: "Deployment",
		description:
			"Release to staging/production environments and cutover activities",
	},
	{
		sequence: 7,
		key: "closure",
		name: "Closure",
		description:
			"Final client signoff, warranty handover, retrospective and archiving",
	},
] as const;

export async function ensureDefaultStages(db: Database) {
	const existing = await db
		.select({ key: projectStages.key })
		.from(projectStages);
	const existingKeys = new Set(existing.map((s) => s.key));

	for (const stage of DEFAULT_STAGES) {
		if (!existingKeys.has(stage.key)) {
			await db.insert(projectStages).values({
				id: crypto.randomUUID(),
				key: stage.key,
				name: stage.name,
				description: stage.description,
				sequence: stage.sequence,
				isActive: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}
	}
}

export async function logProjectEvent(
	db: Database,
	event: {
		projectId: string;
		eventType: string;
		actorId: string;
		entityType?: string;
		entityId?: string;
		details?: Record<string, unknown>;
	},
) {
	await db.insert(projectEvents).values({
		id: crypto.randomUUID(),
		projectId: event.projectId,
		eventType: event.eventType,
		actorId: event.actorId,
		entityType: event.entityType,
		entityId: event.entityId,
		details: event.details ? JSON.stringify(event.details) : null,
		createdAt: new Date(),
	});
}

/** Generates human-friendly sequential code e.g. PRJ-001, PRJ-002 */
async function generateNextProjectCode(db: Database): Promise<string> {
	const allProjects = await db.select({ code: projects.code }).from(projects);

	let maxNum = 0;
	for (const p of allProjects) {
		const match = p.code.match(/^PRJ-(\d+)$/i);
		if (match) {
			const num = Number.parseInt(match[1], 10);
			if (!Number.isNaN(num) && num > maxNum) {
				maxNum = num;
			}
		}
	}

	const nextNum = maxNum + 1;
	return `PRJ-${String(nextNum).padStart(3, "0")}`;
}

// ─── Schemas ───

const createProjectSchema = z.object({
	name: z.string().min(2, "Project name is required."),
	description: z.string().optional().nullable(),
	projectType: z
		.enum(["internal", "client", "poc", "retainer"])
		.default("client"),
	clientCompanyId: z.string().optional().nullable(),
	clientProjectName: z.string().optional().nullable(),
	engagementModel: z
		.enum(["fixed_bid", "time_and_materials", "retainer", "internal"])
		.optional()
		.nullable(),
	contractValue: z.number().min(0).optional().nullable(),
	currency: z.string().default("INR"),
	priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
	startDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format.")
		.optional()
		.nullable(),
	targetEndDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format.")
		.optional()
		.nullable(),
});

const updateProjectSchema = z.object({
	id: z.string(),
	name: z.string().min(2, "Project name is required.").optional(),
	description: z.string().optional().nullable(),
	projectType: z.enum(["internal", "client", "poc", "retainer"]).optional(),
	clientCompanyId: z.string().optional().nullable(),
	clientProjectName: z.string().optional().nullable(),
	engagementModel: z
		.enum(["fixed_bid", "time_and_materials", "retainer", "internal"])
		.optional()
		.nullable(),
	contractValue: z.number().min(0).optional().nullable(),
	currency: z.string().optional(),
	status: z
		.enum(["draft", "active", "on_hold", "completed", "cancelled", "archived"])
		.optional(),
	priority: z.enum(["low", "medium", "high", "critical"]).optional(),
	healthOverride: z.enum(["green", "amber", "red"]).optional().nullable(),
	startDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.nullable(),
	targetEndDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.nullable(),
	actualEndDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.nullable(),
});

const addMemberSchema = z.object({
	projectId: z.string(),
	userId: z.string(),
	role: z
		.enum(["owner", "manager", "contributor", "viewer"])
		.default("contributor"),
	allocationPercent: z.number().min(0).max(100).optional().nullable(),
	billableRate: z.number().min(0).optional().nullable(),
});

const updateMemberSchema = z.object({
	projectId: z.string(),
	memberId: z.string(),
	role: z.enum(["owner", "manager", "contributor", "viewer"]),
	allocationPercent: z.number().min(0).max(100).optional().nullable(),
	billableRate: z.number().min(0).optional().nullable(),
});

const removeMemberSchema = z.object({
	projectId: z.string(),
	memberId: z.string(),
	leaveReason: z.enum([
		"rolled_off",
		"reassigned",
		"left_company",
		"project_ended",
	]),
	replacedByUserId: z.string().optional().nullable(),
});

const transferOwnershipSchema = z.object({
	projectId: z.string(),
	newOwnerId: z.string(),
});

const advanceStageSchema = z.object({
	projectId: z.string(),
	targetStageKey: z.string().optional().nullable(),
	notes: z.string().optional().nullable(),
});

// ─── Server Functions ───

export const getProjectsPageData = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z
			.object({
				tab: z.enum(["active", "all", "archived"]).optional(),
				q: z.string().optional(),
			})
			.optional()
			.parse(data),
	)
	.handler(async ({ data: filter, context }) => {
		const db = createDb();
		await ensureDefaultStages(db);

		const visibleIds = await visibleProjectIdsFor(db, context.user);
		if (Array.isArray(visibleIds) && visibleIds.length === 0) {
			return {
				projects: [],
				summary: { total: 0, active: 0, onTrack: 0, atRisk: 0 },
				companies: await db
					.select({
						id: companies.id,
						name: companies.name,
						code: companies.code,
					})
					.from(companies),
				today: getTodayIsoDate(),
			};
		}

		const whereConditions = [];
		if (Array.isArray(visibleIds)) {
			whereConditions.push(inArray(projects.id, visibleIds));
		}

		if (filter?.tab === "archived") {
			whereConditions.push(eq(projects.status, "archived"));
		} else if (filter?.tab === "active") {
			whereConditions.push(eq(projects.status, "active"));
		} else if (!filter?.tab || filter.tab === "all") {
			// tab all includes everything except archived by default
		}

		const query = db
			.select({
				id: projects.id,
				code: projects.code,
				name: projects.name,
				description: projects.description,
				projectType: projects.projectType,
				status: projects.status,
				priority: projects.priority,
				healthOverride: projects.healthOverride,
				currentStageKey: projects.currentStageKey,
				startDate: projects.startDate,
				targetEndDate: projects.targetEndDate,
				ownerId: projects.ownerId,
				ownerName: users.name,
				ownerEmail: users.email,
				clientCompanyId: projects.clientCompanyId,
				clientCompanyName: companies.name,
				contractValue: projects.contractValue,
				currency: projects.currency,
				createdAt: projects.createdAt,
				updatedAt: projects.updatedAt,
			})
			.from(projects)
			.leftJoin(users, eq(projects.ownerId, users.id))
			.leftJoin(companies, eq(projects.clientCompanyId, companies.id))
			.orderBy(desc(projects.createdAt));

		const allLoaded =
			whereConditions.length > 0
				? await query.where(and(...whereConditions))
				: await query;

		// Summary metrics calculated over visible projects
		const allVisibleProjects = Array.isArray(visibleIds)
			? await db
					.select({
						status: projects.status,
						healthOverride: projects.healthOverride,
					})
					.from(projects)
					.where(inArray(projects.id, visibleIds))
			: await db
					.select({
						status: projects.status,
						healthOverride: projects.healthOverride,
					})
					.from(projects);

		const summary = {
			total: allVisibleProjects.length,
			active: allVisibleProjects.filter((p) => p.status === "active").length,
			onTrack: allVisibleProjects.filter(
				(p) => p.status === "active" && p.healthOverride !== "red",
			).length,
			atRisk: allVisibleProjects.filter(
				(p) => p.status === "active" && p.healthOverride === "red",
			).length,
		};

		const availableCompanies = await db
			.select({
				id: companies.id,
				name: companies.name,
				code: companies.code,
				isInternal: companies.isInternal,
			})
			.from(companies);

		return {
			projects: allLoaded,
			summary,
			companies: availableCompanies,
			today: getTodayIsoDate(),
		};
	});

export const getProjectDetail = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => z.string().parse(data))
	.handler(async ({ data: projectId, context }) => {
		const db = createDb();
		await ensureDefaultStages(db);

		const access = await assertProjectAccess(
			db,
			context.user,
			projectId,
			"viewer",
		);

		const [project] = await db
			.select({
				id: projects.id,
				code: projects.code,
				name: projects.name,
				description: projects.description,
				projectType: projects.projectType,
				clientCompanyId: projects.clientCompanyId,
				clientProjectName: projects.clientProjectName,
				engagementModel: projects.engagementModel,
				contractValue: projects.contractValue,
				currency: projects.currency,
				status: projects.status,
				priority: projects.priority,
				healthOverride: projects.healthOverride,
				currentStageKey: projects.currentStageKey,
				startDate: projects.startDate,
				targetEndDate: projects.targetEndDate,
				actualEndDate: projects.actualEndDate,
				ownerId: projects.ownerId,
				createdById: projects.createdById,
				createdAt: projects.createdAt,
				updatedAt: projects.updatedAt,
			})
			.from(projects)
			.where(eq(projects.id, projectId))
			.limit(1);

		if (!project) {
			throw new AppError("Project not found.");
		}

		// Client company & contacts
		let client = null;
		let contacts: Array<typeof clientContacts.$inferSelect> = [];
		if (project.clientCompanyId) {
			const [c] = await db
				.select()
				.from(companies)
				.where(eq(companies.id, project.clientCompanyId))
				.limit(1);
			client = c ?? null;

			contacts = await db
				.select()
				.from(clientContacts)
				.where(
					and(
						eq(clientContacts.companyId, project.clientCompanyId),
						eq(clientContacts.isActive, true),
					),
				);
		}

		// Members
		const members = await db
			.select({
				id: projectMembers.id,
				projectId: projectMembers.projectId,
				userId: projectMembers.userId,
				userName: users.name,
				userEmail: users.email,
				userAvatarUrl: users.avatarUrl,
				role: projectMembers.role,
				allocationPercent: projectMembers.allocationPercent,
				billableRate: projectMembers.billableRate,
				joinedAt: projectMembers.joinedAt,
				leftAt: projectMembers.leftAt,
				leaveReason: projectMembers.leaveReason,
				replacedByUserId: projectMembers.replacedByUserId,
				isCurrent: projectMembers.isCurrent,
			})
			.from(projectMembers)
			.leftJoin(users, eq(projectMembers.userId, users.id))
			.where(eq(projectMembers.projectId, projectId));

		// Stages & Progress
		const stages = await db
			.select()
			.from(projectStages)
			.where(eq(projectStages.isActive, true))
			.orderBy(projectStages.sequence);

		const progress = await db
			.select()
			.from(projectStageProgress)
			.where(eq(projectStageProgress.projectId, projectId));

		const candidates = await db
			.select({ id: users.id, name: users.name, email: users.email })
			.from(users)
			.where(and(eq(users.isOnboarded, true), eq(users.isActive, true)));

		const availableCompanies = await db
			.select({ id: companies.id, name: companies.name, code: companies.code })
			.from(companies);

		const events = await db
			.select({
				id: projectEvents.id,
				projectId: projectEvents.projectId,
				eventType: projectEvents.eventType,
				actorId: projectEvents.actorId,
				actorName: users.name,
				entityType: projectEvents.entityType,
				entityId: projectEvents.entityId,
				details: projectEvents.details,
				createdAt: projectEvents.createdAt,
			})
			.from(projectEvents)
			.leftJoin(users, eq(projectEvents.actorId, users.id))
			.where(eq(projectEvents.projectId, projectId))
			.orderBy(desc(projectEvents.createdAt))
			.limit(50);

		return {
			project,
			access,
			members,
			stages,
			progress,
			client,
			contacts,
			candidates,
			companies: availableCompanies,
			events,
			today: getTodayIsoDate(),
		};
	});

export const getProjectTimeline = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z
			.object({
				projectId: z.string(),
				limit: z.number().min(1).max(200).default(50),
			})
			.parse(data),
	)
	.handler(async ({ data: input, context }) => {
		const db = createDb();
		await assertProjectAccess(db, context.user, input.projectId, "viewer");

		const events = await db
			.select({
				id: projectEvents.id,
				projectId: projectEvents.projectId,
				eventType: projectEvents.eventType,
				actorId: projectEvents.actorId,
				actorName: users.name,
				entityType: projectEvents.entityType,
				entityId: projectEvents.entityId,
				details: projectEvents.details,
				createdAt: projectEvents.createdAt,
			})
			.from(projectEvents)
			.leftJoin(users, eq(projectEvents.actorId, users.id))
			.where(eq(projectEvents.projectId, input.projectId))
			.orderBy(desc(projectEvents.createdAt))
			.limit(input.limit);

		return { events };
	});

export const createProject = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => createProjectSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			await ensureDefaultStages(db);

			const projectId = crypto.randomUUID();
			const code = await generateNextProjectCode(db);
			const now = new Date();

			await db.insert(projects).values({
				id: projectId,
				code,
				name: input.name.trim(),
				description: input.description?.trim() || null,
				projectType: input.projectType,
				clientCompanyId: input.clientCompanyId || null,
				clientProjectName: input.clientProjectName?.trim() || null,
				engagementModel: input.engagementModel || null,
				contractValue: input.contractValue ?? null,
				currency: input.currency || "INR",
				status: "active",
				priority: input.priority,
				currentStageKey: "planning",
				startDate: input.startDate || getTodayIsoDate(),
				targetEndDate: input.targetEndDate || null,
				ownerId: context.user.id,
				createdById: context.user.id,
				createdAt: now,
				updatedAt: now,
			});

			// Assign creator as primary owner
			await db.insert(projectMembers).values({
				id: crypto.randomUUID(),
				projectId,
				userId: context.user.id,
				role: "owner",
				allocationPercent: 100,
				joinedAt: getTodayIsoDate(),
				addedById: context.user.id,
				isCurrent: true,
				createdAt: now,
				updatedAt: now,
			});

			// Initialize stage progress
			const activeStages = await db
				.select()
				.from(projectStages)
				.where(eq(projectStages.isActive, true))
				.orderBy(projectStages.sequence);

			for (const stage of activeStages) {
				const isInitial = stage.key === "planning";
				await db.insert(projectStageProgress).values({
					id: crypto.randomUUID(),
					projectId,
					stageKey: stage.key,
					status: isInitial ? "active" : "pending",
					startedAt: isInitial ? now : null,
					createdAt: now,
					updatedAt: now,
				});
				await ensureStageChecklistInstantiated(db, projectId, stage.key);
			}

			await logProjectEvent(db, {
				projectId,
				eventType: "created",
				actorId: context.user.id,
				entityType: "project",
				entityId: projectId,
				details: { code, name: input.name, projectType: input.projectType },
			});

			await logAuditEvent(db, {
				actorId: context.user.id,
				action: "create",
				entityType: "projects",
				entityId: projectId,
				newData: { code, name: input.name, ownerId: context.user.id },
			});

			return { success: true, projectId, code };
		} catch (err) {
			return toClientError(err, "Failed to create project.");
		}
	});

export const updateProject = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => updateProjectSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			await assertProjectAccess(db, context.user, input.id, "manager");

			const [existing] = await db
				.select()
				.from(projects)
				.where(eq(projects.id, input.id))
				.limit(1);

			if (!existing) {
				return { error: "Project not found." };
			}

			const updateValues: Record<string, unknown> = {
				updatedAt: new Date(),
			};

			if (input.name !== undefined) updateValues.name = input.name.trim();
			if (input.description !== undefined)
				updateValues.description = input.description?.trim() || null;
			if (input.projectType !== undefined)
				updateValues.projectType = input.projectType;
			if (input.clientCompanyId !== undefined)
				updateValues.clientCompanyId = input.clientCompanyId;
			if (input.clientProjectName !== undefined)
				updateValues.clientProjectName =
					input.clientProjectName?.trim() || null;
			if (input.engagementModel !== undefined)
				updateValues.engagementModel = input.engagementModel;
			if (input.contractValue !== undefined)
				updateValues.contractValue = input.contractValue;
			if (input.currency !== undefined) updateValues.currency = input.currency;
			if (input.status !== undefined) updateValues.status = input.status;
			if (input.priority !== undefined) updateValues.priority = input.priority;
			if (input.healthOverride !== undefined)
				updateValues.healthOverride = input.healthOverride;
			if (input.startDate !== undefined)
				updateValues.startDate = input.startDate;
			if (input.targetEndDate !== undefined)
				updateValues.targetEndDate = input.targetEndDate;
			if (input.actualEndDate !== undefined)
				updateValues.actualEndDate = input.actualEndDate;

			await db
				.update(projects)
				.set(updateValues)
				.where(eq(projects.id, input.id));

			await logProjectEvent(db, {
				projectId: input.id,
				eventType: "updated",
				actorId: context.user.id,
				entityType: "project",
				entityId: input.id,
				details: updateValues,
			});

			await logAuditEvent(db, {
				actorId: context.user.id,
				action: "update",
				entityType: "projects",
				entityId: input.id,
				oldData: existing,
				newData: updateValues,
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update project.");
		}
	});

export const archiveProject = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ projectId: z.string() }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			await assertProjectAccess(db, context.user, input.projectId, "owner");

			await db
				.update(projects)
				.set({
					status: "archived",
					actualEndDate: getTodayIsoDate(),
					updatedAt: new Date(),
				})
				.where(eq(projects.id, input.projectId));

			await logProjectEvent(db, {
				projectId: input.projectId,
				eventType: "archived",
				actorId: context.user.id,
				entityType: "project",
				entityId: input.projectId,
			});

			await logAuditEvent(db, {
				actorId: context.user.id,
				action: "update",
				entityType: "projects",
				entityId: input.projectId,
				newData: { status: "archived" },
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to archive project.");
		}
	});

export const transferProjectOwnership = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => transferOwnershipSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			await assertProjectAccess(db, context.user, input.projectId, "owner");

			const [targetUser] = await db
				.select({ id: users.id, name: users.name, isActive: users.isActive })
				.from(users)
				.where(eq(users.id, input.newOwnerId))
				.limit(1);

			if (!targetUser || !targetUser.isActive) {
				return { error: "New owner must be an active employee." };
			}

			const now = new Date();

			// 1. Update project ownerId
			await db
				.update(projects)
				.set({
					ownerId: input.newOwnerId,
					updatedAt: now,
				})
				.where(eq(projects.id, input.projectId));

			// 2. Ensure new owner has an active member record with role "owner"
			const [existingMember] = await db
				.select()
				.from(projectMembers)
				.where(
					and(
						eq(projectMembers.projectId, input.projectId),
						eq(projectMembers.userId, input.newOwnerId),
					),
				)
				.limit(1);

			if (existingMember) {
				await db
					.update(projectMembers)
					.set({
						role: "owner",
						isCurrent: true,
						updatedAt: now,
					})
					.where(eq(projectMembers.id, existingMember.id));
			} else {
				await db.insert(projectMembers).values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					userId: input.newOwnerId,
					role: "owner",
					joinedAt: getTodayIsoDate(),
					addedById: context.user.id,
					isCurrent: true,
					createdAt: now,
					updatedAt: now,
				});
			}

			await logProjectEvent(db, {
				projectId: input.projectId,
				eventType: "ownership_transferred",
				actorId: context.user.id,
				entityType: "project",
				entityId: input.projectId,
				details: {
					newOwnerId: input.newOwnerId,
					newOwnerName: targetUser.name,
				},
			});

			await logAuditEvent(db, {
				actorId: context.user.id,
				action: "update",
				entityType: "projects",
				entityId: input.projectId,
				newData: { ownerId: input.newOwnerId },
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to transfer project ownership.");
		}
	});

export const addProjectMember = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => addMemberSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			await assertProjectAccess(db, context.user, input.projectId, "manager");

			const [targetUser] = await db
				.select({ id: users.id, name: users.name, isActive: users.isActive })
				.from(users)
				.where(eq(users.id, input.userId))
				.limit(1);

			if (!targetUser || !targetUser.isActive) {
				return {
					error: "Only active employees can be added as project members.",
				};
			}

			// Check if already an active member
			const [existing] = await db
				.select()
				.from(projectMembers)
				.where(
					and(
						eq(projectMembers.projectId, input.projectId),
						eq(projectMembers.userId, input.userId),
						eq(projectMembers.isCurrent, true),
					),
				)
				.limit(1);

			if (existing) {
				return { error: "This employee is already a member of this project." };
			}

			const memberId = crypto.randomUUID();
			const now = new Date();

			await db.insert(projectMembers).values({
				id: memberId,
				projectId: input.projectId,
				userId: input.userId,
				role: input.role,
				allocationPercent: input.allocationPercent ?? 100,
				billableRate: input.billableRate ?? null,
				joinedAt: getTodayIsoDate(),
				addedById: context.user.id,
				isCurrent: true,
				createdAt: now,
				updatedAt: now,
			});

			await logProjectEvent(db, {
				projectId: input.projectId,
				eventType: "member_added",
				actorId: context.user.id,
				entityType: "member",
				entityId: memberId,
				details: {
					userId: input.userId,
					userName: targetUser.name,
					role: input.role,
				},
			});

			return { success: true, memberId };
		} catch (err) {
			return toClientError(err, "Failed to add project member.");
		}
	});

export const updateProjectMember = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => updateMemberSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			await assertProjectAccess(db, context.user, input.projectId, "manager");

			const [targetMember] = await db
				.select()
				.from(projectMembers)
				.where(
					and(
						eq(projectMembers.id, input.memberId),
						eq(projectMembers.projectId, input.projectId),
					),
				)
				.limit(1);

			if (!targetMember) {
				return { error: "Project member not found." };
			}

			// Invariant: A project must always have at least one owner
			if (targetMember.role === "owner" && input.role !== "owner") {
				const otherOwners = await db
					.select({ id: projectMembers.id })
					.from(projectMembers)
					.where(
						and(
							eq(projectMembers.projectId, input.projectId),
							eq(projectMembers.role, "owner"),
							eq(projectMembers.isCurrent, true),
							ne(projectMembers.id, input.memberId),
						),
					);

				if (otherOwners.length === 0) {
					return { error: "A project must always have at least one owner." };
				}
			}

			await db
				.update(projectMembers)
				.set({
					role: input.role,
					allocationPercent:
						input.allocationPercent ?? targetMember.allocationPercent,
					billableRate:
						input.billableRate !== undefined
							? input.billableRate
							: targetMember.billableRate,
					updatedAt: new Date(),
				})
				.where(eq(projectMembers.id, input.memberId));

			await logProjectEvent(db, {
				projectId: input.projectId,
				eventType: "member_updated",
				actorId: context.user.id,
				entityType: "member",
				entityId: input.memberId,
				details: { newRole: input.role, allocation: input.allocationPercent },
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update project member.");
		}
	});

export const removeProjectMember = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => removeMemberSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			await assertProjectAccess(db, context.user, input.projectId, "manager");

			const [targetMember] = await db
				.select()
				.from(projectMembers)
				.where(
					and(
						eq(projectMembers.id, input.memberId),
						eq(projectMembers.projectId, input.projectId),
					),
				)
				.limit(1);

			if (!targetMember || !targetMember.isCurrent) {
				return { error: "Active member record not found." };
			}

			// Invariant: Cannot remove the last active owner
			if (targetMember.role === "owner") {
				const otherOwners = await db
					.select({ id: projectMembers.id })
					.from(projectMembers)
					.where(
						and(
							eq(projectMembers.projectId, input.projectId),
							eq(projectMembers.role, "owner"),
							eq(projectMembers.isCurrent, true),
							ne(projectMembers.id, input.memberId),
						),
					);

				if (otherOwners.length === 0) {
					return {
						error:
							"Cannot remove the last project owner. Transfer ownership first.",
					};
				}
			}

			const now = new Date();
			await db
				.update(projectMembers)
				.set({
					isCurrent: false,
					leftAt: getTodayIsoDate(),
					leaveReason: input.leaveReason,
					replacedByUserId: input.replacedByUserId || null,
					updatedAt: now,
				})
				.where(eq(projectMembers.id, input.memberId));

			// If replacement designated, add them as a new member
			if (input.replacedByUserId) {
				const [replacementUser] = await db
					.select({ id: users.id, isActive: users.isActive })
					.from(users)
					.where(eq(users.id, input.replacedByUserId))
					.limit(1);

				if (replacementUser?.isActive) {
					await db.insert(projectMembers).values({
						id: crypto.randomUUID(),
						projectId: input.projectId,
						userId: input.replacedByUserId,
						role: targetMember.role,
						allocationPercent: targetMember.allocationPercent,
						billableRate: targetMember.billableRate,
						joinedAt: getTodayIsoDate(),
						addedById: context.user.id,
						isCurrent: true,
						createdAt: now,
						updatedAt: now,
					});
				}
			}

			await logProjectEvent(db, {
				projectId: input.projectId,
				eventType: "member_removed",
				actorId: context.user.id,
				entityType: "member",
				entityId: input.memberId,
				details: {
					userId: targetMember.userId,
					leaveReason: input.leaveReason,
					replacedByUserId: input.replacedByUserId,
				},
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to remove project member.");
		}
	});

export const advanceProjectStage = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => advanceStageSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			await assertProjectAccess(db, context.user, input.projectId, "manager");

			const [project] = await db
				.select()
				.from(projects)
				.where(eq(projects.id, input.projectId))
				.limit(1);

			if (!project) {
				return { error: "Project not found." };
			}

			const activeStages = await db
				.select()
				.from(projectStages)
				.where(eq(projectStages.isActive, true))
				.orderBy(projectStages.sequence);

			const currentStageIndex = activeStages.findIndex(
				(s) => s.key === (project.currentStageKey || "planning"),
			);

			let nextStage = null;
			if (input.targetStageKey) {
				nextStage = activeStages.find((s) => s.key === input.targetStageKey);
			} else if (
				currentStageIndex >= 0 &&
				currentStageIndex < activeStages.length - 1
			) {
				nextStage = activeStages[currentStageIndex + 1];
			}

			if (!nextStage) {
				return { error: "Cannot advance past the final stage." };
			}

			const now = new Date();

			// 1. Complete current stage (enforcing checklist completion)
			if (project.currentStageKey) {
				await ensureStageChecklistInstantiated(
					db,
					input.projectId,
					project.currentStageKey,
				);

				const currentChecklist = await db
					.select()
					.from(projectChecklistItems)
					.where(
						and(
							eq(projectChecklistItems.projectId, input.projectId),
							eq(projectChecklistItems.stageKey, project.currentStageKey),
						),
					);

				const assessment = assessStageChecklist(currentChecklist);
				if (!assessment.canAdvance) {
					const names = assessment.unmetRequiredItems
						.map((i) => `"${i.title}"`)
						.join(", ");
					return {
						error: `Cannot advance stage: ${assessment.unmetRequiredItems.length} required checklist item(s) are incomplete: ${names}.`,
					};
				}

				await db
					.update(projectStageProgress)
					.set({
						status: "completed",
						completedAt: now,
						completedById: context.user.id,
						notes: input.notes?.trim() || null,
						updatedAt: now,
					})
					.where(
						and(
							eq(projectStageProgress.projectId, input.projectId),
							eq(projectStageProgress.stageKey, project.currentStageKey),
						),
					);
			}

			// 2. Activate next stage
			await db
				.insert(projectStageProgress)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					stageKey: nextStage.key,
					status: "active",
					startedAt: now,
					createdAt: now,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [
						projectStageProgress.projectId,
						projectStageProgress.stageKey,
					],
					set: {
						status: "active",
						startedAt: now,
						updatedAt: now,
					},
				});

			// 3. Update authoritative project currentStageKey
			await db
				.update(projects)
				.set({
					currentStageKey: nextStage.key,
					status: nextStage.key === "closure" ? "completed" : project.status,
					updatedAt: now,
				})
				.where(eq(projects.id, input.projectId));

			await ensureStageChecklistInstantiated(
				db,
				input.projectId,
				nextStage.key,
			);

			await logProjectEvent(db, {
				projectId: input.projectId,
				eventType: "stage_advanced",
				actorId: context.user.id,
				entityType: "stage",
				entityId: nextStage.key,
				details: {
					previousStage: project.currentStageKey,
					newStage: nextStage.key,
					notes: input.notes,
				},
			});

			return {
				success: true,
				newStageKey: nextStage.key,
				newStageName: nextStage.name,
			};
		} catch (err) {
			return toClientError(err, "Failed to advance project stage.");
		}
	});

export const getProjectStageConfig = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(async () => {
		const db = createDb();
		await ensureDefaultStages(db);

		const stages = await db
			.select()
			.from(projectStages)
			.orderBy(projectStages.sequence);

		return { stages };
	});

export const upsertProjectStage = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) =>
		z
			.object({
				id: z.string().optional(),
				key: z.string().min(2),
				name: z.string().min(2),
				description: z.string().optional().nullable(),
				sequence: z.number().min(1),
				appliesToType: z.string().optional().nullable(),
				isActive: z.boolean().default(true),
			})
			.parse(data),
	)
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const now = new Date();

			if (input.id) {
				await db
					.update(projectStages)
					.set({
						key: input.key,
						name: input.name,
						description: input.description || null,
						sequence: input.sequence,
						appliesToType: input.appliesToType || null,
						isActive: input.isActive,
						updatedAt: now,
					})
					.where(eq(projectStages.id, input.id));
			} else {
				await db.insert(projectStages).values({
					id: crypto.randomUUID(),
					key: input.key,
					name: input.name,
					description: input.description || null,
					sequence: input.sequence,
					appliesToType: input.appliesToType || null,
					isActive: input.isActive,
					createdAt: now,
					updatedAt: now,
				});
			}

			await logAuditEvent(db, {
				actorId: context.user.id,
				action: input.id ? "update" : "create",
				entityType: "project_stages",
				entityId: input.id || input.key,
				newData: input,
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to save project stage.");
		}
	});
