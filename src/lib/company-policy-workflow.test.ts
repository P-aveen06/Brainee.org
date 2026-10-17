import { describe, expect, it } from "vitest";
import { byLabel } from "../../shared/graph/model";
import { recordValues } from "../../shared/graph/write-values";
import {
	assertCompanyPolicyAdmin,
	assertCompanyPolicyTransition,
	createPolicyDraftRevision,
	parsePolicyEffectiveDate,
} from "./company-policy-workflow";

describe("company policy review workflow", () => {
	it("defaults new records to Draft and increments revision versions", () => {
		const policyModel = byLabel.get("CompanyPolicyDocument");
		if (!policyModel) throw new Error("Company policy model is missing.");
		const values = recordValues(
			policyModel,
			{
				id: "policy",
				title: "Handbook",
				r2Key: "company-policies/policy",
				fileName: "handbook.pdf",
				mimeType: "application/pdf",
				sizeBytes: 10,
			},
			true,
		);
		expect(values.status).toBe("draft");
		expect(values.version).toBe(1);
		expect(createPolicyDraftRevision()).toEqual({
			status: "draft",
			version: 1,
		});
		expect(createPolicyDraftRevision(3)).toEqual({
			status: "draft",
			version: 4,
		});
	});

	it("allows only draft publication and draft or published archival", () => {
		expect(() =>
			assertCompanyPolicyTransition("draft", "published"),
		).not.toThrow();
		expect(() =>
			assertCompanyPolicyTransition("draft", "archived"),
		).not.toThrow();
		expect(() =>
			assertCompanyPolicyTransition("published", "archived"),
		).not.toThrow();
		expect(() =>
			assertCompanyPolicyTransition("published", "published"),
		).toThrow();
		expect(() =>
			assertCompanyPolicyTransition("archived", "published"),
		).toThrow();
		expect(() =>
			assertCompanyPolicyTransition("archived", "archived"),
		).toThrow();
	});

	it("requires an administrator and a valid effective date", () => {
		expect(() => assertCompanyPolicyAdmin("admin")).not.toThrow();
		expect(() => assertCompanyPolicyAdmin("employee")).toThrow();
		expect(parsePolicyEffectiveDate("2026-10-17").toISOString()).toBe(
			"2026-10-17T00:00:00.000Z",
		);
		expect(() => parsePolicyEffectiveDate("2026-02-30")).toThrow();
	});
});
