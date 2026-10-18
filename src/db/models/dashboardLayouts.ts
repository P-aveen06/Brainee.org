import { defineNode } from "../../../shared/graph/model";

export type DashboardLayoutRow = {
	userId: string;
	layout: string;
	updatedAt: Date | null;
};

export const dashboardLayouts =
	defineNode<DashboardLayoutRow>("DashboardLayout");
