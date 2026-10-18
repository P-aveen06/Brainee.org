import { CypherBindings } from "./cypher-expression.ts";
import type { GraphRequest } from "./request.ts";

function projection(bindings: CypherBindings, value: unknown): string {
	if (value && typeof value === "object" && !("kind" in value)) {
		return `{${Object.entries(value)
			.map(
				([key, child]) =>
					`${bindings.identifier(key)}:${projection(bindings, child)}`,
			)
			.join(",")}}`;
	}
	return bindings.compile(value);
}

export function compileRead(
	request: GraphRequest,
	bindings: CypherBindings,
	scope?: (alias: string, label: string) => string,
) {
	if (!request.model) throw new Error("Missing graph model.");
	const clauses = [`MATCH ${bindings.register(request.model)}`];
	const security: string[] = [];
	if (scope) security.push(scope(request.model.alias, request.model.label));
	for (const join of request.joins ?? []) {
		clauses.push(
			`${join.optional ? "OPTIONAL MATCH" : "MATCH"} ${bindings.register(join.model)} WHERE ${bindings.compile(join.condition)}`,
		);
		// Joined project records are restricted independently of the caller's filter.
		if (scope) security.push(scope(join.model.alias, join.model.label));
	}
	const predicate = request.where ? bindings.compile(request.where) : "true";
	clauses.push(
		`WITH ${[...bindings.aliases.keys()].join(",")} WHERE (${predicate}) AND ${security.length ? security.join(" AND ") : "true"}`,
	);
	const fields = request.selection ?? { _record: request.model };
	const columns = Object.entries(fields).map(([key, value], i) => ({
		key,
		expr: projection(bindings, value),
		alias: `r${i}`,
	}));
	const order = (request.order ?? []).map((order, i) => {
		const expr = order as { op?: string; args?: unknown[] };
		const direction = expr.op === "desc" ? "DESC" : "ASC";
		const value =
			expr.op === "asc" || expr.op === "desc" ? expr.args?.[0] : order;
		const text = bindings.compile(value);
		const column = columns.find((column) => column.expr === text);
		return {
			expr: text,
			alias: column?.alias ?? `s${i}`,
			direction,
			extra: !column,
		};
	});
	clauses.push(
		`WITH ${[...columns.map((c) => `${c.expr} AS ${c.alias}`), ...order.filter((o) => o.extra).map((o) => `${o.expr} AS ${o.alias}`)].join(",")}`,
	);
	if (order.length)
		clauses.push(
			`ORDER BY ${order.map((o) => `${o.alias} ${o.direction}`).join(",")}`,
		);
	if (request.offset !== undefined) {
		if (!Number.isInteger(request.offset) || request.offset < 0)
			throw new Error("Invalid graph offset.");
		clauses.push(`SKIP ${bindings.bind(request.offset)}`);
	}
	const limit = request.limit ?? 10001;
	if (!Number.isInteger(limit) || limit < 0 || limit > 10001)
		throw new Error("Graph read limit exceeded.");
	clauses.push(`LIMIT ${bindings.bind(limit)}`);
	clauses.push(
		request.selection
			? `RETURN collect({${columns.map((c) => `${bindings.identifier(c.key)}:${c.alias}`).join(",")}}) AS rows`
			: "RETURN collect(r0) AS rows",
	);
	return clauses.join("\n");
}
