export interface AssistantQuestionOption {
	id: string;
	label: string;
	description?: string;
}

export interface AssistantQuestion {
	id: string;
	prompt: string;
	type: "single_choice" | "multiple_choice" | "text";
	suggestedAnswer?: string;
	options?: AssistantQuestionOption[];
	allowOther?: boolean;
}

export interface AssistantQuestionSet {
	requestId: string;
	questions: AssistantQuestion[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 && trimmed.length <= maxLength
		? trimmed
		: undefined;
}

export function parseAssistantQuestionSet(
	value: unknown,
	requestId?: string,
): AssistantQuestionSet | undefined {
	if (!isRecord(value) || !Array.isArray(value.questions)) return undefined;
	if (value.questions.length < 1 || value.questions.length > 5)
		return undefined;
	const resolvedRequestId =
		requestId || boundedString(value.requestId, 120) || "";

	const questions: AssistantQuestion[] = [];
	const questionIds = new Set<string>();
	for (const item of value.questions) {
		if (!isRecord(item)) return undefined;
		const id = boundedString(item.id, 60);
		const prompt = boundedString(item.prompt, 240);
		const type = item.type;
		if (
			!id ||
			!/^[a-z0-9_-]+$/i.test(id) ||
			questionIds.has(id) ||
			!prompt ||
			(type !== "single_choice" &&
				type !== "multiple_choice" &&
				type !== "text")
		) {
			return undefined;
		}
		questionIds.add(id);

		if (type === "text") {
			const suggestedAnswer = boundedString(item.suggestedAnswer, 1200);
			questions.push({
				id,
				prompt,
				type,
				...(suggestedAnswer ? { suggestedAnswer } : {}),
			});
			continue;
		}

		if (
			!Array.isArray(item.options) ||
			item.options.length < 2 ||
			item.options.length > 7
		) {
			return undefined;
		}
		const optionIds = new Set<string>();
		const options: AssistantQuestionOption[] = [];
		for (const rawOption of item.options) {
			if (!isRecord(rawOption)) return undefined;
			const optionId = boundedString(rawOption.id, 80);
			const label = boundedString(rawOption.label, 120);
			const description = rawOption.description
				? boundedString(rawOption.description, 240)
				: undefined;
			if (
				!optionId ||
				!label ||
				optionIds.has(optionId) ||
				(rawOption.description && !description)
			) {
				return undefined;
			}
			optionIds.add(optionId);
			options.push({
				id: optionId,
				label,
				...(description ? { description } : {}),
			});
		}
		questions.push({
			id,
			prompt,
			type,
			options,
			allowOther: item.allowOther === true,
		});
	}

	return { requestId: resolvedRequestId, questions };
}
