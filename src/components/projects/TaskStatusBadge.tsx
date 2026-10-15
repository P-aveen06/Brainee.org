import { cn } from "@/lib/utils";
import { TASK_STATUS_CONFIG, type TaskStatusKey } from "./taskStatusStyles";

interface TaskStatusBadgeProps {
	status: string;
	className?: string;
	showIcon?: boolean;
}

export function TaskStatusBadge({
	status,
	className,
	showIcon = false,
}: TaskStatusBadgeProps) {
	const config =
		TASK_STATUS_CONFIG[status as TaskStatusKey] || TASK_STATUS_CONFIG.todo;
	const Icon = config.icon;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-md border-0 px-2 py-0.5 text-xs font-medium",
				config.badge,
				"border-0",
				className,
			)}
		>
			{showIcon ? (
				<Icon className="size-3" />
			) : (
				<span className={cn("size-1.5 rounded-full", config.dot)} />
			)}
			<span>{config.label}</span>
		</span>
	);
}
