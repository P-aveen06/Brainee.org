import { describe, expect, it } from "vitest";
import {
	POLICY_MAX_FILE_SIZE,
	parsePolicyUpload,
	validatePolicyFile,
} from "./company-policy-documents";

describe("company policy uploads", () => {
	it.each([
		["policy.PDF", "application/pdf"],
		["policy.doc", "application/msword"],
		[
			"policy.docx",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		],
		["policy.txt", "text/plain"],
	])("accepts supported document %s", (name, type) => {
		expect(validatePolicyFile(new File(["policy"], name, { type }))).toBe(type);
	});
	it("handles browsers that omit the MIME type", () => {
		expect(validatePolicyFile(new File(["policy"], "policy.pdf"))).toBe(
			"application/pdf",
		);
	});
	it("accepts MIME charset parameters added during multipart upload", () => {
		expect(
			validatePolicyFile(
				new File(["policy"], "policy.txt", {
					type: "text/plain;charset=utf-8",
				}),
			),
		).toBe("text/plain");
	});
	it("rejects extensions inherited from Object.prototype", () => {
		expect(() =>
			validatePolicyFile(new File(["policy"], "policy.constructor")),
		).toThrow("PDF, DOC, DOCX, or TXT");
	});
	it("rejects empty, unsupported, and mismatched files", () => {
		expect(() => validatePolicyFile(new File([], "policy.pdf"))).toThrow(
			"non-empty",
		);
		expect(() =>
			validatePolicyFile(
				new File(["<script>"], "policy.html", { type: "text/html" }),
			),
		).toThrow("PDF, DOC, DOCX, or TXT");
		expect(() =>
			validatePolicyFile(
				new File(["<svg>"], "policy.pdf", { type: "image/svg+xml" }),
			),
		).toThrow("PDF, DOC, DOCX, or TXT");
	});
	it("enforces the upload size limit", () => {
		const file = new File(
			[new Uint8Array(POLICY_MAX_FILE_SIZE + 1)],
			"policy.pdf",
			{ type: "application/pdf" },
		);
		expect(() => validatePolicyFile(file)).toThrow("25 MB");
	});
	it("trims metadata and rejects blank titles and missing files", () => {
		const data = new FormData();
		data.set(
			"file",
			new File(["policy"], "policy.txt", { type: "text/plain" }),
		);
		data.set("title", "  Employee handbook  ");
		data.set("description", "  Company guidelines  ");
		expect(parsePolicyUpload(data)).toMatchObject({
			title: "Employee handbook",
			description: "Company guidelines",
			mimeType: "text/plain",
		});
		data.set("title", "  ");
		expect(() => parsePolicyUpload(data)).toThrow("Title is required");
		data.delete("file");
		expect(() => parsePolicyUpload(data)).toThrow("A document is required");
	});
});
