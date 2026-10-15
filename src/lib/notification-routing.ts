export type NotificationRecordInput = {
	userId: string;
	type: string;
	title: string;
	body: string;
	relatedId?: string;
	relatedType?: string;
	actionUrl?: string;
};

export function buildNotificationRecord(input: NotificationRecordInput) {
	return {
		id: crypto.randomUUID(),
		userId: input.userId,
		type: input.type,
		title: input.title,
		body: input.body,
		isRead: false,
		relatedId: input.relatedId ?? null,
		relatedType: input.relatedType ?? null,
		actionUrl: input.actionUrl ?? null,
	};
}
