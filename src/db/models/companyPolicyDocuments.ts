import { defineNode } from "../../../shared/graph/model";

export type CompanyPolicyDocumentRow = {
	id: string;
	title: string;
	description: string | null;
	r2Key: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	uploadedById: string | null;
	status: "draft" | "published" | "archived";
	version: number;
	revisionOfId: string | null;
	publishedById: string | null;
	publishedAt: Date | null;
	effectiveDate: Date | null;
	archivedById: string | null;
	archivedAt: Date | null;
	createdAt: Date;
};

export const companyPolicyDocuments = defineNode<CompanyPolicyDocumentRow>(
	"CompanyPolicyDocument",
);
