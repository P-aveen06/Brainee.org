import { defineNode } from "../../../shared/graph/model";

export type ProjectEventRow = {
	id: string;
	projectId: string;
	eventType: string;
	actorId: string | null;
	entityType: string | null;
	entityId: string | null;
	details: string | null;
	createdAt: Date | null;
};

export const projectEvents = defineNode<ProjectEventRow>("ProjectEvent");
