import { defineNode } from "../../../shared/graph/model";

export type AssetRow = {
	id: string;
	assetTag: string;
	name: string;
	category: string;
	assetType: string;
	ownerCompanyId: string;
	serialNumber: string | null;
	model: string | null;
	specs: string | null;
	purchaseDate: string | null;
	purchaseCost: number | null;
	warrantyExpiry: string | null;
	accountExpiry: string | null;
	renewalDate: string | null;
	status: string;
	defectReason: string | null;
	disposalReason: string | null;
	disposalDate: string | null;
	replacedByAssetId: string | null;
	notes: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const assets = defineNode<AssetRow>("Asset");
