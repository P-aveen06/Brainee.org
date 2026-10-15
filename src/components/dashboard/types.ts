export interface PendingItem {
	id: string;
	type: "leave" | "wfh";
	name: string;
	avatarUrl?: string;
	label: string;
	date: string;
}

export interface AvailabilityEntry {
	name: string;
	avatarUrl: string | null;
	statusText: string;
}

export interface UpdateProject {
	projectId: string;
	projectCode: string;
	projectName: string;
	hasSubmitted: boolean;
	status?: string;
	hoursSpent?: number | null;
}

export interface UpcomingLeaveItem {
	id: string;
	name: string;
	avatarUrl: string | null;
	leaveType: string;
	startDate: string;
	endDate: string;
}

export interface BirthdayItem {
	id: string;
	name: string;
	avatarUrl: string | null;
	daysUntil: number;
}
