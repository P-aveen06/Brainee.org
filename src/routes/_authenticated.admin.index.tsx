import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCompanyPolicyDocuments } from "@/api/company-policy-documents";
import { CompanyPoliciesPanel } from "@/components/admin/CompanyPoliciesPanel";
import { eq, or } from "@/db/graph-query";
import { AdminConsoleTabs } from "../components/admin/AdminConsoleTabs";
import { EmployeeTable } from "../components/admin/EmployeeTable";
import { HolidayList } from "../components/admin/HolidayList";
import { LeaveTypeManager } from "../components/admin/LeaveTypeManager";
import { WfhPolicyForm } from "../components/admin/WfhPolicyForm";
import { Page, PageHeader } from "../components/layout/page-layout";
import { createDb } from "../db";
import {
	publicHolidays,
	systemLeaveTypes,
	users,
	wfhPolicy,
} from "../db/schema";
import { adminMiddleware } from "../lib/server-fn";
import { DEFAULT_WFH_ALLOWANCE, WFH_POLICY_ID } from "../lib/wfh-policy";

export const getAdminPageData = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(async () => {
		const db = createDb();
		const currentYear = new Date().getFullYear();

		// 1. Fetch employees
		const dbUsers = await db.select().from(users).orderBy(users.name);

		// Only active reports confer the derived "lead" role, matching
		// getCurrentAppUser — a departed report must not keep promoting anyone.
		const leadIds = new Set(
			dbUsers
				.filter((u) => u.isActive)
				.map((u) => u.peerLeadId)
				.filter(Boolean),
		);
		const employees = dbUsers.map((u) => {
			const mappedRole =
				u.role === "user" && leadIds.has(u.id) ? "lead" : u.role;
			return {
				id: u.id,
				name: u.name,
				email: u.email,
				role: mappedRole,
				avatar_url: u.avatarUrl,
				peer_lead_id: u.peerLeadId,
				standard_hours: Number(u.standardHours),
				is_onboarded: u.isOnboarded,
				join_date: u.joinDate,
				birthday: u.birthday,
				created_at: u.createdAt ? u.createdAt.toISOString() : "",
				is_active: u.isActive,
				exit_date: u.exitDate,
				exit_reason: u.exitReason,
			};
		});

		// 2. Fetch holidays
		const dbHolidays = await db
			.select()
			.from(publicHolidays)
			.where(
				or(eq(publicHolidays.year, currentYear), eq(publicHolidays.year, 0)),
			)
			.orderBy(publicHolidays.date);

		const sortedHolidays = dbHolidays
			.map((h) => {
				if (h.year === 0) {
					const parts = h.date.split("-");
					return {
						...h,
						date: `${currentYear}-${parts[1]}-${parts[2]}`,
					};
				}
				return h;
			})
			.sort((a, b) => a.date.localeCompare(b.date));

		// 3. Fetch leave types
		const dbLeaveTypes = await db
			.select()
			.from(systemLeaveTypes)
			.orderBy(systemLeaveTypes.createdAt);

		const leaveTypes = dbLeaveTypes.map((t) => ({
			id: t.id,
			name: t.name,
			slug: t.slug,
			description: t.description,
			default_days: Number(t.defaultDays),
			accrual_per_year: Number(t.accrualPerYear),
			apply_before_days: t.applyBeforeDays,
			apply_before_days_extended: t.applyBeforeDaysExtended,
			extended_limit_trigger: t.extendedLimitTrigger,
			created_at: t.createdAt ? t.createdAt.toISOString() : "",
		}));
		const [dbWfhPolicy] = await db
			.select({ annualAllowance: wfhPolicy.annualAllowance })
			.from(wfhPolicy)
			.where(eq(wfhPolicy.id, WFH_POLICY_ID))
			.limit(1);

		return {
			employees,
			holidays: sortedHolidays,
			leaveTypes,
			wfhPolicy: {
				annualAllowance: Number(
					dbWfhPolicy?.annualAllowance ?? DEFAULT_WFH_ALLOWANCE,
				),
			},
			currentYear,
		};
	});

const adminSearchSchema = z.object({
	tab: z
		.enum(["employees", "holidays", "leave-config", "wfh", "policies"])
		.optional(),
});

export const Route = createFileRoute("/_authenticated/admin/")({
	validateSearch: (search) => adminSearchSchema.parse(search),
	loader: async () => {
		const [adminData, policyDocuments] = await Promise.all([
			getAdminPageData(),
			getCompanyPolicyDocuments(),
		]);
		return { adminData, policyDocuments };
	},
	component: AdminConsolePage,
});

function AdminConsolePage() {
	const { adminData, policyDocuments } = Route.useLoaderData();

	return (
		<Page>
			<PageHeader
				title="Admin Console"
				description="Manage employees, holidays, company policies, and leave configuration."
			/>

			<AdminConsoleTabs
				employeesContent={<EmployeeTable users={adminData.employees} />}
				holidaysContent={
					<HolidayList
						holidays={adminData.holidays}
						year={adminData.currentYear}
					/>
				}
				leaveConfigContent={
					<LeaveTypeManager
						initialTypes={adminData.leaveTypes}
						employees={adminData.employees}
					/>
				}
				wfhContent={
					<div className="max-w-xl">
						<WfhPolicyForm
							initialAllowance={adminData.wfhPolicy.annualAllowance}
						/>
					</div>
				}
				policiesContent={<CompanyPoliciesPanel documents={policyDocuments} />}
			/>
		</Page>
	);
}
