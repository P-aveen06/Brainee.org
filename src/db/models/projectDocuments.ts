import { defineNode } from "../../../shared/graph/model";

export type DocumentVersionRow = {
	id: string;
	projectId: string;
	stageKey: string | null;
	title: string;
	description: string | null;
	category: string;
	r2Key: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	version: number;
	supersedesDocumentId: string | null;
	status: string;
	uploadedById: string | null;
	checksum: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const projectDocuments =
	defineNode<DocumentVersionRow>("DocumentVersion");
