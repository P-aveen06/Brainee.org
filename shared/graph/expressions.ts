import type { Expression } from "./model.ts";
export const expression = <T = unknown>(
	op: string,
	...args: unknown[]
): Expression<T> => ({ kind: "expression", op, args });
export const eq = (a: unknown, b: unknown) => expression<boolean>("eq", a, b);
export const ne = (a: unknown, b: unknown) => expression<boolean>("ne", a, b);
export const gt = (a: unknown, b: unknown) => expression<boolean>("gt", a, b);
export const gte = (a: unknown, b: unknown) => expression<boolean>("gte", a, b);
export const lt = (a: unknown, b: unknown) => expression<boolean>("lt", a, b);
export const lte = (a: unknown, b: unknown) => expression<boolean>("lte", a, b);
export const and = (...args: unknown[]) =>
	expression<boolean>("and", ...args.filter((v) => v !== undefined));
export const or = (...args: unknown[]) =>
	expression<boolean>("or", ...args.filter((v) => v !== undefined));
export const not = (a: unknown) => expression<boolean>("not", a);
export const inArray = (a: unknown, b: readonly unknown[]) =>
	expression<boolean>("in", a, b);
export const notInArray = (a: unknown, b: readonly unknown[]) =>
	not(inArray(a, b));
export const isNull = (a: unknown) => expression<boolean>("isNull", a);
export const isNotNull = (a: unknown) => not(isNull(a));
export const like = (a: unknown, b: string) =>
	expression<boolean>("like", a, b);
export const lower = (a: unknown) => expression<string>("lower", a);
export const count = (a?: unknown) =>
	expression<number>("count", ...(a === undefined ? [] : [a]));
export const sum = (a: unknown) => expression<number>("sum", a);
export const max = (a: unknown) => expression<number>("max", a);
export const add = (a: unknown, b: unknown) => expression<number>("add", a, b);
export const subtract = (a: unknown, b: unknown) =>
	expression<number>("subtract", a, b);
export const greatest = (a: unknown, b: unknown) =>
	expression<number>("greatest", a, b);
export const countWhen = (a: unknown) => expression<number>("countWhen", a);
export const constant = <T>(a: T) => expression<T>("literal", a);
export const asc = (a: unknown) => expression("asc", a);
export const desc = (a: unknown) => expression("desc", a);
export { alias, aliasedTable } from "./model.ts";
