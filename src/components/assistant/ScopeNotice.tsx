import { ShieldAlert, ShieldCheck } from "lucide-react";

interface ScopeNoticeProps {
	userRole: string;
	projectCount?: number;
}

export function ScopeNotice({ userRole, projectCount = 0 }: ScopeNoticeProps) {
	const isAdmin = userRole === "admin";

	return (
		<div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
			{isAdmin ? (
				<>
					<ShieldAlert className="w-3 h-3 text-amber-500 shrink-0" />
					<span>
						Admin scope — sees all projects, inventory, and approvals.
					</span>
				</>
			) : (
				<>
					<ShieldCheck className="w-3 h-3 text-primary shrink-0" />
					<span>
						Scoped to your {projectCount} assigned project(s), leaves, and
						equipment.
					</span>
				</>
			)}
		</div>
	);
}
