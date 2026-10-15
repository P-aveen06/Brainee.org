import { Link } from "@tanstack/react-router";
import {
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar";
import type { NavItem } from "#/lib/navigation";
import { cn } from "#/lib/utils";

export function SidebarNavItem({
	item,
	isActive,
	pendingApprovalCount,
}: {
	item: NavItem;
	isActive: boolean;
	pendingApprovalCount: number;
}) {
	const badge =
		item.badgeType === "approvals" && pendingApprovalCount > 0
			? pendingApprovalCount > 99
				? "99+"
				: String(pendingApprovalCount)
			: null;

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				render={<Link to={item.href} />}
				isActive={isActive}
				tooltip={item.label}
				aria-current={isActive ? "page" : undefined}
				className={cn(
					"h-8 gap-2.5 rounded-xl px-2.5 text-[13px] ease-standard",
					isActive
						? "bg-card font-semibold text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.10)] hover:bg-card hover:text-foreground"
						: "bg-transparent text-sidebar-foreground/80 hover:bg-card/60 hover:text-foreground",
				)}
			>
				<item.icon className="size-4" />
				<span>{item.label}</span>
			</SidebarMenuButton>
			{badge && (
				<SidebarMenuBadge
					title={`${pendingApprovalCount} pending approval${pendingApprovalCount === 1 ? "" : "s"}`}
					className="bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-active/menu-button:text-primary-foreground group-data-[collapsible=icon]:right-1 group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:flex! group-data-[collapsible=icon]:h-2! group-data-[collapsible=icon]:w-2! group-data-[collapsible=icon]:min-w-0! group-data-[collapsible=icon]:min-h-0! group-data-[collapsible=icon]:rounded-full! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:text-[0px] group-data-[collapsible=icon]:bg-primary!"
				>
					{badge}
					<span className="sr-only"> pending approvals</span>
				</SidebarMenuBadge>
			)}
		</SidebarMenuItem>
	);
}
