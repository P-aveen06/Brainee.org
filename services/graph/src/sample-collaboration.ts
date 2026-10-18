import type { GraphDatabase } from "../../../shared/graph/query.ts";
import { sampleProjects } from "./sample-catalog.ts";
import { addSample, dateOffset, sampleProjectMembers } from "./sample-data.ts";

const projects = sampleProjects.map((project) => ({
	...project,
	tasks: [
		`Add loading and empty states for ${project.tasks[1].toLowerCase()}`,
		`Review acceptance criteria for ${project.tasks[3].toLowerCase()}`,
	],
	reply:
		"The decision is reflected in the delivery checklist and the assigned follow-up work.",
}));

export async function seedSampleCollaboration(
	db: GraphDatabase,
	adminId: string,
	monday: string,
	today: string,
) {
	for (const [projectIndex, project] of projects.entries()) {
		const members = sampleProjectMembers[project.id];
		const taskPrefix = `sample-task-${projectIndex}`;
		const childTaskIds = [5, 6].map((number) => `${taskPrefix}-${number}`);

		for (const [index, title] of project.tasks.entries())
			await addSample(db, "Task", {
				id: childTaskIds[index],
				projectId: project.id,
				parentTaskId: `${taskPrefix}-1`,
				taskNumber: index + 5,
				title,
				description: "Fictional follow-up task linked to the project work.",
				status: index === 0 ? "in_progress" : "todo",
				priority: index === 0 ? "high" : "medium",
				assigneeId: project.members[index % project.members.length],
				createdById: adminId,
				stageKey: project.stage,
				startDate: dateOffset(monday, -2),
				dueDate: dateOffset(monday, index + 3),
				estimateHours: index === 0 ? 4 : 3,
				actualHours: null,
				blockedReason: null,
				sequence: index + 5,
			});

		await addSample(db, "Task", {
			id: `${taskPrefix}-7`,
			projectId: project.id,
			taskNumber: 7,
			title: `Review solution architecture for ${project.name}`,
			description: project.decision,
			status: project.health === "red" ? "in_progress" : "in_review",
			priority: "high",
			assigneeId: "sample-dev",
			createdById: adminId,
			stageKey: project.stage,
			dueDate: dateOffset(monday, 2),
			estimateHours: 2,
			sequence: 7,
		});
		for (const [index, userId] of members.entries()) {
			const updateId = `sample-update-${project.id}-${userId}`;
			const taskId =
				userId === "sample-dev"
					? `${taskPrefix}-7`
					: index === 1
						? childTaskIds[0]
						: index === 2
							? childTaskIds[1]
							: `${taskPrefix}-${index % 4}`;
			await addSample(db, "DailyUpdate", {
				id: updateId,
				projectId: project.id,
				userId,
				date: today,
				summary: `Advanced ${project.tasks[0].toLowerCase()}. Next: ${project.tasks[1].toLowerCase()}.`,
				blockers: userId === project.members[0] ? project.blocker : null,
				hoursSpent:
					Math.round(
						60 /
							sampleProjects.filter((p) =>
								sampleProjectMembers[p.id].includes(userId),
							).length,
					) / 10,
				status: "submitted",
				submittedAt: new Date(`${today}T14:30:00.000Z`),
			});
			await addSample(db, "DailyUpdateItem", {
				id: `${updateId}-task`,
				updateId,
				taskId,
				note: "Progress recorded in the sample project update.",
				progressNote: "The next action is assigned and scheduled.",
			});
		}

		for (const [index, title] of [
			"Review acceptance criteria",
			"Confirm QA coverage",
		].entries()) {
			const assigneeId = members[index + 1] ?? members[0];
			const done = index === 0;
			await addSample(db, "ChecklistItem", {
				id: `sample-checklist-${project.id}-${index + 1}`,
				projectId: project.id,
				stageKey: project.stage,
				title,
				description:
					"Fictional development-stage requirement for the sample team.",
				isRequired: true,
				status: done ? "done" : "pending",
				assignedToId: assigneeId,
				createdById: adminId,
				dueDate: dateOffset(today, 1),
				completedById: done ? assigneeId : null,
				completedAt: done
					? new Date(`${dateOffset(today, -1)}T12:00:00.000Z`)
					: null,
				notes: done ? "Sample acceptance criteria reviewed." : null,
				sequence: index + 1,
			});
		}

		const decisionId = `sample-comment-${project.id}-decision`;
		await addSample(db, "Comment", {
			id: decisionId,
			projectId: project.id,
			stageKey: project.stage,
			taskId: childTaskIds[0],
			authorId: members[0],
			body: project.decision,
			isDecision: true,
			isPinned: true,
		});
		await addSample(db, "Comment", {
			id: `sample-comment-${project.id}-reply`,
			projectId: project.id,
			stageKey: project.stage,
			taskId: childTaskIds[0],
			parentId: decisionId,
			authorId: members[1] ?? members[0],
			body: project.reply,
			isDecision: false,
			isPinned: false,
		});

		await addSample(db, "ProjectEvent", {
			id: `sample-event-${project.id}-created`,
			projectId: project.id,
			eventType: "created",
			actorId: adminId,
			entityType: "project",
			entityId: project.id,
			details: JSON.stringify({ code: project.id.replace("sample-", "DEMO-") }),
		});
		await addSample(db, "ProjectEvent", {
			id: `sample-event-${project.id}-task-started`,
			projectId: project.id,
			eventType: "task_status_changed",
			actorId: members[1] ?? members[0],
			entityType: "task",
			entityId: childTaskIds[0],
			details: JSON.stringify({ taskNumber: 5, newStatus: "in_progress" }),
		});
	}
}
