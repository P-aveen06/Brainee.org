export type AssistantFailureCode =
	| "provider_timeout"
	| "turn_timeout"
	| "request_interrupted"
	| "provider_unavailable"
	| "turn_failed";

export class AssistantFailure extends Error {
	constructor(
		public readonly code: AssistantFailureCode,
		public readonly publicMessage: string,
	) {
		super(publicMessage);
		this.name = "AssistantFailure";
	}
}

export function classifyAssistantFailure(error: unknown): {
	code: AssistantFailureCode;
	publicMessage: string;
	label: "Timeout" | "Interrupted" | "Service Error" | "Error";
} {
	if (error instanceof AssistantFailure) {
		return {
			code: error.code,
			publicMessage: error.publicMessage,
			label:
				error.code === "provider_timeout" || error.code === "turn_timeout"
					? "Timeout"
					: error.code === "request_interrupted"
						? "Interrupted"
						: "Service Error",
		};
	}
	if (error instanceof DOMException && error.name === "AbortError") {
		return {
			code: "request_interrupted",
			label: "Interrupted",
			publicMessage:
				"The response was interrupted before it completed. Please retry; do not assume the requested action was performed.",
		};
	}
	return {
		code: "turn_failed",
		label: "Error",
		publicMessage:
			"Company Brain could not complete this response. Please retry; do not assume the requested action was performed.",
	};
}
