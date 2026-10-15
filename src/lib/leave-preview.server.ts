import type { Database } from "@/db";
import { validateLeaveRequest } from "./leave-validation.server";
import type { AppUser } from "./server-fn";

export async function previewLeaveRequest(
	db: Database,
	user: AppUser,
	input: {
		leaveType: string;
		startDate: string;
		endDate: string;
		reason?: string;
	},
) {
	return validateLeaveRequest(
		db,
		user,
		{
			leave_type: input.leaveType,
			start_date: input.startDate,
			end_date: input.endDate,
			start_day_portion: "full_day",
			end_day_portion: "full_day",
			reason: input.reason,
		},
		{ provisionBalances: false },
	);
}
