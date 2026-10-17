import { defineNode } from "../../../shared/graph/model";

export type ClientContactRow = {
	id: string;
	companyId: string;
	name: string;
	title: string | null;
	email: string | null;
	phone: string | null;
	role: string;
	isPrimary: boolean;
	notes: string | null;
	isActive: boolean;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const clientContacts = defineNode<ClientContactRow>("ClientContact");
