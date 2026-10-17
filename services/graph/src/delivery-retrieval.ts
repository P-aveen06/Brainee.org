import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import type { Graph } from "falkordb";
import {
	deliveryString,
	inputRecord,
	parseDeliveryInput,
	parseDeliveryManifest,
	type DeliveryOperation,
} from "../../../shared/delivery-knowledge.ts";
import type { Actor } from "./data-executor.ts";
import { resolveActor } from "./data-executor.ts";

const retrievalOperations = [
	"delivery.search",
	"delivery.context",
	"delivery.passages",
];

function endpoint() {
	const value = process.env.GRAPHRAG_SERVICE_URL;
	if (!value) throw new Error("Configure the private GraphRAG SDK service.");
	return value.replace(/\/$/, "");
}

async function sdkResponse(response: Response) {
	if (!response.ok) throw new Error("GraphRAG SDK retrieval is unavailable.");
	const result = (await response.json()) as { data?: unknown; error?: string };
	if (result.error || result.data === undefined)
		throw new Error("Invalid GraphRAG SDK response.");
	return result.data;
}

export async function deliveryOperation(
	graph: Graph,
	name: string,
	payload: unknown,
	actor: Actor,
) {
	if (name === "delivery.document_source") {
		const documentId = deliveryString(
			inputRecord(payload, ["documentId"]).documentId,
			"document ID",
		);
		const { data = [] } = await graph.roQuery<{ source: unknown }>(
			`
MATCH (a:Employee {id:$actorId}) WHERE a.isActive=true
MATCH (d:DocumentVersion {id:$documentId})-[:IN_PROJECT]->(:Project)
WHERE d.status <> 'superseded'
RETURN {id:d.id,r2Key:d.r2Key,mimeType:d.mimeType,checksum:d.checksum,
deliveryTextChecksum:d.deliveryTextChecksum,deliveryIndexStatus:d.deliveryIndexStatus} AS source`,
			{
				params: { actorId: actor.id, documentId },
				TIMEOUT: 5000,
			},
		);
		if (data.length !== 1) throw new Error("Current document not found.");
		return data[0].source;
	}
	if (name === "delivery.document_manifest") {
		if (actor.role !== "admin")
			throw new Error("Administrator access required.");
		const { offset, limit } = parseDeliveryManifest(payload);
		const { data = [] } = await graph.roQuery<{ id: string }>(
			`
MATCH (a:Employee {id:$actorId}) WHERE a.isActive=true AND a.role='admin'
MATCH (d:DocumentVersion)-[:IN_PROJECT]->(:Project) WHERE d.status <> 'superseded'
RETURN d.id AS id ORDER BY d.id SKIP $offset LIMIT $limit`,
			{
				params: { actorId: actor.id, offset, limit: limit + 1 },
				TIMEOUT: 5000,
			},
		);
		return {
			documentIds: data.slice(0, limit).map((row) => row.id),
			nextOffset: data.length > limit ? offset + limit : null,
		};
	}
	if (!retrievalOperations.includes(name))
		throw new Error("Delivery operation is not permitted.");
	const data = parseDeliveryInput(name as DeliveryOperation, payload);
	return sdkResponse(
		await fetch(`${endpoint()}/operations`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${process.env.GRAPH_SERVICE_TOKEN}`,
			},
			body: JSON.stringify({
				operation: name,
				actorId: actor.id,
				payload: data,
			}),
			signal: AbortSignal.timeout(11000),
		}),
	);
}

export async function indexDeliveryStream(
	graph: Graph,
	subject: string,
	documentId: string,
	request: IncomingMessage,
) {
	const actor = await resolveActor(graph, subject);
	if (!documentId || documentId.length > 200)
		throw new Error("Invalid document ID.");
	const options: RequestInit & { duplex: "half" } = {
		method: "POST",
		duplex: "half",
		headers: {
			authorization: `Bearer ${process.env.GRAPH_SERVICE_TOKEN}`,
			"x-graph-actor": actor.id,
		},
		body: Readable.toWeb(request) as ReadableStream<Uint8Array>,
		signal: AbortSignal.timeout(30000),
	};
	return sdkResponse(
		await fetch(
			`${endpoint()}/documents/${encodeURIComponent(documentId)}/index`,
			options,
		),
	);
}
