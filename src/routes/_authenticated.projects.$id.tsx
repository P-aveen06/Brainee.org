import {
	createFileRoute,
	useNavigate,
	useRouter,
	useSearch,
} from "@tanstack/react-router";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { archiveProject } from "@/api/projects";
import { Page } from "@/components/layout/page-layout";
import type { ProjectMemberItem } from "@/components/projects/MemberManagerDialog";
import {
	ProjectHeaderSection,
	type TabKey,
	type ViewKey,
} from "@/components/projects/ProjectHeaderSection";
import { ProjectModalsContainer } from "@/components/projects/ProjectModalsContainer";
import { ProjectTabsContent } from "@/components/projects/ProjectTabsContent";
import type { TaskDetailItem } from "@/components/projects/TaskDetailSheet";
import type { TaskFormItem } from "@/components/projects/TaskFormDialog";
import { assessStageChecklist } from "@/lib/project-stage-policy";
import { resolveProjectTab } from "@/lib/project-tab-resolver";
import { loadProjectDetailData } from "./-project-detail-loader";

const projectDetailSearchSchema = z.object({
	tab: z
		.enum([
			"overview",
			"tasks",
			"daily",
			"checklists",
			"documents",
			"updates",
			"eod",
			"flags",
			"discussions",
			"members",
			"client",
			"timeline",
		])
		.optional(),
	view: z.enum(["list", "board", "gantt", "calendar"]).optional(),
	status: z.string().optional(),
	stage: z.string().optional(),
	date: z.string().optional(),
	focusTask: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/projects/$id")({
	validateSearch: (search) => projectDetailSearchSchema.parse(search),
	loaderDeps: ({ search: { date } }) => ({ date }),
	loader: ({ params, deps }) => loadProjectDetailData(params.id, deps.date),
	component: ProjectDetailPage,
});

function ProjectDetailPage() {
	const data = Route.useLoaderData();
	const navigate = useNavigate();
	const router = useRouter();
	const search = useSearch({ from: "/_authenticated/projects/$id" });

	const rawTab = search.tab;
	const tab: TabKey = resolveProjectTab(rawTab);
	const view: ViewKey = (search.view as ViewKey) || "list";

	const [editOpen, setEditOpen] = useState(false);
	const [archiveOpen, setArchiveOpen] = useState(false);
	const [membersOpen, setMembersOpen] = useState(
		() => search.tab === "members",
	);
	const [, startArchiving] = useTransition();

	const [createTaskOpen, setCreateTaskOpen] = useState(false);
	const [taskToEdit, setTaskToEdit] = useState<TaskFormItem | null>(null);
	const [parentTaskId, setParentTaskId] = useState<string | null>(null);
	const [selectedTask, setSelectedTask] = useState<TaskDetailItem | null>(null);

	const {
		project,
		client,
		contacts,
		members,
		stages,
		progress,
		candidates,
		events,
		tasks,
		checklistItems,
		documents,
		dailyUpdates,
		eodSubmissionState,
		eodReport,
		workFlags,
		currentUserId,
		access,
		companies,
		today,
		selectedDate,
	} = data;

	useEffect(() => {
		if (!search.focusTask) return;
		const task = tasks.find((candidate) => candidate.id === search.focusTask);
		if (!task) return;

		setSelectedTask(task);
		void navigate({
			to: "/projects/$id",
			params: { id: project.id },
			search: {
				tab: "tasks",
				view: search.view,
				status: search.status,
				stage: search.stage,
				date: search.date,
			},
			replace: true,
		});
	}, [
		navigate,
		project.id,
		search.date,
		search.focusTask,
		search.stage,
		search.status,
		search.view,
		tasks,
	]);

	const memberOptions = useMemo(
		() =>
			(
				members as Array<{
					userId: string;
					userName: string | null;
					isCurrent?: boolean;
				}>
			)
				.filter((m) => m.isCurrent)
				.map((m) => ({ userId: m.userId, userName: m.userName })),
		[members],
	);

	const currentStageKey =
		project.currentStageKey || stages[0]?.key || "planning";
	const currentStageItems = useMemo(
		() => checklistItems.filter((i) => i.stageKey === currentStageKey),
		[checklistItems, currentStageKey],
	);
	const checklistSummary = useMemo(() => {
		const res = assessStageChecklist(currentStageItems);
		const stageName = stages.find((s) => s.key === currentStageKey)?.name;
		return { ...res, currentStageName: stageName };
	}, [currentStageItems, stages, currentStageKey]);

	const handleTabChange = (newTab: string) => {
		navigate({
			to: "/projects/$id",
			params: { id: project.id },
			search: () => ({
				tab: newTab === "overview" ? undefined : (newTab as TabKey),
				view: view === "list" ? undefined : view,
				date: search.date,
			}),
		});
	};

	const handleMembersOpenChange = (open: boolean) => {
		setMembersOpen(open);
		if (!open && search.tab === "members") {
			navigate({
				to: "/projects/$id",
				params: { id: project.id },
				search: () => ({
					tab: undefined,
					view: view === "list" ? undefined : view,
					date: search.date,
				}),
			});
		}
	};

	const handleViewChange = (newView: string) => {
		navigate({
			to: "/projects/$id",
			params: { id: project.id },
			search: () => ({
				tab: tab === "overview" ? undefined : tab,
				view: newView === "list" ? undefined : (newView as ViewKey),
				date: search.date,
			}),
		});
	};

	const handleDateChange = (newDate: string) => {
		navigate({
			to: "/projects/$id",
			params: { id: project.id },
			search: () => ({
				tab: tab === "overview" ? undefined : tab,
				view: view === "list" ? undefined : view,
				date: newDate === today ? undefined : newDate,
			}),
		});
	};

	const handleArchive = () => {
		startArchiving(async () => {
			try {
				const res = await archiveProject({ data: { projectId: project.id } });
				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Project archived successfully");
					setArchiveOpen(false);
					router.invalidate();
				}
			} catch (_err) {
				toast.error("Failed to archive project");
			}
		});
	};

	return (
		<Page>
			<ProjectHeaderSection
				project={project}
				access={access}
				tab={tab}
				onTabChange={handleTabChange}
				onEditClick={() => setEditOpen(true)}
				onManageMembersClick={() => setMembersOpen(true)}
			/>

			<ProjectTabsContent
				tab={tab}
				rawTab={rawTab}
				view={view}
				onViewChange={handleViewChange}
				project={project}
				client={client}
				contacts={contacts}
				members={members}
				stages={stages}
				progress={progress}
				tasks={tasks}
				checklistItems={checklistItems}
				documents={documents}
				dailyUpdates={dailyUpdates}
				eodSubmissionState={eodSubmissionState}
				eodReport={eodReport}
				workFlags={workFlags}
				events={events}
				currentUserId={currentUserId}
				access={access}
				today={today}
				currentStageKey={currentStageKey}
				memberOptions={memberOptions}
				checklistSummary={checklistSummary}
				allUsers={candidates.map((c) => ({ ...c, role: null }))}
				selectedDate={selectedDate}
				onDateChange={handleDateChange}
				onSelectTask={setSelectedTask}
				onAddTask={() => {
					setTaskToEdit(null);
					setParentTaskId(null);
					setCreateTaskOpen(true);
				}}
				onTabChange={handleTabChange}
				onManageMembers={() => setMembersOpen(true)}
				onSuccess={() => router.invalidate()}
				onStageSuccess={() => router.invalidate()}
			/>

			<ProjectModalsContainer
				project={project}
				companies={companies}
				stages={stages}
				members={memberOptions}
				today={today}
				access={access}
				editOpen={editOpen}
				onEditOpenChange={setEditOpen}
				archiveOpen={archiveOpen}
				onArchiveOpenChange={setArchiveOpen}
				onConfirmArchive={handleArchive}
				isArchiving={false}
				selectedTask={selectedTask}
				onSelectTask={setSelectedTask}
				createTaskOpen={createTaskOpen}
				onCreateTaskOpenChange={setCreateTaskOpen}
				taskToEdit={taskToEdit}
				onTaskToEditChange={setTaskToEdit}
				parentTaskId={parentTaskId}
				onParentTaskIdChange={setParentTaskId}
				membersOpen={membersOpen}
				onMembersOpenChange={handleMembersOpenChange}
				allProjectMembers={members as unknown as ProjectMemberItem[]}
				allUsers={candidates.map((c) => ({ ...c, role: null }))}
				onSuccess={() => router.invalidate()}
			/>
		</Page>
	);
}
