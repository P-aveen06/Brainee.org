import { describe, expect, it } from "vitest";
import { getForcedToolForIntent } from "./intent-routing";

describe("getForcedToolForIntent", () => {
	it.each(["List my own leave and WFH request history", "Show pending leave requests", "What request needs leave approval?"])("does not treat a history or approval lookup as a mutation: %s", (query) => {
		expect(getForcedToolForIntent(query, [])).toBeUndefined();
	});
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
