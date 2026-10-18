import { useLocation } from "@tanstack/react-router";
import * as React from "react";
import { GlobalBrainDrawer } from "#/components/assistant/GlobalBrainDrawer";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
	useSidebar,
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

function AssistantSidebarSync({
	isAssistantPage,
}: {
	isAssistantPage: boolean;
}) {
	const { open, setOpen } = useSidebar();
	const prevAssistantPageRef = React.useRef(isAssistantPage);
	const wasOpenRef = React.useRef<boolean>(false);
	const initialMountRef = React.useRef<boolean>(true);

	React.useEffect(() => {
		if (initialMountRef.current) {
			initialMountRef.current = false;
			if (isAssistantPage && open) {
				wasOpenRef.current = true;
				setOpen(false);
			}
			return;
		}

		const wasAssistant = prevAssistantPageRef.current;
		prevAssistantPageRef.current = isAssistantPage;

		if (!wasAssistant && isAssistantPage) {
			wasOpenRef.current = open;
			if (open) {
				setOpen(false);
			}
		} else if (wasAssistant && !isAssistantPage) {
			if (wasOpenRef.current) {
				setOpen(true);
				wasOpenRef.current = false;
			}
		}
	}, [isAssistantPage, open, setOpen]);

	return null;
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
		<SidebarProvider defaultOpen={!isAssistantPage}>
			<AssistantSidebarSync isAssistantPage={isAssistantPage} />
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
					<div className="h-[calc(100dvh-3rem)] w-full min-w-0 md:h-dvh">
						<div className="h-full overflow-hidden bg-background">
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
