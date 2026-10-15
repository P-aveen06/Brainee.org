import { cn } from "@/lib/utils";
import { MEMBER_ROLE_CONFIG, type MemberRoleKey } from "./projectStyles";

interface MemberRoleBadgeProps {
	role: string;
	className?: string;
}

export function MemberRoleBadge({ role, className }: MemberRoleBadgeProps) {
	const config =
		MEMBER_ROLE_CONFIG[role as MemberRoleKey] || MEMBER_ROLE_CONFIG.contributor;
	const Icon = config.icon;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium border",
				config.badge,
				className,
			)}
		>
			<Icon className="size-3" />
			<span>{config.label}</span>
		</span>
	);
}
