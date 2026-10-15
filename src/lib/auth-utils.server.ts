import { redirect } from "@tanstack/react-router";
import { getCurrentAppUser } from "./current-user.server";
import type { Role } from "./navigation";

/**
 * Checks if the current authenticated user has one of the allowed roles.
 * Returns the user object if authorized, otherwise returns null.
 */
export async function hasRole(allowedRoles: Role[]) {
	const user = await getCurrentAppUser();

	if (!user || !user.role) return null;

	if (allowedRoles.includes(user.role as Role)) {
		return user;
	}

	return null;
}

/**
 * Ensures the current authenticated user has one of the allowed roles.
 * Redirects to the specified path if the user is unauthorized.
 *
 * @param allowedRoles Array of roles that are allowed to access
 * @param redirectTo Path to redirect to if unauthorized (default: "/")
 * @returns The authorized user object
 */
export async function requireRole(allowedRoles: Role[], redirectTo = "/") {
	const user = await hasRole(allowedRoles);

	if (!user) {
		throw redirect({ to: redirectTo });
	}

	return user;
}
