/** Plain-language summaries for the dashboard hero. */

export function countWorkdays(
	year: number,
	monthIndex: number,
	throughDay?: number,
): number {
	const last = new Date(year, monthIndex + 1, 0).getDate();
	const end = Math.min(throughDay ?? last, last);
	let count = 0;
	for (let d = 1; d <= end; d++) {
		const dow = new Date(year, monthIndex, d).getDay();
		if (dow !== 0 && dow !== 6) count++;
	}
	return count;
}

export interface HeroInput {
	pendingApprovals: number;
	hasLoggedToday: boolean;
	outToday: string[];
	overdueTasks: number;
	dueTodayTasks: number;
}

function plural(n: number, one: string, many = `${one}s`) {
	return `${n} ${n === 1 ? one : many}`;
}

function firstName(full: string) {
	return full.split(" ")[0];
}

export function buildHeroSummary(input: HeroInput): string {
	const parts: string[] = [];
	if (input.pendingApprovals > 0) {
		parts.push(`${plural(input.pendingApprovals, "approval")} waiting`);
	}
	if (input.overdueTasks > 0) {
		parts.push(`${plural(input.overdueTasks, "task")} overdue`);
	} else if (input.dueTodayTasks > 0) {
		parts.push(`${plural(input.dueTodayTasks, "task")} due today`);
	}
	if (!input.hasLoggedToday) parts.push("you haven't logged today");
	if (input.outToday.length === 1) {
		parts.push(`${firstName(input.outToday[0])} is out`);
	} else if (input.outToday.length > 1) {
		parts.push(`${input.outToday.length} teammates are out`);
	}
	if (parts.length === 0)
		return "You're all caught up. Nothing needs you today.";
	const sentence = parts.join(", ");
	return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}
