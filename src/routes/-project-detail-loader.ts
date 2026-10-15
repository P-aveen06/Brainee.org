import { getProjectChecklist } from "@/api/project-checklists";
import { getProjectComments } from "@/api/project-comments";
import { getProjectDailyUpdates } from "@/api/project-daily-updates";
import { getProjectDocuments } from "@/api/project-documents";
import { getEodStatus } from "@/api/project-eod";
import { getProjectTasks } from "@/api/project-tasks";
import { getProjectDetail } from "@/api/projects";
import { getWorkFlags } from "@/api/work-flags";
import type { ProjectEodReportData } from "@/components/projects/EodReportEditor";
import type { TaskDetailItem } from "@/components/projects/TaskDetailSheet";
import type { EodSubmissionState } from "@/lib/eod-policy";
import { getTodayIsoDate } from "@/lib/leave-policy";

export async function loadProjectDetailData(projectId: string, date?: string) {
	const targetDate = date || getTodayIsoDate();

	const [
		detail,
		tasksRes,
		checklistsRes,
		docsRes,
		commentsRes,
		updatesRes,
		eodRes,
		flagsRes,
	] = await Promise.all([
		getProjectDetail({ data: projectId }),
		getProjectTasks({ data: { projectId } }),
		getProjectChecklist({ data: { projectId } }),
		getProjectDocuments({ data: { projectId } }),
		getProjectComments({ data: { projectId } }),
		getProjectDailyUpdates({ data: { projectId, date: targetDate } }),
		getEodStatus({ data: { projectId, date: targetDate } }),
		getWorkFlags({ data: { projectId, status: "all" } }),
	]);

	const fallbackSubmissionState: EodSubmissionState = {
		expected: [],
		submitted: [],
		missing: [],
		allSubmitted: false,
		canGenerate: false,
	};

	return {
		...detail,
		tasks:
			tasksRes && "tasks" in tasksRes
				? (tasksRes.tasks as TaskDetailItem[])
				: [],
		checklistItems:
			checklistsRes && "items" in checklistsRes ? checklistsRes.items : [],
		documents: docsRes && "documents" in docsRes ? docsRes.documents : [],
		comments:
			commentsRes && "comments" in commentsRes ? commentsRes.comments : [],
		dailyUpdates:
			updatesRes && "updates" in updatesRes ? updatesRes.updates : [],
		eodSubmissionState:
			eodRes && "submissionState" in eodRes && eodRes.submissionState
				? (eodRes.submissionState as EodSubmissionState)
				: fallbackSubmissionState,
		eodReport:
			eodRes && "report" in eodRes
				? (eodRes.report as ProjectEodReportData | null)
				: null,
		workFlags: flagsRes && "flags" in flagsRes ? flagsRes.flags : [],
		currentUserId:
			commentsRes && "currentUserId" in commentsRes
				? commentsRes.currentUserId
				: undefined,
		selectedDate: targetDate,
	};
}
