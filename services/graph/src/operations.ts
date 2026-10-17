import type { Graph } from "falkordb";
import type { GraphRequest } from "../../../shared/graph/request.ts";
import { executeData, executeBatch, resolveActor } from "./data-executor.ts";
import { resolveIdentity } from "./identity.ts";
import { peopleOperation } from "./people-operations.ts";
import { createTaskOperation } from "./task-operation.ts";

export function operations(graph: Graph) {
	return async (name: string, payload: unknown, subject: string) => {
		if (name === "identity.resolve") {
			if ((payload as { authUserId?: string })?.authUserId !== subject)
				throw new Error("Identity is not permitted.");
			return resolveIdentity(graph, payload);
		}
		const actor = await resolveActor(graph, subject);
		if (name === "data.execute")
			return executeData(graph, payload as GraphRequest, actor);
		if (name === "data.batch")
			return executeBatch(graph, payload as GraphRequest[], actor);
		if (
			[
				"employees.changeRole",
				"leave.approve",
				"leave.revoke",
				"leave.request",
				"wfh.request",
			].includes(name)
		)
			return peopleOperation(graph, name, payload, actor);
		if (name === "tasks.create")
			return createTaskOperation(graph, payload, actor);
		throw new Error("Operation is not permitted.");
	};
}
