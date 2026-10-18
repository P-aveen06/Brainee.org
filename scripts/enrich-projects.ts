// Explicit local-only content update. Run graph:backup before invoking this command.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Miniflare } from "miniflare";
import { eq } from "../shared/graph/expressions";
import { GraphDatabase } from "../shared/graph/query";
import { sampleProjects } from "../services/graph/src/sample-catalog";
import { defineNode } from "../shared/graph/model";
import { localSecrets } from "./graph-setup";
import { buildProjectContent } from "./project-content/build";

const secrets = localSecrets();
const db = new GraphDatabase(async (operation, payload) => {
	const response = await fetch("http://127.0.0.1:3100/operations", {
		method: "POST", headers: { authorization: `Bearer ${secrets.GRAPH_SERVICE_TOKEN}`, "content-type": "application/json" },
		body: JSON.stringify({ operation, payload, subject: "test-sample-user" }), signal: AbortSignal.timeout(12000),
	});
	const result = await response.json() as { data?: unknown; error?: string };
	if (!response.ok || result.error) throw new Error(result.error ?? "Local graph operation failed.");
	return result.data;
});
const node = (label: string) => defineNode<Record<string, unknown>>(label);
async function addSample(_db: GraphDatabase, label: string, values: Record<string, unknown>) {
	const model = node(label);
	await db.insert(model).values(values).onConflictDoNothing({ target: model.id });
}
// Miniflare provides only local R2. No deployed Worker or remote R2 is contacted.
const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('local'); } }", r2Buckets: { PROJECT_DOCS: "brainee-org-docs" }, r2Persist: resolve(".wrangler/state/v3/r2") });
try {
	const employee = node("Employee");
	const admins = await db.select().from(employee).where(eq(employee.authId, "test-sample-user"));
	if (admins.length !== 1 || admins[0].role !== "admin" || admins[0].isActive !== true) throw new Error("Seed the local startup fixture before enriching it.");
	const actor = { id: admins[0].id };
	const bucket = await mf.getR2Bucket("PROJECT_DOCS");
	const report = [];
	for (const [p, project] of sampleProjects.entries()) {
		const content = buildProjectContent(project, p);
		const projectModel = node("Project");
		const taskModel = node("Task");
		const [stored] = await db.select().from(projectModel).where(eq(projectModel.id, project.id));
		if (!stored || stored.name !== project.name) throw new Error(`Expected demo project missing or renamed: ${project.id}`);
		// Only replace fixture boilerplate. Subsequent runs preserve authored edits.
		if (stored.description === project.outcome)
			await db.update(projectModel).set({ description: content.description, updatedAt: new Date() }).where(eq(projectModel.id, project.id));
		const existing = await db.select().from(taskModel).where(eq(taskModel.projectId, project.id));
		let nextNumber = Math.max(0, ...existing.map(task => Number(task.taskNumber))) + 1;
		const byId = new Map(existing.map(task => [task.id, task]));
		for (const task of content.tasks) {
			const current = byId.get(task.id);
			if (!current) throw new Error(`Expected parent task missing: ${task.id}`);
			if (current.description === `${project.outcome} Acceptance is tracked in the project checklist.`)
				await db.update(taskModel).set({ description: task.description, updatedAt: new Date() }).where(eq(taskModel.id, task.id));
		}
		const architectureId = `sample-task-${p}-7`;
		if (byId.get(architectureId)?.description === project.decision)
			await db.update(taskModel).set({ description: content.architecture, updatedAt: new Date() }).where(eq(taskModel.id, architectureId));
		for (const child of content.children) {
			const current = byId.get(child.id);
			if (current) {
				if (current.description === "Fictional follow-up task linked to the project work.")
					await db.update(taskModel).set({ title: child.title, description: child.description, parentTaskId: child.parentTaskId, updatedAt: new Date() }).where(eq(taskModel.id, child.id));
			} else {
				const parent = byId.get(child.parentTaskId)!;
				await addSample(db, "Task", { ...child, projectId: project.id, taskNumber: nextNumber++, status: "todo", priority: parent.priority, stageKey: parent.stageKey, createdById: actor.id });
			}
		}
		const folder = resolve("docs/projects", project.code.toLowerCase());
		await mkdir(folder, { recursive: true });
		let documentsAdded = 0;
		for (const document of content.documents) {
			const id = `sample-doc-${p}-${document.slug}-v1`;
			const fileName = `${document.slug}.md`;
			// Versioned artifacts are immutable; edited app documents remain untouched.
			await writeFile(resolve(folder, fileName), document.text);
			const model = node("DocumentVersion");
			const [current] = await db.select().from(model).where(eq(model.id, id));
			if (current) {
				const saved = await bucket.get(String(current.r2Key));
				if (!saved) throw new Error(`Existing document file missing: ${id}`);
				continue;
			}
			const key = `projects/${project.id}/${id}/v1/${fileName}`;
			await bucket.put(key, document.text, { httpMetadata: { contentType: "text/markdown" } });
			const object = await bucket.get(key);
			if (!object || await object.text() !== document.text) throw new Error(`Document storage verification failed: ${id}`);
			await addSample(db, "DocumentVersion", { id, projectId: project.id, stageKey: project.stage, title: document.title, description: "Detailed fictional delivery specification, proposed work and acceptance evidence requirements.", category: document.category, r2Key: key, fileName, mimeType: "text/markdown", sizeBytes: Buffer.byteLength(document.text), version: 1, status: "final", uploadedById: actor.id, checksum: createHash("sha256").update(document.text).digest("hex") });
			await addSample(db, "ProjectEvent", { id: `${id}-uploaded`, projectId: project.id, eventType: "document_uploaded", actorId: actor.id, entityType: "document", entityId: id, details: JSON.stringify({ title: document.title, fileName, category: document.category, sizeBytes: Buffer.byteLength(document.text) }) });
			documentsAdded++;
		}
		const after = await db.select().from(taskModel).where(eq(taskModel.projectId, project.id));
		for (const before of existing) {
			const actual = after.find(task => task.id === before.id);
			for (const key of ["status", "assigneeId", "startDate", "dueDate", "estimateHours", "actualHours", "blockedReason", "completedAt"])
				if (JSON.stringify(actual?.[key]) !== JSON.stringify(before[key])) throw new Error(`Execution state changed: ${before.id}/${key}`);
		}
		for (const task of content.tasks)
			if (after.filter(child => child.parentTaskId === task.id).length < 3) throw new Error(`Missing subtasks: ${task.id}`);
		for (const task of [...content.tasks, { id: architectureId }])
			if (String(after.find(current => current.id === task.id)?.description ?? "").length < 300) throw new Error(`Detailed description missing: ${task.id}`);
		const documentModel = node("DocumentVersion");
		let documentsIndexed = 0;
		for (const document of content.documents) {
			const id = `sample-doc-${p}-${document.slug}-v1`;
			const [saved] = await db.select().from(documentModel).where(eq(documentModel.id, id));
			if (!saved || saved.projectId !== project.id) throw new Error(`Document record missing: ${id}`);
			const file = await bucket.get(String(saved.r2Key));
			if (!file) throw new Error(`Document file missing: ${id}`);
			const bytes = await file.arrayBuffer();
			if (createHash("sha256").update(Buffer.from(bytes)).digest("hex") !== saved.checksum) throw new Error(`Document checksum mismatch: ${id}`);
			if (saved.deliveryIndexStatus === "indexed" && saved.deliveryTextChecksum === saved.checksum) { documentsIndexed++; continue; }
			const response = await fetch(`http://127.0.0.1:3100/delivery/documents/${id}/index`, { method: "POST", headers: { authorization: `Bearer ${secrets.GRAPH_SERVICE_TOKEN}`, "x-graph-subject": "test-sample-user" }, body: bytes, signal: AbortSignal.timeout(35000) });
			const result = await response.json() as { data?: { status?: string } };
			if (!response.ok || result.data?.status !== "indexed") throw new Error(`Document indexing failed: ${id}`);
			documentsIndexed++;
		}
		report.push({ project: project.name, detailedParentTasks: content.tasks.length + 1, subtasks: content.children.length, documentsAdded, documentsIndexed });
	}
	console.log(JSON.stringify({ graph: "brainee_dev", projects: report }, null, 2));
} finally {
	await mf.dispose();
}
