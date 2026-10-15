import { Link } from "@tanstack/react-router";
import type { DashboardTask } from "#/lib/dashboard-extras.server";
import { formatDateDisplay } from "#/lib/date-format";
import { getTodayIsoDate } from "#/lib/leave-policy";
import { cn } from "#/lib/utils";

const PRIORITY_DOT: Record<string, string> = {
	low: "bg-muted-foreground/40",
	medium: "bg-accent",
	high: "bg-logo-orange",
	critical: "bg-destructive",
};

export function dueLabel(due: string | null) {
	if (!due) return { text: "No due date", tone: "text-muted-foreground" };
	const today = getTodayIsoDate();
	if (due < today) return { text: "Overdue", tone: "text-destructive" };
	if (due === today)
		return { text: "Today", tone: "text-amber-600 dark:text-amber-400" };
	return { text: formatDateDisplay(due), tone: "text-muted-foreground" };
}

export function TaskRow({ task }: { task: DashboardTask }) {
	const due = dueLabel(task.dueDate);
	return (
		<Link
			to="/projects/$id"
			params={{ id: task.projectId }}
			className="group/task -mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all duration-150 ease-out hover:bg-surface-alt hover:translate-x-1 hover:shadow-2xs"
		>
			<span
				aria-hidden="true"
				className={cn(
					"size-2 shrink-0 rounded-full transition-transform duration-150 group-hover/task:scale-125",
					PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium,
				)}
			/>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-[13px] font-medium">
					{task.title}
				</span>
				<span className="block font-mono text-[10px] text-muted-foreground">
					{task.projectCode}
				</span>
			</span>
			<span className={cn("shrink-0 text-xs font-medium", due.tone)}>
				{due.text}
			</span>
		</Link>
	);
}
