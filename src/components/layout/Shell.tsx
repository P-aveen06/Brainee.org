import { useLocation } from "@tanstack/react-router";
import { GlobalBrainDrawer } from "#/components/assistant/GlobalBrainDrawer";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "#/components/ui/sidebar";
import type { NotificationRow } from "#/hooks/useNotifications";
import type { Role } from "#/lib/navigation";
import { AppSidebar } from "./AppSidebar";

interface ShellProps {
	user: {
		id: string;
		name: string;
		email: string;
		role: string;
		avatarUrl?: string | null;
	};
	notifications: NotificationRow[];
	pendingApprovalCount: number;
	initialCollapsedGroups: string[];
	children: React.ReactNode;
}

export function Shell({
	user,
	notifications,
	pendingApprovalCount,
	initialCollapsedGroups,
	children,
}: ShellProps) {
	const role = (user?.role as Role) || "user";
	const { pathname } = useLocation();
	const isAssistantPage = pathname.startsWith("/assistant");
	const isDashboard = pathname === "/" || pathname === "";

	return (
		<SidebarProvider>
			<AppSidebar
				role={role}
				userId={user?.id}
				user={user}
				initialNotifications={notifications}
				pendingApprovalCount={pendingApprovalCount}
				initialCollapsedGroups={initialCollapsedGroups}
			/>
			<SidebarInset className="min-w-0 bg-background">
				{/* Mobile-only sticky topbar with navigation trigger */}
				<header className="sticky top-0 z-20 flex h-12 w-full shrink-0 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur md:hidden">
					<div className="flex items-center gap-2.5">
						<SidebarTrigger
							aria-label="Open navigation menu"
							className="size-8 text-foreground/80 hover:bg-surface-alt hover:text-foreground"
						/>
						<span className="font-heading font-bold text-sm tracking-tight text-foreground">
							Brainee.org
						</span>
					</div>
				</header>

				{isAssistantPage ? (
					<div className="h-[calc(100vh-3rem)] w-full min-w-0 px-2.5 py-3 sm:px-4 sm:py-3.5 md:h-screen lg:px-4.5">
						<div className="h-full overflow-hidden rounded-2xl bg-background shadow-[0_4px_24px_rgba(9,12,29,0.08)] ring-1 ring-border">
							{children}
						</div>
					</div>
				) : isDashboard ? (
					<div className="mx-auto min-w-0 w-full max-w-[1600px] px-2.5 pt-3 pb-3 sm:px-4 sm:pt-3.5 sm:pb-4 lg:px-4.5">
						{children}
					</div>
				) : (
					<>
						<div className="mx-auto min-w-0 w-full max-w-[1600px] px-2.5 pt-3 pb-16 sm:px-4 sm:pt-3.5 lg:px-4.5">
							{children}
						</div>
						{/* Bottom fade: content dissolves into the page background */}
						<div
							aria-hidden="true"
							className="pointer-events-none sticky bottom-0 z-10 -mt-16 h-16 shrink-0 bg-gradient-to-t from-background via-background/80 to-transparent"
						/>
					</>
				)}
			</SidebarInset>
			<GlobalBrainDrawer />
		</SidebarProvider>
	);
}
