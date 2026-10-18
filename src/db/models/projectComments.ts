import { defineNode } from "../../../shared/graph/model";

export type CommentRow = {
	id: string;
	projectId: string;
	stageKey: string | null;
	taskId: string | null;
	documentId: string | null;
	parentId: string | null;
	authorId: string;
	body: string;
	isDecision: boolean;
	isPinned: boolean;
	editedAt: Date | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const projectComments = defineNode<CommentRow>("Comment");
