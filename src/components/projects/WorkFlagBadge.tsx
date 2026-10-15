"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WorkFlagBadgeProps {
	flagCode: string;
	severity: "info" | "warning" | string;
	className?: string;
}

export function WorkFlagBadge({
	flagCode,
	severity,
	className,
}: WorkFlagBadgeProps) {
	const isWarning = severity === "warning";

	return (
		<Badge
			variant="outline"
			className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider ${
				isWarning
					? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
					: "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10"
			} ${className || ""}`}
		>
			{isWarning ? (
				<AlertTriangle className="size-3 shrink-0" />
			) : (
				<AlertCircle className="size-3 shrink-0" />
			)}
			<span>{flagCode.replace(/_/g, " ")}</span>
		</Badge>
	);
}
