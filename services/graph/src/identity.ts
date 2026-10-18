import { randomUUID } from "node:crypto";
import type { Graph } from "falkordb";
import { demoPersonForAuth } from "../../../shared/demo-startup.ts";
import { byLabel } from "../../../shared/graph/model.ts";
import { recordValues } from "../../../shared/graph/write-values.ts";
import { queryParams } from "./params.ts";

export async function resolveIdentity(graph: Graph, payload: unknown) {
	const input = payload as { authUserId?: string; email?: string };
	const person = input.authUserId
		? demoPersonForAuth(input.authUserId)
		: undefined;
	if (
		process.env.TEST_AUTH_ENABLED !== "true" ||
		!person ||
		input.email !== person.email
	)
		throw new Error("Identity is not permitted.");
	if (person.persona !== "ceo") {
		const result = await graph.roQuery<{ user: Record<string, unknown> }>(
			"MATCH (u:Employee {authId:$subject,email:$email}) RETURN properties(u) AS user",
			{
				params: { subject: person.authId, email: person.email },
				TIMEOUT: 3000,
			},
		);
		if (result.data?.length !== 1)
			throw new Error(
				"Sample account is missing. Run the local startup seed first.",
			);
		return withEffectiveRole(graph, result.data[0].user);
	}
	const values = recordValues(
		byLabel.get("Employee")!,
		{
			id: randomUUID(),
			authId: input.authUserId,
			email: input.email,
			name: person.name,
			role: "admin",
			isOnboarded: false,
		},
		true,
	);
	const { data = [] } = await graph.query<{ user: Record<string, unknown> }>(
		"MERGE (u:Employee {authId:$subject}) ON CREATE SET u += $values WITH u SET u.isOnboarded = CASE WHEN u.birthday IS NOT NULL THEN true ELSE u.isOnboarded END RETURN properties(u) AS user",
		{
			params: { subject: person.authId, values: queryParams(values) },
			TIMEOUT: 5000,
		},
	);
	const user = data[0]?.user;
	if (!user) throw new Error("Could not resolve employee account.");
	return withEffectiveRole(graph, user);
}

async function withEffectiveRole(graph: Graph, user: Record<string, unknown>) {
	if (user.role === "user") {
		const reports = await graph.roQuery<{ count: number }>(
			"MATCH (u:Employee {peerLeadId:$id}) WHERE u.isActive=true RETURN count(u) AS count",
			{ params: { id: String(user.id) }, TIMEOUT: 3000 },
		);
		if (Number(reports.data?.[0].count) > 0) user.role = "lead";
	}
	return user;
}
