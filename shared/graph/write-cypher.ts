import { byLabel, models, type ModelDefinition } from "./model.ts";
import { CypherBindings } from "./cypher-expression.ts";
import {
	references,
	referenceTarget,
	relationshipPattern,
} from "./relationships.ts";
import { recordValues } from "./write-values.ts";
import type { GraphRequest } from "./request.ts";

function refreshLinks(model: ModelDefinition, node: string) {
	const links = references(model)
		.map((ref, i) => {
			const target = referenceTarget(ref),
				key = ref.targetFields[0];
			return `WITH ${node}
CALL { WITH ${node}
OPTIONAL MATCH ${relationshipPattern(node, `previous${i}`, ref, `old${i}`)}
WITH ${node},collect(old${i}) AS stale
FOREACH (edge IN stale | DELETE edge)
WITH ${node}
OPTIONAL MATCH (linked${i}:${target.label}) WHERE linked${i}.${key} = ${node}.${ref.fields[0]}
FOREACH (_ IN CASE WHEN linked${i} IS NULL THEN [] ELSE [1] END | MERGE ${relationshipPattern(node, `linked${i}`, ref)})
RETURN count(*) AS linkedCount${i} }`;
		})
		.join("\n");
 if(model.label!=="LeaveRequest")return links;
 return links+`
WITH ${node}
CALL { WITH ${node} OPTIONAL MATCH (${node})-[oldBalance:USES_BALANCE]->() WITH ${node},collect(oldBalance) AS oldLinks FOREACH (edge IN oldLinks | DELETE edge)
WITH ${node} OPTIONAL MATCH (balance:LeaveBalance) WHERE balance.userId=${node}.userId AND balance.leaveType=${node}.leaveType AND balance.cycleStart<=${node}.startDate AND balance.cycleEnd>=${node}.startDate
FOREACH (_ IN CASE WHEN balance IS NULL THEN [] ELSE [1] END | MERGE (${node})-[:USES_BALANCE]->(balance)) RETURN count(*) AS linkedBalance }`;
}
function businessKeys(model: ModelDefinition, node: string) {
	if (model.label === "ProjectMembership")
		return `SET ${node}.activeKey = CASE WHEN ${node}.isCurrent THEN toString(size(${node}.userId))+':'+${node}.userId+${node}.projectId ELSE null END`;
	if (model.label === "AssetAssignment")
		return `SET ${node}.activeKey = CASE WHEN ${node}.isCurrent THEN ${node}.assetId ELSE null END`;
	return "";
}
function returnRows(request: GraphRequest, bindings: CypherBindings) {
	if (!request.selection)
		return `RETURN collect(properties(${request.model!.alias})) AS rows`;
	return `RETURN collect({${Object.entries(request.selection)
		.map(
			([key, value]) =>
				`${bindings.identifier(key)}:${bindings.compile(value)}`,
		)
		.join(",")}}) AS rows`;
}

export function compileWrite(
	request: GraphRequest,
	b: CypherBindings,
	scope?: (alias: string, label: string) => string,
) {
	if (!request.model) throw new Error("Missing graph model.");
	const model = byLabel.get(request.model.label);
	if (!model) throw new Error("Unknown graph model.");
	const node = request.model.alias;
	const pattern = b.register(request.model);
	const clauses: string[] = [];
	if (request.action === "create") {
		if (!request.values?.length || request.values.length > 1000)
			throw new Error("Invalid graph creation batch.");
		const records = request.values.map((row) => recordValues(model, row, true));
		for (const row of records) delete row._refreshActiveKey;
		clauses.push(`UNWIND ${b.bind(records)} AS data`);
		const refs = references(model);
		for (const [i, ref] of refs.entries()) {
			const target = referenceTarget(ref);
			clauses.push(
				`OPTIONAL MATCH (ref${i}:${target.label}) WHERE ref${i}.${ref.targetFields[0]} = data.${ref.fields[0]}`,
			);
		}
		clauses.push(
			`WITH collect({data:data${refs.map((_, i) => `,ref${i}:ref${i}`).join("")}}) AS entries`,
		);
		clauses.push(
			`WHERE all(entry IN entries WHERE ${refs.map((ref, i) => `(entry.data.${ref.fields[0]} IS NULL OR entry.ref${i} IS NOT NULL)`).join(" AND ") || "true"})`,
		);
		clauses.push("UNWIND entries AS entry WITH entry.data AS data");
		if (request.conflict) {
			const keys = request.conflict.target.map((value) => {
				const expr = value as { op?: string; args?: unknown[] };
				if (expr.op !== "property" || expr.args?.[0] !== model.label)
					throw new Error("Invalid graph upsert key.");
				return b.identifier(expr.args[2]);
			});
			if (!keys.length)
				keys.push(Object.hasOwn(model.fields, "id") ? "id" : "userId");
			const valid = [
				...model.unique,
				Object.keys(model.fields).filter((k) => model.fields[k].primary),
			];
			if (
				!valid.some(
					(candidate) => JSON.stringify(candidate) === JSON.stringify(keys),
				)
			)
				throw new Error("Unindexed graph upsert key.");
			clauses.push(
				`MERGE (${node}:${model.label} {${keys.map((k) => `${k}:data.${k}`).join(",")}}) ON CREATE SET ${node} += data`,
			);
			if (request.conflict.set) {
				const set = recordValues(model, request.conflict.set, false);
				clauses.push(
					`ON MATCH SET ${Object.entries(set)
						.filter(([k]) => k !== "_refreshActiveKey")
						.map(([k, v]) => `${node}.${k}=${b.compile(v)}`)
						.join(",")}`,
				);
			}
		} else clauses.push(`CREATE ${pattern} SET ${node} += data`);
	} else {
		clauses.push(
			`MATCH ${pattern} WHERE ${request.where ? b.compile(request.where) : "true"} AND ${scope ? scope(node, model.label) : "true"}`,
		);
		if (request.action === "delete") return compileDelete(model, node, clauses);
		if (request.action !== "update" || !request.set)
			throw new Error("Invalid graph mutation.");
		const values = recordValues(model, request.set, false);
		delete values._refreshActiveKey;
		for (const [i, ref] of references(model).entries()) {
			const key = ref.fields[0];
			if (!Object.hasOwn(values, key)) continue;
			const target = referenceTarget(ref);
			clauses.push(
				`OPTIONAL MATCH (check${i}:${target.label}) WHERE check${i}.${ref.targetFields[0]} = ${b.compile(values[key])}`,
			);
			clauses.push(
				`WITH ${node},check${i} WHERE ${b.compile(values[key])} IS NULL OR check${i} IS NOT NULL`,
			);
		}
		clauses.push(
			`SET ${Object.entries(values)
				.map(
					([key, value]) => `${node}.${b.identifier(key)}=${b.compile(value)}`,
				)
				.join(",")}`,
		);
	}
	clauses.push(businessKeys(model, node));
	clauses.push(refreshLinks(model, node));
	clauses.push(returnRows(request, b));
	return clauses.filter(Boolean).join("\n");
}

function compileDelete(
	model: ModelDefinition,
	node: string,
	clauses: string[],
) {
	if (model.label === "Employee")
		throw new Error("Employee records must be deactivated, not deleted.");
	if (model.label === "Conversation") {
		clauses.push(
			`CALL { WITH ${node} OPTIONAL MATCH (message:Message) WHERE message.conversationId=${node}.id WITH collect(message) AS messages FOREACH (message IN messages | DETACH DELETE message) RETURN count(*) AS removedMessages }`,
		);
		clauses.push(`CALL { WITH ${node} OPTIONAL MATCH (turn:AssistantTurn) WHERE turn.conversationId=${node}.id OPTIONAL MATCH (inv:ToolInvocation) WHERE inv.turnId=turn.id SET inv.turnId=null RETURN count(*) AS clearedInvocations }`);
		clauses.push(
			`CALL { WITH ${node} OPTIONAL MATCH (turn:AssistantTurn) WHERE turn.conversationId=${node}.id WITH collect(turn) AS turns FOREACH (turn IN turns | DETACH DELETE turn) RETURN count(*) AS removedTurns }`,
		);
	}
	// Restrictive references are checked before any delete clauses execute.
	for (const dependent of models)
		for (const ref of references(dependent)) {
			if (
				ref.target !== model.table ||
				ref.onDelete ||
				(model.label === "Conversation" &&
					["Message", "AssistantTurn"].includes(dependent.label))
			)
				continue;
			clauses[0] += ` AND size([${relationshipPattern(`:${dependent.label}`, node, ref)} | 1]) = 0`;
		}
	clauses.push(
		`WITH ${node},properties(${node}) AS previous DETACH DELETE ${node} RETURN collect(previous) AS rows`,
	);
	return clauses.join("\n");
}
