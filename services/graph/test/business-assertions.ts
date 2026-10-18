import { assertStartupDataset } from "./startup-assertions.ts";
import { operations } from "../src/operations.ts";
import assert from "node:assert/strict";
import type { Graph } from "falkordb";
import { GraphDatabase } from "../../../shared/graph/query.ts";
import { defineNode } from "../../../shared/graph/model.ts";
import { eq } from "../../../shared/graph/expressions.ts";
import { type Actor } from "../src/data-executor.ts";
import { peopleOperation } from "../src/people-operations.ts";
import { createTaskOperation } from "../src/task-operation.ts";
import { seedSampleData } from "../src/sample-data.ts";
const rowCount = (value: unknown) => {
	assert.ok(Array.isArray(value));
	return value.length;
};
export async function assertBusinessOperations(
	graph: Graph,
	db: GraphDatabase,
	actor: Actor,
	userActor: Actor,
) {
	const User = defineNode<Record<string, unknown>>("Employee"),
		Sheet = defineNode<Record<string, unknown>>("Timesheet");
	// All mutations in a failed query must roll back, including previous updates.
	await assert.rejects(
		async () =>
			await db.insert(Sheet).values({
				id: "bad-reference",
				userId: "missing",
				date: "2026-10-20",
				hours: 8,
			}),
	);
	const before = await db.select().from(User).where(eq(User.id, "employee"));
	await assert.rejects(
		db.batch([
			db
				.update(User)
				.set({ name: "Must roll back" })
				.where(eq(User.id, "employee")),
			db
				.update(User)
				.set({ email: "admin@example.test" })
				.where(eq(User.id, "employee")),
		]),
	);
	assert.equal(
		(await db.select().from(User).where(eq(User.id, "employee")))[0].name,
		before[0].name,
	);
	await db.delete(Sheet).where(eq(Sheet.id, "absent")); // Empty deletes preserve existing API behavior.
	const baseline = await graph.query<{ maximum: number }>(
		"MATCH (t:Task {projectId:'project'}) RETURN max(t.taskNumber) AS maximum",
	);
	const tasks = await Promise.all(
		Array.from({ length: 8 }, (_, i) =>
			createTaskOperation(
				graph,
				{
					values: {
						id: "task-" + i,
						projectId: "project",
						title: "Concurrent " + i,
					},
				},
				actor,
			),
		),
	);
	assert.equal(new Set(tasks.map((t) => t.taskNumber)).size, 8);
	assert.equal(Math.max(...tasks.map((t) => t.taskNumber)), (baseline.data?.[0]?.maximum ?? 0) + 8);
	const Kind = defineNode<Record<string, unknown>>("LeaveType"),
		Balance = defineNode<Record<string, unknown>>("LeaveBalance"),
		Leave = defineNode<Record<string, unknown>>("LeaveRequest");
	await db
		.insert(Kind)
		.values({ id: "kind", slug: "annual", name: "Annual", defaultDays: 12 });
	await db.insert(Balance).values({
		id: "balance",
		userId: "employee",
		leaveType: "annual",
		totalLimit: 12,
		cycleStart: "2026-01-01",
		cycleEnd: "2026-12-31",
	});
	const leavePayload = {
		values: {
			id: "leave",
			leaveType: "annual",
			startDate: "2026-10-21",
			endDate: "2026-10-21",
			totalDays: 1,
		},
		cycleStart: "2026-01-01",
	};
	const requested = await peopleOperation(
		graph,
		"leave.request",
		leavePayload,
		userActor,
	);
	assert.equal(rowCount(requested), 1);
	const approvals = await Promise.all(
		Array.from({ length: 8 }, () =>
			peopleOperation(
				graph,
				"leave.approve",
				{ id: "leave", cycleStart: "2026-01-01" },
				actor,
			),
		),
	);
	assert.equal(
		approvals.reduce((n, r) => n + rowCount(r), 0),
		1,
	);
	assert.equal((await db.select().from(Balance))[0].used, 1);
	const blocked = await peopleOperation(
		graph,
		"leave.request",
		{ ...leavePayload, values: { ...leavePayload.values, id: "overlap" } },
		userActor,
	);
	assert.equal(rowCount(blocked), 0);
	const wfhArgs = {
		values: { id: "wfh", date: "2026-10-22" },
		cycleStart: "2026-01-01",
		cycleEnd: "2026-12-31",
		defaultAllowance: 1,
	};
	const submissions = await Promise.all(
		Array.from({ length: 8 }, (_, i) =>
			peopleOperation(
				graph,
				"wfh.request",
				{ ...wfhArgs, values: { ...wfhArgs.values, id: "wfh-" + i } },
				userActor,
			),
		),
	);
	assert.equal(
		submissions.reduce(
			(n, r) =>
				n + (r as unknown as { meta: { changes: number } }).meta.changes,
			0,
		),
		1,
	);
	const wfhOverlap = await peopleOperation(
		graph,
		"leave.request",
		{
			...leavePayload,
			values: {
				...leavePayload.values,
				id: "wfh-overlap",
				startDate: "2026-10-22",
				endDate: "2026-10-22",
			},
		},
		userActor,
	);
	assert.equal(rowCount(wfhOverlap), 0);
	const leaveOverlap = await peopleOperation(
		graph,
		"wfh.request",
		{ ...wfhArgs, values: { id: "leave-overlap", date: "2026-10-21" } },
		userActor,
	);
	assert.equal(
		(leaveOverlap as unknown as { meta: { changes: number } }).meta.changes,
		0,
	);
	await peopleOperation(
		graph,
		"leave.revoke",
		{ id: "leave", reason: "Test", cycleStart: "2026-01-01" },
		actor,
	);
	await peopleOperation(
		graph,
		"leave.revoke",
		{ id: "leave", reason: "Test", cycleStart: "2026-01-01" },
		actor,
	);
	assert.equal((await db.select().from(Balance))[0].used, 0);
	// Type rename stays connected through the one-query batch.
	await db.batch([
		db.update(Kind).set({ slug: "annual-new" }).where(eq(Kind.id, "kind")),
		db
			.update(Balance)
			.set({ leaveType: "annual-new" })
			.where(eq(Balance.leaveType, "annual")),
		db
			.update(Leave)
			.set({ leaveType: "annual-new" })
			.where(eq(Leave.leaveType, "annual")),
	]);
	assert.equal((await db.select().from(Balance))[0].leaveType, "annual-new");
	const link = await graph.roQuery<{ n: number }>(
		'MATCH (:LeaveBalance)-[:OF_LEAVE_TYPE]->(:LeaveType {slug:"annual-new"}) RETURN count(*) AS n',
	);
	assert.equal(link.data?.[0].n, 1);
	const lastAdmin = await peopleOperation(
		graph,
		"employees.changeRole",
		{ userId: "admin", newRole: "user" },
		actor,
	);
	assert.equal(rowCount(lastAdmin), 0);


 const Conversation=defineNode<Record<string,unknown>>("Conversation"),Turn=defineNode<Record<string,unknown>>("AssistantTurn"),Message=defineNode<Record<string,unknown>>("Message"),Tool=defineNode<Record<string,unknown>>("ToolInvocation");
 await db.insert(Conversation).values({id:"conversation",userId:"admin"});
 await db.insert(Turn).values({id:"turn",conversationId:"conversation",userId:"admin"});
 await db.insert(Message).values({id:"message",conversationId:"conversation",turnId:"turn",role:"user"});
 await db.insert(Tool).values({id:"invocation",userId:"admin",turnId:"turn",toolName:"test"});
 await db.delete(Conversation).where(eq(Conversation.id,"conversation"));
 assert.equal((await db.select().from(Message)).length,0);
 assert.equal((await db.select().from(Turn)).length,0);
 assert.equal((await db.select().from(Tool))[0].turnId,null);
 const Stage=defineNode<Record<string,unknown>>("StageDefinition");
 await db.insert(Stage).values({id:"existing-proposal-stage",key:"proposal",name:"Proposal",sequence:2});
	const seeded = await seedSampleData(graph);
	const seededAgain = await seedSampleData(graph);
	assert.deepEqual(seededAgain, seeded);
 const previousTestAuth=process.env.TEST_AUTH_ENABLED;
 process.env.TEST_AUTH_ENABLED="true";
 try{
  await assertStartupDataset(graph);
  const execute=operations(graph);
  const identity=await execute("identity.resolve",{authUserId:"test-sample-user",email:"test@example.com"},"test-sample-user") as Record<string,unknown>;
  assert.equal(identity.role,"admin");
  await assert.rejects(execute("identity.resolve",{authUserId:"forged",email:"test@example.com"},"test-sample-user"));
  await assert.rejects(execute("data.execute",{action:"read",model:{kind:"node",label:"Employee",alias:"Employee"}},"unknown-identity"));
  await graph.query("MATCH (u:Employee {authId:'test-sample-user'}) SET u.isActive=false");
  await assert.rejects(execute("data.execute",{action:"read",model:{kind:"node",label:"Employee",alias:"Employee"}},"test-sample-user"));
 }finally{if(previousTestAuth===undefined)delete process.env.TEST_AUTH_ENABLED;else process.env.TEST_AUTH_ENABLED=previousTestAuth;}

	assert.ok(seeded.counts.find((r) => r.label === "Employee")!.count >= 8);
	assert.ok(seeded.counts.find((r) => r.label === "Task")!.count >= 12);
}
