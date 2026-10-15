import { z } from "zod";

export const assistantEntityTypeSchema = z.enum([
	"project",
	"task",
	"employee",
	"asset",
	"leave_request",
	"approval",
]);

const assistantScreenSchema = z.enum([
	"dashboard",
	"project_detail",
	"project_portfolio",
	"my_tasks",
	"calendar",
	"team_calendar",
	"approvals",
	"organization",
	"asset_inventory",
	"employee_detail",
	"admin",
	"assistant",
]);

export const assistantPageContextSchema = z.object({
	routeId: z
		.string()
		.min(1)
		.max(200)
		.regex(/^\/[a-zA-Z0-9_/$.-]*$/),
	screen: assistantScreenSchema,
	primaryEntity: z
		.object({
			type: assistantEntityTypeSchema,
			id: z.string().min(1).max(200),
		})
		.optional(),
	selectedEntityIds: z.array(z.string().min(1).max(200)).max(20).optional(),
	visibleState: z
		.object({
			tab: z.string().max(80).optional(),
			searchQuery: z.string().max(200).optional(),
			dateRange: z
				.object({ start: z.string().max(20), end: z.string().max(20) })
				.optional(),
		})
		.optional(),
});

export type AssistantPageContext = z.infer<typeof assistantPageContextSchema>;

export function deriveAssistantPageContext(
	pathname: string,
): AssistantPageContext {
	const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
	if (projectMatch) {
		return {
			routeId: "/projects/$id",
			screen: "project_detail",
			primaryEntity: { type: "project", id: projectMatch[1] },
		};
	}
	const employeeMatch = pathname.match(/^\/admin\/employees\/([^/]+)/);
	if (employeeMatch) {
		return {
			routeId: "/admin/employees/$id",
			screen: "employee_detail",
			primaryEntity: { type: "employee", id: employeeMatch[1] },
		};
	}

	const screens: Array<[string, string]> = [
		["/my-tasks", "my_tasks"],
		["/projects", "project_portfolio"],
		["/calendar", "calendar"],
		["/team-calendar", "team_calendar"],
		["/approvals", "approvals"],
		["/organization", "organization"],
		["/admin/assets", "asset_inventory"],
		["/admin", "admin"],
		["/assistant", "assistant"],
	];
	const matched = screens.find(([prefix]) => pathname.startsWith(prefix));
	return {
		routeId: matched?.[0] ?? "/",
		screen: (matched?.[1] ?? "dashboard") as AssistantPageContext["screen"],
	};
}
