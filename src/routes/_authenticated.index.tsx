import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
	loadDashboardExtras,
	resetDashboardLayout,
	saveDashboardLayout,
} from "#/api/dashboard-extras";
import { getMyDashboardDailyUpdates } from "#/api/project-daily-updates";
import { CalendarRail } from "#/components/dashboard/calendar/CalendarRail";
import { CompanyBrainSpotlight } from "#/components/dashboard/CompanyBrainSpotlight";
import { DashboardGrid } from "#/components/dashboard/DashboardGrid";
import { DashboardHero } from "#/components/dashboard/DashboardHero";
import { EditLayoutBar } from "#/components/dashboard/EditLayoutBar";
import { PeekingMascotProvider } from "#/components/dashboard/PeekingMascot";
import { Page, PageLoading } from "#/components/layout/page-layout";
import { DashboardSkeleton } from "#/components/ui/skeletons";
import {
	getDefaultLayout,
	type LayoutEntry,
	resolveLayout,
} from "#/lib/dashboard-layout";
import { getDashboardData } from "#/lib/dashboard-stats.server";
import { buildHeroSummary } from "#/lib/dashboard-summary";
import { authMiddleware } from "#/lib/server-fn";

export const loadDashboard = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) => {
		return await getDashboardData(context.user);
	});

export const Route = createFileRoute("/_authenticated/")({
	loader: async () => {
		const [data, dailyUpdatesData, extras] = await Promise.all([
			loadDashboard(),
			getMyDashboardDailyUpdates(),
			loadDashboardExtras(),
		]);
		return { dashboardData: data, dailyUpdatesData, extras };
	},
	pendingComponent: DashboardSkeleton,
	component: DashboardPage,
});

function DashboardPage() {
	const router = useRouter();
	const { user } = Route.useRouteContext();
	const { dashboardData, dailyUpdatesData, extras } = Route.useLoaderData();
	const [layout, setLayout] = useState<LayoutEntry[]>(() =>
		resolveLayout(extras.layout, user.role),
	);
	const [draft, setDraft] = useState<LayoutEntry[] | null>(null);
	const [saving, setSaving] = useState(false);

	if (!dashboardData) {
		return <PageLoading label="Loading dashboard..." />;
	}

	const editing = draft !== null;
	const shown = draft ?? layout;
	const canApprove = user.role === "lead" || user.role === "admin";
	const pendingApprovals = canApprove ? dashboardData.totalPending : 0;
	const refresh = () => router.invalidate();

	async function persist(next: LayoutEntry[] | null) {
		setSaving(true);
		try {
			if (next) {
				await saveDashboardLayout({ data: next });
				setLayout(next);
			} else {
				await resetDashboardLayout();
				setLayout(getDefaultLayout(user.role));
			}
			setDraft(null);
			toast.success(next ? "Layout saved" : "Layout reset");
		} catch {
			toast.error("Couldn't save your layout. Try again.");
		} finally {
			setSaving(false);
		}
	}

	const summary = buildHeroSummary({
		pendingApprovals,
		hasLoggedToday: dashboardData.existingLog !== null,
		outToday: dashboardData.teamAvailability
			.filter((a) => a.statusText.startsWith("On Leave"))
			.map((a) => a.name),
		overdueTasks: extras.tasks.summary.overdue,
		dueTodayTasks: extras.tasks.summary.dueToday,
	});

	return (
		<PeekingMascotProvider enabled={!editing}>
			<Page className="space-y-3 sm:space-y-3.5">
				<DashboardHero
					firstName={user.name.split(" ")[0]}
					summary={summary}
					standardHours={user.standardHours}
					existingLog={dashboardData.existingLog}
					onChanged={refresh}
					editing={editing}
					onCustomize={() => setDraft(editing ? null : layout)}
				/>
				<CompanyBrainSpotlight />

				{draft && (
					<EditLayoutBar
						hidden={draft.filter((e) => e.hidden)}
						saving={saving}
						onAdd={(id) =>
							setDraft(
								draft.map((e) => (e.id === id ? { ...e, hidden: false } : e)),
							)
						}
						onReset={() => persist(null)}
						onCancel={() => setDraft(null)}
						onSave={() => persist(draft)}
					/>
				)}

				<div className="grid items-stretch gap-3 sm:gap-3.5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
					<DashboardGrid
						layout={shown}
						editing={editing}
						onLayoutChange={setDraft}
						data={dashboardData}
						extras={extras}
						updates={dailyUpdatesData}
						standardHours={user.standardHours}
						onChanged={refresh}
					/>
					<CalendarRail
						initial={extras.calendar}
						upcomingLeaves={dashboardData.upcomingLeaves}
						upcomingBirthdays={dashboardData.upcomingBirthdays}
					/>
				</div>
			</Page>
		</PeekingMascotProvider>
	);
}
