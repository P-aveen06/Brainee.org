import { getRequest } from "@tanstack/start-server-core";
import { getEnvVar, getSessionFromRequest } from "../lib/auth.server";

// Isolated to one HTTP request; writes invalidate reads before they are sent.
const requestReads = new WeakMap<Request, Map<string, Promise<unknown>>>();

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
	const request = getRequest();
	let reads = requestReads.get(request);
	if (!reads) {
		reads = new Map();
		requestReads.set(request, reads);
	}
	const readOnly =
		operation === "identity.resolve" ||
		(operation === "data.execute" &&
			payload !== null &&
			typeof payload === "object" &&
			"action" in payload &&
			payload.action === "read");
	const key = JSON.stringify([url, session.authUserId, operation, payload]);
	if (!readOnly) reads.clear();
	const previous = readOnly ? reads.get(key) : undefined;
	if (previous) return structuredClone(await previous) as T;
	const pending = (async () => {
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
	})();
	if (readOnly) reads.set(key, pending);
	try {
		const data = await pending;
		return readOnly ? structuredClone(data) : data;
	} catch (error) {
		if (reads.get(key) === pending) reads.delete(key);
		throw error;
	}
}
