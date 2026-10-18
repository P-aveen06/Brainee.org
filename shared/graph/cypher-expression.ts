import { byLabel, type Expression, type NodeReference } from "./model.ts";

export class CypherBindings {
	readonly params: Record<string, unknown> = {};
	readonly aliases = new Map<string, string>();
	private prefix: string;
	constructor(prefix = "p") {
		this.prefix = prefix;
	}
	identifier(value: unknown): string {
		if (
			typeof value !== "string" ||
			!/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(value)
		)
			throw new Error("Invalid graph identifier.");
		return value;
	}
	register(ref: NodeReference) {
		if (!byLabel.has(ref.label)) throw new Error("Unknown graph model.");
		this.identifier(ref.alias);
		if (this.aliases.has(ref.alias)) throw new Error("Duplicate graph alias.");
		this.aliases.set(ref.alias, ref.label);
		return `(${ref.alias}:${ref.label})`;
	}
	bind(value: unknown) {
		if (value === undefined) throw new Error("Undefined graph parameter.");
		const key = `${this.prefix}${Object.keys(this.params).length}`;
		this.params[key] = value;
		return `$${key}`;
	}
	field(label: string, alias: string, key: string) {
		if (
			this.aliases.get(alias) !== label ||
			!Object.hasOwn(byLabel.get(label)?.fields ?? {}, key)
		)
			throw new Error("Unknown graph property.");
		return `${this.identifier(alias)}.${this.identifier(key)}`;
	}
	compile(value: unknown, depth = 0): string {
		if (depth > 24) throw new Error("Graph expression is too complex.");
		if (!value || typeof value !== "object" || !("kind" in value))
			return this.bind(value);
		if ((value as NodeReference).kind === "node") {
			const ref = value as NodeReference;
			if (this.aliases.get(ref.alias) !== ref.label)
				throw new Error("Unknown projection model.");
			return `properties(${ref.alias})`;
		}
		const expr = value as Expression;
		if (expr.kind !== "expression" || !Array.isArray(expr.args))
			throw new Error("Invalid graph expression.");
		const args = expr.args;
		const child = (v: unknown) => this.compile(v, depth + 1);
		if (expr.op === "property")
			return this.field(...(args as [string, string, string]));
		if (expr.op === "literal") return this.bind(args[0]);
		if (expr.op === "and" || expr.op === "or")
			return args.length
				? `(${args.map(child).join(expr.op === "and" ? " AND " : " OR ")})`
				: expr.op === "and"
					? "true"
					: "false";
		if (expr.op === "not") return `(NOT (${child(args[0])}))`;
		if (expr.op === "isNull") return `(${child(args[0])} IS NULL)`;
		if (expr.op === "lower") return `toLower(${child(args[0])})`;
		if (expr.op === "count")
			return args.length ? `count(${child(args[0])})` : "count(*)";
		if (expr.op === "countWhen")
			return `coalesce(sum(CASE WHEN ${child(args[0])} THEN 1 ELSE 0 END),0)`;
		if (["sum", "max"].includes(expr.op))
			return `${expr.op}(${child(args[0])})`;
		if (expr.op === "greatest") {
			const a = child(args[0]),
				b = child(args[1]);
			return `(CASE WHEN ${a} > ${b} THEN ${a} ELSE ${b} END)`;
		}
		if (expr.op === "like") {
			if (typeof args[1] !== "string" || args[1].length > 1024)
				throw new Error("Invalid search pattern.");
			const escaped = args[1]
				.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
				.replaceAll("%", ".*")
				.replaceAll("_", ".");
			return `(${child(args[0])} =~ ${this.bind(`(?i)^${escaped}$`)})`;
		}
		const operators: Record<string, string> = {
			eq: "=",
			ne: "<>",
			gt: ">",
			gte: ">=",
			lt: "<",
			lte: "<=",
			in: "IN",
			add: "+",
			subtract: "-",
		};
		if (operators[expr.op]) {
			let right = args[1];
			const left = args[0] as Expression | undefined;
			if (
				left?.op === "property" &&
				left.args[2] === "id" &&
				!(right && typeof right === "object" && "kind" in right)
			) {
				right = Array.isArray(right)
					? right.map(String)
					: right == null
						? right
						: String(right);
			}
			return `(${child(args[0])} ${operators[expr.op]} ${child(right)})`;
		}
		throw new Error(`Unsupported graph expression: ${expr.op}`);
	}
}
