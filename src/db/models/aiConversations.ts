import { defineNode } from "../../../shared/graph/model";

export type ConversationRow = {
	id: string;
	userId: string;
	title: string | null;
	lastMessageAt: Date | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const aiConversations = defineNode<ConversationRow>("Conversation");
