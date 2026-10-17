import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
	operation: vi.fn(),
	get: vi.fn(),
	fetch: vi.fn(),
}));
vi.mock("@/db/transport.server", () => ({ graphOperation: mocks.operation }));
vi.mock("@/lib/auth.server", () => ({
	getEnvVar: (key: string) =>
		key === "GRAPH_SERVICE_URL" ? "http://private-graph" : "private-token",
	getSessionFromRequest: async () => ({ authUserId: "signed-user" }),
}));
vi.mock("cloudflare:workers", () => ({
	env: { PROJECT_DOCS: { get: mocks.get } },
}));
import {
	ensureDeliveryDocumentIndexed,
	tryIndexDeliveryDocument,
} from "./delivery-documents.server";

describe("Worker document indexing boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", mocks.fetch);
		mocks.operation.mockResolvedValue({
			id: "doc",
			r2Key: "private/key",
			mimeType: "text/plain",
			checksum: "hash",
		});
	});
	it("streams original bytes with server-derived identity", async () => {
		const body = new ReadableStream();
		mocks.get.mockResolvedValue({ size: 20, body });
		mocks.fetch.mockResolvedValue(
			Response.json({ data: { documentId: "doc", status: "indexed" } }),
		);
		expect(await ensureDeliveryDocumentIndexed("doc")).toEqual({
			documentId: "doc",
			status: "indexed",
		});
		const [url, request] = mocks.fetch.mock.calls[0];
		expect(url).toBe("http://private-graph/delivery/documents/doc/index");
		expect(request.body).toBe(body);
		expect(request.headers["x-graph-subject"]).toBe("signed-user");
		expect(request.headers.authorization).toBe("Bearer private-token");
	});
	it("does not re-extract matching indexed versions", async () => {
		mocks.operation.mockResolvedValue({
			checksum: "hash",
			deliveryTextChecksum: "hash",
			deliveryIndexStatus: "indexed",
		});
		expect((await ensureDeliveryDocumentIndexed("doc")).status).toBe("indexed");
		expect(mocks.get).not.toHaveBeenCalled();
	});
	it("leaves failed extraction retryable without failing uploads", async () => {
		mocks.get.mockResolvedValue(null);
		expect(await tryIndexDeliveryDocument("doc")).toEqual({
			documentId: "doc",
			status: "pending",
		});
	});
});
