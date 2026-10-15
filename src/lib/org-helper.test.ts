import { describe, expect, it } from "vitest";
import { buildOrgTree } from "./org-helper";

const baseUser = {
	email: "person@example.com",
	role: "user",
	avatarUrl: null,
	peerLeadId: null,
	standardHours: 8,
};

describe("buildOrgTree", () => {
	it("nests direct reports under their peer lead", () => {
		const tree = buildOrgTree([
			{ ...baseUser, id: "lead", name: "Lead", role: "lead" },
			{ ...baseUser, id: "report", name: "Report", peerLeadId: "lead" },
		]);

		expect(tree).toHaveLength(1);
		expect(tree[0].id).toBe("lead");
		expect(tree[0].children.map((child) => child.id)).toEqual(["report"]);
	});

	it("keeps users visible when existing reporting data contains a cycle", () => {
		const tree = buildOrgTree([
			{ ...baseUser, id: "a", name: "A", peerLeadId: "b" },
			{ ...baseUser, id: "b", name: "B", peerLeadId: "a" },
		]);

		expect(tree.map((node) => node.id).sort()).toEqual(["a", "b"]);
	});
});
