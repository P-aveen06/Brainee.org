import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
	session: vi.fn(),
	config: vi.fn(),
	fetch: vi.fn(),
}));
vi.mock("../lib/auth.server", () => ({
	getSessionFromRequest: mocks.session,
	getEnvVar: mocks.config,
}));
import { graphOperation } from "./transport.server";
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
