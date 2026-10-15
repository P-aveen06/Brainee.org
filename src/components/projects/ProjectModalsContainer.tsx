"use client";

import type { ProjectAccess } from "@/lib/project-access";
import type { ProjectMemberItem } from "./MemberManagerDialog";
import { ProjectArchiveDialog } from "./ProjectArchiveDialog";
import {
	type CompanyOption,
	ProjectFormDialog,
	type ProjectToEdit,
} from "./ProjectFormDialog";
import { ProjectMemberManagerDialog } from "./ProjectMemberManagerDialog";
import type { Stage } from "./StageTracker";
import { type TaskDetailItem, TaskDetailSheet } from "./TaskDetailSheet";
import { TaskFormDialog, type TaskFormItem } from "./TaskFormDialog";

interface ProjectModalsContainerProps {
	project: ProjectToEdit & { code: string; name: string };
	companies: CompanyOption[];
	stages: Stage[];
	members: Array<{ userId: string; userName: string | null }>;
	today: string;
	access: ProjectAccess;
	editOpen: boolean;
	onEditOpenChange: (open: boolean) => void;
	archiveOpen: boolean;
	onArchiveOpenChange: (open: boolean) => void;
	onConfirmArchive: () => void;
	isArchiving: boolean;
	selectedTask: TaskDetailItem | null;
	onSelectTask: (task: TaskDetailItem | null) => void;
	createTaskOpen: boolean;
	onCreateTaskOpenChange: (open: boolean) => void;
	taskToEdit: TaskFormItem | null;
	onTaskToEditChange: (task: TaskFormItem | null) => void;
	parentTaskId: string | null;
	onParentTaskIdChange: (id: string | null) => void;
	membersOpen: boolean;
	onMembersOpenChange: (open: boolean) => void;
	allProjectMembers: ProjectMemberItem[];
	allUsers: Array<{
		id: string;
		name: string | null;
		email: string | null;
		role: string | null;
	}>;
	onSuccess: () => void;
}

export function ProjectModalsContainer({
	project,
	companies,
	stages,
	members,
	today,
	access,
	editOpen,
	onEditOpenChange,
	archiveOpen,
	onArchiveOpenChange,
	onConfirmArchive,
	isArchiving,
	selectedTask,
	onSelectTask,
	createTaskOpen,
	onCreateTaskOpenChange,
	taskToEdit,
	onTaskToEditChange,
	parentTaskId,
	onParentTaskIdChange,
	membersOpen,
	onMembersOpenChange,
	allProjectMembers,
	allUsers,
	onSuccess,
}: ProjectModalsContainerProps) {
	return (
		<>
			<ProjectFormDialog
				open={editOpen}
				onOpenChange={onEditOpenChange}
				projectToEdit={project}
				companies={companies}
				today={today}
				onSuccess={onSuccess}
			/>

			<TaskDetailSheet
				task={selectedTask}
				open={Boolean(selectedTask)}
				onOpenChange={(open) => !open && onSelectTask(null)}
				projectCode={project.code}
				access={access}
				today={today}
				onEdit={(t) => {
					onTaskToEditChange({
						...t,
						priority: (t.priority as TaskFormItem["priority"]) || "medium",
					});
					onParentTaskIdChange(t.parentTaskId || null);
					onSelectTask(null);
					onCreateTaskOpenChange(true);
				}}
				onAddSubtask={(pId) => {
					onTaskToEditChange(null);
					onParentTaskIdChange(pId);
					onSelectTask(null);
					onCreateTaskOpenChange(true);
				}}
				onSuccess={onSuccess}
			/>

			<TaskFormDialog
				open={createTaskOpen}
				onOpenChange={onCreateTaskOpenChange}
				projectId={project.id}
				stages={stages}
				members={members}
				taskToEdit={taskToEdit}
				parentTaskId={parentTaskId}
				onSuccess={onSuccess}
			/>

			<ProjectArchiveDialog
				open={archiveOpen}
				onOpenChange={onArchiveOpenChange}
				projectName={project.name}
				onConfirm={onConfirmArchive}
				isArchiving={isArchiving}
			/>

			<ProjectMemberManagerDialog
				open={membersOpen}
				onOpenChange={onMembersOpenChange}
				projectId={project.id}
				projectName={project.name}
				projectCode={project.code}
				members={allProjectMembers}
				allUsers={allUsers}
				access={access}
				onSuccess={onSuccess}
			/>
		</>
	);
}
