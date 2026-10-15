import type { Database } from "@/db";
import type { AppUser } from "@/lib/server-fn";

export interface ToolContext {
	user: AppUser;
	db: Database;
	d1?: unknown;
}

export interface ToolExecutionResult {
	success: boolean;
	data?: unknown;
	error?: string;
	groundedRecordIds?: string[];
	/** Real (id, label) pairs from this tool's own output — used to verify citations by content, never by position. */
	groundedLabels?: Array<{ id: string; label: string }>;
	proposedAction?: {
		actionType: string;
		targetEntityType: string;
		targetEntityId: string;
		payload: Record<string, unknown>;
	};
}

export interface ToolHandler {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	execute(
		args: Record<string, unknown>,
		ctx: ToolContext,
	): Promise<ToolExecutionResult>;
}
