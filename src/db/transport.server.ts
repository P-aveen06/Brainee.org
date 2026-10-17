import { getEnvVar, getSessionFromRequest } from "../lib/auth.server";

export async function graphOperation<T = unknown>(
	operation: string,
	payload: unknown,
): Promise<T> {
	const url = getEnvVar("GRAPH_SERVICE_URL");
	const token = getEnvVar("GRAPH_SERVICE_TOKEN");
	if (!url || !token)
		throw new Error(
			"Configure GRAPH_SERVICE_URL and GRAPH_SERVICE_TOKEN. FalkorDB is required.",
		);
	const session = await getSessionFromRequest();
	if (!session) throw new Error("Sign in before accessing team data.");
	const response = await fetch(`${url.replace(/\/$/, "")}/operations`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({ operation, payload, subject: session.authUserId }),
		signal: AbortSignal.timeout(12_000),
	});
	const result = (await response.json()) as { data?: T; error?: string };
	if (!response.ok || result.error)
		throw new Error(result.error ?? "FalkorDB is unavailable.");
	return result.data as T;
}
