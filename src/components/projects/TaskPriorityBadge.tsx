import { cn } from "@/lib/utils";
import { TASK_PRIORITY_CONFIG, type TaskPriorityKey } from "./taskStatusStyles";

interface TaskPriorityBadgeProps {
	priority: string;
	className?: string;
	showLabel?: boolean;
}

export function TaskPriorityBadge({
	priority,
	className,
	showLabel = true,
}: TaskPriorityBadgeProps) {
	const config =
		TASK_PRIORITY_CONFIG[priority as TaskPriorityKey] ||
		TASK_PRIORITY_CONFIG.medium;
	const Icon = config.icon;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-md border-0 px-2 py-0.5 text-xs font-medium",
				config.badge,
				"border-0",
				className,
			)}
		>
			<Icon className={cn("size-3 shrink-0", config.color)} />
			{showLabel && <span>{config.label}</span>}
		</span>
	);
}
