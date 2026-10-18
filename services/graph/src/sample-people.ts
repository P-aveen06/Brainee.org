import type { GraphDatabase } from "../../../shared/graph/query.ts";
import {
	addSample,
	cycleFor,
	dateOffset,
	sampleEmployees,
} from "./sample-data.ts";

export async function seedSamplePeople(
	db: GraphDatabase,
	admin: Record<string, unknown>,
	monday: string,
) {
	const kinds = [
		{
			id: "sample-annual",
			name: "Annual Leave",
			slug: "annual",
			defaultDays: 18,
			description:
				"Sample policy: 18 days per birthday-based cycle; request 3 days ahead.",
			applyBeforeDays: 3,
		},
		{
			id: "sample-sick",
			name: "Sick Leave",
			slug: "sick",
			defaultDays: 8,
			description:
				"Sample policy: 8 days per birthday-based cycle; no advance notice required.",
		},
		{
			id: "sample-casual",
			name: "Casual Leave",
			slug: "casual",
			defaultDays: 6,
			description: "Sample policy: 6 days per birthday-based cycle.",
		},
	];
	for (const kind of kinds) await addSample(db, "LeaveType", kind);
	await addSample(db, "WfhPolicy", { id: 1, annualAllowance: 12 });
	const people = [
		...sampleEmployees,
		{ id: String(admin.id), birthday: String(admin.birthday ?? "2026-10-16") },
	];
	const requests = [
		{
			id: "sample-leave-monday",
			userId: "sample-anika",
			offset: 0,
			leaveType: "annual",
			status: "approved",
			reason: "Fictional family appointment",
		},
		{
			id: "sample-leave-tuesday",
			userId: "sample-rohan",
			offset: 1,
			leaveType: "casual",
			status: "pending",
			reason: "Fictional personal errand",
		},
		{
			id: "sample-leave-wednesday",
			userId: String(admin.id),
			offset: 2,
			leaveType: "annual",
			status: "pending",
			reason: "Fictional personal appointment",
		},
		{
			id: "sample-leave-thursday",
			userId: "sample-kiran",
			offset: 3,
			leaveType: "annual",
			status: "approved",
			reason: "Fictional appointment",
			isHalfDayStart: true,
			halfDayStartPeriod: "first_half",
		},
		{
			id: "sample-leave-neha-pending",
			userId: "sample-neha",
			offset: 4,
			leaveType: "annual",
			status: "pending",
			reason: "Fictional planned family visit",
		},
		{
			id: "sample-leave-friday",
			userId: "sample-neha",
			offset: 4,
			leaveType: "sick",
			status: "rejected",
			reason: "Fictional request for testing",
			rejectionReason: "Sample rejection only",
		},
	];
	for (const person of people)
		for (const kind of kinds) {
			const used = requests
				.filter(
					(r) =>
						r.userId === person.id &&
						r.leaveType === kind.slug &&
						r.status === "approved",
				)
				.reduce((n, r) => n + (r.isHalfDayStart ? 0.5 : 1), 0);
			await addSample(db, "LeaveBalance", {
				id: `sample-balance-${person.id}-${kind.slug}`,
				userId: person.id,
				leaveType: kind.slug,
				totalLimit: kind.defaultDays,
				used,
				...cycleFor(person.birthday, monday),
			});
		}
	for (const { offset, ...request } of requests)
		await addSample(db, "LeaveRequest", {
			...request,
			startDate: dateOffset(monday, offset),
			endDate: dateOffset(monday, offset),
			totalDays: request.isHalfDayStart ? 0.5 : 1,
			approvedBy: request.status === "approved" ? String(admin.id) : null,
			rejectedBy: request.status === "rejected" ? String(admin.id) : null,
		});
	for (const [i, userId] of [
		"sample-leena",
		"sample-neha",
		"sample-kiran",
	].entries())
		await addSample(db, "WfhRequest", {
			id: `sample-wfh-${i}`,
			userId,
			date: dateOffset(monday, i === 0 ? 0 : i),
			status: i === 2 ? "pending" : "approved",
			approvedBy: i === 2 ? null : String(admin.id),
			reason: "Fictional home working day",
		});
	for (const person of people)
		for (let day = 0; day < 5; day++)
			await addSample(db, "Timesheet", {
				id: `sample-hours-${person.id}-${day}`,
				userId: person.id,
				date: dateOffset(monday, day - 7),
				hours: day === 4 ? 6 : 8,
			});
	await addSample(db, "Notification", {
		id: "sample-admin-notification",
		userId: String(admin.id),
		type: "leave_requested",
		title: "Sample team is ready",
		body: "Fictional employees, projects, leave requests and equipment are available for testing.",
		actionUrl: "/approvals",
	});
}
