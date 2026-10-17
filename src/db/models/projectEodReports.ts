import { defineNode } from "../../../shared/graph/model";

export type EodReportRow = {
	id: string;
	projectId: string;
	date: string;
	generatedById: string | null;
	contentDraft: string | null;
	contentFinal: string | null;
	status: string;
	missingSubmitters: string | null;
	finalisedAt: Date | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const projectEodReports = defineNode<EodReportRow>("EodReport");
