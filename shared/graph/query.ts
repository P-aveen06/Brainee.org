import {
	byLabel,
	hydrate,
	nodeRef,
	wire,
	type Expression,
	type NodeModel,
	type RowOf,
} from "./model.ts";
import type { GraphRequest, Transport } from "./request.ts";

type InferValue<T> =
	T extends Expression<infer Value>
		? Value
		: T extends { $inferSelect: infer Row }
			? Row | null
			: T extends object
				? { [K in keyof T]: InferValue<T[K]> }
				: T;
type Projection = Record<string, unknown>;
type Result<S, M> = S extends Projection
	? { [K in keyof S]: InferValue<S[K]> }
	: RowOf<M>;
type Updates<Row> = { [K in keyof Row]?: Row[K] | Expression<Row[K]> };

function decode(selection: unknown, value: unknown): unknown {
	if (value == null) return value;
	if (selection && typeof selection === "object" && "$node" in selection) {
		return hydrate(
			byLabel.get((selection as NodeModel<object>).$node.label)!,
			value as Record<string, unknown>,
		);
	}
	if (selection && typeof selection === "object" && "op" in selection) {
		const expr = selection as Expression;
		if (expr.op === "property") {
			const [label, , key] = expr.args as string[];
			if (byLabel.get(label)?.fields[key]?.type === "date")
				return new Date(Number(value));
			if (key === "id" && byLabel.get(label)?.fields[key]?.type === "number")
				return Number(value);
		}
		return value;
	}
	if (selection && typeof selection === "object") {
		return Object.fromEntries(
			Object.entries(selection).map(([key, child]) => [
				key,
				decode(child, (value as Record<string, unknown>)[key]),
			]),
		);
	}
	return value;
}

export class GraphQuery<S = undefined, M = never>
	implements PromiseLike<Result<S, M>[]>
{
	readonly request: GraphRequest;
	private model?: NodeModel<object>;
	private selected?: Projection;
	private transport: Transport;
	constructor(
		transport: Transport,
		action: GraphRequest["action"],
		selection?: S,
	) {
		this.transport = transport;
		this.request = { action };
		if (selection) {
			this.selected = selection as Projection;
			this.request.selection = wire(selection) as Projection;
		}
	}
	from<N extends NodeModel<object>>(model: N): GraphQuery<S, N> {
		this.model = model;
		this.request.model = nodeRef(model);
		return this as unknown as GraphQuery<S, N>;
	}
	where(condition?: unknown) {
		this.request.where = wire(condition);
		return this;
	}
	leftJoin(model: NodeModel<object>, condition: unknown) {
		return this.join(model, condition, true);
	}
	innerJoin(model: NodeModel<object>, condition: unknown) {
		return this.join(model, condition, false);
	}
	private join(
		model: NodeModel<object>,
		condition: unknown,
		optional: boolean,
	) {
		(this.request.joins ??= []).push({
			model: nodeRef(model),
			condition: wire(condition),
			optional,
		});
		return this;
	}
	orderBy(...values: unknown[]) {
		this.request.order = wire(values) as unknown[];
		return this;
	}
	groupBy(...values: unknown[]) {
		this.request.group = wire(values) as unknown[];
		return this;
	}
	limit(value: number) {
		this.request.limit = value;
		return this;
	}
	offset(value: number) {
		this.request.offset = value;
		return this;
	}
	set(values: Updates<RowOf<M>>) {
		this.request.set = wire(values) as Record<string, unknown>;
		return this;
	}
	values(values: Partial<RowOf<M>> | Partial<RowOf<M>>[]) {
		this.request.values = wire(
			Array.isArray(values) ? values : [values],
		) as Record<string, unknown>[];
		return this;
	}
	onConflictDoUpdate(options: {
		target: unknown | unknown[];
		set: Updates<RowOf<M>>;
	}) {
		this.request.conflict = {
			target: wire(
				Array.isArray(options.target) ? options.target : [options.target],
			) as unknown[],
			set: wire(options.set) as Record<string, unknown>,
		};
		return this;
	}
	onConflictDoNothing(options?: { target?: unknown | unknown[] }) {
		const target = options?.target;
		this.request.conflict = {
			target: wire(
				target ? (Array.isArray(target) ? target : [target]) : [],
			) as unknown[],
			ignore: true,
		};
		return this;
	}
	returning(): GraphQuery<undefined, M>;
	returning<P extends Projection>(selection: P): GraphQuery<P, M>;
	returning(selection?: Projection): GraphQuery<unknown, M> {
		this.request.returning = true;
		this.selected = selection;
		this.request.selection = wire(selection) as Projection;
		return this as GraphQuery<unknown, M>;
	}
	then<TResult1 = Result<S, M>[], TResult2 = never>(
		fulfilled?:
			| ((value: Result<S, M>[]) => TResult1 | PromiseLike<TResult1>)
			| null,
		rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		return this.execute().then(fulfilled, rejected);
	}
	private async execute(): Promise<Result<S, M>[]> {
		if (!this.model) throw new Error("Graph query has no model.");
		const rows = (await this.transport("data.execute", this.request)) as Record<
			string,
			unknown
		>[];
		return rows.map((row) =>
			this.selected
				? decode(this.selected, row)
				: hydrate(byLabel.get(this.model!.$node.label)!, row),
		) as Result<S, M>[];
	}
}

export class GraphDatabase {
	private transport: Transport;
	constructor(transport: Transport) {
		this.transport = transport;
	}
	select<S extends Projection | undefined = undefined>(selection?: S) {
		return new GraphQuery<S>(this.transport, "read", selection);
	}
	insert<M extends NodeModel<object>>(model: M) {
		return new GraphQuery(this.transport, "create").from(model);
	}
	update<M extends NodeModel<object>>(model: M) {
		return new GraphQuery(this.transport, "update").from(model);
	}
	delete<M extends NodeModel<object>>(model: M) {
		return new GraphQuery(this.transport, "delete").from(model);
	}
	batch(queries: { request: GraphRequest }[]) {
		return this.transport(
			"data.batch",
			queries.map((query) => query.request),
		);
	}
	operation<T = Record<string, unknown>>(name: string, payload: unknown) {
		return this.transport(name, payload) as Promise<T>;
	}
}
