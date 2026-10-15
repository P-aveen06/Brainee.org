import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getMyTasks } from "@/api/project-tasks";
import {
	DataTableFilters,
	DataTableToolbar,
} from "@/components/layout/data-table-layout";
import { Page, PageHeader } from "@/components/layout/page-layout";
import { MyTasksKpiGrid } from "@/components/projects/MyTasksKpiGrid";
import { MyTasksProjectGroup } from "@/components/projects/MyTasksProjectGroup";
import { Input } from "@/components/ui/input";
import { PageTabs } from "@/components/ui/page-tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/my-tasks")({
	loader: async () => {
		return await getMyTasks();
	},
	component: MyTasksRoute,
});

const FILTER_TABS = [
	{ value: "all", label: "All Tasks" },
	{ value: "active", label: "Active" },
	{ value: "overdue", label: "Overdue" },
	{ value: "due_today", label: "Due Today" },
	{ value: "done", label: "Completed" },
];

function MyTasksRoute() {
	const data = Route.useLoaderData();
	const [tab, setTab] = useState("active");
	const [search, setSearch] = useState("");
	const [projectFilter, setProjectFilter] = useState("all");

	// Project filter options
	const projectOptions = useMemo(() => {
		const unique = new Map<
			string,
			{ id: string; code: string; name: string }
		>();
		for (const t of data.tasks) {
			if (!unique.has(t.projectId)) {
				unique.set(t.projectId, {
					id: t.projectId,
					code: t.projectCode,
					name: t.projectName,
				});
			}
		}
		return Array.from(unique.values()).map((p) => ({
			id: p.id,
			label: `${p.code} · ${p.name}`,
		}));
	}, [data.tasks]);

	// Filter tasks
	const filteredTasks = useMemo(() => {
		return data.tasks.filter((task) => {
			// Tab filtering
			if (tab === "active") {
				if (task.status === "done" || task.status === "cancelled") return false;
			} else if (tab === "overdue") {
				const isOverdue =
					task.status !== "done" &&
					task.status !== "cancelled" &&
					task.dueDate &&
					task.dueDate < data.today;
				if (!isOverdue) return false;
			} else if (tab === "due_today") {
				const isDueToday =
					task.status !== "done" &&
					task.status !== "cancelled" &&
					task.dueDate === data.today;
				if (!isDueToday) return false;
			} else if (tab === "done") {
				if (task.status !== "done") return false;
			}

			// Project filtering
			if (projectFilter !== "all" && task.projectId !== projectFilter) {
				return false;
			}

			// Search query
			if (search.trim()) {
				const q = search.toLowerCase();
				const titleMatch = task.title.toLowerCase().includes(q);
				const projectMatch =
					task.projectName.toLowerCase().includes(q) ||
					task.projectCode.toLowerCase().includes(q);
				const numberMatch = `#${task.taskNumber}`.includes(q);
				if (!titleMatch && !projectMatch && !numberMatch) return false;
			}

			return true;
		});
	}, [data.tasks, data.today, tab, projectFilter, search]);

	// Group tasks by project
	const groupedByProject = useMemo(() => {
		const groups = new Map<string, typeof filteredTasks>();
		for (const t of filteredTasks) {
			const existing = groups.get(t.projectId) || [];
			existing.push(t);
			groups.set(t.projectId, existing);
		}
		return groups;
	}, [filteredTasks]);

	return (
		<Page>
			<PageHeader
				title="My Tasks"
				description="Cross-project overview of all work items assigned to you."
			/>

			{/* KPI Stats cards */}
			<MyTasksKpiGrid summary={data.summary} />

			{/* Filter Tabs & Search */}
			<div className="space-y-4">
				<PageTabs
					items={FILTER_TABS}
					value={tab}
					onChange={setTab}
					ariaLabel="Tasks status filter"
				/>

				<DataTableToolbar>
					<DataTableFilters>
						<div className="relative w-full max-w-sm">
							<Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
							<Input
								placeholder="Search your tasks or projects..."
								className="pl-9 h-9"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>

						{projectOptions.length > 1 && (
							<Select
								value={projectFilter}
								onValueChange={(v) => v && setProjectFilter(v)}
							>
								<SelectTrigger className="h-9 w-48">
									<SelectValue placeholder="All Projects" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Projects</SelectItem>
									{projectOptions.map((p) => (
										<SelectItem key={p.id} value={p.id}>
											{p.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</DataTableFilters>
				</DataTableToolbar>
			</div>

			{/* Grouped by Project Work Items */}
			{filteredTasks.length === 0 ? (
				<div className="border border-dashed border-border p-12 text-center space-y-3">
					<FolderKanban className="size-10 text-muted-foreground mx-auto stroke-1" />
					<h3 className="font-heading text-sm font-semibold text-foreground">
						No work items found
					</h3>
					<p className="text-xs text-muted-foreground max-w-sm mx-auto">
						{search || projectFilter !== "all" || tab !== "all"
							? "No tasks match your current filters. Try changing or clearing them."
							: "You do not have any tasks assigned to you across your active projects."}
					</p>
				</div>
			) : (
				<div className="space-y-8">
					{Array.from(groupedByProject.entries()).map(
						([projectId, projectTasksList]) => (
							<MyTasksProjectGroup
								key={projectId}
								projectId={projectId}
								tasks={projectTasksList}
								today={data.today}
							/>
						),
					)}
				</div>
			)}
		</Page>
	);
}
