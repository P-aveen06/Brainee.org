import { describe, expect, it } from "vitest";
import {
	parseDeliveryInput,
	parseDeliveryResult,
} from "../../../shared/delivery-knowledge";
import { matchGroundedCitation } from "./citations";
import { getForcedToolForIntent } from "./intent-routing";
import { reconstructHistory } from "./turn-history";
import type { aiMessages } from "@/db/schema";

describe("company delivery knowledge contract", () => {
	it("rejects arbitrary identity, graph names and queries", () => {
		for (const field of ["actorId", "graph", "cypher", "subject"])
			expect(() =>
				parseDeliveryInput("delivery.search", {
					query: "SSO",
					[field]: "injected",
				}),
			).toThrow();
	});
	it("bounds retrieval and pagination", () => {
		expect(
			parseDeliveryInput("delivery.search", {
				query: "SSO",
				concepts: ["sign in"],
			}),
		).toMatchObject({ limit: 15, offset: 0 });
		expect(() =>
			parseDeliveryInput("delivery.passages", { documentId: "doc", limit: 21 }),
		).toThrow();
		expect(() =>
			parseDeliveryInput("delivery.context", {
				projectId: "OLD",
				section: "salaries",
			}),
		).toThrow();
	});
	it("requires scoped source citations", () => {
		expect(() => parseDeliveryResult({ sources: [] })).toThrow();
		expect(
			parseDeliveryResult({ scope: "company_delivery", sources: [] }).scope,
		).toBe("company_delivery");
	});
	it("matches the most specific source label", () => {
		expect(
			matchGroundedCitation("OLD #7", [
				{ id: "project", label: "OLD" },
				{ id: "task", label: "OLD #7" },
			]),
		).toBe("task");
	});
	it("routes reuse questions to delivery search", () => {
		expect(
			getForcedToolForIntent("Have we built similar functionality?", []),
		).toBe("search_delivery_knowledge");
	});
	it("replays company delivery while preserving ordinary project restrictions", () => {
		const row = {
			role: "tool",
			toolCallId: "call",
			content: JSON.stringify({
				scopeProjectId: "other",
				knowledgeScope: "company_delivery",
				result: { title: "SSO" },
			}),
		} as typeof aiMessages.$inferSelect;
		expect(reconstructHistory([row], () => false)[0].content).toContain("SSO");
		row.content = JSON.stringify({
			scopeProjectId: "other",
			result: { title: "restricted" },
		});
		expect(reconstructHistory([row], () => false)[0].content).toContain(
			"no longer accessible",
		);
	});
});
