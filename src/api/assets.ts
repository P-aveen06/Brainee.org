import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray } from "@/db/graph-query";
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

/**
 * Returns every asset currently in a person's custody — used by departure
 * clearance, where the per-asset flows are impractical.
 *
 * Each asset is closed out independently and
 * the work is idempotent: assignments already closed are simply not selected.
 * Returns the assets it processed so the caller can report and audit them.
 */
export async function returnAllCurrentAssetsForUser(
	db: ReturnType<typeof createDb>,
	options: {
		userId: string;
		actorId: string;
		returnedDate: string;
		note: string;
	},
) {
	const held = await db
		.select({
			assignmentId: assetAssignments.id,
			assetId: assets.id,
			assetTag: assets.assetTag,
			assetName: assets.name,
			isInternal: companies.isInternal,
		})
		.from(assetAssignments)
		.innerJoin(assets, eq(assetAssignments.assetId, assets.id))
		.leftJoin(companies, eq(assets.ownerCompanyId, companies.id))
		.where(
			and(
				eq(assetAssignments.userId, options.userId),
				eq(assetAssignments.isCurrent, true),
			),
		);

	const now = new Date();
	const processed: {
		assetId: string;
		assetTag: string;
		assetName: string;
		newStatus: string;
		returnDestination: string;
	}[] = [];

	for (const item of held) {
		// Departure clearance does not collect a per-asset condition.
		const conditionIn = "good";
		const { newStatus, destination: returnDestination } =
			resolveAssetReturnRouting(Boolean(item.isInternal), conditionIn);

		await db
			.update(assetAssignments)
			.set({
				isCurrent: false,
				returnedDate: options.returnedDate,
				conditionIn,
				returnDestination,
				returnNotes: options.note,
				receivedByUserId: options.actorId,
				updatedAt: now,
			})
			.where(eq(assetAssignments.id, item.assignmentId));

		await db
			.update(assets)
			.set({ status: newStatus, updatedAt: now })
			.where(eq(assets.id, item.assetId));

		await db.insert(assetHistory).values({
			id: crypto.randomUUID(),
			assetId: item.assetId,
			eventType: "returned",
			actorId: options.actorId,
			targetUserId: options.userId,
			details: JSON.stringify({
				returnedDate: options.returnedDate,
				conditionIn,
				returnDestination,
				newStatus,
				notes: options.note,
			}),
			createdAt: now,
		});

		processed.push({
			assetId: item.assetId,
			assetTag: item.assetTag,
			assetName: item.assetName,
			newStatus,
			returnDestination,
		});
	}

	return processed;
}

/** Assets currently in a person's custody, for previewing a departure. */
export async function listCurrentAssetsForUser(
	db: ReturnType<typeof createDb>,
	userId: string,
) {
	return await db
		.select({
			assetId: assets.id,
			assetTag: assets.assetTag,
			assetName: assets.name,
			category: assets.category,
			isInternal: companies.isInternal,
		})
		.from(assetAssignments)
		.innerJoin(assets, eq(assetAssignments.assetId, assets.id))
		.leftJoin(companies, eq(assets.ownerCompanyId, companies.id))
		.where(
			and(
				eq(assetAssignments.userId, userId),
				eq(assetAssignments.isCurrent, true),
			),
		);
}

/** Ensure default internal Brainee.org company exists in DB */
export async function ensureDefaultCompany(db: ReturnType<typeof createDb>) {
	const [existingCompany] = await db
		.select()
		.from(companies)
		.where(eq(companies.code, "Brainee.org"))
		.limit(1);

	if (!existingCompany) {
		const companyId = crypto.randomUUID();
		await db.insert(companies).values({
			id: companyId,
			name: "Brainee.org",
			code: "Brainee.org",
			isInternal: true,
			contactEmail: "admin@brainee.org",
			notes: "Primary internal organization",
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		return companyId;
	}
	return existingCompany.id;
}

// ────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────

const createAssetSchema = z.object({
	assetTag: z.string().min(1, "Asset tag is required"),
	name: z.string().min(1, "Name is required"),
	category: z.enum([
		"laptop",
		"charger",
		"bag",
		"monitor",
		"id_card",
		"phone",
		"digital_account",
		"accessory",
		"other",
	]),
	assetType: z
		.enum(["capital_asset", "bulk_peripheral", "digital_account", "physical"])
		.default("capital_asset"),
	ownerCompanyId: z.string().min(1, "Owner company is required"),
	serialNumber: z.string().optional().nullable(),
	model: z.string().optional().nullable(),
	specs: z.string().optional().nullable(),
	purchaseDate: z.string().optional().nullable(),
	purchaseCost: z.number().optional().nullable(),
	warrantyExpiry: z.string().optional().nullable(),
	accountExpiry: z.string().optional().nullable(),
	renewalDate: z.string().optional().nullable(),
	quantity: z.number().int().min(1).max(100).default(1),
	notes: z.string().optional().nullable(),
});

const updateAssetSchema = createAssetSchema.extend({
	id: z.string(),
});

const assignAssetSchema = z.object({
	assetId: z.string(),
	userId: z.string(),
	clientDeploymentId: z.string().optional().nullable(),
	assignedDate: z.string().min(1),
	conditionOut: z.enum(["new", "good", "fair"]).default("good"),
	notes: z.string().optional().nullable(),
});

const reassignAssetSchema = z.object({
	assetId: z.string(),
	newUserId: z.string(),
	clientDeploymentId: z.string().optional().nullable(),
	reassignDate: z.string().min(1),
	conditionOut: z.enum(["new", "good", "fair"]).default("good"),
	notes: z.string().optional().nullable(),
});

const returnAssetSchema = z.object({
	assetId: z.string(),
	conditionIn: z.enum(["good", "fair", "damaged", "defective"]),
	returnNotes: z.string().optional().nullable(),
	returnedDate: z.string().min(1),
});

const markStatusSchema = z.object({
	assetId: z.string(),
	status: z.enum([
		"in_inventory",
		"maintenance",
		"defective",
		"disposed",
		"returned_to_client",
	]),
	reason: z.string().optional().nullable(),
});

const replaceAssetSchema = z.object({
	defectiveAssetId: z.string(),
	replacementAssetId: z.string(),
	notes: z.string().optional().nullable(),
});

const renewAccountSchema = z.object({
	assetId: z.string(),
	renewalDate: z.string().min(1),
	accountExpiry: z.string().optional().nullable(),
	notes: z.string().optional().nullable(),
});

// ────────────────────────────────────────────────────────────
// Server Functions
// ────────────────────────────────────────────────────────────

export const getAssetsPageData = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(async () => {
		const db = createDb();
		await ensureDefaultCompany(db);

		// Fetch all companies
		const allCompanies = await db
			.select()
			.from(companies)
			.orderBy(companies.isInternal, companies.name);

		// Fetch all users for dropdown
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

		// Fetch active client deployments for dropdowns
		const activeDeployments = await db
			.select({
				id: clientDeployments.id,
				userId: clientDeployments.userId,
				userName: users.name,
				primaryClientId: clientDeployments.primaryClientId,
				endClientId: clientDeployments.endClientId,
				roleTitle: clientDeployments.roleTitle,
				startDate: clientDeployments.startDate,
			})
			.from(clientDeployments)
			.leftJoin(users, eq(clientDeployments.userId, users.id))
			.where(eq(clientDeployments.status, "active"));

		// Fetch all assets with current active assignment and joined owner company
		const allAssets = await db
			.select({
				id: assets.id,
				assetTag: assets.assetTag,
				name: assets.name,
				category: assets.category,
				assetType: assets.assetType,
				ownerCompanyId: assets.ownerCompanyId,
				ownerCompanyName: companies.name,
				ownerCompanyCode: companies.code,
				ownerCompanyIsInternal: companies.isInternal,
				serialNumber: assets.serialNumber,
				model: assets.model,
				specs: assets.specs,
				purchaseDate: assets.purchaseDate,
				purchaseCost: assets.purchaseCost,
				warrantyExpiry: assets.warrantyExpiry,
				accountExpiry: assets.accountExpiry,
				renewalDate: assets.renewalDate,
				status: assets.status,
				defectReason: assets.defectReason,
				disposalReason: assets.disposalReason,
				disposalDate: assets.disposalDate,
				replacedByAssetId: assets.replacedByAssetId,
				notes: assets.notes,
				createdAt: assets.createdAt,
				updatedAt: assets.updatedAt,
			})
			.from(assets)
			.leftJoin(companies, eq(assets.ownerCompanyId, companies.id))
			.orderBy(desc(assets.createdAt));

		// Fetch all current active assignments
		const currentAssignments = await db
			.select({
				assignmentId: assetAssignments.id,
				assetId: assetAssignments.assetId,
				userId: assetAssignments.userId,
				userName: users.name,
				userEmail: users.email,
				userAvatarUrl: users.avatarUrl,
				clientDeploymentId: assetAssignments.clientDeploymentId,
				assignedDate: assetAssignments.assignedDate,
				conditionOut: assetAssignments.conditionOut,
				acknowledgedAt: assetAssignments.acknowledgedAt,
				issueReportedAt: assetAssignments.issueReportedAt,
				issueDescription: assetAssignments.issueDescription,
				issueStatus: assetAssignments.issueStatus,
			})
			.from(assetAssignments)
			.leftJoin(users, eq(assetAssignments.userId, users.id))
			.where(eq(assetAssignments.isCurrent, true));

		const assignmentMap = new Map<string, (typeof currentAssignments)[0]>();
		for (const assignment of currentAssignments) {
			assignmentMap.set(assignment.assetId, assignment);
		}

		// Attach active assignment to assets
		const enrichedAssets = allAssets.map((asset) => ({
			...asset,
			purchaseCost: asset.purchaseCost ? Number(asset.purchaseCost) : null,
			currentAssignment: assignmentMap.get(asset.id) || null,
		}));

		// Compute metrics
		const now = new Date();
		const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
			.toISOString()
			.slice(0, 10);
		const todayStr = now.toISOString().slice(0, 10);

		const summary = {
			total: enrichedAssets.length,
			inInventory: enrichedAssets.filter((a) => a.status === "in_inventory")
				.length,
			assigned: enrichedAssets.filter((a) => a.status === "assigned").length,
			defective: enrichedAssets.filter(
				(a) => a.status === "defective" || a.status === "maintenance",
			).length,
			disposed: enrichedAssets.filter((a) => a.status === "disposed").length,
			expiringAccounts: enrichedAssets.filter((a) => {
				if (a.assetType !== "digital_account") return false;
				const dateToCheck = a.renewalDate || a.accountExpiry;
				if (!dateToCheck) return false;
				return dateToCheck <= in30Days;
			}).length,
		};

		return {
			assets: enrichedAssets,
			companies: allCompanies,
			users: allUsers,
			deployments: activeDeployments,
			summary,
			today: todayStr,
		};
	});

export const getAssetHistory = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => z.string().parse(data))
	.handler(async ({ data: assetId }) => {
		const db = createDb();

		const [asset] = await db
			.select({
				id: assets.id,
				assetTag: assets.assetTag,
				name: assets.name,
				category: assets.category,
				assetType: assets.assetType,
				ownerCompanyName: companies.name,
				serialNumber: assets.serialNumber,
				model: assets.model,
				specs: assets.specs,
				purchaseDate: assets.purchaseDate,
				purchaseCost: assets.purchaseCost,
				warrantyExpiry: assets.warrantyExpiry,
				accountExpiry: assets.accountExpiry,
				renewalDate: assets.renewalDate,
				status: assets.status,
				defectReason: assets.defectReason,
				disposalReason: assets.disposalReason,
				disposalDate: assets.disposalDate,
				notes: assets.notes,
			})
			.from(assets)
			.leftJoin(companies, eq(assets.ownerCompanyId, companies.id))
			.where(eq(assets.id, assetId))
			.limit(1);

		if (!asset) return null;

		const dbHistory = await db
			.select({
				id: assetHistory.id,
				eventType: assetHistory.eventType,
				actorId: assetHistory.actorId,
				actorName: users.name,
				actorEmail: users.email,
				targetUserId: assetHistory.targetUserId,
				details: assetHistory.details,
				createdAt: assetHistory.createdAt,
			})
			.from(assetHistory)
			.leftJoin(users, eq(assetHistory.actorId, users.id))
			.where(eq(assetHistory.assetId, assetId))
			.orderBy(desc(assetHistory.createdAt));

		// Get target user names if needed
		const targetUserIds = dbHistory
			.map((h) => h.targetUserId)
			.filter(Boolean) as string[];
		const targetUserMap = new Map<string, string>();
		if (targetUserIds.length > 0) {
			const targetUsers = await db
				.select({ id: users.id, name: users.name })
				.from(users)
				.where(inArray(users.id, targetUserIds));
			for (const u of targetUsers) {
				targetUserMap.set(u.id, u.name);
			}
		}

		// Also get past assignments
		const assignments = await db
			.select({
				id: assetAssignments.id,
				userId: assetAssignments.userId,
				userName: users.name,
				userEmail: users.email,
				assignedDate: assetAssignments.assignedDate,
				returnedDate: assetAssignments.returnedDate,
				conditionOut: assetAssignments.conditionOut,
				conditionIn: assetAssignments.conditionIn,
				returnDestination: assetAssignments.returnDestination,
				returnNotes: assetAssignments.returnNotes,
				isCurrent: assetAssignments.isCurrent,
			})
			.from(assetAssignments)
			.leftJoin(users, eq(assetAssignments.userId, users.id))
			.where(eq(assetAssignments.assetId, assetId))
			.orderBy(desc(assetAssignments.assignedDate));

		type JsonValue =
			| string
			| number
			| boolean
			| null
			| JsonValue[]
			| { [key: string]: JsonValue };

		function parseJsonDetails(
			details: string | null,
		): Record<string, JsonValue> {
			if (!details) return {};
			try {
				const parsed = JSON.parse(details);
				if (
					typeof parsed === "object" &&
					parsed !== null &&
					!Array.isArray(parsed)
				) {
					return parsed as Record<string, JsonValue>;
				}
				return {};
			} catch {
				return {};
			}
		}

		const historyTimeline = dbHistory.map((h) => {
			const parsedDetails = parseJsonDetails(h.details);

			return {
				id: h.id,
				eventType: h.eventType,
				actor: h.actorId
					? {
							id: h.actorId,
							name: h.actorName ?? "Unknown",
							email: h.actorEmail ?? "",
						}
					: null,
				targetUserName: h.targetUserId
					? (targetUserMap.get(h.targetUserId) ?? null)
					: null,
				details: parsedDetails,
				createdAt: h.createdAt ? h.createdAt.toISOString() : "",
			};
		});

		return {
			asset: {
				...asset,
				purchaseCost: asset.purchaseCost ? Number(asset.purchaseCost) : null,
			},
			history: historyTimeline,
			assignments,
		};
	});

export const createAsset = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => createAssetSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const admin = context.user;
			const quantity = input.quantity || 1;
			const now = new Date();

			if (quantity === 1) {
				// Single asset creation
				const tag = input.assetTag.trim().toUpperCase();
				const [existing] = await db
					.select({ id: assets.id })
					.from(assets)
					.where(eq(assets.assetTag, tag))
					.limit(1);

				if (existing) {
					return { error: `Asset tag "${tag}" is already in use.` };
				}

				const assetId = crypto.randomUUID();
				await db.insert(assets).values({
					id: assetId,
					assetTag: tag,
					name: input.name.trim(),
					category: input.category,
					assetType: input.assetType,
					ownerCompanyId: input.ownerCompanyId,
					serialNumber: input.serialNumber?.trim() || null,
					model: input.model?.trim() || null,
					specs: input.specs?.trim() || null,
					purchaseDate: input.purchaseDate || null,
					purchaseCost: input.purchaseCost ?? null,
					warrantyExpiry: input.warrantyExpiry || null,
					accountExpiry: input.accountExpiry || null,
					renewalDate: input.renewalDate || null,
					status: "in_inventory",
					notes: input.notes?.trim() || null,
					createdAt: now,
					updatedAt: now,
				});

				await db.insert(assetHistory).values({
					id: crypto.randomUUID(),
					assetId,
					eventType: "created",
					actorId: admin.id,
					details: JSON.stringify({
						assetTag: tag,
						name: input.name,
						category: input.category,
						ownerCompanyId: input.ownerCompanyId,
					}),
					createdAt: now,
				});

				await logAuditEvent(db, {
					actorId: admin.id,
					action: "create",
					entityType: "assets",
					entityId: assetId,
					newData: {
						assetTag: tag,
						name: input.name,
						category: input.category,
					},
				});

				return { success: true, assetId, count: 1 };
			}

			// Multi-unit batch creation
			const baseTag = input.assetTag.trim().toUpperCase();
			const match = baseTag.match(/^(.*?)(\d+)$/);
			const generatedTags: string[] = [];

			if (match) {
				const prefix = match[1];
				const startNum = parseInt(match[2], 10);
				const padLength = match[2].length;
				for (let i = 0; i < quantity; i++) {
					const numStr = String(startNum + i).padStart(padLength, "0");
					generatedTags.push(`${prefix}${numStr}`);
				}
			} else {
				const cleanPrefix = baseTag.endsWith("-") ? baseTag : `${baseTag}-`;
				for (let i = 0; i < quantity; i++) {
					const numStr = String(i + 1).padStart(3, "0");
					generatedTags.push(`${cleanPrefix}${numStr}`);
				}
			}

			// Check for conflicts
			const existingTags = await db
				.select({ assetTag: assets.assetTag })
				.from(assets)
				.where(inArray(assets.assetTag, generatedTags));

			if (existingTags.length > 0) {
				return {
					error: `Cannot create batch: Tag(s) ${existingTags
						.map((t) => `"${t.assetTag}"`)
						.join(", ")} are already taken.`,
				};
			}

			for (const tag of generatedTags) {
				const assetId = crypto.randomUUID();
				await db.insert(assets).values({
					id: assetId,
					assetTag: tag,
					name: input.name.trim(),
					category: input.category,
					assetType: input.assetType,
					ownerCompanyId: input.ownerCompanyId,
					serialNumber: null, // Each unit in batch has separate serial, to be recorded on assignment or edit
					model: input.model?.trim() || null,
					specs: input.specs?.trim() || null,
					purchaseDate: input.purchaseDate || null,
					purchaseCost: input.purchaseCost ?? null,
					warrantyExpiry: input.warrantyExpiry || null,
					accountExpiry: input.accountExpiry || null,
					renewalDate: input.renewalDate || null,
					status: "in_inventory",
					notes: input.notes?.trim() || null,
					createdAt: now,
					updatedAt: now,
				});

				await db.insert(assetHistory).values({
					id: crypto.randomUUID(),
					assetId,
					eventType: "created",
					actorId: admin.id,
					details: JSON.stringify({
						assetTag: tag,
						name: input.name,
						category: input.category,
						ownerCompanyId: input.ownerCompanyId,
						batch: true,
						totalQuantity: quantity,
					}),
					createdAt: now,
				});
			}

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "create",
				entityType: "assets",
				entityId: "batch",
				newData: {
					name: input.name,
					category: input.category,
					quantity,
					tags: generatedTags,
				},
			});

			return { success: true, count: quantity };
		} catch (err) {
			return toClientError(err, "Failed to create asset.");
		}
	});

export const updateAsset = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => updateAssetSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const admin = context.user;

			const [oldAsset] = await db
				.select()
				.from(assets)
				.where(eq(assets.id, input.id))
				.limit(1);

			if (!oldAsset) {
				return { error: "Asset not found." };
			}

			// Check tag uniqueness if changed
			if (input.assetTag.toUpperCase() !== oldAsset.assetTag) {
				const [existing] = await db
					.select({ id: assets.id })
					.from(assets)
					.where(eq(assets.assetTag, input.assetTag.trim().toUpperCase()))
					.limit(1);
				if (existing && existing.id !== input.id) {
					return { error: `Asset tag "${input.assetTag}" is already in use.` };
				}
			}

			const now = new Date();

			await db
				.update(assets)
				.set({
					assetTag: input.assetTag.trim().toUpperCase(),
					name: input.name.trim(),
					category: input.category,
					assetType: input.assetType,
					ownerCompanyId: input.ownerCompanyId,
					serialNumber: input.serialNumber?.trim() || null,
					model: input.model?.trim() || null,
					specs: input.specs?.trim() || null,
					purchaseDate: input.purchaseDate || null,
					purchaseCost: input.purchaseCost ?? null,
					warrantyExpiry: input.warrantyExpiry || null,
					accountExpiry: input.accountExpiry || null,
					renewalDate: input.renewalDate || null,
					notes: input.notes?.trim() || null,
					updatedAt: now,
				})
				.where(eq(assets.id, input.id));

			await db.insert(assetHistory).values({
				id: crypto.randomUUID(),
				assetId: input.id,
				eventType: "details_updated",
				actorId: admin.id,
				details: JSON.stringify({
					updatedFields: {
						name: input.name,
						category: input.category,
						ownerCompanyId: input.ownerCompanyId,
					},
				}),
				createdAt: now,
			});

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "update",
				entityType: "assets",
				entityId: input.id,
				oldData: { name: oldAsset.name, assetTag: oldAsset.assetTag },
				newData: { name: input.name, assetTag: input.assetTag },
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update asset.");
		}
	});

export const assignAsset = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => assignAssetSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const admin = context.user;

			const [asset] = await db
				.select()
				.from(assets)
				.where(eq(assets.id, input.assetId))
				.limit(1);

			if (!asset) {
				return { error: "Asset not found." };
			}

			if (asset.status === "assigned") {
				return {
					error: "Asset is currently assigned. Reassign or return it first.",
				};
			}

			if (asset.status === "disposed") {
				return { error: "Cannot assign a disposed asset." };
			}

			const now = new Date();
			const assignmentId = crypto.randomUUID();

			// Mark existing current assignments for this asset as closed if any (safety check)
			await db
				.update(assetAssignments)
				.set({
					isCurrent: false,
					returnedDate: input.assignedDate,
					updatedAt: now,
				})
				.where(
					and(
						eq(assetAssignments.assetId, input.assetId),
						eq(assetAssignments.isCurrent, true),
					),
				);

			// Create new assignment
			await db.insert(assetAssignments).values({
				id: assignmentId,
				assetId: input.assetId,
				userId: input.userId,
				clientDeploymentId: input.clientDeploymentId || null,
				assignedDate: input.assignedDate,
				conditionOut: input.conditionOut,
				assignedByUserId: admin.id,
				isCurrent: true,
				returnNotes: input.notes || null,
				createdAt: now,
				updatedAt: now,
			});

			// Update asset status
			await db
				.update(assets)
				.set({
					status: "assigned",
					updatedAt: now,
				})
				.where(eq(assets.id, input.assetId));

			// Log history
			await db.insert(assetHistory).values({
				id: crypto.randomUUID(),
				assetId: input.assetId,
				eventType: "assigned",
				actorId: admin.id,
				targetUserId: input.userId,
				details: JSON.stringify({
					assignedDate: input.assignedDate,
					conditionOut: input.conditionOut,
					clientDeploymentId: input.clientDeploymentId || null,
					notes: input.notes || null,
				}),
				createdAt: now,
			});

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "assign",
				entityType: "assets",
				entityId: input.assetId,
				newData: {
					userId: input.userId,
					assignedDate: input.assignedDate,
				},
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to assign asset.");
		}
	});

export const reassignAsset = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => reassignAssetSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const admin = context.user;

			const [asset] = await db
				.select()
				.from(assets)
				.where(eq(assets.id, input.assetId))
				.limit(1);

			if (!asset) {
				return { error: "Asset not found." };
			}

			const now = new Date();

			// Close current active assignment
			await db
				.update(assetAssignments)
				.set({
					isCurrent: false,
					returnedDate: input.reassignDate,
					conditionIn: "good",
					returnNotes: `Directly reassigned by ${admin.name}`,
					receivedByUserId: admin.id,
					updatedAt: now,
				})
				.where(
					and(
						eq(assetAssignments.assetId, input.assetId),
						eq(assetAssignments.isCurrent, true),
					),
				);

			// Create new assignment
			const newAssignmentId = crypto.randomUUID();
			await db.insert(assetAssignments).values({
				id: newAssignmentId,
				assetId: input.assetId,
				userId: input.newUserId,
				clientDeploymentId: input.clientDeploymentId || null,
				assignedDate: input.reassignDate,
				conditionOut: input.conditionOut,
				assignedByUserId: admin.id,
				isCurrent: true,
				returnNotes: input.notes || null,
				createdAt: now,
				updatedAt: now,
			});

			await db
				.update(assets)
				.set({
					status: "assigned",
					updatedAt: now,
				})
				.where(eq(assets.id, input.assetId));

			await db.insert(assetHistory).values({
				id: crypto.randomUUID(),
				assetId: input.assetId,
				eventType: "reassigned",
				actorId: admin.id,
				targetUserId: input.newUserId,
				details: JSON.stringify({
					reassignDate: input.reassignDate,
					conditionOut: input.conditionOut,
					notes: input.notes || null,
				}),
				createdAt: now,
			});

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "reassign",
				entityType: "assets",
				entityId: input.assetId,
				newData: {
					newUserId: input.newUserId,
					reassignDate: input.reassignDate,
				},
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to reassign asset.");
		}
	});

export const returnAsset = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => returnAssetSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const admin = context.user;

			const [asset] = await db
				.select({
					id: assets.id,
					ownerCompanyId: assets.ownerCompanyId,
					isInternal: companies.isInternal,
					ownerCompanyName: companies.name,
				})
				.from(assets)
				.leftJoin(companies, eq(assets.ownerCompanyId, companies.id))
				.where(eq(assets.id, input.assetId))
				.limit(1);

			if (!asset) {
				return { error: "Asset not found." };
			}

			const now = new Date();

			const {
				newStatus,
				destination: returnDestination,
				defectReason,
			} = resolveAssetReturnRouting(
				Boolean(asset.isInternal),
				input.conditionIn,
				input.returnNotes,
			);

			// Close current active assignment
			await db
				.update(assetAssignments)
				.set({
					isCurrent: false,
					returnedDate: input.returnedDate,
					conditionIn: input.conditionIn,
					returnDestination,
					returnNotes: input.returnNotes || null,
					receivedByUserId: admin.id,
					updatedAt: now,
				})
				.where(
					and(
						eq(assetAssignments.assetId, input.assetId),
						eq(assetAssignments.isCurrent, true),
					),
				);

			// Update asset status
			await db
				.update(assets)
				.set({
					status: newStatus,
					defectReason,
					updatedAt: now,
				})
				.where(eq(assets.id, input.assetId));

			// Log history
			await db.insert(assetHistory).values({
				id: crypto.randomUUID(),
				assetId: input.assetId,
				eventType: "returned",
				actorId: admin.id,
				details: JSON.stringify({
					returnedDate: input.returnedDate,
					conditionIn: input.conditionIn,
					returnDestination,
					newStatus,
					returnNotes: input.returnNotes || null,
				}),
				createdAt: now,
			});

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "return",
				entityType: "assets",
				entityId: input.assetId,
				newData: {
					conditionIn: input.conditionIn,
					returnDestination,
					newStatus,
				},
			});

			return { success: true, newStatus, returnDestination };
		} catch (err) {
			return toClientError(err, "Failed to return asset.");
		}
	});

export const markAssetStatus = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => markStatusSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const admin = context.user;

			const [asset] = await db
				.select()
				.from(assets)
				.where(eq(assets.id, input.assetId))
				.limit(1);

			if (!asset) {
				return { error: "Asset not found." };
			}

			const now = new Date();
			let eventType = "details_updated";

			if (input.status === "defective") {
				eventType = "marked_defective";
			} else if (input.status === "maintenance") {
				eventType = "maintenance_start";
			} else if (
				input.status === "in_inventory" &&
				asset.status === "maintenance"
			) {
				eventType = "maintenance_end";
			} else if (input.status === "disposed") {
				eventType = "disposed";
			}

			// If disposing, close current assignment
			if (input.status === "disposed") {
				await db
					.update(assetAssignments)
					.set({
						isCurrent: false,
						returnedDate: now.toISOString().slice(0, 10),
						conditionIn: "defective",
						returnDestination: "scrapped",
						returnNotes: input.reason || "Asset disposed",
						receivedByUserId: admin.id,
						updatedAt: now,
					})
					.where(
						and(
							eq(assetAssignments.assetId, input.assetId),
							eq(assetAssignments.isCurrent, true),
						),
					);
			}

			await db
				.update(assets)
				.set({
					status: input.status,
					defectReason:
						input.status === "defective" ? input.reason : asset.defectReason,
					disposalReason:
						input.status === "disposed" ? input.reason : asset.disposalReason,
					disposalDate:
						input.status === "disposed"
							? now.toISOString().slice(0, 10)
							: asset.disposalDate,
					updatedAt: now,
				})
				.where(eq(assets.id, input.assetId));

			await db.insert(assetHistory).values({
				id: crypto.randomUUID(),
				assetId: input.assetId,
				eventType,
				actorId: admin.id,
				details: JSON.stringify({
					fromStatus: asset.status,
					toStatus: input.status,
					reason: input.reason || null,
				}),
				createdAt: now,
			});

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "update_status",
				entityType: "assets",
				entityId: input.assetId,
				oldData: { status: asset.status },
				newData: { status: input.status, reason: input.reason },
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update asset status.");
		}
	});

export const replaceAsset = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => replaceAssetSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const admin = context.user;

			const [defective] = await db
				.select()
				.from(assets)
				.where(eq(assets.id, input.defectiveAssetId))
				.limit(1);

			const [replacement] = await db
				.select()
				.from(assets)
				.where(eq(assets.id, input.replacementAssetId))
				.limit(1);

			if (!defective || !replacement) {
				return { error: "Defective or replacement asset not found." };
			}

			const now = new Date();

			// Mark defective as replaced
			await db
				.update(assets)
				.set({
					status: "replaced",
					replacedByAssetId: input.replacementAssetId,
					updatedAt: now,
				})
				.where(eq(assets.id, input.defectiveAssetId));

			// Log history on defective
			await db.insert(assetHistory).values({
				id: crypto.randomUUID(),
				assetId: input.defectiveAssetId,
				eventType: "replaced",
				actorId: admin.id,
				details: JSON.stringify({
					replacedByAssetId: input.replacementAssetId,
					replacedByTag: replacement.assetTag,
					notes: input.notes || null,
				}),
				createdAt: now,
			});

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "replace",
				entityType: "assets",
				entityId: input.defectiveAssetId,
				newData: { replacedBy: input.replacementAssetId },
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to record asset replacement.");
		}
	});

export const renewAccount = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => renewAccountSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const admin = context.user;

			const [asset] = await db
				.select()
				.from(assets)
				.where(eq(assets.id, input.assetId))
				.limit(1);

			if (!asset) {
				return { error: "Account/Asset not found." };
			}

			const now = new Date();

			await db
				.update(assets)
				.set({
					renewalDate: input.renewalDate,
					accountExpiry: input.accountExpiry || asset.accountExpiry,
					updatedAt: now,
				})
				.where(eq(assets.id, input.assetId));

			await db.insert(assetHistory).values({
				id: crypto.randomUUID(),
				assetId: input.assetId,
				eventType: "renewed",
				actorId: admin.id,
				details: JSON.stringify({
					previousRenewalDate: asset.renewalDate,
					newRenewalDate: input.renewalDate,
					newExpiry: input.accountExpiry || asset.accountExpiry,
					notes: input.notes || null,
				}),
				createdAt: now,
			});

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "renew",
				entityType: "assets",
				entityId: input.assetId,
				newData: {
					renewalDate: input.renewalDate,
					accountExpiry: input.accountExpiry,
				},
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to renew account.");
		}
	});

export const deleteAsset = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ assetId: z.string() }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const admin = context.user;

			const [activeAssignment] = await db
				.select()
				.from(assetAssignments)
				.where(
					and(
						eq(assetAssignments.assetId, input.assetId),
						eq(assetAssignments.isCurrent, true),
					),
				)
				.limit(1);

			if (activeAssignment) {
				return {
					error:
						"Cannot delete an asset that is currently assigned. Return it first.",
				};
			}

			// Clean up history and past assignments
			await db
				.delete(assetHistory)
				.where(eq(assetHistory.assetId, input.assetId));
			await db
				.delete(assetAssignments)
				.where(eq(assetAssignments.assetId, input.assetId));
			await db.delete(assets).where(eq(assets.id, input.assetId));

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "delete",
				entityType: "assets",
				entityId: input.assetId,
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to delete asset.");
		}
	});

export const acknowledgeAssetReceipt = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ assignmentId: z.string() }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const user = context.user;

			const [assignment] = await db
				.select()
				.from(assetAssignments)
				.where(eq(assetAssignments.id, input.assignmentId))
				.limit(1);

			if (!assignment) {
				return { error: "Assignment record not found." };
			}

			if (user.role !== "admin" && assignment.userId !== user.id) {
				return { error: "You can only acknowledge equipment in your custody." };
			}

			const now = new Date();

			await db
				.update(assetAssignments)
				.set({
					acknowledgedAt: now,
					updatedAt: now,
				})
				.where(eq(assetAssignments.id, input.assignmentId));

			await db.insert(assetHistory).values({
				id: crypto.randomUUID(),
				assetId: assignment.assetId,
				eventType: "receipt_acknowledged",
				actorId: user.id,
				targetUserId: assignment.userId,
				details: JSON.stringify({
					assignmentId: input.assignmentId,
					acknowledgedAt: now.toISOString(),
				}),
				createdAt: now,
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to acknowledge receipt.");
		}
	});

const reportAssetIssueSchema = z.object({
	assignmentId: z.string(),
	description: z.string().min(1, "Please describe the issue."),
});

/**
 * The single source of truth for reporting an equipment issue — used by the server fn
 * below and by the AI assistant's proposal-confirmation flow, so an AI-confirmed report
 * gets the exact same custody check and asset-history audit trail a human report gets.
 */
export async function reportAssetIssueCore(
	db: ReturnType<typeof createDb>,
	user: { id: string; role: string },
	input: z.infer<typeof reportAssetIssueSchema>,
) {
	try {
		const [assignment] = await db
			.select()
			.from(assetAssignments)
			.where(eq(assetAssignments.id, input.assignmentId))
			.limit(1);

		if (!assignment) {
			return { error: "Assignment record not found." };
		}

		if (user.role !== "admin" && assignment.userId !== user.id) {
			return {
				error: "You can only report issues for equipment in your custody.",
			};
		}

		const now = new Date();

		await db
			.update(assetAssignments)
			.set({
				issueReportedAt: now,
				issueDescription: input.description.trim(),
				issueStatus: "open",
				updatedAt: now,
			})
			.where(eq(assetAssignments.id, input.assignmentId));

		await db.insert(assetHistory).values({
			id: crypto.randomUUID(),
			assetId: assignment.assetId,
			eventType: "issue_reported",
			actorId: user.id,
			targetUserId: assignment.userId,
			details: JSON.stringify({
				assignmentId: input.assignmentId,
				description: input.description.trim(),
			}),
			createdAt: now,
		});

		return { success: true };
	} catch (err) {
		return toClientError(err, "Failed to report issue.");
	}
}

export const reportAssetIssue = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => reportAssetIssueSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		const db = createDb();
		return reportAssetIssueCore(db, context.user, input);
	});

export const resolveAssetIssue = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ assignmentId: z.string() }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb();
			const admin = context.user;

			const [assignment] = await db
				.select()
				.from(assetAssignments)
				.where(eq(assetAssignments.id, input.assignmentId))
				.limit(1);

			if (!assignment) {
				return { error: "Assignment record not found." };
			}

			const now = new Date();

			await db
				.update(assetAssignments)
				.set({
					issueStatus: "resolved",
					updatedAt: now,
				})
				.where(eq(assetAssignments.id, input.assignmentId));

			await db.insert(assetHistory).values({
				id: crypto.randomUUID(),
				assetId: assignment.assetId,
				eventType: "issue_resolved",
				actorId: admin.id,
				targetUserId: assignment.userId,
				details: JSON.stringify({
					assignmentId: input.assignmentId,
				}),
				createdAt: now,
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to resolve issue.");
		}
	});
