import { getRequestUrl } from "@tanstack/start-server-core/request-response";
import { demoPeople } from "../../shared/demo-startup";
import {
	createSessionCookie,
	getEnvVar,
	isTestAuthEnabled,
	setResponseCookieHeader,
} from "./auth.server";

/** Local demo identities are selected from a server-owned list; callers never supply a role. */
export async function signInAsDemoPerson(employeeId: string) {
	const local = ["localhost", "127.0.0.1", "[::1]"].includes(
		getRequestUrl().hostname,
	);
	if (!isTestAuthEnabled() || !local)
		return {
			error: "Role selection is available only in the enabled local demo.",
		};
	const person = demoPeople.find((entry) => entry.id === employeeId);
	if (!person) return { error: "Choose a person from the startup team." };
	const url = getEnvVar("GRAPH_SERVICE_URL"),
		token = getEnvVar("GRAPH_SERVICE_TOKEN");
	if (!url || !token)
		return { error: "The local graph service is not configured." };
	try {
		const response = await fetch(`${url.replace(/\/$/, "")}/operations`, {
			method: "POST",
			headers: {
				authorization: `Bearer ${token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				operation: "identity.resolve",
				payload: { authUserId: person.authId, email: person.email },
				subject: person.authId,
			}),
			signal: AbortSignal.timeout(8000),
		});
		const result = (await response.json()) as {
			data?: {
				authId: string;
				email: string;
				isActive: boolean;
				isOnboarded: boolean;
				name: string;
			};
			error?: string;
		};
		if (!response.ok || !result.data)
			return {
				error:
					"This demo account is unavailable. Run the local startup seed and try again.",
			};
		const account = result.data;
		if (account.authId !== person.authId || account.email !== person.email)
			return {
				error: "The selected account does not match the startup identity.",
			};
		if (!account.isActive)
			return { error: "This employee account has been deactivated." };
		setResponseCookieHeader(
			await createSessionCookie({
				authUserId: account.authId,
				email: account.email,
				emailVerified: true,
				firstName: account.name.split(" ")[0],
			}),
		);
		return { success: true };
	} catch {
		return {
			error:
				"Unable to connect to the local startup workspace. Check the graph service and try again.",
		};
	}
}
