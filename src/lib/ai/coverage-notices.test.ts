import { describe, expect, it } from "vitest";
import { coverageNotices } from "./coverage-notices";
describe("visible evidence coverage", () => {
	it("distinguishes an empty corpus from complete indexing", () => {
		expect(
			coverageNotices({ documentCoverage: { currentDocuments: 0 } })[0],
		).toContain("no project documents");
		expect(
			coverageNotices({
				documentCoverage: { currentDocuments: 2, indexedDocuments: 2 },
			}),
		).toEqual([]);
	});
	it("discloses partial indexing and degraded semantics", () => {
		expect(
			coverageNotices({
				documentCoverage: { currentDocuments: 5, indexedDocuments: 2 },
				retrievalCoverage: { semantic: { state: "indexing" } },
			}),
		).toHaveLength(2);
	});
});
