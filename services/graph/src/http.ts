import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { companyPolicyMigrationId } from "./company-policy-migration.ts";

type Execute = (
	operation: string,
	payload: unknown,
	subject: string,
) => Promise<unknown>;
async function readEnvelope(request: IncomingMessage) {
	const parts: Buffer[] = [];
	let size = 0;
	for await (const part of request) {
		size += part.length;
		if (size > 1_048_576) throw new Error("Request too large.");
		parts.push(part);
	}
	const value = JSON.parse(Buffer.concat(parts).toString("utf8")) as Record<
		string,
		unknown
	>;
	if (
		!value ||
		typeof value.operation !== "string" ||
		value.operation.length > 80 ||
		typeof value.subject !== "string" ||
		!value.subject ||
		value.subject.length > 200
	)
		throw new Error("Invalid operation envelope.");
	return {
		operation: value.operation,
		subject: value.subject,
		payload: value.payload,
	};
}
export function createGraphServer(
	token: string,
	ready: () => Promise<void>,
	execute?: Execute,
	indexDocument?: (
		subject: string,
		id: string,
		request: IncomingMessage,
	) => Promise<unknown>,
) {
	const expected = Buffer.from(`Bearer ${token}`);
	const server = createServer(async (request, response) => {
		response.setHeader("content-type", "application/json");
		response.setHeader("cache-control", "no-store");
		const send = (status: number, data: Record<string, unknown>) => {
			response.writeHead(status).end(JSON.stringify(data));
		};
		if (request.url === "/health" && request.method === "GET")
			return send(200, { status: "alive" });
		const supplied = Buffer.from(request.headers.authorization ?? "");
		if (
			supplied.length !== expected.length ||
			!timingSafeEqual(supplied, expected)
		)
			return send(401, { error: "Unauthorized." });
		const documentRoute = request.url?.match(
			/^\/delivery\/documents\/([^/]+)\/index$/,
		);
		if (documentRoute && indexDocument) {
			if (request.method !== "POST")
				return send(405, { error: "Method not allowed." });
			const subject = request.headers["x-graph-subject"];
			if (typeof subject !== "string" || !subject || subject.length > 200)
				return send(400, { error: "Invalid subject." });
			if (Number(request.headers["content-length"] ?? 0) > 25 * 1024 * 1024)
				return send(413, { error: "Document too large." });
			try {
				return send(200, {
					data: await indexDocument(
						subject,
						decodeURIComponent(documentRoute[1]),
						request,
					),
				});
			} catch {
				return send(400, {
					error: "Document indexing is unavailable. Retry later.",
				});
			}
		}
		if (request.url === "/ready") {
			if (request.method !== "GET")
				return send(405, { error: "Method not allowed." });
			try {
				await ready();
				return send(200, { status: "ready", schema: companyPolicyMigrationId });
			} catch {
				return send(503, { error: "Graph database or schema is unavailable." });
			}
		}
		if (request.url !== "/operations" || !execute)
			return send(404, { error: "Operation not found." });
		if (request.method !== "POST")
			return send(405, { error: "Method not allowed." });
		if (Number(request.headers["content-length"] ?? 0) > 1_048_576)
			return send(413, { error: "Request too large." });
		try {
			const input = await readEnvelope(request);
			const data = await execute(input.operation, input.payload, input.subject);
			return send(200, { data });
		} catch {
			return send(400, {
				error: "The graph operation could not be completed. Refresh and retry.",
			});
		}
	});
	server.requestTimeout = 30000;
	server.headersTimeout = 5000;
	server.keepAliveTimeout = 2000;
	server.maxHeadersCount = 30;
	return server;
}
