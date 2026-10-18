import { ShieldCheck } from "lucide-react";

interface ScopeNoticeProps {
	userRole: string;
	projectCount?: number;
}

export function ScopeNotice({ userRole, projectCount = 0 }: ScopeNoticeProps) {
	const isAdmin = userRole === "admin";

	return (
		<div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
			{isAdmin ? (
				<>
					<ShieldCheck className="w-3 h-3 text-primary shrink-0" />
					<span>Company-wide projects, inventory, and approvals.</span>
				</>
			) : (
				<>
					<ShieldCheck className="w-3 h-3 text-primary shrink-0" />
					<span>
						{userRole === "hr"
							? "People operations, availability, and personal requests."
							: `Your ${projectCount} assigned projects, leave, and equipment.`}
					</span>
				</>
			)}
		</div>
	);
}
