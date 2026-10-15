import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import DetailedAdminStats from "../components/admin/DetailedAdminStats";
import { Page, PageHeader } from "../components/layout/page-layout";
import { createDb } from "../db";
import { getDetailedAdminStats } from "../lib/detailed-admin-stats.server";
import { adminMiddleware } from "../lib/server-fn";

const statsSearchSchema = z.object({
	userId: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	status: z.string().optional(),
});
type StatsSearch = z.infer<typeof statsSearchSchema>;

export const getStatsPageData = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.inputValidator((data: unknown) => statsSearchSchema.parse(data))
	.handler(async ({ data: searchParams }) => {
		const db = createDb(env.DATABASE);
		const detailedStats = await getDetailedAdminStats(db, searchParams);

		return {
			detailedStats,
		};
	});

export const Route = createFileRoute("/_authenticated/admin/stats")({
	validateSearch: (search) => statsSearchSchema.parse(search),
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) => {
		const statsData = await getStatsPageData({ data: deps as StatsSearch });
		return { statsData };
	},
	component: AdminStatsPage,
});

function AdminStatsPage() {
	const { statsData } = Route.useLoaderData();

	return (
		<Page>
			<PageHeader
				title="Admin Stats"
				description="High-level pulse across client delivery health, critical blockers, team capacity, and operational governance."
			/>

			<DetailedAdminStats data={statsData.detailedStats} />
		</Page>
	);
}
