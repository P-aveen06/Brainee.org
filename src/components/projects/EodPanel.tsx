"use client";

import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { DataTableToolbar } from "@/components/layout/data-table-layout";
import { Button } from "@/components/ui/button";
import type { EodSubmissionState } from "@/lib/eod-policy";
import { addIsoDays } from "@/lib/leave-policy";
import type { ProjectAccess } from "@/lib/project-access";
import { EodReportEditor, type ProjectEodReportData } from "./EodReportEditor";
import { EodStatusPanel } from "./EodStatusPanel";

interface EodPanelProps {
	projectId: string;
	projectCode: string;
	projectName: string;
	date: string;
	today: string;
	onDateChange: (date: string) => void;
	submissionState: EodSubmissionState;
	report: ProjectEodReportData | null;
	access: ProjectAccess;
	onSuccess: () => void;
}

export function EodPanel({
	projectId,
	projectCode: _projectCode,
	projectName: _projectName,
	date,
	today,
	onDateChange,
	submissionState,
	report,
	access,
	onSuccess,
}: EodPanelProps) {
	const handlePrevDay = () => {
		onDateChange(addIsoDays(date, -1));
	};

	const handleNextDay = () => {
		onDateChange(addIsoDays(date, 1));
	};

	const handleToday = () => {
		onDateChange(today);
	};

	return (
		<div className="space-y-4">
			{/* Standardized Toolbar */}
			<DataTableToolbar>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon-xs"
						onClick={handlePrevDay}
						className="size-8"
						title="Previous Day"
					>
						<ChevronLeft className="size-4" />
					</Button>
					<Button
						variant={date === today ? "secondary" : "outline"}
						size="sm"
						onClick={handleToday}
						className="h-8 text-xs font-mono"
					>
						{date === today ? `Today (${date})` : date}
					</Button>
					<Button
						variant="outline"
						size="icon-xs"
						onClick={handleNextDay}
						className="size-8"
						title="Next Day"
					>
						<ChevronRight className="size-4" />
					</Button>
				</div>

				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">
						EOD Assembly · {date}
					</span>
				</div>
			</DataTableToolbar>

			{/* Submission Gate Panel */}
			<EodStatusPanel
				projectId={projectId}
				date={date}
				submissionState={submissionState}
				access={access}
				onSuccess={onSuccess}
			/>

			{/* Report Display or Placeholder */}
			{report ? (
				<EodReportEditor
					projectId={projectId}
					date={date}
					report={report}
					access={access}
					onSuccess={onSuccess}
				/>
			) : (
				<div className="border border-dashed border-border/80 bg-card p-12 text-center space-y-2">
					<FileText className="size-8 mx-auto text-muted-foreground/50" />
					<h4 className="text-sm font-semibold text-foreground">
						EOD Report not yet generated for {date}
					</h4>
					<p className="text-xs text-muted-foreground max-w-md mx-auto">
						{submissionState.allSubmitted
							? "All team members have submitted their daily updates! Click 'Generate EOD Report' above to synthesize the team's achievements."
							: `Waiting for ${submissionState.missing.length} team member(s) to submit their daily standup update. Managers may generate early using the override.`}
					</p>
				</div>
			)}
		</div>
	);
}
