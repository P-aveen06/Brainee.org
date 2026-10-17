import { defineNode } from "../../../shared/graph/model";

export type AssetEventRow = {
	id: string;
	assetId: string;
	eventType: string;
	actorId: string | null;
	targetUserId: string | null;
	details: string | null;
	createdAt: Date | null;
};

export const assetHistory = defineNode<AssetEventRow>("AssetEvent");
