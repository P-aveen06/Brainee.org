import { createServerFn } from "@tanstack/react-start";
import { eq } from "@/db/graph-query";
import { z } from "zod";
import { createDb } from "../db";
import { users } from "../db/schema";
import { getCurrentAppUser } from "../lib/current-user.server";
import { parseDateInputToIso } from "../lib/date-format";
import { provisionBalancesForCycle } from "../lib/leave-balances.server";
import { getTodayIsoDate } from "../lib/leave-policy";
import { authMiddleware } from "../lib/server-fn";

export const checkOnboardingUser = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async () => {
		return await getCurrentAppUser();
	});

const dateField = z.preprocess(
	(value) => parseDateInputToIso(value),
	z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use dd-MM-yyyy format."),
);

const onboardingSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	birthday: dateField.refine(
		(value) => value < getTodayIsoDate(),
		"Birthday must be in the past",
	),
});

export const completeOnboarding = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.inputValidator((data: unknown) => {
		return z
			.object({
				name: z.string(),
				birthday: z.string(),
			})
			.parse(data);
	})
	.handler(async ({ data: input, context }) => {
		const parsed = onboardingSchema.safeParse(input);
		if (!parsed.success) {
			return { error: parsed.error.issues[0]?.message || "Invalid data" };
		}

		const db = createDb();

		// Update user profile in local database
		const [user] = await db
			.update(users)
			.set({
				name: parsed.data.name,
				birthday: parsed.data.birthday,
				isOnboarded: true,
				updatedAt: new Date(),
			})
			.where(eq(users.id, context.user.id))
			.returning();

		if (!user) {
			return { error: "User record not found." };
		}

		await provisionBalancesForCycle(db, {
			id: user.id,
			birthday: user.birthday,
			joinDate: user.joinDate,
		});

		return { success: true };
	});
