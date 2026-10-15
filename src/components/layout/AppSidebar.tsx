import { useLocation } from "@tanstack/react-router";
import { PanelLeftIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "#/components/ui/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarTrigger,
	useSidebar,
} from "#/components/ui/sidebar";
import type { NotificationRow } from "#/hooks/useNotifications";
import {
	getActiveHref,
	getNavigationGroups,
	type Role,
} from "#/lib/navigation";
import { cn } from "#/lib/utils";
import { NavUserMenu } from "./NavUserMenu";
import { NotificationBell } from "./NotificationBell";
import { SidebarGroupItems } from "./SidebarGroupItems";
import { SidebarNavItem } from "./SidebarNavItem";
import { persistCollapsedGroups } from "./sidebar-groups-cookie";
import { ThemeToggle } from "./ThemeToggle";

interface AppUserProp {
	id: string;
	name: string;
	email: string;
	role: string;
	avatarUrl?: string | null;
}

export function AppSidebar({
	role,
	userId,
	user,
	initialNotifications,
	pendingApprovalCount,
	initialCollapsedGroups,
}: {
	role: Role;
	userId?: string;
	user?: AppUserProp;
	initialNotifications: NotificationRow[];
	pendingApprovalCount: number;
	initialCollapsedGroups: string[];
}) {
	const { pathname } = useLocation();
	const { state, toggleSidebar } = useSidebar();
	const groups = getNavigationGroups(role);

	const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
	const activeHref = useMemo(
		() => getActiveHref(pathname, allItems),
		[pathname, allItems],
	);

	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
		() => new Set(initialCollapsedGroups),
	);

	const toggleGroup = useCallback((groupId: string) => {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(groupId)) {
				next.delete(groupId);
			} else {
				next.add(groupId);
			}
			persistCollapsedGroups(next);
			return next;
		});
	}, []);

	return (
		<Sidebar collapsible="icon" variant="floating">
			<SidebarHeader className="relative">
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							onClick={state === "collapsed" ? toggleSidebar : undefined}
							aria-label={state === "collapsed" ? "Expand sidebar" : undefined}
							tooltip={state === "collapsed" ? "Expand sidebar" : undefined}
							tabIndex={state === "expanded" ? -1 : undefined}
							className={cn(
								"h-8 px-1 gap-2 pr-9 group-data-[collapsible=icon]:cursor-pointer group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:pr-0!",
								state === "expanded" &&
									"cursor-default hover:bg-transparent! hover:text-sidebar-foreground! active:bg-transparent!",
							)}
						>
							<div className="flex size-6 shrink-0 items-center justify-center">
								<img
									src="/brainee-logo.svg"
									alt="Brainee.org"
									className="size-6 object-contain group-data-[collapsible=icon]:group-hover/menu-button:hidden"
								/>
								<PanelLeftIcon className="hidden size-4 group-data-[collapsible=icon]:group-hover/menu-button:block" />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
								<span className="truncate font-heading font-semibold tracking-tight text-foreground">
									Brainee.org
								</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<SidebarTrigger
					aria-label="Toggle sidebar"
					className="absolute right-2 inset-y-0 z-10 my-auto size-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden"
				/>
			</SidebarHeader>

			<SidebarContent className="gap-1 py-1">
				{groups.map((group) => {
					// First group (Workspace) is unlabelled and non-collapsible
					if (group.id === "workspace") {
						return (
							<SidebarGroup key={group.id} className="py-1">
								<SidebarGroupContent>
									<SidebarMenu>
										{group.items.map((item) => (
											<SidebarNavItem
												key={item.href}
												item={item}
												isActive={activeHref === item.href}
												pendingApprovalCount={pendingApprovalCount}
											/>
										))}
									</SidebarMenu>
								</SidebarGroupContent>
							</SidebarGroup>
						);
					}

					// In icon mode, force groups open so icons are never trapped
					const isGroupOpen =
						state === "collapsed" ? true : !collapsedGroups.has(group.id);
					const GroupIcon = group.icon;
					const hasActive = group.items.some((i) => i.href === activeHref);

					return (
						<Collapsible
							key={group.id}
							open={isGroupOpen}
							onOpenChange={() => toggleGroup(group.id)}
							className="group/collapsible py-1"
						>
							<SidebarGroup className="py-0">
								<CollapsibleTrigger
									className={cn(
										"flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-medium select-none outline-none transition-[background-color,color] duration-300 ease-standard focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden",
										hasActive
											? "bg-accent-gradient text-accent-foreground shadow-2xs"
											: "text-sidebar-foreground/80 hover:bg-card/60 hover:text-foreground",
									)}
									aria-label={`Toggle ${group.title} group`}
								>
									{GroupIcon && <GroupIcon className="size-4 shrink-0" />}
									<span className="flex-1 truncate text-left">
										{group.title}
									</span>
									<span aria-hidden="true" className="relative size-4 shrink-0">
										<span className="absolute top-1/2 left-1/2 h-0.5 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
										<span
											className={cn(
												"absolute top-1/2 left-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current transition-transform duration-500 ease-bounce",
												isGroupOpen && "rotate-90",
											)}
										/>
									</span>
								</CollapsibleTrigger>
								<CollapsibleContent className="duration-[450ms] ease-bounce">
									<SidebarGroupContent className="pt-1">
										<SidebarGroupItems
											items={group.items}
											activeHref={activeHref}
											pendingApprovalCount={pendingApprovalCount}
										/>
									</SidebarGroupContent>
								</CollapsibleContent>
							</SidebarGroup>
						</Collapsible>
					);
				})}
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<NotificationBell
							userId={userId}
							initialNotifications={initialNotifications}
							showLabel
							className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
						/>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<ThemeToggle />
					</SidebarMenuItem>
				</SidebarMenu>

				{/* User menu with Profile & Sign out dropdown */}
				<NavUserMenu user={user} />
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
