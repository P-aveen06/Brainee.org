import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import {
	markAllNotificationsRead,
	markNotificationRead,
} from "#/api/notifications";
import { Button, buttonVariants } from "#/components/ui/button";
import { PillToggle } from "#/components/ui/pill-toggle";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "#/components/ui/popover";
import {
	type NotificationRow,
	useNotifications,
} from "#/hooks/useNotifications";
import { cn } from "#/lib/utils";

type NotificationBellProps = {
	userId: string | undefined;
	initialNotifications: NotificationRow[];
	showLabel?: boolean;
	className?: string;
};

type NotificationFilter = "all" | "requests" | "unread";

const FILTERS: { value: NotificationFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "requests", label: "Requests" },
	{ value: "unread", label: "Unread" },
];

function isRequestNotification(notification: NotificationRow) {
	return (
		notification.type.startsWith("leave_") ||
		notification.type.startsWith("wfh_") ||
		notification.type.startsWith("eod_")
	);
}

export function NotificationBell({
	userId,
	initialNotifications,
	showLabel = false,
	className,
}: NotificationBellProps) {
	const navigate = useNavigate();
	const { notifications, unreadCount, setNotifications } = useNotifications(
		userId,
		initialNotifications,
	);
	const [isPending, startTransition] = useTransition();
	const [filter, setFilter] = useState<NotificationFilter>("all");
	const [open, setOpen] = useState(false);

	const filteredNotifications = useMemo(() => {
		if (filter === "requests") {
			return notifications.filter(isRequestNotification);
		}

		if (filter === "unread") {
			return notifications.filter((notification) => !notification.isRead);
		}

		return notifications;
	}, [filter, notifications]);

	const handleMarkRead = (id: string) => {
		// Optimistic update
		setNotifications((prev) =>
			prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
		);
		startTransition(async () => {
			await markNotificationRead({ data: id });
		});
	};

	const handleMarkAllRead = () => {
		// Optimistic update
		setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
		startTransition(async () => {
			await markAllNotificationsRead();
		});
	};

	const handleOpenNotification = (notification: NotificationRow) => {
		if (!notification.actionUrl) return;

		if (!notification.isRead) {
			handleMarkRead(notification.id);
		}
		setOpen(false);
		navigate({ to: notification.actionUrl });
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<button
						type="button"
						className={cn(
							buttonVariants({
								variant: "ghost",
								size: showLabel ? "default" : "icon",
							}),
							"relative",
							showLabel &&
								"h-8 w-full justify-start gap-2.5 rounded-xl px-2.5 text-[13px] ease-standard",
							className,
						)}
					>
						<Bell className="size-4 shrink-0" />
						{showLabel && (
							<span className="flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
								Notifications
							</span>
						)}
						{unreadCount > 0 && (
							<span
								className={cn(
									"relative flex size-2 shrink-0 items-center justify-center",
									showLabel
										? "group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-1.5 group-data-[collapsible=icon]:right-1.5"
										: "absolute top-1.5 right-1.5",
								)}
							>
								<span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
								<span className="relative inline-flex size-2 rounded-full bg-destructive" />
							</span>
						)}
						<span className="sr-only">Open notifications</span>
					</button>
				}
			/>
			<PopoverContent
				align={showLabel ? "start" : "end"}
				side={showLabel ? "top" : "bottom"}
				sideOffset={8}
				className="max-h-[min(620px,calc(100vh-2rem))] w-[min(560px,calc(100vw-2rem))] gap-0 overflow-hidden p-0"
			>
				<PopoverHeader className="border-b px-5 py-4">
					<PopoverTitle className="text-xl">All notifications</PopoverTitle>
					<PopoverDescription className="mt-1">
						{unreadCount} unread updates.
					</PopoverDescription>
				</PopoverHeader>

				<div className="border-b px-5 py-2.5">
					<PillToggle
						items={FILTERS}
						value={filter}
						onChange={(val) =>
							setFilter(val as (typeof FILTERS)[number]["value"])
						}
					/>
				</div>

				<div className="flex items-center justify-between border-b px-5 py-3">
					<p className="text-sm text-muted-foreground">
						Showing {filteredNotifications.length} of {notifications.length}
					</p>
					{unreadCount > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-auto p-1 px-2 text-xs"
							onClick={handleMarkAllRead}
							disabled={isPending}
						>
							<CheckCheck className="mr-1 h-3 w-3" /> Mark all read
						</Button>
					)}
				</div>

				<div className="max-h-[440px] overflow-y-auto">
					{filteredNotifications.length === 0 ? (
						<div className="py-8 text-center text-sm text-muted-foreground">
							No notifications yet.
						</div>
					) : (
						<div className="flex flex-col">
							{filteredNotifications.map((notification) => (
								<div
									key={notification.id}
									className={cn(
										"grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b p-4 transition-colors last:border-0 hover:bg-muted/50",
										!notification.isRead && "bg-muted/30",
									)}
								>
									{notification.actionUrl ? (
										<button
											type="button"
											onClick={() => handleOpenNotification(notification)}
											className="min-w-0 space-y-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										>
											<span className="block text-sm font-medium">
												{notification.title}
											</span>
											<span className="block text-sm text-muted-foreground">
												{notification.body}
											</span>
											<span className="mt-1 block text-xs text-muted-foreground/70">
												{formatDistanceToNow(
													notification.createdAt
														? new Date(notification.createdAt)
														: new Date(),
													{ addSuffix: true },
												)}
											</span>
											<span className="sr-only">Open related page</span>
										</button>
									) : (
										<div className="min-w-0 space-y-1">
											<span className="block text-sm font-medium">
												{notification.title}
											</span>
											<p className="text-sm text-muted-foreground">
												{notification.body}
											</p>
											<span className="mt-1 block text-xs text-muted-foreground/70">
												{formatDistanceToNow(
													notification.createdAt
														? new Date(notification.createdAt)
														: new Date(),
													{ addSuffix: true },
												)}
											</span>
										</div>
									)}
									{!notification.isRead && (
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 shrink-0"
											onClick={() => handleMarkRead(notification.id)}
											disabled={isPending}
											title="Mark as read"
										>
											<Check className="h-3 w-3" />
											<span className="sr-only">Mark as read</span>
										</Button>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
