"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
	role: string;
	className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
	const norm = role.toLowerCase();

	switch (norm) {
		case "admin":
			return (
				<Badge
					className={cn(
						"border-0 bg-[#e9f5fe] px-2 py-0.5 text-xs font-medium text-[#0091ff] shadow-none rounded-md hover:bg-[#d0ebff] dark:bg-[#0091ff]/20 dark:text-[#38bdf8]",
						className,
					)}
				>
					Admin
				</Badge>
			);
		case "lead":
			return (
				<Badge
					className={cn(
						"border-0 bg-pale-orange px-2 py-0.5 text-xs font-medium text-logo-orange shadow-none rounded-md hover:bg-pale-orange/80 dark:bg-pale-orange/20",
						className,
					)}
				>
					Lead
				</Badge>
			);
		case "hr":
			return (
				<Badge
					className={cn(
						"border-0 bg-[#efedfd] px-2 py-0.5 text-xs font-medium text-[#7612fa] shadow-none rounded-md hover:bg-[#e2dcfe] dark:bg-[#7612fa]/20 dark:text-[#a78bfa]",
						className,
					)}
				>
					HR
				</Badge>
			);
		default:
			return (
				<Badge
					className={cn(
						"border-0 bg-surface-alt px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-none rounded-md hover:bg-surface-alt/80 capitalize",
						className,
					)}
				>
					{norm === "user" || !role ? "Employee" : role}
				</Badge>
			);
	}
}
