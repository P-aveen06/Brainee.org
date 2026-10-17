import { defineNode } from "../../../shared/graph/model";

export type CompanyRow = {
	id: string;
	name: string;
	code: string;
	isInternal: boolean;
	contactEmail: string | null;
	notes: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const companies = defineNode<CompanyRow>("Company");
