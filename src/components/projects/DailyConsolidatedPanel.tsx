"use client";

import { AlertTriangle, Calendar, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PillToggle } from "@/components/ui/pill-toggle";
import type { EodSubmissionState } from "@/lib/eod-policy";
import type { ProjectAccess } from "@/lib/project-access";
import {
	DailyUpdatesPanel,
	type MemberDailyUpdateData,
} from "./DailyUpdatesPanel";
import { EodPanel } from "./EodPanel";
import type { ProjectEodReportData } from "./EodReportEditor";
import type { WorkFlagItemData } from "./WorkFlagCard";
import { WorkFlagsPanel } from "./WorkFlagsPanel";

export type DailySection = "flags" | "updates" | "eod";

interface DailyConsolidatedPanelProps {
	projectId: string;
	projectCode: string;
	projectName: string;
	flags: WorkFlagItemData[];
	updates: MemberDailyUpdateData[];
	currentUserId?: string;
	selectedDate: string;
	today: string;
	onDateChange: (date: string) => void;
	submissionState: EodSubmissionState;
	report: ProjectEodReportData | null;
	access: ProjectAccess;
	initialSection?: DailySection;
	onSuccess: () => void;
}

export function DailyConsolidatedPanel({
	projectId,
	projectCode,
	projectName,
	flags,
	updates,
	currentUserId,
	selectedDate,
	today,
	onDateChange,
	submissionState,
	report,
	access,
	initialSection = "flags",
	onSuccess,
}: DailyConsolidatedPanelProps) {
	const [activeSection, setActiveSection] = useState<DailySection>(() => {
		const openCount = flags.filter((f) => f.status === "open").length;
		// If explicit initial section is given or there are open flags, prioritize accordingly
		if (initialSection) return initialSection;
		return openCount > 0 ? "flags" : "updates";
	});

	const openFlagsCount = useMemo(
		() => flags.filter((f) => f.status === "open").length,
		[flags],
	);

	const sectionItems = [
		{
			value: "flags",
			label: (
				<span className="flex items-center gap-1.5">
					<AlertTriangle className="size-3.5 text-logo-orange" />
					Flags
					{openFlagsCount > 0 && (
						<Badge
							variant="destructive"
							className="ml-1 size-4 rounded-full p-0 text-[10px] leading-none flex items-center justify-center font-bold"
						>
							{openFlagsCount}
						</Badge>
					)}
				</span>
			),
		},
		{
			value: "updates",
			label: (
				<span className="flex items-center gap-1.5">
					<Calendar className="size-3.5" />
					Updates
				</span>
			),
		},
		{
			value: "eod",
			label: (
				<span className="flex items-center gap-1.5">
					<FileText className="size-3.5" />
					EOD
				</span>
			),
		},
	];

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface/30 p-2 sm:p-2.5">
				<div className="flex items-center gap-2">
					<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
						Daily Workspace
					</span>
				</div>
				<PillToggle
					items={sectionItems}
					value={activeSection}
					onChange={(val) => setActiveSection(val as DailySection)}
					ariaLabel="Daily workspace view"
				/>
			</div>

			{activeSection === "flags" && (
				<WorkFlagsPanel
					projectId={projectId}
					flags={flags}
					access={access}
					currentUserId={currentUserId}
					onSuccess={onSuccess}
				/>
			)}

			{activeSection === "updates" && (
				<DailyUpdatesPanel
					projectId={projectId}
					projectCode={projectCode}
					projectName={projectName}
					updates={updates}
					currentUserId={currentUserId}
					selectedDate={selectedDate}
					today={today}
					onDateChange={onDateChange}
					access={access}
					onSuccess={onSuccess}
				/>
			)}

			{activeSection === "eod" && (
				<EodPanel
					projectId={projectId}
					projectCode={projectCode}
					projectName={projectName}
					date={selectedDate}
					today={today}
					onDateChange={onDateChange}
					submissionState={submissionState}
					report={report}
					access={access}
					onSuccess={onSuccess}
				/>
			)}
		</div>
	);
}
