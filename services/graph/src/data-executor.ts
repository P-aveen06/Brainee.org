import { queryParams } from "./params.ts";
import type { Graph } from "falkordb";
import { byLabel } from "../../../shared/graph/model.ts";
import { CypherBindings } from "../../../shared/graph/cypher-expression.ts";
import { compileRead } from "../../../shared/graph/read-cypher.ts";
import { compileWrite } from "../../../shared/graph/write-cypher.ts";
import type { GraphRequest } from "../../../shared/graph/request.ts";

export interface Actor {
	id: string;
	role: string;
	storedRole: string;
}

export async function resolveActor(
	graph: Graph,
	subject: string,
): Promise<Actor> {
	const { data = [] } = await graph.roQuery<{ id: string; role: string }>(
		"MATCH (u:Employee {authId:$subject}) WHERE u.isActive = true RETURN u.id AS id,u.role AS role",
		{ params: { subject }, TIMEOUT: 3000 },
	);
	if (data.length !== 1)
		throw new Error("An active employee account is required.");
	const row = data[0];
	if (row.role === "user") {
		const reports = await graph.roQuery<{ count: number }>(
			"MATCH (u:Employee {peerLeadId:$id}) WHERE u.isActive = true RETURN count(u) AS count",
			{ params: { id: row.id }, TIMEOUT: 3000 },
		);
		if (Number(reports.data?.[0].count) > 0)
			return { ...row, role: "lead", storedRole: row.role };
	}
	return { ...row, storedRole: row.role };
}

export function accessScope(b: CypherBindings, actor: Actor, write: boolean) {
	const id = b.bind(actor.id);
	return (alias: string, label: string) => {
		if (actor.role === "admin") return "true";
		const model = byLabel.get(label)!;
		if (label === "Project" || Object.hasOwn(model.fields, "projectId")) {
			const project =
				label === "Project"
					? `(${alias})`
					: label === "Task"
						? `(${alias})<-[:HAS_TASK]-(:Project)`
						: `(${alias})-[:IN_PROJECT]->(:Project)`;
			const owner =
				label === "Project"
					? `${alias}.ownerId = ${id}`
					: label === "Task"
						? `size([(${alias})<-[:HAS_TASK]-(:Project {ownerId:${id}}) | 1]) > 0`
						: `size([(${alias})-[:IN_PROJECT]->(:Project {ownerId:${id}}) | 1]) > 0`;
			const membership = (role?: string) =>
				`size([${project}<-[:IN_PROJECT]-(:ProjectMembership {userId:${id},isCurrent:true${role ? `,role:'${role}'` : ""}}) | 1]) > 0`;
			const allowed = write
				? `(${membership("manager")} OR ${membership("contributor")})`
				: membership();
			return `(${alias} IS NULL OR ${Object.hasOwn(model.fields, "projectId") ? `${alias}.projectId IS NULL OR ` : ""}${owner} OR ${allowed})`;
		}
		if (
			write &&
			actor.role === "user" &&
			[
				"Employee",
				"LeaveBalance",
				"LeaveRequest",
				"WfhRequest",
				"Timesheet",
				"AssetAssignment",
				"DashboardLayout",
			].includes(label)
		) {
			return `${alias}.${label === "Employee" ? "id" : "userId"} = ${id}`;
		}
		if (
			write &&
			actor.role !== "hr" &&
			[
				"LeaveType",
				"Holiday",
				"WfhPolicy",
				"Company",
				"CompanyPolicyDocument",
			].includes(label)
		)
			return "false";
		return "true";
	};
}

export async function executeData(
	graph: Graph,
	request: GraphRequest,
	actor: Actor,
) {
	if (
		!request ||
		!["read", "create", "update", "delete"].includes(request.action) ||
		!request.model
	)
		throw new Error("Invalid graph operation.");
	if (
		(request.action === "update" || request.action === "delete") &&
		!request.where
	)
		throw new Error("A mutation filter is required.");
	const b = new CypherBindings();
	const scope = accessScope(b, actor, request.action !== "read");
	const query =
		request.action === "read"
			? compileRead(request, b, scope)
			: compileWrite(request, b, scope);
	const guard =
		"MATCH (_verifiedActor:Employee {id:$verifiedId}) WHERE _verifiedActor.isActive=true AND _verifiedActor.role=$verifiedRole WITH _verifiedActor";
	const params = {
		...b.params,
		verifiedId: actor.id,
		verifiedRole: actor.storedRole,
	};
	const result = await (request.action === "read"
		? graph.roQuery<{ rows: Record<string, unknown>[] }>(
				`${guard}\nCALL { ${query} } RETURN rows`,
				{ params: queryParams(params), TIMEOUT: 5000 },
			)
		: graph.query<{ rows: Record<string, unknown>[] }>(
				`${guard}\nCALL { ${query} } RETURN rows`,
				{ params: queryParams(params), TIMEOUT: 5000 },
			));
	if (!result.data?.length)
		throw new Error("Account permissions changed. Refresh and retry.");
	const rows = result.data[0].rows;
	if (!Array.isArray(rows)) throw new Error("Invalid graph response.");
	if (rows.length > 10000)
		throw new Error("Result too large. Narrow the date or project filter.");
	if (
		request.action === "create" &&
		!request.conflict &&
		rows.length !== request.values?.length
	)
		throw new Error("A referenced record is missing or inaccessible.");
	return rows;
}

export async function executeBatch(
	graph: Graph,
	requests: GraphRequest[],
	actor: Actor,
) {
	if (!Array.isArray(requests) || !requests.length || requests.length > 20)
		throw new Error("Invalid graph batch.");
	const params: Record<string, unknown> = {
		verifiedId: actor.id,
		verifiedRole: actor.storedRole,
	};
	const clauses = [
		"MATCH (_verifiedActor:Employee {id:$verifiedId}) WHERE _verifiedActor.isActive=true AND _verifiedActor.role=$verifiedRole",
	];
	requests.forEach((request, i) => {
		if (!["update", "delete"].includes(request.action) || !request.where)
			throw new Error("Only filtered mutations may be batched.");
		const b = new CypherBindings(`q${i}p`);
		const query = compileWrite(request, b, accessScope(b, actor, true));
		Object.assign(params, b.params);
		clauses.push(
			`CALL { ${query} } WITH _verifiedActor,${[...Array(i).keys()].map((j) => `result${j},`).join("")}rows AS result${i}`,
		);
	});
	clauses.push(`RETURN ${requests.map((_, i) => `result${i}`).join(",")}`);
	const result = await graph.query(clauses.join("\n"), {
		params: queryParams(params),
		TIMEOUT: 5000,
	});
	if (!result.data?.length) throw new Error("Account permissions changed.");
	return result.data;
}
