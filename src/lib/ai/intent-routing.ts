import type { ChatMessage } from "./provider";

const LEAVE_WORDS =
	/\b(leave|sick|personal|casual|festival|vacation|pto|time off)\b/i;
// "request" is also a noun in read-only requests such as "leave request history".
const APPLY_WORDS = /\b(apply for|take (?:\w+ )?(?:leave|time off)|book (?:\w+ )?(?:leave|time off)|submit (?:a |my )?(?:\w+ )?leave)\b|(?:^|please |can i |i want to |i need to )request (?:a |some |my )?(?:\w+ )?(?:leave|time off|vacation|pto)\b/i;
const CANCEL_WORDS = /\b(cancel|withdraw|remove|revoke)\b/i;

export function getForcedToolForIntent(
	userMessage: string,
	history: ChatMessage[],
): string | undefined {
	if (APPLY_WORDS.test(userMessage) && LEAVE_WORDS.test(userMessage)) {
		return "propose_leave_request";
	}
	if (
		/\b(similar (functionality|feature|implementation)|previous implementation|built before|developed before|reuse|reusable)\b/i.test(
			userMessage,
		) &&
		!LEAVE_WORDS.test(userMessage)
	)
		return "search_delivery_knowledge";
	if (!CANCEL_WORDS.test(userMessage)) return undefined;
	if (LEAVE_WORDS.test(userMessage)) return "propose_leave_cancellation";

	const recentContext = history
		.slice(-8)
		.map((message) => message.content || "")
		.join(" ");
	return LEAVE_WORDS.test(recentContext)
		? "propose_leave_cancellation"
		: undefined;
}
