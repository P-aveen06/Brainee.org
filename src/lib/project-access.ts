import { and, eq, or } from "drizzle-orm";
import type { Database } from "../db";
import { projectMembers, projects } from "../db/schema";
import { AppError } from "./errors";

export interface ProjectAccessUser {
	id: string;
	role?: string | null;
}

export type ProjectRole = "owner" | "manager" | "contributor" | "viewer";
export type AccessLevel = ProjectRole;

export interface ProjectAccess {
	role: ProjectRole;
	canView: boolean;
	canContribute: boolean; // tasks, comments, documents, daily updates
	canManage: boolean; // stage advance, project edit, member management
	canOwn: boolean; // archive, transfer ownership
	projectId?: string;
}

const LEVEL_RANK: Record<AccessLevel, number> = {
	viewer: 1,
	contributor: 2,
	manager: 3,
	owner: 4,
};

export function meetsAccessLevel(
	role: ProjectRole,
	minLevel: AccessLevel,
): boolean {
	return LEVEL_RANK[role] >= LEVEL_RANK[minLevel];
}

/**
 * Pure authorization resolver.
 *
 * Rules, evaluated in order:
 * 1. Global admin -> owner access to every project.
 * 2. projects.ownerId === user.id -> owner.
 * 3. An active project_members row (isCurrent = true) -> that row's role.
 * 4. Otherwise -> null (no access). The org chart grants nothing.
 */
export function resolveProjectAccess(
	user: { id: string; role?: string | null },
	project: { id: string; ownerId: string },
	memberRow: { role: ProjectRole; isCurrent: boolean } | null,
): ProjectAccess | null {
	if (user.role === "admin") {
		return {
			role: "owner",
			canView: true,
			canContribute: true,
			canManage: true,
			canOwn: true,
		};
	}

	if (project.ownerId === user.id) {
		return {
			role: "owner",
			canView: true,
			canContribute: true,
			canManage: true,
			canOwn: true,
		};
	}

	if (memberRow?.isCurrent) {
		switch (memberRow.role) {
			case "owner":
				return {
					role: "owner",
					canView: true,
					canContribute: true,
					canManage: true,
					canOwn: true,
				};
			case "manager":
				return {
					role: "manager",
					canView: true,
					canContribute: true,
					canManage: true,
					canOwn: false,
				};
			case "contributor":
				return {
					role: "contributor",
					canView: true,
					canContribute: true,
					canManage: false,
					canOwn: false,
				};
			case "viewer":
				return {
					role: "viewer",
					canView: true,
					canContribute: false,
					canManage: false,
					canOwn: false,
				};
		}
	}

	return null;
}

/**
 * Row-level access check for server functions and routes.
 *
 * Fails closed: throws AppError("Project not found.") rather than "Forbidden",
 * preventing project enumeration probes.
 */
export async function assertProjectAccess(
	db: Database,
	user: ProjectAccessUser,
	projectId: string,
	minLevel: AccessLevel = "viewer",
): Promise<ProjectAccess> {
	const trimmed = projectId.trim();
	const [project] = await db
		.select({ id: projects.id, ownerId: projects.ownerId })
		.from(projects)
		.where(
			or(
				eq(projects.id, trimmed),
				eq(projects.id, trimmed.toLowerCase()),
				eq(projects.code, trimmed),
				eq(projects.code, trimmed.toUpperCase()),
			),
		)
		.limit(1);

	if (!project) {
		throw new AppError("Project not found.");
	}

	// Fetch current member record for this user if one exists
	const [memberRow] = await db
		.select({
			role: projectMembers.role,
			isCurrent: projectMembers.isCurrent,
		})
		.from(projectMembers)
		.where(
			and(
				eq(projectMembers.projectId, project.id),
				eq(projectMembers.userId, user.id),
			),
		)
		.limit(1);

	const access = resolveProjectAccess(
		user,
		project,
		memberRow as { role: ProjectRole; isCurrent: boolean } | null,
	);

	if (!access || !meetsAccessLevel(access.role, minLevel)) {
		throw new AppError("Project not found.");
	}

	return {
		...access,
		projectId: project.id,
	};
}

/**
 * Derives the list of project IDs visible to the given user.
 *
 * - Admin sees all projects -> returns "all".
 * - Ordinary users/leads see only projects where they are owner or an active member.
 */
export async function visibleProjectIdsFor(
	db: Database,
	user: ProjectAccessUser,
): Promise<string[] | "all"> {
	if (user.role === "admin") {
		return "all";
	}

	const owned = await db
		.select({ id: projects.id })
		.from(projects)
		.where(eq(projects.ownerId, user.id));

	const memberProjects = await db
		.select({ projectId: projectMembers.projectId })
		.from(projectMembers)
		.where(
			and(
				eq(projectMembers.userId, user.id),
				eq(projectMembers.isCurrent, true),
			),
		);

	const idSet = new Set<string>();
	for (const p of owned) idSet.add(p.id);
	for (const m of memberProjects) idSet.add(m.projectId);

	return Array.from(idSet);
}
