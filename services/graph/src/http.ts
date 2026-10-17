import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

export function createGraphServer(token: string, ready: () => Promise<void>) {
	const expected = Buffer.from(`Bearer ${token}`);
	const server = createServer(async (request, response) => {
		response.setHeader("content-type", "application/json");
		response.setHeader("cache-control", "no-store");
		const send = (status: number, data: Record<string, unknown>) => {
			response.writeHead(status).end(JSON.stringify(data));
		};
		if (request.method !== "GET")
			return send(405, { error: "Method not allowed." });
		if (request.url === "/health") return send(200, { status: "alive" });
		const supplied = Buffer.from(request.headers.authorization ?? "");
		if (
			supplied.length !== expected.length ||
			!timingSafeEqual(supplied, expected)
		) {
			return send(401, { error: "Unauthorized." });
		}
		if (request.url !== "/ready")
			return send(404, { error: "Operation not found." });
		try {
			await ready();
			return send(200, { status: "ready", schema: "0001-record-identities" });
		} catch {
			return send(503, { error: "Graph database or schema is unavailable." });
		}
	});
	server.requestTimeout = 5000;
	server.headersTimeout = 5000;
	server.keepAliveTimeout = 2000;
	server.maxHeadersCount = 30;
	return server;
}
