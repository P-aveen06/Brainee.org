import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	session: vi.fn(),
	config: vi.fn(),
	fetch: vi.fn(),
	request: vi.fn(),
}));
vi.mock("@tanstack/start-server-core", () => ({ getRequest: mocks.request }));
vi.mock("../lib/auth.server", () => ({
	getSessionFromRequest: mocks.session,
	getEnvVar: mocks.config,
}));

import { graphOperation } from "./transport.server";

beforeEach(() => {
	mocks.request.mockReturnValue(new Request("https://example.test"));
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetAllMocks();
});
describe("server graph transport", () => {
	it("uses the verified session identity and keeps the token server-side", async () => {
		mocks.config.mockImplementation((key: string) =>
			key === "GRAPH_SERVICE_URL" ? "http://127.0.0.1:3100" : "private-key",
		);
		mocks.session.mockResolvedValue({ authUserId: "signed-session-subject" });
		mocks.fetch.mockResolvedValue(Response.json({ data: [{ id: "record" }] }));
		vi.stubGlobal("fetch", mocks.fetch);
		expect(
			await graphOperation("data.execute", { subject: "client-value" }),
		).toEqual([{ id: "record" }]);
		const [url, request] = mocks.fetch.mock.calls[0];
		expect(url).toBe("http://127.0.0.1:3100/operations");
		expect(JSON.parse(request.body).subject).toBe("signed-session-subject");
		expect(request.headers.authorization).toBe("Bearer private-key");
	});
	it("refuses signed-out requests and never falls back to another database", async () => {
		mocks.config.mockReturnValue("configured");
		mocks.session.mockResolvedValue(null);
		vi.stubGlobal("fetch", mocks.fetch);
		await expect(graphOperation("data.execute", {})).rejects.toThrow("Sign in");
		expect(mocks.fetch).not.toHaveBeenCalled();
		mocks.config.mockReturnValue(undefined);
		await expect(graphOperation("data.execute", {})).rejects.toThrow(
			"FalkorDB is required",
		);
	});
});

describe("request-scoped graph reads", () => {
	beforeEach(() => {
		mocks.request.mockReturnValue(
			new Request("https://example.test/projects/one"),
		);
		mocks.config.mockImplementation((key: string) =>
			key === "GRAPH_SERVICE_URL" ? "http://127.0.0.1:3100" : "private-key",
		);
		mocks.session.mockResolvedValue({ authUserId: "one" });
		mocks.fetch.mockImplementation(async () =>
			Response.json({ data: [{ id: "record" }] }),
		);
		vi.stubGlobal("fetch", mocks.fetch);
	});
	it("shares concurrent and later identical reads within a request", async () => {
		const payload = { action: "read", model: "Project" };
		const results = await Promise.all(
			Array.from({ length: 8 }, () => graphOperation("data.execute", payload)),
		);
		(results[0] as { id: string }[])[0].id = "mutated";
		expect(await graphOperation("data.execute", payload)).toEqual([
			{ id: "record" },
		]);
		expect(mocks.fetch).toHaveBeenCalledTimes(1);
	});
	it("never shares data between requests or signed identities", async () => {
		await graphOperation("identity.resolve", {});
		mocks.session.mockResolvedValue({ authUserId: "two" });
		await graphOperation("identity.resolve", {});
		mocks.request.mockReturnValue(
			new Request("https://example.test/projects/one"),
		);
		await graphOperation("identity.resolve", {});
		expect(mocks.fetch).toHaveBeenCalledTimes(3);
	});
	it("does not cache mutations and invalidates earlier reads", async () => {
		await graphOperation("data.execute", { action: "read" });
		await graphOperation("data.execute", { action: "update" });
		await graphOperation("data.execute", { action: "update" });
		await graphOperation("data.execute", { action: "read" });
		expect(mocks.fetch).toHaveBeenCalledTimes(4);
	});
	it("retries failed reads rather than retaining rejected promises", async () => {
		mocks.fetch.mockResolvedValueOnce(
			Response.json({ error: "temporary failure" }, { status: 503 }),
		);
		await expect(graphOperation("identity.resolve", {})).rejects.toThrow(
			"temporary failure",
		);
		await expect(graphOperation("identity.resolve", {})).resolves.toEqual([
			{ id: "record" },
		]);
		expect(mocks.fetch).toHaveBeenCalledTimes(2);
	});
});
