import { describe, expect, it } from "vitest";
import {
	type CitationRef,
	matchGroundedCitation,
	sanitizeModelOutputText,
	validateCitations,
} from "./citations";

describe("validateCitations", () => {
	const rawText =
		"Task [PRJ-001 #12] is overdue and Document [Security SOW] is approved.";
	const claimed: CitationRef[] = [
		{ id: "tsk-1", type: "task", label: "PRJ-001 #12" },
		{ id: "doc-1", type: "document", label: "Security SOW" },
	];

	it("keeps citations that exist in grounded tool record IDs", () => {
		const grounded = new Set(["tsk-1", "doc-1"]);
		const res = validateCitations(rawText, claimed, grounded);

		expect(res.isFullyGrounded).toBe(true);
		expect(res.verifiedCitations).toHaveLength(2);
		expect(res.unverifiedCitations).toHaveLength(0);
		expect(res.sanitizedText).toBe(rawText);
	});

	it("strips brackets from unverified citations and marks output as not fully grounded", () => {
		const grounded = new Set(["tsk-1"]); // doc-1 is missing/hallucinated
		const res = validateCitations(rawText, claimed, grounded);

		expect(res.isFullyGrounded).toBe(false);
		expect(res.verifiedCitations.map((c) => c.id)).toEqual(["tsk-1"]);
		expect(res.unverifiedCitations.map((c) => c.id)).toEqual(["doc-1"]);
		expect(res.sanitizedText).toContain("[PRJ-001 #12]");
		expect(res.sanitizedText).not.toContain("[Security SOW]");
		expect(res.sanitizedText).toContain("Security SOW");
	});
});

describe("matchGroundedCitation", () => {
	const grounded = [
		{ id: "tsk-1", label: "#12" },
		{ id: "tsk-1", label: "Auth callback route" },
		{ id: "prj-1", label: "PRJ-001" },
		{ id: "prj-1", label: "Apollo Core" },
	];

	it("matches a claimed citation whose text contains a grounded label", () => {
		expect(matchGroundedCitation("PRJ-001 #12", grounded)).toBe("tsk-1");
		expect(matchGroundedCitation("Apollo Core", grounded)).toBe("prj-1");
	});

	it("does not match a citation with no corresponding grounded label", () => {
		expect(
			matchGroundedCitation("A Project That Does Not Exist", grounded),
		).toBeNull();
	});

	it("never falls back to a positional guess", () => {
		// Even though grounded[] is non-empty, an unrelated label must not match.
		expect(
			matchGroundedCitation("Totally Fabricated Task #999", grounded),
		).toBeNull();
	});
});

describe("sanitizeModelOutputText", () => {
	it("replaces raw R2 storage URLs with safe placeholder", () => {
		const text =
			"Download here: https://pub-abc.r2.cloudflarestorage.com/project-docs/secret.pdf";
		const clean = sanitizeModelOutputText(text);
		expect(clean).not.toContain("r2.cloudflarestorage.com");
		expect(clean).toContain("[Document Attachment]");
	});

	it("replaces local system path leaks", () => {
		const text = "Loaded from /Users/charan/Brainee.org Workspace/file.txt";
		const clean = sanitizeModelOutputText(text);
		expect(clean).not.toContain("/Users/charan");
		expect(clean).toContain("[File]");
	});
});
