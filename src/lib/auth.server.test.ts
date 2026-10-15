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

import {
	createLogoutCookie,
	getSessionFromRequest,
	sealSession,
	signInWithPassword,
	TEST_AUTH_USER_ID,
	unsealSession,
} from "./auth.server";

const credentials = { email: "test@example.com", password: "TestLogin123!" };
const session = () => ({
	authUserId: TEST_AUTH_USER_ID,
	email: credentials.email,
	expiresAt: Date.now() + 60_000,
});

describe("temporary password authentication", () => {
	beforeEach(() => {
		vi.stubEnv("TEST_AUTH_ENABLED", "true");
		vi.stubEnv(
			"SESSION_SECRET",
			"a-unique-session-signing-secret-for-tests-only",
		);
		request.cookie = "";
		request.url = "http://localhost:3000/sign-in";
		vi.clearAllMocks();
	});

	afterEach(() => vi.unstubAllEnvs());

	it("signs in the sample account with an HttpOnly cookie that resolves on later requests", async () => {
		expect(await signInWithPassword(credentials)).toEqual({ success: true });
		const [header, cookie] = request.setResponseHeader.mock.calls[0];
		expect(header).toBe("Set-Cookie");
		expect(cookie).toContain("HttpOnly;");
		expect(cookie).toContain("SameSite=Lax;");
		expect(cookie).not.toContain("Secure;");
		expect(cookie).not.toContain(credentials.password);
		request.cookie = cookie.split(";")[0];
		expect(await getSessionFromRequest()).toMatchObject({
			authUserId: TEST_AUTH_USER_ID,
			email: credentials.email,
		});
	});

	it("normalizes email casing and whitespace", async () => {
		expect(
			await signInWithPassword({ ...credentials, email: " TEST@EXAMPLE.COM " }),
		).toEqual({ success: true });
	});

	it.each([
		{ ...credentials, password: "wrong-password" },
		{ ...credentials, password: `${credentials.password} ` },
		{ ...credentials, email: "other@example.com" },
	])("rejects incorrect credentials without issuing a cookie", async (input) => {
		expect(await signInWithPassword(input)).toEqual({
			error: "Invalid email or password.",
		});
		expect(request.setResponseHeader).not.toHaveBeenCalled();
	});

	it("disables both sign-in and existing sessions when test authentication is not enabled", async () => {
		request.cookie = `brainee_session=${await sealSession(session())}`;
		vi.stubEnv("TEST_AUTH_ENABLED", "");
		expect(await signInWithPassword(credentials)).toHaveProperty("error");
		expect(await getSessionFromRequest()).toBeNull();
		expect(request.setResponseHeader).not.toHaveBeenCalled();
	});

	it("uses Secure cookies for HTTPS, including logout", async () => {
		request.url = "https://example.com/sign-in";
		await signInWithPassword(credentials);
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
		await expect(signInWithPassword(credentials)).rejects.toThrow();
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
