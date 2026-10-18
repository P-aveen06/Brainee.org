import { defineNode } from "../../../shared/graph/model";

export type EmployeeRow = {
	id: string;
	authId: string;
	name: string;
	email: string;
	birthday: string | null;
	role: string;
	standardHours: number;
	joinDate: string | null;
	peerLeadId: string | null;
	avatarUrl: string | null;
	isOnboarded: boolean;
	isActive: boolean;
	exitDate: string | null;
	exitReason: string | null;
	deactivatedById: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
};

export const users = defineNode<EmployeeRow>("Employee");
