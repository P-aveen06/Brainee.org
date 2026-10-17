import { defineNode } from "../../../shared/graph/model";

export type ProposedActionRow = {
	id: string;
	messageId: string | null;
	userId: string;
	actionType: string;
	targetEntityType: string;
	targetEntityId: string;
	payload: string | null;
	status: string;
	confirmedAt: Date | null;
	expiresAt: Date | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const aiProposedActions =
	defineNode<ProposedActionRow>("ProposedAction");
