import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { desc, eq } from "@/db/graph-query";
import { checkOnboardingUser } from "../api/users";
import { Shell } from "../components/layout/Shell";
import {
	parseCollapsedGroups,
	SIDEBAR_GROUPS_COOKIE_NAME,
} from "../components/layout/sidebar-groups-cookie";
import { createDb } from "../db";
import { notifications } from "../db/schema";
import { getPendingApprovalCount } from "../lib/approval-count.server";
import { authMiddleware } from "../lib/server-fn";

export const getMyNotifications = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		const user = context.user;
		const db = createDb();
		const items = await db
			.select()
			.from(notifications)
			.where(eq(notifications.userId, user.id))
			.orderBy(desc(notifications.createdAt))
			.limit(20);

		// Map to camelCase properties for use in useNotifications
		const notificationItems = items.map((item) => ({
			id: item.id,
			userId: item.userId,
			type: item.type,
			title: item.title,
			body: item.body,
			isRead: item.isRead,
			relatedId: item.relatedId,
			relatedType: item.relatedType,
			actionUrl: item.actionUrl,
			createdAt: item.createdAt,
		}));

		const pendingApprovalCount = await getPendingApprovalCount(db, user);

		// Read on the server so SSR matches the client and groups never flash open
		const collapsedGroups = parseCollapsedGroups(
			getCookie(SIDEBAR_GROUPS_COOKIE_NAME),
		);

		return { notificationItems, pendingApprovalCount, collapsedGroups };
	});

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => {
		const user = await checkOnboardingUser();
		if (!user) {
			throw redirect({ to: "/sign-in/$" });
		}
		if (!user.isOnboarded) {
			throw redirect({ to: "/onboarding" });
		}

		const { notificationItems, pendingApprovalCount, collapsedGroups } =
			await getMyNotifications();
		return {
			user,
			notifications: notificationItems,
			pendingApprovalCount,
			collapsedGroups,
		};
	},
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	const { user, notifications, pendingApprovalCount, collapsedGroups } =
		Route.useRouteContext();

	return (
		<Shell
			user={user}
			notifications={notifications}
			pendingApprovalCount={pendingApprovalCount}
			initialCollapsedGroups={collapsedGroups}
		>
			<Outlet />
		</Shell>
	);
}
