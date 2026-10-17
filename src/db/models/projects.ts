import { defineNode } from "../../../shared/graph/model";

export type ProjectRow = {
	id: string;
	code: string;
	name: string;
	description: string | null;
	projectType: string;
	clientCompanyId: string | null;
	clientProjectName: string | null;
	engagementModel: string | null;
	contractValue: number | null;
	currency: string | null;
	status: string;
	priority: string;
	healthOverride: string | null;
	currentStageKey: string | null;
	startDate: string | null;
	targetEndDate: string | null;
	actualEndDate: string | null;
	ownerId: string;
	createdById: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const projects = defineNode<ProjectRow>("Project");
