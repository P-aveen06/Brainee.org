import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { projectTasks, users } from "@/db/schema";
import { assertProjectAccess } from "@/lib/project-access";
import type { AppUser } from "@/lib/server-fn";
import type { AssistantPageContext } from "./page-context";

export async function verifyAssistantPageContext(
	db: Database,
	user: AppUser,
	context: AssistantPageContext | undefined,
): Promise<AssistantPageContext | undefined> {
	if (!context) return undefined;
	const verified: AssistantPageContext = {
		routeId: context.routeId,
		screen: context.screen,
		visibleState: context.visibleState,
	};
	const entity = context.primaryEntity;
	if (!entity) return verified;

	if (entity.type === "project") {
		try {
			await assertProjectAccess(db, user, entity.id, "viewer");
			verified.primaryEntity = entity;
		} catch {
			// Context narrows a request; an inaccessible client-supplied id is discarded.
		}
		return verified;
	}

	if (entity.type === "task") {
		const [task] = await db
			.select({ projectId: projectTasks.projectId })
			.from(projectTasks)
			.where(eq(projectTasks.id, entity.id))
			.limit(1);
		if (!task) return verified;
		try {
			await assertProjectAccess(db, user, task.projectId, "viewer");
			verified.primaryEntity = entity;
		} catch {
			// Deliberately indistinguishable from a missing task.
		}
		return verified;
	}

	if (entity.type === "employee" && user.role === "admin") {
		const [employee] = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.id, entity.id))
			.limit(1);
		if (employee) verified.primaryEntity = entity;
	}
	return verified;
}
