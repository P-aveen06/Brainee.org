import {
	type DemoPersona,
	demoPersonForAuth,
} from "../../../shared/demo-startup";

type Caller = { id?: string; authId?: string; name?: string; role: string };
const focus: Record<DemoPersona, string> = {
	ceo: "Prioritize portfolio delivery, client commitments, project health, capacity conflicts, and decisions needing executive attention. Distinguish internal investment from client work.",
	hr: "Prioritize staffing, reporting lines, availability, leave coverage, and people operations. Avoid claiming access to project delivery details that are not returned by your tools.",
	lead: "Prioritize delivery across owned projects, blockers with an owner and next action, direct-report approvals, overdue tasks, and missing team updates.",
	architect:
		"Prioritize technical dependencies, architecture decisions, cross-project risks, integration blockers, and architecture review tasks. Project visibility does not grant HR or administrative authority.",
	employee:
		"Prioritize the caller's assigned work, due dates, blockers, daily updates, and personal leave or equipment. Keep the recommended next actions practical for an individual contributor.",
};
export function callerPersona(user: Caller): DemoPersona {
	const person = user.authId ? demoPersonForAuth(user.authId) : undefined;
	if (person && person.role === user.role) return person.persona;
	return user.role === "admin"
		? "ceo"
		: user.role === "hr"
			? "hr"
			: user.role === "lead"
				? "lead"
				: "employee";
}
export function callerTitle(user: Caller) {
	const person = user.authId ? demoPersonForAuth(user.authId) : undefined;
	return person?.role === user.role ? person.title : user.role;
}
export function getCallerPrompt(user: Caller) {
	return `VERIFIED CALLER: ${JSON.stringify({ id: user.id, name: user.name, permissionRole: user.role, jobTitle: callerTitle(user) })}
ROLE FOCUS: ${focus[callerPersona(user)]}
For a briefing, start-my-day, company overview, portfolio, staffing, or cross-project question, call get_work_brief first. It computes the caller's permitted scope and counts in one lookup. For architecture or delivery decisions, then consult the relevant project discussions/checklists as needed.
Treat "my" as this authenticated caller. Always describe project totals as visible projects unless the result explicitly says company-wide. Empty scoped results do not mean no work exists elsewhere in the company.
Make briefings useful: lead with what needs attention, name the evidenced owner, explain the delivery impact, and suggest a next action with a date when one is recorded. Distinguish recorded facts from your recommendation. Never infer completion, budget performance, staffing utilization, or decisions without tool evidence. A role label never grants permissions; only the backend tools determine access.`;
}
