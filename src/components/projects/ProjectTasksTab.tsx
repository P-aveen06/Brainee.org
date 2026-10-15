"use client";

import type { ProjectAccess } from "@/lib/project-access";
import { TaskBoardView } from "./TaskBoardView";
import { TaskCalendarView } from "./TaskCalendarView";
import type { TaskDetailItem } from "./TaskDetailSheet";
import { TaskGanttView } from "./TaskGanttView";
import { TaskListView } from "./TaskListView";

interface ProjectTasksTabProps {
	view: "list" | "board" | "gantt" | "calendar";
	onViewChange?: (view: "list" | "board" | "gantt" | "calendar") => void;
	tasks: TaskDetailItem[];
	projectCode: string;
	access: ProjectAccess;
	today: string;
	onSelectTask: (task: TaskDetailItem) => void;
	onAddTask: () => void;
	onSuccess: () => void;
}

export function ProjectTasksTab({
	view,
	onViewChange,
	tasks,
	projectCode,
	access,
	today,
	onSelectTask,
	onAddTask,
	onSuccess,
}: ProjectTasksTabProps) {
	return (
		<div className="space-y-4">
			{view === "list" && (
				<TaskListView
					tasks={tasks}
					projectCode={projectCode}
					today={today}
					onSelectTask={onSelectTask}
					view={view}
					onViewChange={onViewChange}
					onAddTask={onAddTask}
					access={access}
				/>
			)}

			{view === "board" && (
				<TaskBoardView
					tasks={tasks}
					projectCode={projectCode}
					access={access}
					today={today}
					onSelectTask={onSelectTask}
					onAddTask={onAddTask}
					onSuccess={onSuccess}
					view={view}
					onViewChange={onViewChange}
				/>
			)}

			{view === "gantt" && (
				<TaskGanttView
					tasks={tasks}
					projectCode={projectCode}
					onSelectTask={onSelectTask}
					view={view}
					onViewChange={onViewChange}
					onAddTask={onAddTask}
					access={access}
				/>
			)}

			{view === "calendar" && (
				<TaskCalendarView
					tasks={tasks}
					projectCode={projectCode}
					today={today}
					onSelectTask={onSelectTask}
					view={view}
					onViewChange={onViewChange}
					onAddTask={onAddTask}
					access={access}
				/>
			)}
		</div>
	);
}
