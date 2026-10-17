import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({
	cookie: "",
	url: "http://localhost:3000/sign-in",
	setResponseHeader: vi.fn(),
}));

vi.mock("@tanstack/start-server-core/request-response", () => ({
	getRequestHeader: () => request.cookie,
	getRequestUrl: () => new URL(request.url),
	setResponseHeader: request.setResponseHeader,
}));

import { demoPeople } from "../../shared/demo-startup";
import {
	createLogoutCookie,
	getSessionFromRequest,
	sealSession,
	TEST_AUTH_USER_ID,
	unsealSession,
} from "./auth.server";
import { signInAsDemoPerson } from "./demo-login.server";

const credentials = { email: "test@example.com" };
const session = () => ({
	authUserId: TEST_AUTH_USER_ID,
	email: credentials.email,
	expiresAt: Date.now() + 60_000,
});

describe("local startup role authentication", () => {
	beforeEach(() => {
		vi.stubEnv("TEST_AUTH_ENABLED", "true");
		vi.stubEnv(
			"SESSION_SECRET",
			"a-unique-session-signing-secret-for-tests-only",
		);
		vi.stubEnv("GRAPH_SERVICE_URL", "http://127.0.0.1:3100");
		vi.stubEnv("GRAPH_SERVICE_TOKEN", "local-graph-test-token");
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, options: RequestInit) => {
				const body = JSON.parse(String(options.body));
				const person = demoPeople.find(
					(entry) => entry.authId === body.subject,
				)!;
				return {
					ok: true,
					json: async () => ({
						data: { ...person, isActive: true, isOnboarded: true },
					}),
				};
			}),
		);
		request.cookie = "";
		request.url = "http://localhost:3000/sign-in";
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	});

	it("signs in the sample account with an HttpOnly cookie that resolves on later requests", async () => {
		expect(await signInAsDemoPerson("sample-admin")).toEqual({ success: true });
		const [header, cookie] = request.setResponseHeader.mock.calls[0];
		expect(header).toBe("Set-Cookie");
		expect(cookie).toContain("HttpOnly;");
		expect(cookie).toContain("SameSite=Lax;");
		expect(cookie).not.toContain("Secure;");
		request.cookie = cookie.split(";")[0];
		expect(await getSessionFromRequest()).toMatchObject({
			authUserId: TEST_AUTH_USER_ID,
			email: credentials.email,
		});
	});

	it.each(
		demoPeople,
	)("authenticates $name using their server-owned identity", async (person) => {
		expect(await signInAsDemoPerson(person.id)).toEqual({ success: true });
		request.cookie = request.setResponseHeader.mock.calls[0][1].split(";")[0];
		expect(await getSessionFromRequest()).toMatchObject({
			authUserId: person.authId,
			email: person.email,
		});
		const sealed = (await getSessionFromRequest()) as unknown as Record<
			string,
			unknown
		>;
		expect(sealed.role).toBeUndefined();
	});
	it.each([
		"admin",
		"unknown",
		"sample-admin;role=admin",
	])("rejects unknown person %s", async (id) => {
		expect(await signInAsDemoPerson(id)).toHaveProperty("error");
		expect(request.setResponseHeader).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalled();
	});
	it("refuses role selection on a nonlocal host", async () => {
		request.url = "https://example.com/sign-in";
		expect(await signInAsDemoPerson("sample-admin")).toHaveProperty("error");
		expect(request.setResponseHeader).not.toHaveBeenCalled();
	});
	it("rejects a missing or deactivated account without a session", async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
			json: async () => ({ error: "Missing" }),
		} as Response);
		expect(await signInAsDemoPerson("sample-anika")).toHaveProperty("error");
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ data: { ...demoPeople[0], isActive: false } }),
		} as Response);
		expect(await signInAsDemoPerson("sample-admin")).toHaveProperty("error");
		expect(request.setResponseHeader).not.toHaveBeenCalled();
	});

	it("disables both sign-in and existing sessions when test authentication is not enabled", async () => {
		request.cookie = `brainee_session=${await sealSession(session())}`;
		vi.stubEnv("TEST_AUTH_ENABLED", "");
		expect(await signInAsDemoPerson("sample-admin")).toHaveProperty("error");
		expect(await getSessionFromRequest()).toBeNull();
		expect(request.setResponseHeader).not.toHaveBeenCalled();
	});

	it("uses Secure cookies for HTTPS, including logout", async () => {
		request.url = "https://localhost:3000/sign-in";
		await signInAsDemoPerson("sample-admin");
		expect(request.setResponseHeader.mock.calls[0][1]).toContain(" Secure;");
		expect(createLogoutCookie()).toContain(" Secure;");
	});

	it("rejects forged, expired, malformed, and old provider sessions", async () => {
		const sealed = await sealSession(session());
		const [payload, signature] = sealed.split(".");
		expect(
			await unsealSession(
				`${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`,
			),
		).toBeNull();
		expect(
			await unsealSession(
				await sealSession({ ...session(), expiresAt: Date.now() - 1 }),
			),
		).toBeNull();
		expect(await unsealSession("not-a-session")).toBeNull();
		expect(
			await unsealSession(await sealSession({ ...session(), authUserId: "" })),
		).toBeNull();
		expect(
			await unsealSession(
				await sealSession({ ...session(), expiresAt: Number.NaN }),
			),
		).toBeNull();
	});

	it.each([
		"",
		"too-short",
	])("refuses to issue sessions with an invalid signing secret", async (secret) => {
		vi.stubEnv("SESSION_SECRET", secret);
		expect(await signInAsDemoPerson("sample-admin")).toHaveProperty("error");
		expect(request.setResponseHeader).not.toHaveBeenCalled();
	});

	it("clears the cookie on logout and treats the cleared cookie as signed out", async () => {
		const cookie = createLogoutCookie();
		expect(cookie).toContain("Max-Age=0");
		expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
		request.cookie = cookie.split(";")[0];
		expect(await getSessionFromRequest()).toBeNull();
	});
});
