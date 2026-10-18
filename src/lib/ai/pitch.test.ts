import { describe, expect, it } from "vitest";
import {
	collectPitchEvidence,
	publicPitchSource,
	restorePitchState,
} from "./pitch-evidence";
import { pitchHtml } from "./pitch-html";
import { pitchFixture } from "./pitch-test-fixture";
import { createPitch, parsePitch } from "./pitch-types";
import { presentPitchPackageTool } from "./tools/pitch-tools";

describe("pitch packages", () => {
	it("keeps two representations tied to retrieved sources and saves successive revisions", () => {
		const { input, state, pitch } = pitchFixture();
		state.drafts.push(pitch);
		const revision = createPitch(
			{ ...input, draftId: pitch.draftId, title: "Revised pitch" },
			state,
		);
		expect(revision.revision).toBe(2);
		expect(revision.draftId).toBe(pitch.draftId);
		expect(revision.sections[0].slide).not.toBe(revision.sections[0].document);
		expect(revision.sources[0].excerpt).toContain("in_review");
	});
	it("rejects invented evidence and foreign draft IDs", () => {
		const { input, state } = pitchFixture();
		expect(() =>
			createPitch(
				{
					...input,
					sections: [{ ...input.sections[0], sourceIds: ["invented"] }],
				},
				state,
			),
		).toThrow(/Retrieve supporting evidence/);
		expect(() =>
			createPitch({ ...input, draftId: "other-conversation" }, state),
		).toThrow(/Reopen/);
	});
	it("does not accept public research as company delivery evidence", () => {
		const { input, state } = pitchFixture();
		const web = publicPitchSource(
			"https://www.assistant-ui.com/components",
			"UI patterns",
			"Public guidance",
		);
		state.evidence.set(web.id, web);
		expect(() =>
			createPitch(
				{ ...input, sections: [{ ...input.sections[0], sourceIds: [web.id] }] },
				state,
			),
		).toThrow(/workspace evidence/);
	});
	it("excludes HR tools from pitch evidence", () => {
		const { state } = pitchFixture();
		collectPitchEvidence(
			state,
			"get_my_leave_requests",
			[{ id: "leave-1", body: "Private reason" }],
			[{ id: "leave-1", label: "Leave" }],
			["project-1"],
		);
		expect(state.evidence.has("leave-1")).toBe(false);
	});
	it("restores drafts only while their project sources are still accessible", () => {
		const { pitch } = pitchFixture();
		const rows = [
			{ role: "tool", content: JSON.stringify({ result: { pitch } }) },
		];
		expect(restorePitchState(rows, () => true).drafts).toHaveLength(1);
		expect(restorePitchState(rows, () => false).drafts).toHaveLength(0);
		const badScope = { ...pitch, scopeProjectIds: [] };
		expect(
			restorePitchState(
				[
					{
						role: "tool",
						content: JSON.stringify({ result: { pitch: badScope } }),
					},
				],
				() => false,
			).drafts,
		).toHaveLength(0);
	});
	it("rejects duplicate sections and missing persisted references", () => {
		const { input, state, pitch } = pitchFixture();
		expect(() =>
			createPitch(
				{ ...input, sections: [input.sections[0], input.sections[0]] },
				state,
			),
		).toThrow(/unique/);
		expect(parsePitch({ ...pitch, sources: [] })).toBeUndefined();
	});
	it("renders model content as inert text in preview and PDF templates", () => {
		const { pitch } = pitchFixture();
		pitch.sections[0].slide =
			'<script>fetch("https://attacker.invalid")</script>';
		const html = pitchHtml(pitch, "presentation");
		expect(html).not.toContain("<script>");
		expect(html).toContain("&lt;script&gt;");
		expect(pitchHtml(pitch, "document")).toContain("currently in review");
	});
	it("omits invented draft IDs on fresh pitch state and creates a package", async () => {
		const { input, state } = pitchFixture();
		const result = await presentPitchPackageTool.execute(
			{ ...input, draftId: "pitch-20261018-invented" },
			{ pitchState: state, user: {} as never, db: {} as never },
		);
		expect(result.success).toBe(true);
		expect(state.drafts).toHaveLength(1);
		expect(state.drafts[0].draftId).not.toBe("pitch-20261018-invented");
		expect(state.drafts[0].revision).toBe(1);
	});
	it("rejects foreign draft IDs when revising across conversations", async () => {
		const { input, state, pitch } = pitchFixture();
		state.drafts.push(pitch);
		await expect(
			presentPitchPackageTool.execute(
				{ ...input, draftId: "other-conversation" },
				{ pitchState: state, user: {} as never, db: {} as never },
			),
		).rejects.toThrow(/Reopen/);
	});
});
