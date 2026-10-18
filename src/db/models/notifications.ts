import { defineNode } from "../../../shared/graph/model";

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

export const notifications = defineNode<NotificationRow>("Notification");
