import { waitUntil } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../db";
import { notifications, users } from "../db/schema";
import { sendMail } from "./mail.server";
import {
	buildNotificationRecord,
	type NotificationRecordInput,
} from "./notification-routing";

type NotificationInput = NotificationRecordInput & {
	emailSubject?: string;
	emailBody?: string;
};

function buildEmailText(input: NotificationInput) {
	return [
		input.emailBody ?? input.body,
		input.actionUrl ? `\nOpen in Brainee.org: ${input.actionUrl}` : "",
	]
		.filter(Boolean)
		.join("\n");
}

/** Sends the email outside the request path; a mail failure can never fail the mutation. */
function queueEmail(to: string, subject: string, text: string) {
	waitUntil(
		sendMail({ to, subject, text }).catch((err) => {
			console.error("Email send failed:", err);
		}),
	);
}

export async function createNotification(
	db: Database,
	input: NotificationInput,
) {
	await db.insert(notifications).values(buildNotificationRecord(input));

	const [user] = await db
		.select({ email: users.email })
		.from(users)
		.where(eq(users.id, input.userId))
		.limit(1);

	if (user?.email) {
		queueEmail(
			user.email,
			input.emailSubject ?? input.title,
			buildEmailText(input),
		);
	}
}

/**
 * Notifies the people who can act on a request: all admins plus the
 * requester's direct lead (decision: leads only handle their own reports).
 */
export async function notifyApprovers(
	db: Database,
	{
		requesterId,
		...input
	}: Omit<NotificationInput, "userId"> & { requesterId: string },
) {
	const [requester] = await db
		.select({ peerLeadId: users.peerLeadId })
		.from(users)
		.where(eq(users.id, requesterId))
		.limit(1);

	const admins = await db
		.select({ id: users.id, email: users.email })
		.from(users)
		.where(and(eq(users.role, "admin"), eq(users.isActive, true)));

	const recipientIds = new Set(admins.map((a) => a.id));
	if (requester?.peerLeadId) {
		recipientIds.add(requester.peerLeadId);
	}
	recipientIds.delete(requesterId);

	if (recipientIds.size === 0) return;

	const ids = [...recipientIds];
	await db
		.insert(notifications)
		.values(ids.map((userId) => buildNotificationRecord({ ...input, userId })));

	const recipients = await db
		.select({ email: users.email })
		.from(users)
		.where(inArray(users.id, ids));

	const text = buildEmailText({ ...input, userId: "" });
	const subject = input.emailSubject ?? input.title;
	for (const recipient of recipients) {
		if (recipient.email) {
			queueEmail(recipient.email, subject, text);
		}
	}
}
