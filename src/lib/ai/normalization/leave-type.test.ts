import { describe, expect, it } from "vitest";
import { resolveLeaveType } from "./leave-type";

const types = [
	{ slug: "personal-leave", name: "Personal Leave" },
	{ slug: "sick-leave", name: "Sick Leave" },
	{ slug: "festival-leave", name: "Festival Leave" },
];

describe("resolveLeaveType", () => {
	it("matches a natural partial name", () => {
		expect(resolveLeaveType("sick", types)?.slug).toBe("sick-leave");
	});

	it("matches configured synonyms", () => {
		expect(resolveLeaveType("medical", types)?.slug).toBe("sick-leave");
		expect(resolveLeaveType("casual", types)?.slug).toBe("personal-leave");
	});

	it("does not invent an unknown leave type", () => {
		expect(resolveLeaveType("parental", types)).toBeNull();
	});
});
