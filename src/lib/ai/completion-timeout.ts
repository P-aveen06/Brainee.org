import { AssistantFailure } from "./ai-errors";
import type {
	ChatCompletionRequest,
	ChatCompletionResult,
	ChatProvider,
} from "./provider";

export const PROVIDER_TIMEOUT_MS = 60_000;
export const TURN_TIMEOUT_MS = 90_000;
export const CLIENT_TIMEOUT_MS = 100_000;
export const TOOL_TIMEOUT_MS = 12_000;

async function withProviderDeadline<T>(
	request: ChatCompletionRequest,
	deadlineMs: number,
	run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
	const remainingMs = deadlineMs - Date.now();
	if (remainingMs <= 0) {
		throw new AssistantFailure(
			"turn_timeout",
			"The assistant's processing window has expired. Please retry; no unconfirmed action was executed.",
		);
	}

	const timeoutMs = Math.min(PROVIDER_TIMEOUT_MS, remainingMs);
	const isTurnLimit = remainingMs <= PROVIDER_TIMEOUT_MS;
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			controller.abort();
			const seconds = Math.round(timeoutMs / 1000);
			reject(
				new AssistantFailure(
					isTurnLimit ? "turn_timeout" : "provider_timeout",
					isTurnLimit
						? `The assistant reached its ${seconds}-second processing limit before it could finish. Please retry; no unconfirmed action was executed.`
						: `The AI provider did not respond within ${seconds} seconds. Please retry; do not assume the requested action was performed.`,
				),
			);
		}, timeoutMs);
	});
	const abortForCaller = () => controller.abort(request.signal?.reason);
	if (request.signal?.aborted) abortForCaller();
	else
		request.signal?.addEventListener("abort", abortForCaller, { once: true });

	try {
		return await Promise.race([run(controller.signal), timeout]);
	} finally {
		if (timer) clearTimeout(timer);
		request.signal?.removeEventListener("abort", abortForCaller);
	}
}

export function completeWithinDeadline(
	provider: ChatProvider,
	request: ChatCompletionRequest,
	deadlineMs: number,
): Promise<ChatCompletionResult> {
	return withProviderDeadline(request, deadlineMs, (signal) =>
		provider.complete({ ...request, signal }),
	);
}

export function streamWithinDeadline(
	provider: ChatProvider,
	request: ChatCompletionRequest,
	deadlineMs: number,
	onTextDelta: (delta: string) => void,
): Promise<ChatCompletionResult> {
	return withProviderDeadline(request, deadlineMs, async (signal) => {
		const streamRequest = { ...request, signal };
		if (provider.stream) {
			return provider.stream(streamRequest, onTextDelta);
		}
		const result = await provider.complete(streamRequest);
		if (result.text) onTextDelta(result.text);
		return result;
	});
}
