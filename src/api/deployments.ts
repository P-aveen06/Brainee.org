import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../db";
import {
	assetAssignments,
	assetHistory,
	assets,
	clientDeployments,
	companies,
	users,
} from "../db/schema";
import { resolveAssetReturnRouting } from "../lib/asset-return-policy";
import { logAuditEvent } from "../lib/audit.server";
import {
	adminMiddleware,
	authMiddleware,
	toClientError,
} from "../lib/server-fn";
import { ensureDefaultCompany } from "./assets";

// ────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────

const companySchema = z.object({
	name: z.string().min(1, "Company name is required"),
	code: z.string().min(1, "Company code is required"),
	isInternal: z.boolean().default(false),
	contactEmail: z.string().email().optional().nullable().or(z.literal("")),
	notes: z.string().optional().nullable(),
});

const updateCompanySchema = companySchema.extend({
	id: z.string(),
});

const deploymentSchema = z.object({
	userId: z.string().min(1, "Employee is required"),
	primaryClientId: z.string().min(1, "Primary client is required"),
	endClientId: z.string().optional().nullable(),
	roleTitle: z.string().optional().nullable(),
	startDate: z.string().min(1, "Start date is required"),
	endDate: z.string().optional().nullable(),
	notes: z.string().optional().nullable(),
	bundleAssetIds: z.array(z.string()).optional(),
});

const updateDeploymentSchema = z.object({
	id: z.string().min(1),
	primaryClientId: z.string().min(1, "Primary client is required"),
	endClientId: z.string().optional().nullable(),
	roleTitle: z.string().optional().nullable(),
	startDate: z.string().min(1, "Start date is required"),
	endDate: z.string().optional().nullable(),
	status: z.enum(["active", "completed", "terminated"]).default("active"),
	notes: z.string().optional().nullable(),
});

const offboardDeploymentSchema = z.object({
	deploymentId: z.string(),
	endDate: z.string().min(1),
	reason: z.string().optional().nullable(),
	returnAssetIds: z.array(z.string()).optional(),
});

// ────────────────────────────────────────────────────────────
// Server Functions
// ────────────────────────────────────────────────────────────

export const getCompaniesList = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(async () => {
		const db = createDb(env.DATABASE);
		await ensureDefaultCompany(db);

		const allCompanies = await db
			.select()
			.from(companies)
			.orderBy(desc(companies.isInternal), companies.name);

		// Calculate asset counts and active deployment counts
		const assetCounts = await db
			.select({
				companyId: assets.ownerCompanyId,
				count: sql<number>`count(*)`,
			})
			.from(assets)
			.groupBy(assets.ownerCompanyId);

		const deploymentCounts = await db
			.select({
				companyId: clientDeployments.primaryClientId,
				count: sql<number>`count(*)`,
			})
			.from(clientDeployments)
			.where(eq(clientDeployments.status, "active"))
			.groupBy(clientDeployments.primaryClientId);

		const assetCountMap = new Map(
			assetCounts.map((a) => [a.companyId, Number(a.count)]),
		);
		const depCountMap = new Map(
			deploymentCounts.map((d) => [d.companyId, Number(d.count)]),
		);

		return allCompanies.map((c) => ({
			...c,
			assetCount: assetCountMap.get(c.id) || 0,
			activeDeploymentsCount: depCountMap.get(c.id) || 0,
		}));
	});

export const createCompany = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => companySchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb(env.DATABASE);
			const admin = context.user;

			const [existing] = await db
				.select({ id: companies.id })
				.from(companies)
				.where(eq(companies.code, input.code.trim().toUpperCase()))
				.limit(1);

			if (existing) {
				return { error: `Company code "${input.code}" already exists.` };
			}

			const companyId = crypto.randomUUID();
			const now = new Date();

			await db.insert(companies).values({
				id: companyId,
				name: input.name.trim(),
				code: input.code.trim().toUpperCase(),
				isInternal: input.isInternal,
				contactEmail: input.contactEmail?.trim() || null,
				notes: input.notes?.trim() || null,
				createdAt: now,
				updatedAt: now,
			});

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "create",
				entityType: "companies",
				entityId: companyId,
				newData: { name: input.name, code: input.code },
			});

			return { success: true, companyId };
		} catch (err) {
			return toClientError(err, "Failed to create company.");
		}
	});

export const updateCompany = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => updateCompanySchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb(env.DATABASE);
			const admin = context.user;

			const [existing] = await db
				.select()
				.from(companies)
				.where(eq(companies.id, input.id))
				.limit(1);

			if (!existing) {
				return { error: "Company not found." };
			}

			// If code changed, check uniqueness
			if (input.code.trim().toUpperCase() !== existing.code) {
				const [codeTaken] = await db
					.select({ id: companies.id })
					.from(companies)
					.where(eq(companies.code, input.code.trim().toUpperCase()))
					.limit(1);
				if (codeTaken && codeTaken.id !== input.id) {
					return { error: `Company code "${input.code}" already exists.` };
				}
			}

			const now = new Date();

			await db
				.update(companies)
				.set({
					name: input.name.trim(),
					code: input.code.trim().toUpperCase(),
					isInternal: input.isInternal,
					contactEmail: input.contactEmail?.trim() || null,
					notes: input.notes?.trim() || null,
					updatedAt: now,
				})
				.where(eq(companies.id, input.id));

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "update",
				entityType: "companies",
				entityId: input.id,
				oldData: { name: existing.name, code: existing.code },
				newData: { name: input.name, code: input.code },
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update company.");
		}
	});

export const getDeploymentsPageData = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(async () => {
		const db = createDb(env.DATABASE);
		await ensureDefaultCompany(db);

		// Fetch all companies
		const allCompanies = await db
			.select()
			.from(companies)
			.orderBy(desc(companies.isInternal), companies.name);

		const companyMap = new Map(allCompanies.map((c) => [c.id, c]));

		// Fetch all users
		const allUsers = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				avatarUrl: users.avatarUrl,
				role: users.role,
			})
			.from(users)
			.where(eq(users.isActive, true))
			.orderBy(users.name);

		// Fetch all client deployments
		const dbDeployments = await db
			.select({
				id: clientDeployments.id,
				userId: clientDeployments.userId,
				userName: users.name,
				userEmail: users.email,
				userAvatarUrl: users.avatarUrl,
				primaryClientId: clientDeployments.primaryClientId,
				endClientId: clientDeployments.endClientId,
				roleTitle: clientDeployments.roleTitle,
				startDate: clientDeployments.startDate,
				endDate: clientDeployments.endDate,
				status: clientDeployments.status,
				notes: clientDeployments.notes,
				createdAt: clientDeployments.createdAt,
			})
			.from(clientDeployments)
			.leftJoin(users, eq(clientDeployments.userId, users.id))
			.orderBy(desc(clientDeployments.startDate));

		// Fetch active assets assigned to these users/deployments
		const activeAssignments = await db
			.select({
				assignmentId: assetAssignments.id,
				assetId: assetAssignments.assetId,
				userId: assetAssignments.userId,
				clientDeploymentId: assetAssignments.clientDeploymentId,
				assignedDate: assetAssignments.assignedDate,
				assetTag: assets.assetTag,
				assetName: assets.name,
				assetCategory: assets.category,
				assetType: assets.assetType,
				ownerCompanyId: assets.ownerCompanyId,
				serialNumber: assets.serialNumber,
				accountExpiry: assets.accountExpiry,
				renewalDate: assets.renewalDate,
			})
			.from(assetAssignments)
			.innerJoin(assets, eq(assetAssignments.assetId, assets.id))
			.where(eq(assetAssignments.isCurrent, true));

		// Group active assets by user & deployment
		const assetsByUser = new Map<string, typeof activeAssignments>();
		for (const a of activeAssignments) {
			if (!a.userId) continue;
			const list = assetsByUser.get(a.userId) || [];
			list.push(a);
			assetsByUser.set(a.userId, list);
		}

		const enrichedDeployments = dbDeployments.map((dep) => {
			const primaryCompany = companyMap.get(dep.primaryClientId);
			const endCompany = dep.endClientId
				? companyMap.get(dep.endClientId)
				: null;
			const userAssets = assetsByUser.get(dep.userId) || [];

			// Assets specifically tied to this deployment or owned by primary/end client
			const deploymentAssets = userAssets.filter(
				(a) =>
					a.clientDeploymentId === dep.id ||
					a.ownerCompanyId === dep.primaryClientId ||
					(dep.endClientId && a.ownerCompanyId === dep.endClientId),
			);

			return {
				...dep,
				primaryCompanyName: primaryCompany?.name || "Unknown Client",
				primaryCompanyCode: primaryCompany?.code || "CLIENT",
				endCompanyName: endCompany?.name || null,
				endCompanyCode: endCompany?.code || null,
				assignedAssets: deploymentAssets.map((a) => ({
					assignmentId: a.assignmentId,
					assetId: a.assetId,
					assetTag: a.assetTag,
					assetName: a.assetName,
					assetCategory: a.assetCategory,
					assetType: a.assetType,
					ownerCompanyId: a.ownerCompanyId,
					ownerCompanyName:
						companyMap.get(a.ownerCompanyId || "")?.name || "Brainee.org",
					serialNumber: a.serialNumber,
					accountExpiry: a.accountExpiry,
					renewalDate: a.renewalDate,
				})),
			};
		});

		// Available inventory items for quick bundle assignment
		const availableAssets = await db
			.select({
				id: assets.id,
				assetTag: assets.assetTag,
				name: assets.name,
				category: assets.category,
				assetType: assets.assetType,
				ownerCompanyId: assets.ownerCompanyId,
				ownerCompanyName: companies.name,
				serialNumber: assets.serialNumber,
			})
			.from(assets)
			.leftJoin(companies, eq(assets.ownerCompanyId, companies.id))
			.where(eq(assets.status, "in_inventory"))
			.orderBy(assets.category, assets.name);

		return {
			deployments: enrichedDeployments,
			companies: allCompanies,
			users: allUsers,
			availableAssets,
		};
	});

export const createClientDeployment = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => deploymentSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb(env.DATABASE);
			const admin = context.user;

			const deploymentId = crypto.randomUUID();
			const now = new Date();

			await db.insert(clientDeployments).values({
				id: deploymentId,
				userId: input.userId,
				primaryClientId: input.primaryClientId,
				endClientId: input.endClientId || null,
				roleTitle: input.roleTitle?.trim() || null,
				startDate: input.startDate,
				endDate: input.endDate || null,
				status: "active",
				notes: input.notes?.trim() || null,
				createdAt: now,
				updatedAt: now,
			});

			// If bundle assets are selected, assign them immediately
			if (input.bundleAssetIds && input.bundleAssetIds.length > 0) {
				for (const assetId of input.bundleAssetIds) {
					// Close old assignment if any
					await db
						.update(assetAssignments)
						.set({
							isCurrent: false,
							returnedDate: input.startDate,
							updatedAt: now,
						})
						.where(
							and(
								eq(assetAssignments.assetId, assetId),
								eq(assetAssignments.isCurrent, true),
							),
						);

					// Create new assignment linked to this client deployment
					await db.insert(assetAssignments).values({
						id: crypto.randomUUID(),
						assetId,
						userId: input.userId,
						clientDeploymentId: deploymentId,
						assignedDate: input.startDate,
						conditionOut: "good",
						assignedByUserId: admin.id,
						isCurrent: true,
						returnNotes: `Assigned during deployment setup`,
						createdAt: now,
						updatedAt: now,
					});

					await db
						.update(assets)
						.set({ status: "assigned", updatedAt: now })
						.where(eq(assets.id, assetId));

					await db.insert(assetHistory).values({
						id: crypto.randomUUID(),
						assetId,
						eventType: "assigned",
						actorId: admin.id,
						targetUserId: input.userId,
						details: JSON.stringify({
							clientDeploymentId: deploymentId,
							assignedDate: input.startDate,
							notes: `Assigned during onboarding to client`,
						}),
						createdAt: now,
					});
				}
			}

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "create",
				entityType: "client_deployments",
				entityId: deploymentId,
				newData: {
					userId: input.userId,
					primaryClientId: input.primaryClientId,
					startDate: input.startDate,
				},
			});

			return { success: true, deploymentId };
		} catch (err) {
			return toClientError(err, "Failed to create client deployment.");
		}
	});

export const offboardClientDeployment = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => offboardDeploymentSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb(env.DATABASE);
			const admin = context.user;

			const [deployment] = await db
				.select()
				.from(clientDeployments)
				.where(eq(clientDeployments.id, input.deploymentId))
				.limit(1);

			if (!deployment) {
				return { error: "Deployment not found." };
			}

			const now = new Date();

			// Mark deployment completed
			await db
				.update(clientDeployments)
				.set({
					status: "completed",
					endDate: input.endDate,
					notes: input.reason
						? `${deployment.notes ? `${deployment.notes} | ` : ""}Offboarded: ${input.reason}`
						: deployment.notes,
					updatedAt: now,
				})
				.where(eq(clientDeployments.id, input.deploymentId));

			// If specific assets to return/reclaim were passed, process smart return
			if (input.returnAssetIds && input.returnAssetIds.length > 0) {
				for (const assetId of input.returnAssetIds) {
					const [asset] = await db
						.select({
							id: assets.id,
							ownerCompanyId: assets.ownerCompanyId,
							isInternal: companies.isInternal,
						})
						.from(assets)
						.leftJoin(companies, eq(assets.ownerCompanyId, companies.id))
						.where(eq(assets.id, assetId))
						.limit(1);

					if (!asset) continue;

					// This clearance flow does not collect a per-asset condition, so it
					// assumes good order. Routing itself is shared with returnAsset.
					const conditionIn = "good";
					const { newStatus, destination: returnDestination } =
						resolveAssetReturnRouting(Boolean(asset.isInternal), conditionIn);

					await db
						.update(assetAssignments)
						.set({
							isCurrent: false,
							returnedDate: input.endDate,
							conditionIn,
							returnDestination,
							returnNotes: `Client offboarding clearance (${input.reason || "Engagement completed"})`,
							receivedByUserId: admin.id,
							updatedAt: now,
						})
						.where(
							and(
								eq(assetAssignments.assetId, assetId),
								eq(assetAssignments.isCurrent, true),
							),
						);

					await db
						.update(assets)
						.set({
							status: newStatus,
							updatedAt: now,
						})
						.where(eq(assets.id, assetId));

					await db.insert(assetHistory).values({
						id: crypto.randomUUID(),
						assetId,
						eventType: "returned",
						actorId: admin.id,
						details: JSON.stringify({
							clientDeploymentId: input.deploymentId,
							returnedDate: input.endDate,
							returnDestination,
							newStatus,
							notes: `Offboarded from client engagement`,
						}),
						createdAt: now,
					});
				}
			}

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "offboard",
				entityType: "client_deployments",
				entityId: input.deploymentId,
				newData: {
					endDate: input.endDate,
					reason: input.reason,
				},
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to offboard client deployment.");
		}
	});

export const updateClientDeployment = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => updateDeploymentSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb(env.DATABASE);
			const admin = context.user;

			const [existing] = await db
				.select()
				.from(clientDeployments)
				.where(eq(clientDeployments.id, input.id))
				.limit(1);

			if (!existing) {
				return { error: "Deployment record not found." };
			}

			const now = new Date();

			await db
				.update(clientDeployments)
				.set({
					primaryClientId: input.primaryClientId,
					endClientId: input.endClientId || null,
					roleTitle: input.roleTitle?.trim() || null,
					startDate: input.startDate,
					endDate: input.endDate || null,
					status: input.status,
					notes: input.notes?.trim() || null,
					updatedAt: now,
				})
				.where(eq(clientDeployments.id, input.id));

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "update",
				entityType: "client_deployments",
				entityId: input.id,
				oldData: {
					primaryClientId: existing.primaryClientId,
					endClientId: existing.endClientId,
					roleTitle: existing.roleTitle,
					startDate: existing.startDate,
					endDate: existing.endDate,
					status: existing.status,
				},
				newData: {
					primaryClientId: input.primaryClientId,
					endClientId: input.endClientId,
					roleTitle: input.roleTitle,
					startDate: input.startDate,
					endDate: input.endDate,
					status: input.status,
				},
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update client deployment.");
		}
	});

export const deleteClientDeployment = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb(env.DATABASE);
			const admin = context.user;

			// Unlink any assignments from this deployment
			await db
				.update(assetAssignments)
				.set({ clientDeploymentId: null })
				.where(eq(assetAssignments.clientDeploymentId, input.id));

			await db
				.delete(clientDeployments)
				.where(eq(clientDeployments.id, input.id));

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "delete",
				entityType: "client_deployments",
				entityId: input.id,
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to delete client deployment.");
		}
	});

export const getEmployeeEquipmentAndDeployments = createServerFn({
	method: "GET",
})
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ userId: z.string() }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		const caller = context.user;

		// Authorization check: User can view their own, or admin/lead can view employee
		if (caller.role !== "admin" && caller.id !== input.userId) {
			// Check if caller is lead of this user
			const [user] = await db
				.select({ peerLeadId: users.peerLeadId })
				.from(users)
				.where(eq(users.id, input.userId))
				.limit(1);

			if (!user || user.peerLeadId !== caller.id) {
				return { error: "Not authorized to view this employee's equipment." };
			}
		}

		// Fetch assigned assets
		const dbAssets = await db
			.select({
				assignmentId: assetAssignments.id,
				assignedDate: assetAssignments.assignedDate,
				conditionOut: assetAssignments.conditionOut,
				assetId: assets.id,
				assetTag: assets.assetTag,
				name: assets.name,
				category: assets.category,
				assetType: assets.assetType,
				serialNumber: assets.serialNumber,
				model: assets.model,
				specs: assets.specs,
				warrantyExpiry: assets.warrantyExpiry,
				accountExpiry: assets.accountExpiry,
				renewalDate: assets.renewalDate,
				ownerCompanyName: companies.name,
				ownerCompanyCode: companies.code,
				ownerCompanyIsInternal: companies.isInternal,
				clientDeploymentId: assetAssignments.clientDeploymentId,
				acknowledgedAt: assetAssignments.acknowledgedAt,
				issueReportedAt: assetAssignments.issueReportedAt,
				issueDescription: assetAssignments.issueDescription,
				issueStatus: assetAssignments.issueStatus,
			})
			.from(assetAssignments)
			.innerJoin(assets, eq(assetAssignments.assetId, assets.id))
			.leftJoin(companies, eq(assets.ownerCompanyId, companies.id))
			.where(
				and(
					eq(assetAssignments.userId, input.userId),
					eq(assetAssignments.isCurrent, true),
				),
			)
			.orderBy(assets.category, assets.name);

		// Fetch deployments
		const dbDeployments = await db
			.select({
				id: clientDeployments.id,
				primaryClientId: clientDeployments.primaryClientId,
				endClientId: clientDeployments.endClientId,
				roleTitle: clientDeployments.roleTitle,
				startDate: clientDeployments.startDate,
				endDate: clientDeployments.endDate,
				status: clientDeployments.status,
				notes: clientDeployments.notes,
			})
			.from(clientDeployments)
			.where(eq(clientDeployments.userId, input.userId))
			.orderBy(desc(clientDeployments.startDate));

		const allCompanies = await db.select().from(companies);
		const companyMap = new Map(allCompanies.map((c) => [c.id, c]));

		const deployments = dbDeployments.map((d) => ({
			...d,
			primaryCompanyName: companyMap.get(d.primaryClientId)?.name || "Client",
			primaryCompanyCode: companyMap.get(d.primaryClientId)?.code || "CLIENT",
			primaryCompanyIsInternal:
				companyMap.get(d.primaryClientId)?.isInternal || false,
			endCompanyName: d.endClientId
				? companyMap.get(d.endClientId)?.name || null
				: null,
			endCompanyCode: d.endClientId
				? companyMap.get(d.endClientId)?.code || null
				: null,
			endCompanyIsInternal: d.endClientId
				? companyMap.get(d.endClientId)?.isInternal || false
				: false,
		}));

		return {
			assets: dbAssets,
			deployments,
		};
	});
