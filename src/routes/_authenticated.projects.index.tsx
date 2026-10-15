import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { getProjectsPageData } from "../api/projects";
import { Page, PageHeader } from "../components/layout/page-layout";
import { ProjectFormDialog } from "../components/projects/ProjectFormDialog";
import { ProjectStatsCards } from "../components/projects/ProjectStatsCards";
import { ProjectTable } from "../components/projects/ProjectTable";
import { Button } from "../components/ui/button";
import { PageTabs } from "../components/ui/page-tabs";

const projectsSearchSchema = z.object({
	tab: z.enum(["active", "all", "archived"]).optional(),
	q: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/projects/")({
	validateSearch: (search) => projectsSearchSchema.parse(search),
	loaderDeps: ({ search }) => search,
	loader: async ({ deps }) => {
		const data = await getProjectsPageData({ data: deps });
		return { data };
	},
	component: ProjectsPage,
});

const TABS = [
	{ value: "active", label: "Active" },
	{ value: "all", label: "All Projects" },
	{ value: "archived", label: "Archived" },
];

function ProjectsPage() {
	const { data } = Route.useLoaderData();
	const { tab = "active" } = Route.useSearch();
	const navigate = Route.useNavigate();
	const router = useRouter();

	const [createOpen, setCreateOpen] = useState(false);

	const handleTabChange = (newTab: string) => {
		navigate({
			search: (prev) => ({
				...prev,
				tab: newTab === "active" ? undefined : (newTab as "all" | "archived"),
			}),
		});
	};

	return (
		<Page>
			<PageHeader
				title="Projects"
				description="Client delivery engagements, stage progress, and project governance."
				actions={
					<Button onClick={() => setCreateOpen(true)}>
						<Plus className="mr-1.5 size-4" />
						New Project
					</Button>
				}
			/>

			{/* Stats row */}
			<ProjectStatsCards summary={data.summary} />

			{/* Filter tabs */}
			<PageTabs
				items={TABS}
				value={tab}
				onChange={handleTabChange}
				ariaLabel="Project status"
			/>

			{/* Table */}
			<ProjectTable projects={data.projects} />

			{/* New Project Dialog */}
			<ProjectFormDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				companies={data.companies}
				today={data.today}
				onSuccess={() => router.invalidate()}
			/>
		</Page>
	);
}
