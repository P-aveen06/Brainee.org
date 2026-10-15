import { and, eq, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type { createTaskSchema } from "@/api/project-tasks-schema";
import type { Database } from "@/db";
import {
	projectEvents,
	projectMembers,
	projects,
	projectTasks,
	users,
} from "@/db/schema";
import { logAuditEvent } from "@/lib/audit.server";
import { AppError } from "@/lib/errors";
import { assertProjectAccess } from "@/lib/project-access";
import type { AppUser } from "@/lib/server-fn";

async function getNextTaskNumber(
	db: Database,
	projectId: string,
): Promise<number> {
	const [maxRow] = await db
		.select({ maxNum: sql<number>`max(${projectTasks.taskNumber})` })
		.from(projectTasks)
		.where(eq(projectTasks.projectId, projectId));

	return (maxRow?.maxNum || 0) + 1;
}

export async function resolveTaskAssignee(
	db: Database,
	projectId: string,
	rawAssignee: string,
): Promise<string | null> {
	const trimmed = rawAssignee.trim();
	if (!trimmed || trimmed === "none") {
		return null;
	}

	const [project] = await db
		.select({ ownerId: projects.ownerId })
		.from(projects)
		.where(eq(projects.id, projectId))
		.limit(1);

	const memberRows = await db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			isActive: users.isActive,
		})
		.from(projectMembers)
		.innerJoin(users, eq(projectMembers.userId, users.id))
		.where(
			and(
				eq(projectMembers.projectId, projectId),
				eq(projectMembers.isCurrent, true),
			),
		);

	const candidateMap = new Map<
		string,
		{ id: string; name: string; email: string; isActive: boolean | null }
	>();
	for (const m of memberRows) {
		candidateMap.set(m.id, m);
	}
	if (project?.ownerId && !candidateMap.has(project.ownerId)) {
		const [owner] = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				isActive: users.isActive,
			})
			.from(users)
			.where(eq(users.id, project.ownerId))
			.limit(1);
		if (owner) {
			candidateMap.set(owner.id, owner);
		}
	}

	const candidates = Array.from(candidateMap.values());

	// 1. Exact ID match among project candidates
	const idMatch = candidates.find((c) => c.id === trimmed);
	if (idMatch) {
		if (idMatch.isActive === false) {
			throw new AppError(
				`Cannot assign task to deactivated user "${idMatch.name}".`,
			);
		}
		return idMatch.id;
	}

	const lower = trimmed.toLowerCase();

	// 2. Exact email match among project candidates
	const emailMatches = candidates.filter(
		(c) => c.email.toLowerCase() === lower,
	);
	if (emailMatches.length === 1) {
		if (emailMatches[0].isActive === false) {
			throw new AppError(
				`Cannot assign task to deactivated user "${emailMatches[0].name}".`,
			);
		}
		return emailMatches[0].id;
	}

	// 3. Exact full name match (case-insensitive) among project candidates
	const exactNameMatches = candidates.filter(
		(c) => c.name.toLowerCase() === lower,
	);
	if (exactNameMatches.length === 1) {
		if (exactNameMatches[0].isActive === false) {
			throw new AppError(
				`Cannot assign task to deactivated user "${exactNameMatches[0].name}".`,
			);
		}
		return exactNameMatches[0].id;
	}
	if (exactNameMatches.length > 1) {
		throw new AppError(
			`Multiple project members share the name "${trimmed}". Please provide an email or user ID.`,
		);
	}

	// 4. Token / single-word match among project candidates
	const tokenMatches = candidates.filter((c) => {
		const parts = c.name.toLowerCase().split(/\s+/);
		return parts.includes(lower);
	});
	if (tokenMatches.length === 1) {
		if (tokenMatches[0].isActive === false) {
			throw new AppError(
				`Cannot assign task to deactivated user "${tokenMatches[0].name}".`,
			);
		}
		return tokenMatches[0].id;
	}
	if (tokenMatches.length > 1) {
		const names = tokenMatches.map((c) => c.name).join(", ");
		throw new AppError(
			`Assignee "${trimmed}" is ambiguous between multiple project members (${names}). Please specify the full name or email.`,
		);
	}

	// 5. If not matched in project members, check directory for specific feedback
	const [globalUser] = await db
		.select({ id: users.id, name: users.name, isActive: users.isActive })
		.from(users)
		.where(
			or(
				eq(users.id, trimmed),
				eq(users.email, lower),
				eq(users.name, trimmed),
			),
		)
		.limit(1);

	if (globalUser) {
		if (globalUser.isActive === false) {
			throw new AppError(
				`Cannot assign task to deactivated user "${globalUser.name}".`,
			);
		}
		throw new AppError(
			`"${globalUser.name}" is not assigned to this project. Please add them as a project member first.`,
		);
	}

	throw new AppError(`Could not find project member matching "${trimmed}".`);
}

export async function createTaskCore(
	db: Database,
	user: AppUser,
	input: z.infer<typeof createTaskSchema>,
) {
	await assertProjectAccess(db, user, input.projectId, "contributor");

	let resolvedAssigneeId: string | null = null;
	if (input.assigneeId && input.assigneeId !== "none") {
		resolvedAssigneeId = await resolveTaskAssignee(
			db,
			input.projectId,
			input.assigneeId,
		);
	}

	const taskId = crypto.randomUUID();
	let taskNumber = await getNextTaskNumber(db, input.projectId);
	const taskValues = () => ({
		id: taskId,
		projectId: input.projectId,
		stageKey: input.stageKey || null,
		parentTaskId: input.parentTaskId || null,
		taskNumber,
		title: input.title.trim(),
		description: input.description?.trim() || null,
		status: "todo" as const,
		priority: input.priority,
		assigneeId: resolvedAssigneeId,
		createdById: user.id,
		startDate: input.startDate || null,
		dueDate: input.dueDate || null,
		estimateHours: input.estimateHours ?? null,
		sequence: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	try {
		await db.insert(projectTasks).values(taskValues());
	} catch (error: unknown) {
		if (!String(error).includes("UNIQUE constraint failed")) throw error;
		taskNumber = await getNextTaskNumber(db, input.projectId);
		await db.insert(projectTasks).values(taskValues());
	}

	await db.insert(projectEvents).values({
		id: crypto.randomUUID(),
		projectId: input.projectId,
		eventType: "task_created",
		actorId: user.id,
		entityType: "task",
		entityId: taskId,
		details: JSON.stringify({
			taskNumber,
			title: input.title,
			priority: input.priority,
			assigneeId: resolvedAssigneeId,
		}),
		createdAt: new Date(),
	});

	await logAuditEvent(db, {
		actorId: user.id,
		action: "project_task_created",
		entityType: "project_task",
		entityId: taskId,
		newData: { projectId: input.projectId, taskNumber, title: input.title },
	});

	return { success: true, taskId, taskNumber };
}
