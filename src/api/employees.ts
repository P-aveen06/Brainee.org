import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, exists, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { createDb, type Database } from "../db";
import {
	clientDeployments,
	leaveBalances,
	projects,
	systemLeaveTypes,
	users,
} from "../db/schema";
import { logAuditEvent } from "../lib/audit.server";
import {
	assessDeactivation,
	type DeactivationSnapshot,
	type Role,
} from "../lib/employee-lifecycle";
import {
	ensureBalancesForCycle,
	provisionBalancesForCycle,
} from "../lib/leave-balances.server";
import { getTodayIsoDate } from "../lib/leave-policy";
import { AppError, adminMiddleware, toClientError } from "../lib/server-fn";
import {
	listCurrentAssetsForUser,
	returnAllCurrentAssetsForUser,
} from "./assets";

const updateRoleSchema = z.object({
	userId: z.string(),
	newRole: z.enum(["user", "lead", "admin", "hr"]),
});

const updateSettingsSchema = z.object({
	userId: z.string(),
	standardHours: z.number().min(1).max(24),
	peerLeadId: z.string().nullable().optional(),
	joinDate: z.string().nullable().optional(),
	birthday: z.string().nullable().optional(),
});

const updateBalanceSchema = z.object({
	userId: z.string(),
	leaveType: z.string().min(1),
	newLimit: z.number().min(0),
});

/** Walks up the proposed reporting chain to reject A→B→…→A cycles. */
async function assertNoReportingCycle(
	db: Database,
	userId: string,
	peerLeadId: string,
) {
	let current: string | null = peerLeadId;
	for (let depth = 0; current && depth < 50; depth++) {
		if (current === userId) {
			throw new AppError(
				"This assignment would create a reporting cycle in the org chart.",
			);
		}
		const [lead] = await db
			.select({ peerLeadId: users.peerLeadId })
			.from(users)
			.where(eq(users.id, current))
			.limit(1);
		if (!lead) {
			throw new AppError("The selected peer lead does not exist.");
		}
		current = lead.peerLeadId;
	}
}

export const updateEmployeeRole = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => updateRoleSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const adminUser = context.user;
			const db = createDb(env.DATABASE);

			const [oldUser] = await db
				.select({ role: users.role })
				.from(users)
				.where(eq(users.id, input.userId))
				.limit(1);

			if (!oldUser) {
				return { error: "Employee not found." };
			}

			const isDemotion = oldUser.role === "admin" && input.newRole !== "admin";

			// Demotion is guarded atomically: the row only changes while at least one
			// OTHER admin still exists. This prevents a check-then-update race where
			// two admins demote each other concurrently and leave zero admins.
			const otherAdmins = alias(users, "other_admins");
			const updated = await db
				.update(users)
				.set({
					role: input.newRole,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(users.id, input.userId),
						isDemotion
							? exists(
									db
										.select({ one: sql`1` })
										.from(otherAdmins)
										.where(
											and(
												eq(otherAdmins.role, "admin"),
												ne(otherAdmins.id, input.userId),
											),
										),
								)
							: undefined,
					),
				)
				.returning({ id: users.id });

			if (updated.length === 0) {
				return { error: "Cannot remove the last admin from the system." };
			}

			await logAuditEvent(db, {
				actorId: adminUser.id,
				action: "update",
				entityType: "users",
				entityId: input.userId,
				oldData: { role: oldUser?.role },
				newData: { role: input.newRole },
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update employee role.");
		}
	});

export const updateEmployeeSettings = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => updateSettingsSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const adminUser = context.user;

			if (input.peerLeadId === input.userId) {
				return { error: "A user cannot be their own peer lead." };
			}

			const db = createDb(env.DATABASE);

			if (input.peerLeadId) {
				await assertNoReportingCycle(db, input.userId, input.peerLeadId);
			}

			const [oldUser] = await db
				.select({
					standardHours: users.standardHours,
					peerLeadId: users.peerLeadId,
					joinDate: users.joinDate,
					birthday: users.birthday,
				})
				.from(users)
				.where(eq(users.id, input.userId))
				.limit(1);

			await db
				.update(users)
				.set({
					standardHours: input.standardHours,
					peerLeadId: input.peerLeadId || null,
					joinDate: input.joinDate || null,
					birthday: input.birthday || null,
					updatedAt: new Date(),
				})
				.where(eq(users.id, input.userId));

			const effectiveBirthday = input.birthday || oldUser?.birthday || null;
			const effectiveJoinDate =
				input.joinDate !== undefined
					? input.joinDate
					: oldUser?.joinDate || null;

			if (effectiveBirthday) {
				await provisionBalancesForCycle(db, {
					id: input.userId,
					birthday: effectiveBirthday,
					joinDate: effectiveJoinDate,
				});
			}

			await logAuditEvent(db, {
				actorId: adminUser.id,
				action: "update",
				entityType: "users",
				entityId: input.userId,
				oldData: {
					standard_hours: oldUser?.standardHours,
					peer_lead_id: oldUser?.peerLeadId,
					join_date: oldUser?.joinDate,
					birthday: oldUser?.birthday,
				},
				newData: {
					standard_hours: input.standardHours,
					peer_lead_id: input.peerLeadId,
					join_date: input.joinDate,
					birthday: input.birthday,
				},
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update settings.");
		}
	});

export const updateLeaveBalance = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => updateBalanceSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const adminUser = context.user;
			const db = createDb(env.DATABASE);

			const [user] = await db
				.select({ birthday: users.birthday, joinDate: users.joinDate })
				.from(users)
				.where(eq(users.id, input.userId))
				.limit(1);

			if (!user) {
				return { error: "User not found." };
			}
			if (!user.birthday) {
				return {
					error: "Set the employee's birthday before editing balances.",
				};
			}

			// Edits always target the employee's current cycle (what the editor shows).
			const cycle = await ensureBalancesForCycle(db, {
				id: input.userId,
				birthday: user.birthday,
				joinDate: user.joinDate,
			});
			if (!cycle) {
				return { error: "Could not resolve the employee's leave cycle." };
			}

			const balanceKey = and(
				eq(leaveBalances.userId, input.userId),
				eq(leaveBalances.leaveType, input.leaveType),
				eq(leaveBalances.cycleStart, cycle.cycleStart),
			);

			const [existingBalance] = await db
				.select({
					totalLimit: leaveBalances.totalLimit,
					used: leaveBalances.used,
				})
				.from(leaveBalances)
				.where(balanceKey)
				.limit(1);

			if (existingBalance && input.newLimit < existingBalance.used) {
				return {
					error: `Cannot set limit lower than already used days (${existingBalance.used}).`,
				};
			}

			await db
				.insert(leaveBalances)
				.values({
					id: crypto.randomUUID(),
					userId: input.userId,
					leaveType: input.leaveType,
					totalLimit: input.newLimit,
					used: existingBalance?.used || 0,
					cycleStart: cycle.cycleStart,
					cycleEnd: cycle.cycleEnd,
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: [
						leaveBalances.userId,
						leaveBalances.leaveType,
						leaveBalances.cycleStart,
					],
					set: {
						totalLimit: input.newLimit,
						cycleEnd: cycle.cycleEnd,
						updatedAt: new Date(),
					},
				});

			await logAuditEvent(db, {
				actorId: adminUser.id,
				action: "update",
				entityType: "leave_balances",
				entityId: `${input.userId}_${input.leaveType}_${cycle.cycleStart}`,
				oldData: { total_limit: existingBalance?.totalLimit },
				newData: {
					total_limit: input.newLimit,
					cycle_start: cycle.cycleStart,
					cycle_end: cycle.cycleEnd,
				},
			});

			return { success: true };
		} catch (err) {
			return toClientError(err, "Failed to update leave balance.");
		}
	});

export const getLeaveBalancesForUser = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => z.string().parse(data))
	.handler(async ({ data: userId }) => {
		const db = createDb(env.DATABASE);

		const dbLeaveTypes = await db
			.select()
			.from(systemLeaveTypes)
			.orderBy(systemLeaveTypes.createdAt);

		const leaveTypes = dbLeaveTypes.map((t) => ({
			id: t.id,
			name: t.name,
			slug: t.slug,
			default_days: Number(t.defaultDays),
		}));

		const [user] = await db
			.select({ birthday: users.birthday, joinDate: users.joinDate })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		// Only the current cycle is shown/edited.
		const cycle = user?.birthday
			? await ensureBalancesForCycle(db, {
					id: userId,
					birthday: user.birthday,
					joinDate: user.joinDate,
				})
			: null;

		const dbBalances = cycle
			? await db
					.select()
					.from(leaveBalances)
					.where(
						and(
							eq(leaveBalances.userId, userId),
							eq(leaveBalances.cycleStart, cycle.cycleStart),
						),
					)
			: [];

		const balances = dbBalances.map((b) => ({
			id: b.id,
			leave_type: b.leaveType,
			total_limit: Number(b.totalLimit),
			used: Number(b.used),
			cycle_start: b.cycleStart,
			cycle_end: b.cycleEnd,
		}));

		return {
			leaveTypes,
			balances,
		};
	});

const deactivateSchema = z.object({
	userId: z.string(),
	exitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid exit date."),
	exitReason: z.string().max(500).optional().nullable(),
	reassignReportsTo: z.string().optional().nullable(),
});

/** Everything the departure rules need, read in one place so preview and commit agree. */
async function gatherDeactivationSnapshot(
	db: Database,
	input: {
		targetUserId: string;
		actorUserId: string;
		reassignReportsTo?: string | null;
	},
) {
	const [target] = await db
		.select()
		.from(users)
		.where(eq(users.id, input.targetUserId))
		.limit(1);

	if (!target) return null;

	const directReports = await db
		.select({ id: users.id, name: users.name, email: users.email })
		.from(users)
		.where(and(eq(users.peerLeadId, target.id), eq(users.isActive, true)));

	const otherActiveAdmins = await db
		.select({ id: users.id })
		.from(users)
		.where(
			and(
				eq(users.role, "admin"),
				ne(users.id, target.id),
				eq(users.isActive, true),
			),
		);

	let reassignTargetIsActive = false;
	if (input.reassignReportsTo) {
		const [candidate] = await db
			.select({ isActive: users.isActive })
			.from(users)
			.where(eq(users.id, input.reassignReportsTo))
			.limit(1);
		reassignTargetIsActive = Boolean(candidate?.isActive);
	}

	const heldAssets = await listCurrentAssetsForUser(db, target.id);

	const activeDeployments = await db
		.select({
			id: clientDeployments.id,
			roleTitle: clientDeployments.roleTitle,
		})
		.from(clientDeployments)
		.where(
			and(
				eq(clientDeployments.userId, target.id),
				eq(clientDeployments.status, "active"),
			),
		);

	const ownedProjects = await db
		.select({
			id: projects.id,
			name: projects.name,
			code: projects.code,
		})
		.from(projects)
		.where(
			and(
				eq(projects.ownerId, target.id),
				inArray(projects.status, ["draft", "active", "on_hold"]),
			),
		);

	const snapshot: DeactivationSnapshot = {
		targetUserId: target.id,
		targetRole: target.role as Role,
		targetIsActive: target.isActive,
		actorUserId: input.actorUserId,
		directReportIds: directReports.map((r) => r.id),
		targetPeerLeadId: target.peerLeadId,
		otherActiveAdminCount: otherActiveAdmins.length,
		reassignReportsTo: input.reassignReportsTo ?? null,
		reassignTargetIsActive,
		ownedProjectIds: ownedProjects.map((p) => p.id),
	};

	return {
		target,
		directReports,
		heldAssets,
		activeDeployments,
		ownedProjects,
		snapshot,
	};
}

/**
 * What deactivating this person would involve, and what stands in the way.
 * Read-only, so the admin sees the consequences before committing.
 */
export const getEmployeeDeactivationPreview = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) =>
		z
			.object({
				userId: z.string(),
				reassignReportsTo: z.string().optional().nullable(),
			})
			.parse(data),
	)
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		const gathered = await gatherDeactivationSnapshot(db, {
			targetUserId: input.userId,
			actorUserId: context.user.id,
			reassignReportsTo: input.reassignReportsTo,
		});

		if (!gathered) return { error: "Employee not found." };

		const {
			target,
			directReports,
			heldAssets,
			activeDeployments,
			ownedProjects,
			snapshot,
		} = gathered;

		if (!target.isActive) {
			return { error: "This employee has already been deactivated." };
		}

		const assessment = assessDeactivation(snapshot);

		return {
			employee: { id: target.id, name: target.name, email: target.email },
			blockers: assessment.blockers,
			canProceed: assessment.canProceed,
			directReports,
			heldAssets,
			activeDeployments,
			ownedProjects,
			today: getTodayIsoDate(),
		};
	});

/**
 * Ends someone's employment: moves their reports, clears their equipment,
 * closes their client engagements, then marks the account inactive.
 *
 * The account is never deleted — audit logs, approvals and the org chart all
 * reference users, and cascading deletes would erase timesheet and leave history.
 *
 * D1 gives us no transaction, so the steps run in dependency order and each is
 * safe to repeat: reports move first (that is what reroutes approvals), and the
 * deactivation itself lands last so a partial failure leaves a still-active
 * account that can simply be retried.
 */
export const deactivateEmployee = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => deactivateSchema.parse(data))
	.handler(async ({ data: input, context }) => {
		try {
			const db = createDb(env.DATABASE);
			const admin = context.user;

			const gathered = await gatherDeactivationSnapshot(db, {
				targetUserId: input.userId,
				actorUserId: admin.id,
				reassignReportsTo: input.reassignReportsTo,
			});

			if (!gathered) return { error: "Employee not found." };

			const { target, snapshot } = gathered;

			if (!target.isActive) {
				return { error: "This employee has already been deactivated." };
			}

			const assessment = assessDeactivation(snapshot);
			if (!assessment.canProceed) {
				return {
					error: assessment.blockers[0].message,
					blockers: assessment.blockers,
				};
			}

			const now = new Date();
			const { userIds, newLeadId, successorId, successorNewLeadId } =
				assessment.reportsToReassign;

			// 1. Move direct reports. Until this happens the departing lead keeps
			//    receiving their approval routing and notifications.
			if (newLeadId) {
				for (const reportId of userIds) {
					await assertNoReportingCycle(db, reportId, newLeadId);
				}

				if (userIds.length > 0) {
					await db
						.update(users)
						.set({ peerLeadId: newLeadId, updatedAt: now })
						.where(inArray(users.id, userIds));
				}

				// A successor promoted from inside the team cannot become their own
				// lead, so they move up to the departing person's lead instead.
				if (successorId) {
					await db
						.update(users)
						.set({ peerLeadId: successorNewLeadId, updatedAt: now })
						.where(eq(users.id, successorId));
				}
			}

			// 2. Clear equipment.
			const returnedAssets = await returnAllCurrentAssetsForUser(db, {
				userId: target.id,
				actorId: admin.id,
				returnedDate: input.exitDate,
				note: `Departure clearance (${input.exitReason || "Employment ended"})`,
			});

			// 3. Close open client engagements.
			await db
				.update(clientDeployments)
				.set({
					status: "completed",
					endDate: input.exitDate,
					updatedAt: now,
				})
				.where(
					and(
						eq(clientDeployments.userId, target.id),
						eq(clientDeployments.status, "active"),
					),
				);

			// 4. Finally, end access.
			await db
				.update(users)
				.set({
					isActive: false,
					exitDate: input.exitDate,
					exitReason: input.exitReason || null,
					deactivatedById: admin.id,
					updatedAt: now,
				})
				.where(eq(users.id, target.id));

			await logAuditEvent(db, {
				actorId: admin.id,
				action: "deactivate",
				entityType: "users",
				entityId: target.id,
				oldData: { isActive: true, peerLeadOf: snapshot.directReportIds },
				newData: {
					isActive: false,
					exitDate: input.exitDate,
					exitReason: input.exitReason || null,
					reportsReassignedTo: newLeadId,
					reportsReassigned: userIds.length + (successorId ? 1 : 0),
					assetsReturned: returnedAssets.length,
				},
			});

			return {
				success: true,
				reportsReassigned: userIds.length + (successorId ? 1 : 0),
				assetsReturned: returnedAssets.length,
			};
		} catch (err) {
			return toClientError(err, "Failed to deactivate employee.");
		}
	});
