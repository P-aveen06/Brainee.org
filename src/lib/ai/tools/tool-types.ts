import type { Database } from "@/db";
import type { AppUser } from "@/lib/server-fn";
import type { AssistantToolProgress } from "../assistant-activity";
import type { ScopedAssistantChart } from "../chart-types";
import type { GroundedLabel } from "../citations";
import type { PitchTurnState } from "../pitch-types";

export interface ToolContext {
	user: AppUser;
	db: Database;
	d1?: unknown;
	pitchState?: PitchTurnState;
	onToolProgress?: (progress: AssistantToolProgress) => void;
}

export interface ToolExecutionResult {
	success: boolean;
	data?: unknown;
	error?: string;
	groundedRecordIds?: string[];
	/** Real (id, label) pairs from this tool's own output — used to verify citations by content, never by position. */
	groundedLabels?: GroundedLabel[];
	knowledgeScope?: "company_delivery";
	scopeProjectIds?: string[];
	/** Private chart scope metadata used to persist and re-authorize an inline chart. */
	chart?: ScopedAssistantChart;
	proposedAction?: {
		actionType: string;
		targetEntityType: string;
		targetEntityId: string;
		payload: Record<string, unknown>;
	};
	proposedActions?: Array<NonNullable<ToolExecutionResult["proposedAction"]>>;
}

export interface ToolHandler {
	name: string;
	timeoutMs?: number;
	description: string;
	parameters: Record<string, unknown>;
	execute(
		args: Record<string, unknown>,
		ctx: ToolContext,
	): Promise<ToolExecutionResult>;
}
