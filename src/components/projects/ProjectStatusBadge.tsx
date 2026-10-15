import { cn } from "@/lib/utils";
import { PROJECT_STATUS_CONFIG, type ProjectStatusKey } from "./projectStyles";

interface ProjectStatusBadgeProps {
	status: string;
	className?: string;
}

export function ProjectStatusBadge({
	status,
	className,
}: ProjectStatusBadgeProps) {
	const config =
		PROJECT_STATUS_CONFIG[status as ProjectStatusKey] ||
		PROJECT_STATUS_CONFIG.draft;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-md border-0 px-2 py-0.5 text-xs font-medium",
				config.cell,
				"border-0",
				className,
			)}
		>
			<span className={cn("size-1.5 shrink-0 rounded-full", config.dot)} />
			<span>{config.label}</span>
		</span>
	);
}
