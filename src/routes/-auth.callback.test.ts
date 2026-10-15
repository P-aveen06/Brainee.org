import { describe, expect, it } from "vitest";
import { handleAuthCallbackRequest } from "./auth.callback";

describe("retired OAuth callback", () => {
	it("discards old authorization parameters and returns to password sign-in without creating a session", () => {
		const response = handleAuthCallbackRequest({
			request: new Request(
				"http://localhost:3000/auth/callback?code=old-code&state=old-state",
			),
		});
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"http://localhost:3000/sign-in",
		);
		expect(response.headers.has("set-cookie")).toBe(false);
	});
});
