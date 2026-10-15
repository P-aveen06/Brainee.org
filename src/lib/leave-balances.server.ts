import type { Database } from "../db";
import { leaveBalances, systemLeaveTypes } from "../db/schema";
import { getCompletedServiceYears, getLeaveCycleBounds } from "./leave-policy";

/**
 * Provisions the user's leave balances for the cycle containing `onDate`
 * (defaults to now), copying defaults from systemLeaveTypes. Existing rows
 * (including admin edits) are left untouched. Cycles are birthday-anchored
 * and there is no carry-over between cycles (intentional policy).
 *
 * Returns the cycle bounds, or null when the user has no birthday set.
 */
export async function provisionBalancesForCycle(
	db: Database,
	user: { id: string; birthday: string | null; joinDate: string | null },
	onDate: Date = new Date(),
) {
	if (!user.birthday) return null;

	const cycle = getLeaveCycleBounds(user.birthday, onDate);
	const leaveTypes = await db.select().from(systemLeaveTypes);

	if (leaveTypes.length > 0) {
		for (const leaveType of leaveTypes) {
			const completedYears = getCompletedServiceYears(
				user.joinDate,
				cycle.cycleStart,
			);
			const totalLimit =
				leaveType.defaultDays + leaveType.accrualPerYear * completedYears;

			await db
				.insert(leaveBalances)
				.values({
					id: crypto.randomUUID(),
					userId: user.id,
					leaveType: leaveType.slug,
					totalLimit,
					used: 0,
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
						totalLimit,
						updatedAt: new Date(),
					},
				});
		}
	}

	return cycle;
}

export const ensureBalancesForCycle = provisionBalancesForCycle;
