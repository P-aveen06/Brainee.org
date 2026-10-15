import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { createDb } from "../db";
import { wfhPolicy, wfhRequests } from "../db/schema";
import { logAuditEvent } from "../lib/audit.server";
import { adminMiddleware, authMiddleware } from "../lib/server-fn";
import {
	calculateWfhQuota,
	DEFAULT_WFH_ALLOWANCE,
	getWfhCycleBounds,
	isValidWfhAllowance,
	WFH_POLICY_ID,
} from "../lib/wfh-policy";

async function getAllowance(db: ReturnType<typeof createDb>) {
	const [policy] = await db
		.select({ annualAllowance: wfhPolicy.annualAllowance })
		.from(wfhPolicy)
		.where(eq(wfhPolicy.id, WFH_POLICY_ID))
		.limit(1);

	return Number(policy?.annualAllowance ?? DEFAULT_WFH_ALLOWANCE);
}

const isoDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format.")
	.refine((date) => {
		const parsed = new Date(`${date}T12:00:00.000Z`);
		return (
			!Number.isNaN(parsed.getTime()) &&
			parsed.toISOString().slice(0, 10) === date
		);
	}, "Date must be valid.");

export const getWfhQuota = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) =>
		z.object({ date: isoDateSchema }).parse(data),
	)
	.handler(async ({ data: input, context }) => {
		const user = context.user;
		if (!user.birthday) {
			return {
				error: "Set your birthday in your profile before applying for WFH.",
			};
		}

		const db = createDb(env.DATABASE);
		const cycle = getWfhCycleBounds(user.birthday, input.date);
		const [allowance, requests] = await Promise.all([
			getAllowance(db),
			db
				.select({ isHalfDay: wfhRequests.isHalfDay })
				.from(wfhRequests)
				.where(
					and(
						eq(wfhRequests.userId, user.id),
						gte(wfhRequests.date, cycle.cycleStart),
						lte(wfhRequests.date, cycle.cycleEnd),
						inArray(wfhRequests.status, ["pending", "approved"]),
					),
				),
		]);
		const reserved = requests.reduce(
			(total, request) => total + (request.isHalfDay ? 0.5 : 1),
			0,
		);

		return {
			allowance,
			cycleStart: cycle.cycleStart,
			cycleEnd: cycle.cycleEnd,
			...calculateWfhQuota({ allowance, reserved }),
		};
	});

export const updateWfhPolicy = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) =>
		z
			.object({
				annualAllowance: z.number().refine(isValidWfhAllowance, {
					message:
						"WFH allowance must be between 0.5 and 365 days in 0.5-day increments.",
				}),
			})
			.parse(data),
	)
	.handler(async ({ data: input, context }) => {
		const db = createDb(env.DATABASE);
		const [oldPolicy] = await db
			.select()
			.from(wfhPolicy)
			.where(eq(wfhPolicy.id, WFH_POLICY_ID))
			.limit(1);

		await db
			.insert(wfhPolicy)
			.values({
				id: WFH_POLICY_ID,
				annualAllowance: input.annualAllowance,
				updatedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: wfhPolicy.id,
				set: {
					annualAllowance: input.annualAllowance,
					updatedAt: new Date(),
				},
			});

		const [updatedPolicy] = await db
			.select()
			.from(wfhPolicy)
			.where(eq(wfhPolicy.id, WFH_POLICY_ID))
			.limit(1);

		await logAuditEvent(db, {
			actorId: context.user.id,
			action: "update",
			entityType: "wfh_policy",
			entityId: String(WFH_POLICY_ID),
			oldData: oldPolicy
				? {
						id: oldPolicy.id,
						annualAllowance: Number(oldPolicy.annualAllowance),
					}
				: { id: WFH_POLICY_ID, annualAllowance: DEFAULT_WFH_ALLOWANCE },
			newData: updatedPolicy
				? {
						id: updatedPolicy.id,
						annualAllowance: Number(updatedPolicy.annualAllowance),
					}
				: null,
		});

		return {
			success: true,
			annualAllowance: Number(
				updatedPolicy?.annualAllowance ?? input.annualAllowance,
			),
		};
	});
