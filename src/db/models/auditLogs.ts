import { defineNode } from "../../../shared/graph/model";

export type AuditEventRow = {
	id: string;
	actorId: string;
	action: string;
	entityType: string;
	entityId: string;
	oldData: string | null;
	newData: string | null;
	createdAt: Date | null;
};

export const auditLogs = defineNode<AuditEventRow>("AuditEvent");
