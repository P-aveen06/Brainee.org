import type { Graph } from "falkordb";
import { demoPeople } from "../../../shared/demo-startup.ts";
import { byLabel, defineNode } from "../../../shared/graph/model.ts";
import { GraphDatabase } from "../../../shared/graph/query.ts";
import { recordValues } from "../../../shared/graph/write-values.ts";
import { executeBatch, executeData } from "./data-executor.ts";
import { queryParams } from "./params.ts";
import { sampleEmployees } from "./sample-catalog.ts";
import { seedSampleCollaboration } from "./sample-collaboration.ts";
import { seedSamplePeople } from "./sample-people.ts";
import { configureStartupTopology } from "./sample-topology.ts";
import { seedSampleWork } from "./sample-work.ts";

export { sampleEmployees, sampleProjectMembers } from "./sample-catalog.ts";
export const node = (label: string) =>
	defineNode<Record<string, unknown>>(label);
export async function addSample(
	db: GraphDatabase,
	label: string,
	values: Record<string, unknown>,
) {
	const model = node(label);
	await db
		.insert(model)
		.values(values)
		.onConflictDoNothing({ target: model.id });
}
export const dateOffset = (iso: string, days: number) =>
	new Date(Date.parse(iso + "T12:00:00Z") + days * 86400000)
		.toISOString()
		.slice(0, 10);
export function cycleFor(birthday: string, date: string) {
	const year =
		Number(date.slice(0, 4)) - (date.slice(5) < birthday.slice(5) ? 1 : 0);
	return {
		cycleStart: `${year}-${birthday.slice(5)}`,
		cycleEnd: dateOffset(`${year + 1}-${birthday.slice(5)}`, -1),
	};
}
export async function seedSampleData(graph: Graph) {
	// This operation is a local CLI tool, never an HTTP operation or automatic startup hook.
	const admin = recordValues(
		byLabel.get("Employee")!,
		{
			id: "sample-admin",
			authId: "test-sample-user",
			name: "Aditi Deshmukh",
			email: "test@example.com",
			role: "admin",
			birthday: "2026-10-16",
			joinDate: "2026-10-16",
			isOnboarded: true,
			standardHours: 8,
		},
		true,
	);
	const { data = [] } = await graph.query<{ user: Record<string, unknown> }>(
		"MERGE (u:Employee {authId:'test-sample-user'}) ON CREATE SET u += $values RETURN properties(u) AS user",
		{ params: { values: queryParams(admin) } },
	);
	const account = data[0]?.user;
	if (!account || account.role !== "admin" || account.isActive !== true)
		throw new Error("The local test account must be an active administrator.");
	const actor = { id: String(account.id), role: "admin", storedRole: "admin" };
	const db = new GraphDatabase(async (name, payload) =>
		name === "data.batch"
			? executeBatch(graph, payload as never, actor)
			: executeData(graph, payload as never, actor),
	);
	// Keep the dates fixed after the first run, so repeating the seed cannot move edited records.
	const today = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Kolkata",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
	const weekday = new Date(today + "T12:00:00Z").getUTCDay();
	const monday = dateOffset(today, (8 - weekday) % 7 || 7);
	const anchor = await graph.query<{ monday: string }>(
		"MERGE (d:SampleDataset {id:'fictional-team-v1'}) ON CREATE SET d.monday=$monday,d.createdAt=$now RETURN d.monday AS monday",
		{ params: { monday, now: Date.now() } },
	);
	const start = anchor.data![0].monday;
	const configured = await graph.roQuery<{ id: string }>(
		"MATCH (d:SampleDataset {id:'fictional-startup-v2'}) RETURN d.id AS id",
	);
	const migrateSamples = !configured.data?.length;
	for (const employee of sampleEmployees)
		await addSample(db, "Employee", {
			id: employee.id,
			name: employee.name,
			birthday: employee.birthday,
			role: employee.role,
			authId: employee.authId,
			email: employee.email,
			joinDate: "2026-10-16",
			standardHours: 8,
			isOnboarded: true,
			peerLeadId:
				employee.peerLeadId === "sample-admin" ? actor.id : employee.peerLeadId,
		});
	if (migrateSamples) {
		const model = node("Employee");
		const { eq } = await import("../../../shared/graph/expressions.ts");
		for (const person of demoPeople) {
			const id = person.persona === "ceo" ? actor.id : person.id;
			await db
				.update(model)
				.set({
					name: person.name,
					email: person.email,
					role: person.role,
					peerLeadId:
						person.peerLeadId === "sample-admin" ? actor.id : person.peerLeadId,
				})
				.where(eq(model.id, id));
		}
	}
	await seedSampleWork(db, actor.id, start);
	await seedSamplePeople(db, account, start);
	await seedSampleCollaboration(db, actor.id, start, today);
	if (migrateSamples) {
		await configureStartupTopology(db, start);
		await graph.query(
			"MERGE (d:SampleDataset {id:'fictional-startup-v2'}) ON CREATE SET d.createdAt=$now",
			{ params: { now: Date.now() } },
		);
	}
	const { data: counts = [] } = await graph.roQuery<{
		label: string;
		count: number;
	}>(
		"MATCH (n) UNWIND labels(n) AS label RETURN label,count(n) AS count ORDER BY label",
	);
	return { weekStarting: start, counts };
}
