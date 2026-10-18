import { getEnvVar } from "@/lib/auth.server";

export async function callBrowser(
	input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const url = getEnvVar("BROWSER_SERVICE_URL");
	const token = getEnvVar("BROWSER_SERVICE_TOKEN");
	if (!url || !token)
		throw new Error(
			"Browser tools are not configured. Start the local browser service and configure BROWSER_SERVICE_URL and BROWSER_SERVICE_TOKEN.",
		);
	const response = await fetch(`${url.replace(/\/$/, "")}/operations`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(input),
		signal: AbortSignal.timeout(35_000),
	});
	const body = (await response.json()) as {
		data?: Record<string, unknown>;
		error?: string;
	};
	if (!response.ok || !body.data)
		throw new Error(body.error ?? "Browser service unavailable.");
	return body.data;
}
