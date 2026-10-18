import { demoPersonForAuth } from "../../shared/demo-startup";
import { byLabel, hydrate } from "../../shared/graph/model";
import type { EmployeeRow } from "../db/models/users";
import { graphOperation } from "../db/transport.server";
import { getSessionFromRequest } from "./auth.server";
import { type AccessState, resolveAccessState } from "./employee-lifecycle";

async function resolveAppUser(): Promise<EmployeeRow | null> {
	const session = await getSessionFromRequest();
	const person = session ? demoPersonForAuth(session.authUserId) : undefined;
	if (!session || !person || session.email !== person.email) return null;
	const row = await graphOperation<Record<string, unknown> | null>(
		"identity.resolve",
		{ authUserId: session.authUserId, email: session.email },
	);
	return row
		? (hydrate(byLabel.get("Employee")!, row) as unknown as EmployeeRow)
		: null;
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
