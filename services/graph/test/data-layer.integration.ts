import { randomUUID } from "node:crypto";
import { assertBusinessOperations } from "./business-assertions.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readConfig } from "../src/config.ts";
import { connect } from "../src/connection.ts";
import { migrate } from "../src/migrations.ts";
import { businessLegacyChecksums } from "../src/business-rules.ts";
import { executeData, executeBatch } from "../src/data-executor.ts";
import { createTaskOperation } from "../src/task-operation.ts";
import { defineNode, byLabel, wire } from "../../../shared/graph/model.ts";
import { recordValues } from "../../../shared/graph/write-values.ts";
import { GraphDatabase } from "../../../shared/graph/query.ts";
import {
	eq,
	and,
	desc,
	count,
	like,
	countWhen,
	add,
	gt,
} from "../../../shared/graph/expressions.ts";

test("native graph data layer: fields, relationships, queries, upserts and permissions", async () => {
	const config = readConfig({...process.env,GRAPH_NAME:`brainee_test_validation_${randomUUID().replaceAll("-","")}`});
	assert.match(config.graphName, /^brainee_test_validation_[a-f0-9]{32}$/);
	const client = await connect(config, process.env.GRAPH_ADMIN_PASSWORD);
	const graph = client.selectGraph(config.graphName);
	const actor = { id: "admin", role: "admin", storedRole: "admin" };
	const db = new GraphDatabase(async (name, payload) =>
		name === "data.batch"
			? executeBatch(graph, payload as never, actor)
			: executeData(graph, payload as never, actor),
	);
	const User = defineNode<Record<string, unknown>>("Employee"),
		Project = defineNode<Record<string, unknown>>("Project"),
		Member = defineNode<Record<string, unknown>>("ProjectMembership"),
		Task = defineNode<Record<string, unknown>>("Task"),
		Sheet = defineNode<Record<string, unknown>>("Timesheet");
	try {
		await graph.query(
			"CREATE (:SchemaMigration {id:$id,checksum:$checksum,appliedAt:$now})",
			{
				params: {
					id: "0002-business-rules",
					checksum: businessLegacyChecksums[0],
					now: Date.now(),
				},
			},
		);
		await graph.query(
			"CREATE (:CompanyPolicyDocument {id:$id,title:$title,r2Key:$r2Key,fileName:$fileName,mimeType:$mimeType,sizeBytes:$sizeBytes,createdAt:$createdAt})",
			{
				params: {
					id: "legacy-policy",
					title: "Legacy handbook",
					r2Key: "company-policies/legacy-policy",
					fileName: "handbook.pdf",
					mimeType: "application/pdf",
					sizeBytes: 12,
					createdAt: Date.now(),
				},
			},
		);
		await migrate(graph);
		const { data: migratedPolicies = [] } = await graph.roQuery<{
			status: string;
			version: number;
		}>(
			"MATCH (d:CompanyPolicyDocument {id:$id}) RETURN d.status AS status,d.version AS version",
			{ params: { id: "legacy-policy" } },
		);
		assert.deepEqual(migratedPolicies, [{ status: "draft", version: 1 }]);
		const { data: retainedBusinessMarker = [] } = await graph.roQuery<{
			checksum: string;
		}>(
			"MATCH (m:SchemaMigration {id:$id}) RETURN m.checksum AS checksum",
			{ params: { id: "0002-business-rules" } },
		);
		assert.equal(retainedBusinessMarker[0]?.checksum, businessLegacyChecksums[0]);
		const admin = recordValues(
			byLabel.get("Employee")!,
			{
				id: "admin",
				authId: "admin-auth",
				email: "admin@example.test",
				name: "Admin",
				role: "admin",
			},
			true,
		);
		await graph.query("CREATE (u:Employee) SET u += $user", {
			params: { user: admin as never },
		});
		await db.insert(User).values({
			id: "employee",
			authId: "employee-auth",
			email: "employee@example.test",
			name: "Employee",
			birthday: "2000-01-01",
			peerLeadId: "admin",
		});
		const [employee] = await db
			.select()
			.from(User)
			.where(eq(User.id, "employee"));
		assert.equal(employee.peerLeadId, "admin");
		assert.ok(employee.createdAt instanceof Date);
		assert.equal(employee.isActive, true);
		await db
			.insert(Project)
			.values({ id: "project", code: "P1", name: "Project", ownerId: "admin" });
		await db
			.insert(Project)
			.values({ id: "hidden", code: "P2", name: "Hidden", ownerId: "admin" });
		await db.insert(Member).values({
			id: "member",
			projectId: "project",
			userId: "employee",
			role: "contributor",
		});
		const relation = await graph.roQuery<{ n: number }>(
			'MATCH (:Employee {id:"employee"})-[:HAS_MEMBERSHIP]->(:ProjectMembership)-[:IN_PROJECT]->(:Project {id:"project"}) RETURN count(*) AS n',
		);
		assert.equal(relation.data?.[0].n, 1);
		const joined = await db
			.select({ name: User.name, project: Project.name })
			.from(Member)
			.innerJoin(User, eq(Member.userId, User.id))
			.leftJoin(Project, eq(Member.projectId, Project.id));
		assert.deepEqual(joined, [{ name: "Employee", project: "Project" }]);
		await db
			.update(User)
			.set({ name: "Changed", peerLeadId: null })
			.where(eq(User.id, "employee"));
		const removed = await graph.roQuery<{ n: number }>(
			'MATCH (:Employee {id:"employee"})-[:REPORTS_TO]->() RETURN count(*) AS n',
		);
		assert.equal(removed.data?.[0].n, 0);
		await db
			.insert(Sheet)
			.values({ id: "sheet", userId: "employee", date: "2026-10-19", hours: 4 })
			.onConflictDoUpdate({
				target: [Sheet.userId, Sheet.date],
				set: { hours: 8 },
			});
		await db
			.insert(Sheet)
			.values({
				id: "ignored-new-id",
				userId: "employee",
				date: "2026-10-19",
				hours: 1,
			})
			.onConflictDoUpdate({
				target: [Sheet.userId, Sheet.date],
				set: { hours: 8 },
			});
		const sheets = await db.select().from(Sheet);
		assert.equal(sheets.length, 1);
		assert.equal(sheets[0].id, "sheet");
		assert.equal(sheets[0].hours, 8);
		const made = await createTaskOperation(
			graph,
			{
				values: {
					id: "task",
					projectId: "project",
					title: "Task",
					assigneeId: "employee",
				},
			},
			actor,
		);
		assert.equal(made.taskNumber, 1);
		const summary = await db
			.select({
				status: Task.status,
				count: count(),
				high: countWhen(gt(Task.taskNumber, 0)),
			})
			.from(Task)
			.groupBy(Task.status);
		assert.deepEqual(summary, [{ status: "todo", count: 1, high: 1 }]);
		const searched = await db
			.select({ id: Task.id })
			.from(Task)
			.where(like(Task.title, "%task%"))
			.orderBy(desc(Task.taskNumber));
		assert.deepEqual(searched, [{ id: "task" }]);
		await db.batch([
			db.update(User).set({ name: "Batch" }).where(eq(User.id, "employee")),
			db
				.update(Sheet)
				.set({ hours: add(Sheet.hours, 1) })
				.where(eq(Sheet.id, "sheet")),
		] as never);
		const [updated] = await db.select().from(Sheet);
		assert.equal(updated.hours, 9);
		const userActor = { id: "employee", role: "user", storedRole: "user" };
		const allowed = await executeData(
			graph,
			{
				action: "read",
				model: { kind: "node", label: "Project", alias: "Project" },
			},
			userActor,
		);
		assert.deepEqual(
			allowed.map((p) => p.id),
			["project"],
		);
		const denied = await executeData(
			graph,
			{
				action: "update",
				model: { kind: "node", label: "Project", alias: "Project" },
				where: wire(eq(Project.id, "hidden")),
				set: { name: "Hacked" },
			},
			userActor,
		);
		assert.equal(denied.length, 0);
		await assert.rejects(
			executeData(
				graph,
				{
					action: "read",
					model: { kind: "node", label: "NotAModel", alias: "n" },
				},
				actor,
			),
		);
		await assert.rejects(
			executeData(
				graph,
				{
					action: "read",
					model: { kind: "node", label: "Employee", alias: "bad) RETURN 1" },
				},
				actor,
			),
		);

		await assertBusinessOperations(graph, db, actor, userActor);
	} finally {
		await graph.delete();
		await client.close();
	}
});
