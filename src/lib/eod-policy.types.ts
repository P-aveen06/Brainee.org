export interface EodSubmissionMember {
	userId: string;
	userName: string | null;
	role: string;
	isCurrent?: boolean | null;
	isActive?: boolean | null;
}

export interface EodSubmittedUpdateRef {
	userId: string;
	status: string;
}

export interface EodSubmissionState {
	expected: { userId: string; name: string }[];
	submitted: string[];
	missing: { userId: string; name: string }[];
	allSubmitted: boolean;
	canGenerate: boolean;
}

export interface EodSkeletonUpdateItem {
	title?: string | null;
	status?: string | null;
	hoursSpent?: number | null;
	note?: string | null;
	progressNote?: string | null;
}

export interface EodSkeletonMemberUpdate {
	userId: string;
	userName: string;
	summary: string;
	blockers?: string | null;
	hoursSpent?: number | null;
	items?: EodSkeletonUpdateItem[];
}

export interface EodTaskItem {
	taskNumber?: number | null;
	title: string;
	status: string;
	dueDate?: string | null;
	blockedReason?: string | null;
	completedAt?: Date | null;
}

export interface EodReportSkeleton {
	projectCode: string;
	projectName: string;
	date: string;
	contentDraft: string;
}
