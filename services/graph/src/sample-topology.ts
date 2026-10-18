import { eq } from "../../../shared/graph/expressions.ts";
import type { GraphDatabase } from "../../../shared/graph/query.ts";
import {
	sampleEmployees,
	sampleProjectMembers,
	sampleProjects,
} from "./sample-catalog.ts";
import { addSample, dateOffset, node } from "./sample-data.ts";
import { projectValues, taskValues } from "./sample-work.ts";

/** One-time conversion of the original fictional fixtures, requested for the startup demo.
 * Only known sample records are reconciled. Later seed runs preserve all edits.
 */
export async function configureStartupTopology(
	db: GraphDatabase,
	monday: string,
) {
	const Project = node("Project"),
		Member = node("ProjectMembership"),
		Task = node("Task"),
		Progress = node("StageProgress");
	for (const [index, project] of sampleProjects.entries()) {
		const { id, createdById: _createdById, ...values } = projectValues(
			project,
			index,
			"sample-admin",
			monday,
		);
		await db.update(Project).set(values).where(eq(Project.id, id));
		await db
			.update(Progress)
			.set({ stageKey: project.stage })
			.where(eq(Progress.id, `sample-progress-${id}`));
		for (const employee of sampleEmployees) {
			const active = sampleProjectMembers[id].includes(employee.id);
			const assignments = sampleProjects.filter((p) =>
				sampleProjectMembers[p.id].includes(employee.id),
			).length;
			await db
				.update(Member)
				.set({
					isCurrent: active,
					role: employee.id === project.ownerId ? "manager" : "contributor",
					allocationPercent: active ? Math.floor(100 / assignments) : 0,
					leftAt: active ? null : monday,
					leaveReason: active ? null : "Startup sample staffing updated",
				})
				.where(eq(Member.id, `sample-member-${id}-${employee.id}`));
		}
		for (let t = 0; t < 4; t++) {
			const {
				id: taskId,
				createdById: _creator,
				...task
			} = taskValues(project, index, t, "sample-admin", monday);
			await db.update(Task).set(task).where(eq(Task.id, taskId));
		}
		for (let t = 5; t <= 6; t++)
			await db
				.update(Task)
				.set({
					assigneeId: project.members[(t - 5) % project.members.length],
					stageKey: project.stage,
				})
				.where(eq(Task.id, `sample-task-${index}-${t}`));
		// Existing update rows retain their identity while their hours reflect the new allocation.
		const Update = node("DailyUpdate");
		for (const personId of sampleProjectMembers[id]) {
			const assignments = sampleProjects.filter((p) =>
				sampleProjectMembers[p.id].includes(personId),
			).length;
			await db
				.update(Update)
				.set({
					hoursSpent: Math.round(60 / assignments) / 10,
					summary: `Advanced ${project.tasks[1].toLowerCase()}. Next: ${project.tasks[3].toLowerCase()}.`,
					blockers: personId === project.members[0] ? project.blocker : null,
				})
				.where(eq(Update.id, `sample-update-${id}-${personId}`));
		}
		// Keep former contributors' historical updates, but make them historical rather than today's work.
		for (const employee of sampleEmployees.filter(
			(person) => !sampleProjectMembers[id].includes(person.id),
		))
			await db
				.update(Update)
				.set({ date: dateOffset(monday, -14) })
				.where(eq(Update.id, `sample-update-${id}-${employee.id}`));
	}
	await addSample(db, "Notification", {
		id: "sample-startup-ready",
		userId: "sample-hr",
		type: "system",
		title: "Northstar's startup team is ready",
		body: "14 colleagues, three leads and ten projects are connected in the local workspace.",
		actionUrl: "/organization",
	});
}
