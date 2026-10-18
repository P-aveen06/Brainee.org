import { sampleProjects } from "../../services/graph/src/sample-catalog";
import { portfolio, type Plan } from "./portfolio";
import { portfolioMore } from "./portfolio-more";

export const plans = { ...portfolio, ...portfolioMore };
export function taskDescription(plan: Plan, index: number) {
	const [goal, steps, acceptance] = plan.work[index];
	return `Objective\n${goal}\n\nImplementation\n${steps.map((step, i) => `${i + 1}. ${step}.`).join("\n")}\n\nAcceptance criteria\n${acceptance}\n\nEvidence\nAttach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.`;
}
export function buildProjectContent(project: (typeof sampleProjects)[number], p: number) {
	const plan = plans[project.id];
	if (!plan || plan.work.length !== project.tasks.length) throw new Error(`Incomplete plan: ${project.id}`);
	const description = `${project.outcome}\n\nAudience\n${plan.audience}.\n\nScope\n${plan.scope}\n\nOut of scope\n${plan.exclusions}\n\nDelivery approach\n${plan.design}\n\nValidation\n${plan.validation}\n\nRecorded decision\n${project.decision}\n\nCurrent dependency\n${project.blocker ?? "No external blocker is currently recorded; confirm readiness during the lead's review."}`;
	const tasks = project.tasks.map((title, t) => ({ id: `sample-task-${p}-${t}`, title, description: taskDescription(plan, t) }));
	const children = plan.work.flatMap(([, steps, acceptance], t) => steps.map((title, s) => ({
		id: t === 1 && s === 0 ? `sample-task-${p}-5` : t === 3 && s === 0 ? `sample-task-${p}-6` : `sample-detail-${p}-${t}-${s}`,
		parentTaskId: tasks[t].id,
		title,
		description: `Parent task: ${tasks[t].title}\n\nAction\n${title}.\n\nContext\n${plan.work[t][0]}\n\nCompletion evidence\nProvide the artifact or check result for this action, including inputs, expected outcome and unresolved questions. Have the project lead review it against the parent acceptance criteria.\n\nParent acceptance criteria\n${acceptance}`,
		assigneeId: project.members[t % project.members.length],
		estimateHours: 2,
		sequence: s + 1,
	})));
	const architecture = `Objective\nReview the solution boundaries and failure modes for ${project.name}.\n\nDesign\n${plan.design}\n\nRecorded decision\n${project.decision}\n\nReview checklist\n1. Trace the core journey and authorization boundaries.\n2. Check data ownership, upstream failures, retries and evidence retention.\n3. Review the project-specific validation plan: ${plan.validation}\n\nAcceptance criteria\nRecord a reviewed architecture decision with alternatives, unresolved dependencies and follow-up owners. ${project.blocker ?? "Confirm there are no unresolved external dependencies."}`;
	const banner = `> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.\n\n`;
	const header = `# ${project.name}`;
	const brief = `${header} — Project brief\n\n${banner}## Outcome and audience\n\n${project.outcome}\n\n${plan.audience}.\n\n## Scope\n\n${plan.scope}\n\n## Exclusions\n\n${plan.exclusions}\n\n## Ownership\n\nProject lead: ${project.ownerId}. Delivery contributors: ${project.members.join(", ")}. Solution architect: sample-dev. Refer to the application membership list for current staffing.\n\n## Recorded delivery context\n\nStage: ${project.stage}. Health: ${project.health}. These are fixture context; consult the application for current state.\n\nDecision: ${project.decision}\n\nDependency: ${project.blocker ?? "No external blocker recorded in the fixture."}\n\n## Success and acceptance\n\n${plan.work.map(([, , acceptance], i) => `${i + 1}. ${acceptance}`).join("\n")}\n\n## Review and change control\n\nThe project lead reviews scope and acceptance evidence; the architect reviews technical decisions. Record proposed scope changes in project discussions before changing the delivery baseline. Client approval and policy decisions must be recorded explicitly.\n`;
	const design = `${header} — Solution design\n\n${banner}## Solution approach\n\n${plan.design}\n\n## Decision baseline\n\n${project.decision}\n\n## Work packages and interfaces\n\n${plan.work.map(([goal, steps], i) => `### ${i + 1}. ${project.tasks[i]}\n\n${goal}\n\n${steps.map(step => `- ${step}.`).join("\n")}`).join("\n\n")}\n\n## Validation and failure scenarios\n\n${plan.validation}\n\n## Dependency handling\n\n${project.blocker ?? "Confirm upstream contracts and reviewer availability during implementation."}\n\nPending external decisions remain explicit assumptions. Use synthetic data for local checks. Record interface examples, authorization denials and recovery evidence with the relevant task. Never include credentials or personal source data in review artifacts.\n`;
	const delivery = `${header} — Delivery and acceptance plan\n\n${banner}## Execution and evidence\n\nWork packages below describe the intended result and actionable subtasks. Current assignees, estimates, dates and completion state remain in the application. Coordinate dependencies before sequencing work; a blocked upstream approval cannot be replaced with a guessed result.\n\n${tasks.map((task, i) => `## ${i + 1}. ${task.title}\n\n${task.description}\n\n### Subtasks\n\n${children.filter(child => child.parentTaskId === task.id).map(child => `- ${child.title}.`).join("\n")}`).join("\n\n")}\n\n## Architecture review\n\n${architecture}\n\n## Quality gate\n\n${plan.validation}\n\nFor each scenario record the input, expected result, actual result and evidence reference. Log defects with severity and owner; require retest evidence before closing them. The lead records the readiness decision and any conditions.\n\n## Handoff\n\nProvide reviewed documentation, open risks, support ownership and a recovery or rollback approach appropriate to the project stage. A readiness review does not execute a deployment.\n`;
	return { description, tasks, children, architecture, documents: [
		{ slug: "brief", title: `${project.name} — Project brief`, category: "sow", text: brief },
		{ slug: "design", title: `${project.name} — Solution design`, category: "design", text: design },
		{ slug: "delivery", title: `${project.name} — Delivery and acceptance plan`, category: "report", text: delivery },
	] };
}
