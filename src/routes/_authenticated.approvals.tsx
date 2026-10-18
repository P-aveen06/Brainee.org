import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ApprovalTabs } from "../components/approvals/ApprovalTabs";
import { Page, PageHeader } from "../components/layout/page-layout";
import { createDb } from "../db";
import { getApprovalsLiveData } from "../lib/approvals-live-data.server";
import { approverMiddleware } from "../lib/server-fn";

export const getApprovalsPageData = createServerFn({ method: "GET" })
	.middleware([approverMiddleware])
	.handler(async ({ context }) => {
		const user = context.user;
		const db = createDb();
		const data = await getApprovalsLiveData(db, {
			leadId: user.role === "admin" ? undefined : user.id,
		});

		return {
			isAdmin: user.role === "admin",
			...data,
		};
	});

export const Route = createFileRoute("/_authenticated/approvals")({
	loader: async () => {
		const approvalsData = await getApprovalsPageData();
		return { approvalsData };
	},
	component: ApprovalsPage,
});

function ApprovalsPage() {
	const { approvalsData } = Route.useLoaderData();

	return (
		<Page>
			<PageHeader
				title="Approvals"
				description="Review and manage leave and WFH requests."
			/>

			<ApprovalTabs
				pending={approvalsData.pending}
				history={approvalsData.history}
				isAdmin={approvalsData.isAdmin}
			/>
		</Page>
	);
}
