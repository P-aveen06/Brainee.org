"use client";

import {
	BarChart3,
	Calendar,
	CheckSquare,
	Edit,
	FolderKanban,
	Kanban,
	List,
	Paperclip,
	Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { PageTabs } from "@/components/ui/page-tabs";
import type { ProjectAccess } from "@/lib/project-access";
import { ProjectHealthBadge } from "./ProjectHealthBadge";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

export const TABS = [
	{ value: "overview", label: "Overview", icon: FolderKanban },
	{ value: "tasks", label: "Tasks", icon: CheckSquare },
	{ value: "daily", label: "Daily", icon: Calendar },
	{ value: "checklists", label: "Checklists", icon: CheckSquare },
	{ value: "documents", label: "Documents", icon: Paperclip },
] as const;

export type TabKey = (typeof TABS)[number]["value"];
export type ViewKey = "list" | "board" | "gantt" | "calendar";

export const VIEW_PILLS = [
	{ value: "list", label: "List", icon: List },
	{ value: "board", label: "Board", icon: Kanban },
	{ value: "gantt", label: "Gantt", icon: BarChart3 },
	{ value: "calendar", label: "Calendar", icon: Calendar },
] as const;

interface ProjectHeaderSectionProps {
	project: {
		id: string;
		code: string;
		name: string;
		description?: string | null;
		status: string;
		healthOverride?: string | null;
		currentStageKey?: string | null;
	};
	access: ProjectAccess;
	tab: TabKey;
	onTabChange: (newTab: string) => void;
	onEditClick: () => void;
	onManageMembersClick?: () => void;
}

export function ProjectHeaderSection({
	project,
	access,
	tab,
	onTabChange,
	onEditClick,
	onManageMembersClick,
}: ProjectHeaderSectionProps) {
	return (
		<>
			<PageHeader
				title={
					<div className="flex flex-wrap items-center gap-3">
						<span className="font-mono text-base font-semibold text-primary">
							{project.code}
						</span>
						<span>{project.name}</span>
						<div className="flex items-center gap-2">
							<ProjectStatusBadge status={project.status} />
							<ProjectHealthBadge health={project.healthOverride} />
						</div>
					</div>
				}
				description={project.description}
				actions={
					<div className="flex items-center gap-2">
						{onManageMembersClick && (
							<Button
								variant="outline"
								size="sm"
								className="gap-1.5"
								onClick={onManageMembersClick}
							>
								<Users className="size-3.5" />
								Team
							</Button>
						)}
						{access.canManage && (
							<Button
								variant="outline"
								size="sm"
								className="gap-1.5"
								onClick={onEditClick}
							>
								<Edit className="size-3.5" />
								Edit Project
							</Button>
						)}
					</div>
				}
			/>

			{/* Navigation Tabs at the top */}
			<PageTabs
				items={TABS.map((t) => ({
					value: t.value,
					label: (
						<span className="flex items-center gap-1.5">
							<t.icon className="h-3.5 w-3.5" />
							{t.label}
						</span>
					),
				}))}
				value={tab}
				onChange={onTabChange}
				ariaLabel="Project sections"
			/>
		</>
	);
}
