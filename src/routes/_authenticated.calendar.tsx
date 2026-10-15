import { createFileRoute } from "@tanstack/react-router";
import { getCalendarData } from "../api/calendar";
import { CalendarPageTabs } from "../components/calendar/CalendarPageTabs";
import { LeaveBalanceBar } from "../components/calendar/LeaveBalanceBar";
import { MonthView } from "../components/calendar/MonthView";
import { MyRequestsList } from "../components/calendar/MyRequestsList";
import { RequestActions } from "../components/calendar/RequestActions";
import {
	Page,
	PageHeader,
	PageLoading,
} from "../components/layout/page-layout";

export const Route = createFileRoute("/_authenticated/calendar")({
	loader: async () => {
		const calendarData = await getCalendarData();
		return { calendarData };
	},
	component: CalendarPage,
});

function CalendarPage() {
	const { calendarData } = Route.useLoaderData();

	if (!calendarData) {
		return <PageLoading label="Loading calendar..." />;
	}

	return (
		<Page>
			<PageHeader
				title="My Attendance"
				description="View your calendar, timesheets, leaves, WFH, and requests."
				actions={<RequestActions />}
			/>

			<CalendarPageTabs
				calendar={
					<div className="space-y-6">
						<LeaveBalanceBar
							balances={calendarData.balances}
							wfh={calendarData.wfhBalance}
						/>
						<MonthView
							timesheets={calendarData.timesheets}
							leaves={calendarData.leaves}
							wfhs={calendarData.wfhs}
							holidays={calendarData.holidays}
						/>
					</div>
				}
				requests={
					<MyRequestsList
						leaves={calendarData.detailedLeaves}
						wfhs={calendarData.detailedWfhs}
					/>
				}
			/>
		</Page>
	);
}
