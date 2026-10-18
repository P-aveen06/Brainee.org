import { describe, expect, it } from "vitest";
import {
	getAssistantToolStep,
	isAssistantToolProgress,
} from "./assistant-activity";

describe("assistant tool activity", () => {
	it("maps internal tool names to user-facing categories", () => {
		expect(getAssistantToolStep("get_project_documents")).toBe("projects");
		expect(getAssistantToolStep("get_team_availability")).toBe("requests");
		expect(getAssistantToolStep("search_pitch_references")).toBe("research");
		expect(getAssistantToolStep("present_pitch_package")).toBe("pitch");
	});

	it("accepts only allow-listed progress categories and states", () => {
		expect(
			isAssistantToolProgress({ step: "projects", status: "running" }),
		).toBe(true);
		expect(
			isAssistantToolProgress({ step: "projects", status: "failed" }),
		).toBe(true);
		expect(
			isAssistantToolProgress({
				step: "get_project_documents",
				status: "running",
			}),
		).toBe(false);
		expect(
			isAssistantToolProgress({
				step: "projects",
				status: "executing command",
			}),
		).toBe(false);
	});
});
