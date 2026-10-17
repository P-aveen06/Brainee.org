import { env } from "cloudflare:workers";
import {
	getRequestHeader,
	getRequestUrl,
	setResponseHeader,
} from "@tanstack/start-server-core/request-response";

const SESSION_COOKIE_NAME = "brainee_session";
const DEFAULT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60;
export const TEST_AUTH_USER_ID = "test-sample-user";

export interface SessionPayload {
	authUserId: string;
	email: string;
	emailVerified?: boolean;
	firstName?: string | null;
	lastName?: string | null;
	profilePictureUrl?: string | null;
	expiresAt: number;
}

export function getEnvVar(key: string): string | undefined {
	try {
		if (typeof env !== "undefined") {
			const envRecord = env as unknown as Record<string, string>;
			if (envRecord[key]) return envRecord[key];
		}
	} catch {}
	if (typeof process !== "undefined" && process.env?.[key]) {
		return process.env[key];
	}
	return undefined;
}

/** Required config must be provided explicitly; never fall back to a value baked into the bundle. */
function requireEnvVar(key: string): string {
	const value = getEnvVar(key);
	if (!value) {
		throw new Error(
			`Missing required environment variable: ${key}. Refusing to fall back to an insecure default.`,
		);
	}
	return value;
}

export function isTestAuthEnabled(): boolean {
	return getEnvVar("TEST_AUTH_ENABLED") === "true";
}

function getCookiePassword(): string {
	const secret = requireEnvVar("SESSION_SECRET");
	if (secret.length < 32) {
		throw new Error(
			"SESSION_SECRET must be at least 32 characters to safely sign sessions.",
		);
	}
	return secret;
}

function securePart(): string {
	return getRequestUrl().protocol === "https:" ? " Secure;" : "";
}

/**
 * Web Crypto HMAC signature for Worker-native tamper-proof session cookies
 */
async function getCryptoKey(secret: string): Promise<CryptoKey> {
	const enc = new TextEncoder();
	return await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

function arrayBufferToBase64(buffer: ArrayBufferLike): string {
	const bytes = new Uint8Array(buffer as ArrayBuffer);
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function base64ToArrayBuffer(base64url: string): ArrayBuffer {
	let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
	while (base64.length % 4) {
		base64 += "=";
	}
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

export async function sealSession(payload: SessionPayload): Promise<string> {
	const secret = getCookiePassword();
	const key = await getCryptoKey(secret);
	const jsonStr = JSON.stringify(payload);
	const jsonBase64 = arrayBufferToBase64(
		new TextEncoder().encode(jsonStr).buffer as ArrayBuffer,
	);
	const sigBuffer = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(jsonBase64),
	);
	const sigBase64 = arrayBufferToBase64(sigBuffer);
	return `${jsonBase64}.${sigBase64}`;
}

export async function unsealSession(
	sealedValue: string,
): Promise<SessionPayload | null> {
	try {
		const parts = sealedValue.split(".");
		if (parts.length !== 2) return null;
		const [jsonBase64, sigBase64] = parts;
		const secret = getCookiePassword();
		const key = await getCryptoKey(secret);

		const sigBuffer = base64ToArrayBuffer(sigBase64);
		const isValid = await crypto.subtle.verify(
			"HMAC",
			key,
			sigBuffer,
			new TextEncoder().encode(jsonBase64),
		);
		if (!isValid) return null;

		const jsonBuffer = base64ToArrayBuffer(jsonBase64);
		const jsonStr = new TextDecoder().decode(jsonBuffer);
		const payload = JSON.parse(jsonStr) as SessionPayload;

		if (
			typeof payload.authUserId !== "string" ||
			!payload.authUserId ||
			typeof payload.email !== "string" ||
			!payload.email ||
			!Number.isFinite(payload.expiresAt) ||
			Date.now() >= payload.expiresAt
		) {
			return null;
		}

		return payload;
	} catch {
		return null;
	}
}

export async function createSessionCookie(
	payload: Omit<SessionPayload, "expiresAt">,
): Promise<string> {
	const fullPayload: SessionPayload = {
		...payload,
		expiresAt: Date.now() + DEFAULT_EXPIRATION_SECONDS * 1000,
	};
	const sealed = await sealSession(fullPayload);
	return `${SESSION_COOKIE_NAME}=${sealed}; Path=/; HttpOnly;${securePart()} SameSite=Lax; Max-Age=${DEFAULT_EXPIRATION_SECONDS}`;
}

export function createLogoutCookie(): string {
	return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly;${securePart()} SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function setResponseCookieHeader(cookieValue: string) {
	setResponseHeader("Set-Cookie", cookieValue);
}

export function parseCookies(
	cookieHeader: string | null | undefined,
): Record<string, string> {
	if (!cookieHeader) return {};
	const cookies: Record<string, string> = {};
	const pairs = cookieHeader.split(";");
	for (const pair of pairs) {
		const [name, ...valParts] = pair.trim().split("=");
		if (name) {
			cookies[name] = decodeURIComponent(valParts.join("="));
		}
	}
	return cookies;
}

export async function getSessionFromRequest(): Promise<SessionPayload | null> {
	if (!isTestAuthEnabled()) return null;
	try {
		const cookieHeader = getRequestHeader("cookie");
		if (!cookieHeader) return null;
		const cookies = parseCookies(cookieHeader);
		const sessionCookie = cookies[SESSION_COOKIE_NAME];
		if (!sessionCookie) return null;
		return await unsealSession(sessionCookie);
	} catch {
		return null;
	}
}
