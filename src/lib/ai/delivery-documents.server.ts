import { env } from "cloudflare:workers";
import { graphOperation } from "@/db/transport.server";
import { getEnvVar, getSessionFromRequest } from "@/lib/auth.server";
import type { DeliveryDocumentSource } from "../../../shared/delivery-knowledge";

/** Stream original bytes across the private service boundary; no Python runs in Workers. */
export async function ensureDeliveryDocumentIndexed(documentId: string) {
	const source = await graphOperation<DeliveryDocumentSource>(
		"delivery.document_source",
		{ documentId },
	);
	if (
		source.checksum &&
		source.deliveryTextChecksum === source.checksum &&
		["indexed", "empty", "unsupported", "truncated"].includes(
			source.deliveryIndexStatus ?? "",
		)
	)
		return { documentId, status: source.deliveryIndexStatus };
	const url = getEnvVar("GRAPH_SERVICE_URL");
	const token = getEnvVar("GRAPH_SERVICE_TOKEN");
	const session = await getSessionFromRequest();
	if (!url || !token || !session)
		throw new Error("Document indexing is unavailable.");
	const file = await env.PROJECT_DOCS.get(source.r2Key);
	if (!file || file.size > 25 * 1024 * 1024)
		throw new Error("Document source is unavailable or too large.");
	const response = await fetch(
		`${url.replace(/\/$/, "")}/delivery/documents/${encodeURIComponent(documentId)}/index`,
		{
			method: "POST",
			headers: {
				authorization: `Bearer ${token}`,
				"x-graph-subject": session.authUserId,
			},
			body: file.body,
			signal: AbortSignal.timeout(35000),
		},
	);
	if (!response.ok)
		throw new Error("Document indexing is unavailable. Retry later.");
	const result = (await response.json()) as {
		data?: { documentId: string; status: string };
		error?: string;
	};
	if (!result.data || result.error)
		throw new Error("Document indexing failed.");
	return result.data;
}

/** File uploads remain available if extraction is temporarily unavailable. Reads can retry. */
export async function tryIndexDeliveryDocument(documentId: string) {
	try {
		return await ensureDeliveryDocumentIndexed(documentId);
	} catch {
		return { documentId, status: "pending" };
	}
}
