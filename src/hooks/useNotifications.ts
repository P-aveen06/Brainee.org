import { useEffect, useState } from "react";

export type NotificationRow = {
	id: string;
	userId: string;
	type: string;
	title: string;
	body: string;
	isRead: boolean;
	relatedId: string | null;
	relatedType: string | null;
	actionUrl: string | null;
	createdAt: Date | null;
};

export function useNotifications(
	_userId: string | undefined,
	initialData: NotificationRow[] = [],
) {
	const [notifications, setNotifications] =
		useState<NotificationRow[]>(initialData);

	useEffect(() => {
		setNotifications(initialData);
	}, [initialData]);

	const unreadCount = notifications.filter((n) => !n.isRead).length;

	return {
		notifications,
		unreadCount,
		setNotifications,
	};
}
