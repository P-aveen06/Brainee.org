import { cn } from "@/lib/utils";
import { PROJECT_HEALTH_CONFIG, type ProjectHealthKey } from "./projectStyles";

interface ProjectHealthBadgeProps {
	health?: string | null;
	className?: string;
}

export function ProjectHealthBadge({
	health,
	className,
}: ProjectHealthBadgeProps) {
	if (!health) return null;
	const config =
		PROJECT_HEALTH_CONFIG[health as ProjectHealthKey] ||
		PROJECT_HEALTH_CONFIG.green;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-md border-0 px-2 py-0.5 text-xs font-medium",
				config.badge,
				"border-0",
				className,
			)}
		>
			<span className={cn("size-1.5 shrink-0 rounded-full", config.dot)} />
			<span>{config.label}</span>
		</span>
	);
}
