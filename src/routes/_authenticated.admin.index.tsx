import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq, or } from "drizzle-orm";
import { AdminConsoleTabs } from "../components/admin/AdminConsoleTabs";
import { AuditLogTable } from "../components/admin/AuditLogTable";
import { EmployeeTable } from "../components/admin/EmployeeTable";
import { HolidayList } from "../components/admin/HolidayList";
import { LeaveTypeManager } from "../components/admin/LeaveTypeManager";
import { WfhPolicyForm } from "../components/admin/WfhPolicyForm";
import { Page, PageHeader } from "../components/layout/page-layout";
import { createDb } from "../db";
import {
	auditLogs,
	publicHolidays,
	systemLeaveTypes,
	users,
	wfhPolicy,
} from "../db/schema";
import { adminMiddleware } from "../lib/server-fn";
import { DEFAULT_WFH_ALLOWANCE, WFH_POLICY_ID } from "../lib/wfh-policy";

type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export const getAdminPageData = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(async () => {
		const db = createDb(env.DATABASE);
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

		// 4. Fetch audit logs with actor
		const dbAuditLogs = await db
			.select({
				id: auditLogs.id,
				createdAt: auditLogs.createdAt,
				action: auditLogs.action,
				entityType: auditLogs.entityType,
				entityId: auditLogs.entityId,
				oldData: auditLogs.oldData,
				newData: auditLogs.newData,
				actorId: auditLogs.actorId,
				actorName: users.name,
				actorEmail: users.email,
			})
			.from(auditLogs)
			.leftJoin(users, eq(auditLogs.actorId, users.id))
			.orderBy(desc(auditLogs.createdAt))
			.limit(100);

		function isJsonValue(value: unknown): value is JsonValue {
			if (
				value === null ||
				typeof value === "string" ||
				typeof value === "number" ||
				typeof value === "boolean"
			) {
				return true;
			}
			if (Array.isArray(value)) {
				return value.every(isJsonValue);
			}
			if (typeof value === "object") {
				return Object.values(value).every(isJsonValue);
			}
			return false;
		}

		function parseAuditData(value: string | null): JsonValue {
			if (!value) return null;
			try {
				const parsed = JSON.parse(value) as unknown;
				return isJsonValue(parsed) ? parsed : null;
			} catch {
				return null;
			}
		}

		const logs = dbAuditLogs.map((log) => ({
			id: log.id,
			created_at: log.createdAt ? log.createdAt.toISOString() : "",
			action: log.action,
			entity_type: log.entityType,
			entity_id: log.entityId,
			old_data: parseAuditData(log.oldData),
			new_data: parseAuditData(log.newData),
			actor: log.actorId
				? {
						id: log.actorId,
						name: log.actorName ?? "Unknown",
						email: log.actorEmail ?? "",
					}
				: null,
		}));

		return {
			employees,
			holidays: sortedHolidays,
			leaveTypes,
			wfhPolicy: {
				annualAllowance: Number(
					dbWfhPolicy?.annualAllowance ?? DEFAULT_WFH_ALLOWANCE,
				),
			},
			logs,
			currentYear,
		};
	});

import { z } from "zod";

const adminSearchSchema = z.object({
	tab: z
		.enum(["employees", "holidays", "leave-config", "wfh", "audit"])
		.optional(),
});

export const Route = createFileRoute("/_authenticated/admin/")({
	validateSearch: (search) => adminSearchSchema.parse(search),
	loader: async () => {
		const adminData = await getAdminPageData();
		return { adminData };
	},
	component: AdminConsolePage,
});

function AdminConsolePage() {
	const { adminData } = Route.useLoaderData();

	return (
		<Page>
			<PageHeader
				title="Admin Console"
				description="Manage employees, holidays, leave policies, and audit logs."
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
				auditContent={<AuditLogTable logs={adminData.logs} />}
			/>
		</Page>
	);
}
