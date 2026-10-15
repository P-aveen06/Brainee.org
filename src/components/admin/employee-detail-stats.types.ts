export interface Employee {
	id: string;
	name: string;
	email: string;
	avatar_url: string | null;
	role: string;
}

export interface TimesheetData {
	date: string;
	hours: number;
	user_id: string;
}

export interface LeaveBalance {
	user_id: string;
	leave_type: string;
	total_limit: number;
	used: number;
}

export interface Request {
	id: string;
	user_id: string;
	type: "leave" | "wfh";
	status: string;
	start_date: string;
	end_date: string;
	reason: string | null;
}
