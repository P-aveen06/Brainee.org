import assert from "node:assert/strict";
import type { Graph } from "falkordb";
import { demoPeople } from "../../../shared/demo-startup.ts";
import { sampleProjects, sampleProjectMembers } from "../src/sample-catalog.ts";
import { operations } from "../src/operations.ts";
import { defineNode, wire } from "../../../shared/graph/model.ts";
import { eq } from "../../../shared/graph/expressions.ts";

export async function assertStartupDataset(graph: Graph) {
	const projectIds = sampleProjects.map((project) => project.id);
	const topology = await graph.roQuery<{
		id: string;
		ownerId: string;
		projectType: string;
		clientCompanyId: string;
	}>(
		"MATCH (p:Project) WHERE p.id IN $ids RETURN p.id AS id,p.ownerId AS ownerId,p.projectType AS projectType,p.clientCompanyId AS clientCompanyId",
		{ params: { ids: projectIds } },
	);
	assert.equal(topology.data?.length, 10);
	assert.equal(
		topology.data?.filter((project) => project.projectType === "internal")
			.length,
		4,
	);
	assert.equal(
		new Set(
			topology.data
				?.filter((project) => project.projectType === "client")
				.map((project) => project.clientCompanyId),
		).size,
		6,
	);
	const counts = Object.fromEntries(
		["sample-lead", "sample-vikram", "sample-priya"].map((id) => [
			id,
			topology.data!.filter((project) => project.ownerId === id).length,
		]),
	);
	assert.deepEqual(counts, {
		"sample-lead": 3,
		"sample-vikram": 3,
		"sample-priya": 4,
	});
	const execute = operations(graph);
	for (const person of demoPeople) {
		const identity = (await execute(
			"identity.resolve",
			{ authUserId: person.authId, email: person.email },
			person.authId,
		)) as Record<string, unknown>;
		assert.equal(identity.name, person.name);
		assert.equal(identity.role, person.role);
		const visible = (await execute(
			"data.execute",
			{
				action: "read",
				model: { kind: "node", label: "Project", alias: "Project" },
			},
			person.authId,
		)) as Array<{ id: string }>;
		const actual = visible
			.filter((project) => projectIds.includes(project.id))
			.map((project) => project.id)
			.sort();
		const expected =
			person.persona === "ceo"
				? projectIds
				: sampleProjects
						.filter((project) =>
							sampleProjectMembers[project.id].includes(person.id),
						)
						.map((project) => project.id);
		assert.deepEqual(
			actual,
			[...expected].sort(),
			`${person.name} has only their permitted projects`,
		);
		if (person.persona === "employee")
			assert.ok(actual.length >= 1 && actual.length <= 2);
		if (person.persona !== "ceo" && person.persona !== "architect") {
			const hidden = projectIds.find((id) => !actual.includes(id))!;
			const Task = defineNode<Record<string, unknown>>("Task");
			const tasks = (await execute(
				"data.execute",
				{
					action: "read",
					model: { kind: "node", label: "Task", alias: "Task" },
					where: wire(eq(Task.projectId, hidden)),
				},
				person.authId,
			)) as unknown[];
			assert.equal(
				tasks.length,
				0,
				`${person.name} cannot read tasks in a hidden project`,
			);
		}
	}
	await assert.rejects(
		execute(
			"identity.resolve",
			{ authUserId: "sample:sample-anika", email: "forged@example.test" },
			"sample:sample-anika",
		),
	);
	const capacity = await graph.roQuery<{ name: string; hours: number }>(
		"MATCH (d:DailyUpdate)-[:FOR_EMPLOYEE]->(u:Employee) WHERE d.status='submitted' AND d.date=$date AND u.authId IN $subjects RETURN u.name AS name,sum(d.hoursSpent) AS hours",
		{
			params: {
				date: new Intl.DateTimeFormat("en-CA", {
					timeZone: "Asia/Kolkata",
					year: "numeric",
					month: "2-digit",
					day: "2-digit",
				}).format(new Date()),
				subjects: demoPeople.map((person) => person.authId),
			},
		},
	);
	for (const row of capacity.data ?? [])
		assert.ok(
			row.hours <= 8,
			`${row.name} has a plausible total daily workload`,
		);
}
