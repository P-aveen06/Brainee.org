import { describe, expect, it } from "vitest";
import { normalizeToolArguments } from "./tool-arguments";

describe("provider optional arguments", () => {
	it("does not turn a project lookup into an empty status filter", () => {
		const normalized = normalizeToolArguments(
			{ query: "Delivery Automation", status: "" },
			{ properties: { query: {}, status: {} } },
		);
		const projects = [{ name: "Delivery Automation", status: "active" }];
		expect(
			projects.filter(
				(p) =>
					normalized.status === undefined || p.status === normalized.status,
			),
		).toHaveLength(1);
		expect(normalized).toEqual({ query: "Delivery Automation" });
	});
	it("preserves invalid required input for validation and real zero/false", () => {
		expect(
			normalizeToolArguments(
				{ title: "", taskId: " ", limit: 0, onlyDecisions: false },
				{ required: ["title"] },
			),
		).toEqual({ title: "", limit: 0, onlyDecisions: false });
	});
});
