import type { Database } from "../db";
import { auditLogs } from "../db/schema";

export async function logAuditEvent(
	db: Database,
	{
		actorId,
		action,
		entityType,
		entityId,
		oldData,
		newData,
	}: {
		actorId: string;
		action: string;
		entityType: string;
		entityId: string;
		oldData?: Record<string, unknown> | null;
		newData?: Record<string, unknown> | null;
	},
) {
	await db.insert(auditLogs).values({
		id: crypto.randomUUID(),
		actorId,
		action,
		entityType,
		entityId,
		oldData: oldData ? JSON.stringify(oldData) : null,
		newData: newData ? JSON.stringify(newData) : null,
	});
}
