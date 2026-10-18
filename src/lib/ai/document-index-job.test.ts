import { afterEach, describe, expect, it, vi } from "vitest";
import { runDocumentIndexJob } from "./document-index-job";

afterEach(() => vi.unstubAllGlobals());
describe("automatic document indexing", () => {
	it("requires an explicit service identity", async () => {
		const fetcher = vi.fn();
		vi.stubGlobal("fetch", fetcher);
		expect(
			(await runDocumentIndexJob({ PROJECT_DOCS: { get: async () => null } }))
				.state,
		).toBe("not_configured");
		expect(fetcher).not.toHaveBeenCalled();
	});
	it("streams a bounded due queue and records a missing source for retry", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({
					data: { documents: [{ id: "doc", r2Key: "source" }] },
				}),
			)
			.mockResolvedValueOnce(Response.json({ data: { status: "pending" } }));
		vi.stubGlobal("fetch", fetcher);
		const result = await runDocumentIndexJob({
			GRAPH_SERVICE_URL: "http://local",
			GRAPH_SERVICE_TOKEN: "private",
			DELIVERY_INDEX_ACTOR_SUBJECT: "configured-subject",
			PROJECT_DOCS: { get: async () => null },
		});
		expect(result.processed).toBe(1);
		expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({
			operation: "delivery.index_failure",
			subject: "configured-subject",
			payload: { documentId: "doc" },
		});
	});
	it("records a storage error and continues to the next file without inventing indexed status", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({
					data: {
						documents: [
							{ id: "missing", r2Key: "missing" },
							{ id: "unsupported", r2Key: "other" },
						],
					},
				}),
			)
			.mockResolvedValueOnce(Response.json({ data: { status: "pending" } }))
			.mockResolvedValueOnce(
				Response.json({ data: { status: "unsupported" } }),
			);
		vi.stubGlobal("fetch", fetcher);
		const result = await runDocumentIndexJob({
			GRAPH_SERVICE_URL: "http://local",
			GRAPH_SERVICE_TOKEN: "private",
			DELIVERY_INDEX_ACTOR_SUBJECT: "configured-subject",
			PROJECT_DOCS: {
				get: async (key) => {
					if (key === "missing")
						throw new Error("Storage temporarily unavailable");
					return { size: 1, body: new ReadableStream() };
				},
			},
		});
		expect(result.outcomes).toEqual([
			{ id: "missing", status: "pending" },
			{ id: "unsupported", status: "unsupported" },
		]);
	});
});
