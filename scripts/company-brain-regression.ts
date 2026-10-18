/** Read-only checks against the explicit local demo. Never accepts a remote URL. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { GraphDatabase } from "../shared/graph/query";
import { demoPeople } from "../shared/demo-startup";
import { localSecrets } from "./graph-setup";
import { listProjectsTool, getMyTasksTool, getProjectTool } from "../src/lib/ai/tools/project-query-tools";
import { getPortfolioEvidenceTool } from "../src/lib/ai/tools/portfolio-evidence-tool";
import { getMyLeaveRequestsTool } from "../src/lib/ai/tools/leave-tools";
import { getReportingStructureTool } from "../src/lib/ai/tools/reporting-structure-tool";
import { normalizeToolArguments } from "../src/lib/ai/tool-arguments";
import type { ToolContext } from "../src/lib/ai/tools/tool-types";
import { getForcedToolForIntent } from "../src/lib/ai/intent-routing";

const token = localSecrets().GRAPH_SERVICE_TOKEN;
const checks: Array<{ check: string; success: boolean }> = [];
const check = async (name: string, run: () => Promise<void>) => {
	try { await run(); checks.push({ check: name, success: true }); }
	catch (error) { checks.push({ check: name, success: false }); console.error(name, error instanceof Error ? error.message : "Failed"); }
};
for (const person of demoPeople.filter(person => person.persona !== "employee" || person.id === "sample-anika")) {
	const db = new GraphDatabase(async (operation, payload) => {
		assert.ok(["data.execute", "identity.resolve"].includes(operation));
		assert.equal((payload as { action?: string }).action, "read");
		const response = await fetch("http://127.0.0.1:3100/operations", {
			method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
			body: JSON.stringify({ operation, payload, subject: person.authId }), signal: AbortSignal.timeout(10000),
		});
		assert.ok(response.ok); const result = await response.json() as { data: unknown }; return result.data;
	});
	const ctx = { db, user: person } as unknown as ToolContext;
	const expected = person.persona === "ceo" || person.persona === "architect" ? 10 : person.persona === "hr" ? 0 : person.id === "sample-priya" ? 4 : person.persona === "lead" ? 3 : 2;
	await check(`${person.name}: empty optional filters retain ${expected} visible projects`, async () => {
		const result = await listProjectsTool.execute({ status: "", query: "" }, ctx);
		const projects = result.data as Array<{ id: string; code: string; name: string }>;
		assert.equal(projects.length, expected);
		for (const project of projects) {
			const found = await listProjectsTool.execute({ status: "", query: project.name }, ctx);
			assert.equal((found.data as unknown[]).length, 1);
			assert.equal((await getProjectTool.execute({ projectId: project.code }, ctx)).success, true);
		}
	});
	await check(`${person.name}: own assignments include assignee`, async () => {
		const result = await getMyTasksTool.execute(normalizeToolArguments({ status: "", priority: "", query: "" }, getMyTasksTool.parameters), ctx);
		for (const task of result.data as Array<{ assigneeName: string }>) assert.equal(task.assigneeName, person.name);
	});
	if (person.persona === "architect") {
		for (const section of ["tasks", "checklists", "documents", "decisions", "timeline"])
			await check(`Portfolio ${section}: all ten projects without dropped calls`, async () => {
				const result = await getPortfolioEvidenceTool.execute({ section, limit: 100 }, ctx);
				assert.equal(result.success, true);
				const data = result.data as { projects: unknown[]; complete: boolean; items: unknown[] };
				assert.equal(data.projects.length, 10); assert.equal(data.complete, true);
				if (section !== "documents") assert.ok(data.items.length >= 10);
			});
	}
	if (person.id === "sample-anika") await check("Anika: own approved leave survives blank status", async () => {
		const result = await getMyLeaveRequestsTool.execute({ status: "" }, ctx);
		const data = result.data as { leaves: Array<{ status: string; startDate: string }> };
		assert.ok(data.leaves.some(leave => leave.status === "approved" && leave.startDate === "2026-10-19"));
	});
	if (person.persona === "hr") await check("Aditi reporting structure includes all five roles", async () => {
		const result = await getReportingStructureTool.execute({ managerName: "Aditi Deshmukh" }, ctx);
		assert.equal((result.data as { directReportCount: number }).directReportCount, 5);
	});
}
await check("Leave history is a read-only intent", async () => {
	assert.equal(getForcedToolForIntent("List my own leave and WFH request history", []), undefined);
});
const output = { date: new Date().toISOString(), environment: "local_demo_read_only", checks,
	passed: checks.filter(check => check.success).length, total: checks.length };
writeFileSync("docs/reports/company-brain-regressions-2026-10-18.json", JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({ passed: output.passed, total: output.total }));
if (output.passed !== output.total) process.exitCode = 1;
