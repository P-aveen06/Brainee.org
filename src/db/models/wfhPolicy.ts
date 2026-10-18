import { defineNode } from "../../../shared/graph/model";

export type WfhPolicyRow = {
	id: number;
	annualAllowance: number;
	updatedAt: Date | null;
};

export const wfhPolicy = defineNode<WfhPolicyRow>("WfhPolicy");
