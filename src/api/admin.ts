// Barrel kept so existing imports of "#/api/admin" keep working after the
// domain split. New code should import from the domain module directly.
export {
	approveLeaveRequest,
	approveWfhRequest,
	getApprovalsLive,
	getTeamCalendarLive,
	rejectLeaveCancellation,
	rejectLeaveRequest,
	rejectWfhCancellation,
	rejectWfhRequest,
	revokeLeaveRequest,
	revokeWfhRequest,
} from "./approvals";
export {
	getLeaveBalancesForUser,
	updateEmployeeRole,
	updateEmployeeSettings,
	updateLeaveBalance,
} from "./employees";
export { createHoliday, deleteHoliday, updateHoliday } from "./holidays";
export {
	createLeaveType,
	deleteLeaveType,
	updateLeaveType,
} from "./leave-types";
