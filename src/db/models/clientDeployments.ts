import { defineNode } from "../../../shared/graph/model";

export type ClientDeploymentRow = {
	id: string;
	userId: string;
	primaryClientId: string;
	endClientId: string | null;
	roleTitle: string | null;
	startDate: string;
	endDate: string | null;
	status: string;
	notes: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const clientDeployments =
	defineNode<ClientDeploymentRow>("ClientDeployment");
