import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { createDb } from "#/db";
import { users } from "#/db/schema";
import { getSessionFromRequest, TEST_AUTH_USER_ID } from "./auth.server";
import { type AccessState, resolveAccessState } from "./employee-lifecycle";

/** Resolves the session to a row, provisioning on first login. May return a deactivated user. */
async function resolveAppUser() {
	const session = await getSessionFromRequest();
	if (
		!session ||
		session.authUserId !== TEST_AUTH_USER_ID ||
		session.email !== "test@example.com"
	)
		return null;

	const db = createDb(env.DATABASE);
	let [existingUser] = await db
		.select()
		.from(users)
		.where(eq(users.authId, session.authUserId))
		.limit(1);

	if (!existingUser) {
		const email = session.email;
		const displayName =
			[session.firstName, session.lastName].filter(Boolean).join(" ") ||
			email.split("@")[0] ||
			"User";

		// Check if a user with the same email already exists (e.g. pre-seeded or migrated)
		const [userWithEmail] = await db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);

		// Never take over an existing account (which may carry a role/balances) on
		// the strength of an unverified email — that would allow account hijacking.
		if (userWithEmail && !session.emailVerified) {
			console.error(
				"[Auth] Refused to link login identity to existing account: email not verified.",
			);
			return null;
		}

		if (userWithEmail) {
			const finalName = userWithEmail.name || displayName;
			const [updatedUser] = await db
				.update(users)
				.set({
					authId: session.authUserId,
					name: finalName,
					avatarUrl: session.profilePictureUrl || userWithEmail.avatarUrl,
					updatedAt: new Date(),
				})
				.where(eq(users.id, userWithEmail.id))
				.returning();

			existingUser = updatedUser;
		} else {
			const [createdUser] = await db
				.insert(users)
				.values({
					id: crypto.randomUUID(),
					authId: session.authUserId,
					name: displayName,
					email,
					avatarUrl: session.profilePictureUrl || null,
					isOnboarded: false,
					role: "admin",
				})
				.returning();

			existingUser = createdUser;
		}
	}

	if (existingUser) {
		if (
			session.profilePictureUrl &&
			existingUser.avatarUrl !== session.profilePictureUrl
		) {
			const [updatedUser] = await db
				.update(users)
				.set({
					avatarUrl: session.profilePictureUrl,
					updatedAt: new Date(),
				})
				.where(eq(users.id, existingUser.id))
				.returning();

			if (updatedUser) existingUser = updatedUser;
		}

		if (!existingUser.isOnboarded && existingUser.birthday) {
			const [repairedUser] = await db
				.update(users)
				.set({
					isOnboarded: true,
					updatedAt: new Date(),
				})
				.where(eq(users.id, existingUser.id))
				.returning();

			if (repairedUser) {
				existingUser = repairedUser;
			}
		}

		// Dynamic role upgrade: if they lead anyone, promote "user" to "lead" dynamically.
		// Only active reports count — a departed employee still pointing here must
		// not keep resurrecting their former lead's approver rights.
		if (existingUser.role === "user") {
			const [subordinate] = await db
				.select({ id: users.id })
				.from(users)
				.where(
					and(eq(users.peerLeadId, existingUser.id), eq(users.isActive, true)),
				)
				.limit(1);

			if (subordinate) {
				existingUser.role = "lead";
			}
		}

		return existingUser;
	}

	return null;
}

/**
 * The authenticated user plus why they are or aren't allowed in, resolved once.
 *
 * `user` is non-null only when the person is still employed; the `state` tells
 * callers whether a null means "signed out" or "no longer employed", which need
 * different destinations.
 */
export async function getCurrentUserWithState(): Promise<{
	user: Awaited<ReturnType<typeof resolveAppUser>>;
	state: AccessState;
}> {
	const resolved = await resolveAppUser();
	const state = resolveAccessState(resolved);
	return { user: state === "active" ? resolved : null, state };
}

/**
 * The authenticated, still-employed user, or null.
 *
 * Returns null for a deactivated employee so every existing `if (!user)` check
 * fails closed. Callers that need to tell "signed out" apart from "no longer
 * employed" must use `getCurrentUserWithState`.
 */
export async function getCurrentAppUser() {
	return (await getCurrentUserWithState()).user;
}
