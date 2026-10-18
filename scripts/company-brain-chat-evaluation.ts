/** Local demo evaluation of the real assistant turn loop; never confirms proposals.
 * Bun supplies Worker environment/transport adapters, not fake tools or model answers.
 * HTTP auth, rate-limit middleware and browser rendering are outside this harness.
 */
import { mock } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { GraphDatabase } from "../shared/graph/query";
import { demoPeople } from "../shared/demo-startup";
import { localSecrets } from "./graph-setup";
import type { ToolContext } from "../src/lib/ai/tools/tool-types";

const values = Object.fromEntries(readFileSync(".dev.vars", "utf8").split("\n").flatMap(line => {
	const match = line.match(/^([A-Z_]+)=(.*)$/);
	return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, "")]] : [];
}));
if (!values.OPENCODE_API_KEY) throw new Error("A configured real chat provider is required.");
const token = localSecrets().GRAPH_SERVICE_TOKEN;
const subjects = new AsyncLocalStorage<string>();
const graphOperation = async (operation: string, payload: unknown) => {
	const response = await fetch("http://127.0.0.1:3100/operations", {
		method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
		body: JSON.stringify({ operation, payload, subject: subjects.getStore() }),
		signal: AbortSignal.timeout(12000),
	});
	const result = await response.json() as { data?: unknown; error?: string };
	if (!response.ok || result.error) throw new Error(result.error ?? "Local graph unavailable.");
	return result.data;
};
mock.module("cloudflare:workers", () => ({ env: { ...values, GRAPH_SERVICE_URL: "http://127.0.0.1:3100", GRAPH_SERVICE_TOKEN: token } }));
mock.module("../src/db/transport.server", () => ({ graphOperation }));
const { runAssistantTurn } = await import("../src/lib/ai/assistant-turn");
const { aiConversations, aiMessages, aiToolInvocations } = await import("../src/db/schema");
const { eq } = await import("../src/db/graph-query");
const corpus = JSON.parse(readFileSync("docs/reports/company-brain-evaluation-corpus.json", "utf8")) as {
	cases: Array<{ id: string; role: string; question: string }>;
};
const output = "docs/reports/company-brain-chat-rerun-2026-10-18.jsonl";
const completed = existsSync(output) ? readFileSync(output, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line)) : [];
const done = new Set(completed.map(row => row.id));
const limit = Number(process.env.EVALUATION_LIMIT ?? 100);
const casePerson = (item: typeof corpus.cases[number]) => {
	if (item.role === "CEO") return "sample-admin";
	if (item.role === "HR") return "sample-arjun";
	if (item.role === "Solution Architect") return "sample-dev";
	if (item.role === "Employee") return "sample-anika";
	const ordinal = Number(item.id.split("-").at(-1));
	return ordinal <= 8 ? "sample-maya" : ordinal <= 14 ? "sample-vikram" : "sample-priya";
};
const selected = corpus.cases.filter(item => !done.has(item.id)).slice(0, limit);
const people = [...new Set(selected.map(casePerson))];
// Two role sessions at a time. Each person's questions retain conversational context.
let next = 0;
async function worker() {
	while (next < people.length) {
		const person = demoPeople.find(person => person.id === people[next++]);
		if (!person) throw new Error("Unknown evaluation persona.");
		await subjects.run(person.authId, async () => {
			const db = new GraphDatabase(graphOperation);
			const previous = completed.find(row => row.employeeId === person.id);
			const conversationId = previous?.conversationId ?? `cnv-eval-${Date.now()}-${person.id}`;
			if (!previous) await db.insert(aiConversations).values({ id: conversationId, userId: person.id, title: "Company Brain retained evaluation" });
			const ctx = { db, user: person } as unknown as ToolContext;
			for (const item of selected.filter(item => casePerson(item) === person.id)) {
				const started = new Date().toISOString();
				let answer: unknown, error: string | undefined;
				try { answer = await runAssistantTurn({ conversationId, userMessage: item.question }, ctx); }
				catch (caught) { error = caught instanceof Error ? caught.message : "Turn failed"; }
				const messages = await db.select().from(aiMessages).where(eq(aiMessages.conversationId, conversationId));
				const turnId = messages.filter(row => row.role === "user" && row.content === item.question).at(-1)?.turnId;
				const evidence = messages.filter(row => row.turnId === turnId);
				const audit = turnId ? await db.select().from(aiToolInvocations).where(eq(aiToolInvocations.turnId, turnId)) : [];
				appendFileSync(output, JSON.stringify({ ...item, employeeId: person.id, conversationId, started,
					finished: new Date().toISOString(), answer, error, evidence, audit,
					qualityScore: null, scoringNote: "Awaiting evidence-based rubric review; completed is not passed." }) + "\n");
				console.log(JSON.stringify({ id: item.id, completed: !error, tools: audit.length }));
			}
		});
	}
}
await Promise.all([worker(), worker()]);
writeFileSync("/tmp/brainee-chat-evaluation-status.json", JSON.stringify({ retained: done.size + selected.length, output }));
