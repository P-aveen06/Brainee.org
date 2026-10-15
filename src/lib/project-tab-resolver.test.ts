import { describe, expect, it } from "vitest";
import {
	CONSOLIDATED_PROJECT_TABS,
	resolveProjectTab,
} from "./project-tab-resolver";

describe("resolveProjectTab", () => {
	it("defaults to overview when tab is missing or empty", () => {
		expect(resolveProjectTab()).toBe("overview");
		expect(resolveProjectTab(null)).toBe("overview");
		expect(resolveProjectTab("")).toBe("overview");
		expect(resolveProjectTab("   ")).toBe("overview");
	});

	it("preserves direct consolidated tabs", () => {
		for (const tab of CONSOLIDATED_PROJECT_TABS) {
			expect(resolveProjectTab(tab)).toBe(tab);
		}
	});

	it("maps removed discussions tab to overview", () => {
		expect(resolveProjectTab("discussions")).toBe("overview");
	});

	it("maps daily-scoped sub-tabs to daily", () => {
		expect(resolveProjectTab("updates")).toBe("daily");
		expect(resolveProjectTab("eod")).toBe("daily");
		expect(resolveProjectTab("flags")).toBe("daily");
	});

	it("maps documents synonyms to documents", () => {
		expect(resolveProjectTab("documents")).toBe("documents");
		expect(resolveProjectTab("files")).toBe("documents");
	});

	it("maps overview-scoped legacy tabs to overview", () => {
		expect(resolveProjectTab("members")).toBe("overview");
		expect(resolveProjectTab("team")).toBe("overview");
		expect(resolveProjectTab("client")).toBe("overview");
		expect(resolveProjectTab("timeline")).toBe("overview");
	});

	it("gracefully falls back to overview on unknown input", () => {
		expect(resolveProjectTab("arbitrary_tab")).toBe("overview");
		expect(resolveProjectTab("12345")).toBe("overview");
	});
});
