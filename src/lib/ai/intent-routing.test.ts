import { describe, expect, it } from "vitest";
import { getForcedToolForIntent } from "./intent-routing";

describe("getForcedToolForIntent", () => {
	it("forces a leave proposal for a direct application", () => {
		expect(getForcedToolForIntent("apply for sick leave tomorrow", [])).toBe(
			"propose_leave_request",
		);
	});

	it("resolves cancel it from recent leave context", () => {
		expect(
			getForcedToolForIntent("cancel it", [
				{ role: "assistant", content: "A sick leave request was drafted." },
			]),
		).toBe("propose_leave_cancellation");
	});

	it("does not force an unrelated cancellation", () => {
		expect(getForcedToolForIntent("cancel it", [])).toBeUndefined();
	});
});
