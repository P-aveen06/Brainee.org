import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import TeamCalendarGrid from "../components/admin/TeamCalendarGrid";
import {
	Page,
	PageHeader,
	PageLoading,
} from "../components/layout/page-layout";
import { createDb } from "../db";
import { authMiddleware } from "../lib/server-fn";
import { getTeamCalendarLiveData } from "../lib/team-calendar-live-data.server";

export const getTeamCalendarPageData = createServerFn({
	method: "GET",
})
	.middleware([authMiddleware])
	.handler(async () => {
		const db = createDb(env.DATABASE);
		const now = new Date();
		const employees = await getTeamCalendarLiveData(db, now);

		return {
			employees,
		};
	});

export const Route = createFileRoute("/_authenticated/team-calendar")({
	loader: async () => {
		const data = await getTeamCalendarPageData();
		return { data };
	},
	component: TeamCalendarPage,
});

function TeamCalendarPage() {
	const { data } = Route.useLoaderData();

	if (!data) {
		return <PageLoading label="Loading team calendar..." />;
	}

	return (
		<Page className="flex h-[calc(100svh-5rem)] min-h-0 flex-col overflow-hidden">
			<PageHeader
				title="Team Calendar"
				description="View all employee timesheets, leaves, and holidays."
			/>

			<TeamCalendarGrid employees={data.employees} initialDate={new Date()} />
		</Page>
	);
}
