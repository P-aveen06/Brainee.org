"use client";

import type { EodSubmissionState } from "@/lib/eod-policy";
import type { ProjectAccess } from "@/lib/project-access";
import type { StageChecklistAssessment } from "@/lib/project-stage-policy";
import type { ChecklistItemData } from "./ChecklistItemRow";
import { ChecklistPanel } from "./ChecklistPanel";
import {
	type ClientCompany,
	type ClientContactItem,
	ClientContactsPanel,
} from "./ClientContactsPanel";
import {
	DailyConsolidatedPanel,
	type DailySection,
} from "./DailyConsolidatedPanel";
import type { MemberDailyUpdateData } from "./DailyUpdatesPanel";
import { DocumentsPanel } from "./DocumentsPanel";
import type { DocumentItemData } from "./DocumentVersionHistoryDialog";
import type { ProjectEodReportData } from "./EodReportEditor";
import {
	MemberManagerPanel,
	type ProjectMemberItem,
} from "./MemberManagerDialog";
import type { TabKey, ViewKey } from "./ProjectHeaderSection";
import { ProjectOverviewTab } from "./ProjectOverviewTab";
import { ProjectTasksTab } from "./ProjectTasksTab";
import { ProjectTimeline } from "./ProjectTimeline";
import type { Stage, StageProgress } from "./StageTracker";
import type { TaskDetailItem } from "./TaskDetailSheet";
import type { WorkFlagItemData } from "./WorkFlagCard";

interface ProjectTabsContentProps {
	tab: TabKey | string;
	rawTab?: string;
	view: ViewKey;
	project: {
		id: string;
		code: string;
		name: string;
		description?: string | null;
		projectType: string;
		priority: string;
		currentStageKey?: string | null;
		startDate?: string | null;
		targetEndDate?: string | null;
		actualEndDate?: string | null;
		engagementModel?: string | null;
		clientProjectName?: string | null;
		contractValue?: number | null;
		currency?: string | null;
	};
	client?: ClientCompany | null;
	contacts: ClientContactItem[];
	members: Array<{
		id: string;
		userId: string;
		userName?: string | null;
		role: string;
		isCurrent?: boolean;
	}>;
	stages: Stage[];
	progress?: StageProgress[];
	tasks: TaskDetailItem[];
	checklistItems: ChecklistItemData[];
	documents: DocumentItemData[];
	dailyUpdates: MemberDailyUpdateData[];
	eodSubmissionState: EodSubmissionState;
	eodReport: ProjectEodReportData | null;
	workFlags: WorkFlagItemData[];
	events: Array<{
		id: string;
		eventType: string;
		actorName?: string | null;
		createdAt?: Date | null;
		details?: string | null;
	}>;
	currentUserId?: string;
	access: ProjectAccess;
	today: string;
	currentStageKey: string;
	memberOptions: Array<{ userId: string; userName: string | null }>;
	checklistSummary:
		| (StageChecklistAssessment & { currentStageName?: string })
		| null;
	allUsers: Array<{
		id: string;
		name: string | null;
		email: string | null;
		role: string | null;
	}>;
	selectedDate: string;
	onDateChange: (date: string) => void;
	onSelectTask: (task: TaskDetailItem | null) => void;
	onAddTask: () => void;
	onViewChange?: (view: ViewKey) => void;
	onTabChange: (tab: string) => void;
	onManageMembers?: () => void;
	onSuccess: () => void;
	onStageSuccess?: () => void;
}

export function ProjectTabsContent({
	tab,
	rawTab,
	view,
	project,
	client,
	contacts,
	members,
	stages,
	progress,
	tasks,
	checklistItems,
	documents,
	dailyUpdates,
	eodSubmissionState,
	eodReport,
	workFlags,
	events,
	currentUserId,
	access,
	today,
	currentStageKey,
	memberOptions,
	checklistSummary,
	allUsers,
	selectedDate,
	onDateChange,
	onSelectTask,
	onAddTask,
	onViewChange,
	onTabChange,
	onManageMembers,
	onSuccess,
	onStageSuccess,
}: ProjectTabsContentProps) {
	switch (tab) {
		case "overview":
			return (
				<ProjectOverviewTab
					project={project}
					client={client}
					members={members}
					access={access}
					stages={stages}
					progress={progress}
					checklistSummary={checklistSummary}
					onManageMembers={onManageMembers || (() => onTabChange("members"))}
					onStageSuccess={onStageSuccess}
				/>
			);
		case "tasks":
			return (
				<ProjectTasksTab
					view={view}
					onViewChange={onViewChange}
					tasks={tasks}
					projectCode={project.code}
					access={access}
					today={today}
					onSelectTask={onSelectTask}
					onAddTask={onAddTask}
					onSuccess={onSuccess}
				/>
			);
		case "daily":
		case "updates":
		case "eod":
		case "flags": {
			const initialSection: DailySection | undefined =
				tab === "updates" || tab === "eod" || tab === "flags"
					? (tab as DailySection)
					: rawTab === "updates" || rawTab === "eod" || rawTab === "flags"
						? (rawTab as DailySection)
						: undefined;

			return (
				<DailyConsolidatedPanel
					projectId={project.id}
					projectCode={project.code}
					projectName={project.name}
					flags={workFlags}
					updates={dailyUpdates}
					currentUserId={currentUserId}
					selectedDate={selectedDate}
					today={today}
					onDateChange={onDateChange}
					submissionState={eodSubmissionState}
					report={eodReport}
					access={access}
					initialSection={initialSection}
					onSuccess={onSuccess}
				/>
			);
		}
		case "checklists":
			return (
				<ChecklistPanel
					projectId={project.id}
					currentStageKey={currentStageKey}
					stages={stages}
					items={checklistItems}
					members={memberOptions}
					access={access}
					onSuccess={onSuccess}
				/>
			);
		case "documents":
			return (
				<DocumentsPanel
					projectId={project.id}
					stages={stages}
					documents={documents}
					access={access}
					onSuccess={onSuccess}
				/>
			);
		case "members":
			return (
				<MemberManagerPanel
					projectId={project.id}
					members={members as unknown as ProjectMemberItem[]}
					allUsers={allUsers}
					access={access}
					onSuccess={onSuccess}
				/>
			);
		case "client":
			return (
				<ClientContactsPanel
					client={client}
					clientProjectName={project.clientProjectName}
					engagementModel={project.engagementModel}
					contractValue={project.contractValue}
					currency={project.currency}
					contacts={contacts}
				/>
			);
		case "timeline":
			return <ProjectTimeline events={events} />;
		default:
			return (
				<ProjectOverviewTab
					project={project}
					client={client}
					members={members}
					access={access}
					stages={stages}
					progress={progress}
					checklistSummary={checklistSummary}
					onManageMembers={onManageMembers || (() => onTabChange("members"))}
					onStageSuccess={onStageSuccess}
				/>
			);
	}
}
