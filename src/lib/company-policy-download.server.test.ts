import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	currentUser: vi.fn(),
	select: vi.fn(),
	limit: vi.fn(),
	get: vi.fn(),
}));
vi.mock("cloudflare:workers", () => ({
	env: { DATABASE: {}, PROJECT_DOCS: { get: mocks.get } },
}));
vi.mock("./current-user.server", () => ({
	getCurrentUserWithState: mocks.currentUser,
}));
vi.mock("@/db", () => ({ createDb: () => ({ select: mocks.select }) }));

import { downloadCompanyPolicyDocument } from "./company-policy-download.server";

describe("private company policy downloads", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mocks.select.mockReturnValue({
			from: () => ({ where: () => ({ limit: mocks.limit }) }),
		});
	});
	it("rejects signed-out users without looking up a document", async () => {
		mocks.currentUser.mockResolvedValue({ user: null });
		expect((await downloadCompanyPolicyDocument("doc-1")).status).toBe(401);
		expect(mocks.select).not.toHaveBeenCalled();
		expect(mocks.get).not.toHaveBeenCalled();
	});
	it.each([
		"user",
		"lead",
		"hr",
	])("rejects %s access before database or storage reads", async (role) => {
		mocks.currentUser.mockResolvedValue({ user: { role } });
		expect((await downloadCompanyPolicyDocument("doc-1")).status).toBe(403);
		expect(mocks.select).not.toHaveBeenCalled();
		expect(mocks.get).not.toHaveBeenCalled();
	});
	it("returns 404 for missing records and missing stored files", async () => {
		mocks.currentUser.mockResolvedValue({ user: { role: "admin" } });
		mocks.limit.mockResolvedValue([]);
		expect((await downloadCompanyPolicyDocument("missing")).status).toBe(404);
		mocks.limit.mockResolvedValue([{ r2Key: "company-policies/doc-1" }]);
		mocks.get.mockResolvedValue(null);
		expect((await downloadCompanyPolicyDocument("doc-1")).status).toBe(404);
	});
	it("streams the file to admins as an uncached attachment", async () => {
		mocks.currentUser.mockResolvedValue({ user: { role: "admin" } });
		mocks.limit.mockResolvedValue([
			{
				r2Key: "company-policies/doc-1",
				fileName: "Company's policy 日本語.txt",
				mimeType: "text/plain",
			},
		]);
		mocks.get.mockResolvedValue({ body: "policy contents", size: 15 });
		const response = await downloadCompanyPolicyDocument("doc-1");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("policy contents");
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(response.headers.get("Content-Disposition")).toContain(
			"Company%27s%20policy%20",
		);
		expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
	});
});
