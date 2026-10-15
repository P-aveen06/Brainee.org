import { describe, expect, it } from "vitest";
import type { Database } from "@/db";
import { projects, users } from "@/db/schema";
import { resolveTaskAssignee } from "./project-task-create.server";

function createMockDb(config: {
	ownerId?: string;
	members?: Array<{
		id: string;
		name: string;
		email: string;
		isActive: boolean | null;
	}>;
	globalUsers?: Array<{
		id: string;
		name: string;
		email: string;
		isActive: boolean | null;
	}>;
}) {
	const members = config.members ?? [];
	const globalUsers = config.globalUsers ?? [];

	return {
		select: (_fields?: unknown) => ({
			from: (table: unknown) => {
				return {
					where: (_clause?: unknown) => ({
						limit: (_n: number) => {
							if (table === projects) {
								return Promise.resolve(
									config.ownerId ? [{ ownerId: config.ownerId }] : [],
								);
							}
							if (table === users) {
								return Promise.resolve(
									globalUsers.length > 0 ? [globalUsers[0]] : [],
								);
							}
							return Promise.resolve([]);
						},
					}),
					innerJoin: () => ({
						where: () => Promise.resolve(members),
					}),
				};
			},
		}),
	} as unknown as Database;
}

describe("resolveTaskAssignee", () => {
	it("returns null for none or blank assignee", async () => {
		const db = createMockDb({});
		expect(await resolveTaskAssignee(db, "prj-1", "none")).toBeNull();
		expect(await resolveTaskAssignee(db, "prj-1", "   ")).toBeNull();
	});

	it("resolves exact user ID of an active project member", async () => {
		const db = createMockDb({
			members: [
				{
					id: "usr-1",
					name: "Charan Kumar",
					email: "charan@brainee.org",
					isActive: true,
				},
				{
					id: "usr-2",
					name: "Sam Jones",
					email: "sam@brainee.org",
					isActive: true,
				},
			],
		});

		const resolved = await resolveTaskAssignee(db, "prj-1", "usr-1");
		expect(resolved).toBe("usr-1");
	});

	it("rejects assignment to a deactivated member", async () => {
		const db = createMockDb({
			members: [
				{
					id: "usr-old",
					name: "Former Employee",
					email: "old@brainee.org",
					isActive: false,
				},
			],
		});

		await expect(resolveTaskAssignee(db, "prj-1", "usr-old")).rejects.toThrow(
			/Cannot assign task to deactivated user/,
		);
	});

	it("resolves exact email of an active project member", async () => {
		const db = createMockDb({
			members: [
				{
					id: "usr-1",
					name: "Charan Kumar",
					email: "charan@brainee.org",
					isActive: true,
				},
			],
		});

		const resolved = await resolveTaskAssignee(db, "prj-1", "charan@brainee.org");
		expect(resolved).toBe("usr-1");
	});

	it("resolves exact full name case-insensitively", async () => {
		const db = createMockDb({
			members: [
				{
					id: "usr-1",
					name: "Charan Kumar",
					email: "charan@brainee.org",
					isActive: true,
				},
			],
		});

		const resolved = await resolveTaskAssignee(db, "prj-1", "charan kumar");
		expect(resolved).toBe("usr-1");
	});

	it("resolves single unambiguous token/first-name", async () => {
		const db = createMockDb({
			members: [
				{
					id: "usr-sam",
					name: "Samantha Reed",
					email: "samantha@brainee.org",
					isActive: true,
				},
				{
					id: "usr-bob",
					name: "Bob Builder",
					email: "bob@brainee.org",
					isActive: true,
				},
			],
		});

		const resolved = await resolveTaskAssignee(db, "prj-1", "samantha");
		expect(resolved).toBe("usr-sam");
	});

	it("rejects ambiguous assignee name matching multiple members", async () => {
		const db = createMockDb({
			members: [
				{
					id: "usr-1",
					name: "Sam Jones",
					email: "sam.j@brainee.org",
					isActive: true,
				},
				{
					id: "usr-2",
					name: "Sam Wilson",
					email: "sam.w@brainee.org",
					isActive: true,
				},
			],
		});

		await expect(resolveTaskAssignee(db, "prj-1", "Sam")).rejects.toThrow(
			/ambiguous between multiple project members/i,
		);
	});

	it("warns when user exists in directory but is not added to project", async () => {
		const db = createMockDb({
			members: [
				{
					id: "usr-1",
					name: "Alice Smith",
					email: "alice@brainee.org",
					isActive: true,
				},
			],
			globalUsers: [
				{
					id: "usr-bob",
					name: "Bob External",
					email: "bob@brainee.org",
					isActive: true,
				},
			],
		});

		await expect(
			resolveTaskAssignee(db, "prj-1", "Bob External"),
		).rejects.toThrow(/not assigned to this project/);
	});
});
