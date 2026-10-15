import { redirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import {
	type getCurrentAppUser,
	getCurrentUserWithState,
} from "./current-user.server";

import { AppError } from "./errors";
export { AppError };

export type AppUser = NonNullable<
	Awaited<ReturnType<typeof getCurrentAppUser>>
>;

/**
 * Server functions are publicly reachable RPC endpoints; route-level guards
 * do NOT protect them. Every server function must use one of these
 * middlewares (authMiddleware / approverMiddleware / adminMiddleware) unless
 * it is intentionally anonymous (e.g. checkOnboardingUser).
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(
	async ({ next }) => {
		const { user, state } = await getCurrentUserWithState();
		if (!user) {
			// A deactivated employee must not be sent to sign-in: password sign-in can still
			// re-authenticate them (deactivation is an app-level state), so they would
			// bounce straight back here and loop.
			throw redirect({
				to: state === "deactivated" ? "/access-ended" : "/sign-in/$",
			});
		}
		return next({ context: { user } });
	},
);

/** Lead or admin. Leads are additionally scoped to their direct reports at the call sites. */
export const approverMiddleware = createMiddleware({ type: "function" })
	.middleware([authMiddleware])
	.server(async ({ next, context }) => {
		if (context.user.role !== "lead" && context.user.role !== "admin") {
			throw new AppError("You are not allowed to perform this action.");
		}
		return next();
	});

/** HR or admin. */
export const hrMiddleware = createMiddleware({ type: "function" })
	.middleware([authMiddleware])
	.server(async ({ next, context }) => {
		if (context.user.role !== "hr" && context.user.role !== "admin") {
			throw new AppError("You are not allowed to perform this action.");
		}
		return next();
	});

export const adminMiddleware = createMiddleware({ type: "function" })
	.middleware([authMiddleware])
	.server(async ({ next, context }) => {
		if (context.user.role !== "admin") {
			throw new AppError("You are not allowed to perform this action.");
		}
		return next();
	});

/**
 * Converts a caught error into the `{ error }` shape the client expects.
 * AppError messages pass through; everything else is logged and masked.
 */
export function toClientError(
	err: unknown,
	fallback: string,
): { error: string } {
	if (err instanceof AppError) {
		return { error: err.message };
	}
	console.error(fallback, err);
	return { error: fallback };
}
