import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { browserOperation } from "./browser.ts";

const token = process.env.BROWSER_SERVICE_TOKEN;
if (!token || token.length < 32) throw new Error("Set a BROWSER_SERVICE_TOKEN of at least 32 characters.");
const expected = Buffer.from(`Bearer ${token}`);
let running = 0;
const server = createServer(async (request, response) => {
	response.setHeader("content-type", "application/json");
	response.setHeader("cache-control", "no-store");
	const send = (status: number, body: unknown) => response.writeHead(status).end(JSON.stringify(body));
	const supplied = Buffer.from(request.headers.authorization ?? "");
	if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return send(401, { error: "Unauthorized." });
	if (request.url !== "/operations" || request.method !== "POST") return send(404, { error: "Not found." });
	if (running >= 2) return send(429, { error: "Browser busy. Retry shortly." });
	running++;
	try {
		const chunks: Buffer[] = []; let size = 0;
		for await (const chunk of request) {
			size += chunk.length;
			if (size > 512_000) return send(413, { error: "Request too large." });
			chunks.push(chunk);
		}
		const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid browser request.");
		return send(200, { data: await browserOperation(input) });
	} catch (error) {
		return send(400, { error: error instanceof Error ? error.message : "Browser operation failed." });
	} finally { running--; }
});
server.requestTimeout = 30_000;
server.headersTimeout = 5000;
server.listen(Number(process.env.BROWSER_SERVICE_PORT ?? 3200), "127.0.0.1", () => console.log("Local browser service listening on 127.0.0.1:3200"));
