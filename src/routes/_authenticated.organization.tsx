import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { Page, PageHeader } from "../components/layout/page-layout";
import { OrgChartTree } from "../components/organization/OrgChartTree";
import { createDb } from "../db";
import { users } from "../db/schema";
import { authMiddleware } from "../lib/server-fn";

export const getOrgData = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async () => {
		const db = createDb(env.DATABASE);
		const dbUsers = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				role: users.role,
				avatarUrl: users.avatarUrl,
				peerLeadId: users.peerLeadId,
				standardHours: users.standardHours,
			})
			.from(users)
			.where(and(eq(users.isOnboarded, true), eq(users.isActive, true)));

		return dbUsers.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			role: u.role,
			avatarUrl: u.avatarUrl,
			peerLeadId: u.peerLeadId,
			standardHours: Number(u.standardHours),
		}));
	});

export const Route = createFileRoute("/_authenticated/organization")({
	loader: async () => {
		const orgUsers = await getOrgData();
		return { orgUsers };
	},
	component: OrganizationPage,
});

function OrganizationPage() {
	const { orgUsers } = Route.useLoaderData();

	return (
		<Page>
			<PageHeader
				title="Organization"
				description="Organizational levels and reporting relationships."
			/>

			<OrgChartTree users={orgUsers} />
		</Page>
	);
}
