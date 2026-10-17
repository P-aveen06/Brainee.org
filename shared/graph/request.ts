import type { NodeReference } from "./model.ts";
export interface GraphRequest {
	action: "read" | "create" | "update" | "delete";
	model?: NodeReference;
	selection?: Record<string, unknown>;
	where?: unknown;
	joins?: { model: NodeReference; condition: unknown; optional: boolean }[];
	order?: unknown[];
	group?: unknown[];
	limit?: number;
	offset?: number;
	values?: Record<string, unknown>[];
	set?: Record<string, unknown>;
	conflict?: {
		target: unknown[];
		set?: Record<string, unknown>;
		ignore?: boolean;
	};
	returning?: boolean;
}
export type Transport = (
	operation: string,
	payload: unknown,
) => Promise<unknown>;
