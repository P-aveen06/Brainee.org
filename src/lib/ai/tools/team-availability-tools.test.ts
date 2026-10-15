import { describe, expect, it } from "vitest";
import type { Database } from "@/db";
import type { AppUser } from "@/lib/server-fn";
import {
	getTeamAvailabilityTool,
	searchTeamMembersTool,
} from "./team-availability-tools";
import type { ToolContext } from "./tool-types";

function createMockContext(data: {
	leaves?: unknown[];
	wfhs?: unknown[];
	users?: unknown[];
}): ToolContext {
	const leaves = data.leaves ?? [];
	const wfhs = data.wfhs ?? [];
	const usersList = data.users ?? [];

	const mockDb = {
		select: (_fields?: unknown) => ({
			from: (table: { [key: string]: unknown }) => {
				const tableName = (table as { _: { name: string } })._?.name;
				return Object.assign(Promise.resolve(usersList), {
					where: () => {
						if (tableName === "leave_requests") return Promise.resolve(leaves);
						if (tableName === "wfh_requests") return Promise.resolve(wfhs);
						if (tableName === "users") return Promise.resolve(usersList);
						return Promise.resolve([]);
					},
				});
			},
		}),
	} as unknown as Database;

	const mockUser = {
		id: "u-test",
		name: "Test User",
		email: "test@brainee.org",
		role: "user",
		isOnboarded: true,
	} as unknown as AppUser;

	return { db: mockDb, user: mockUser };
}

describe("getTeamAvailabilityTool", () => {
	it("handles natural language date phrase without throwing", async () => {
		const ctx = createMockContext({});
		const result = await getTeamAvailabilityTool.execute(
			{ startDate: "next monday", endDate: "next friday" },
			ctx,
		);

		expect(result.success).toBe(true);
		const data = result.data as { dateRange: { start: string; end: string } };
		expect(data.dateRange.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(data.dateRange.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("falls back gracefully on invalid dates without NaN or throwing", async () => {
		const ctx = createMockContext({});
		const result = await getTeamAvailabilityTool.execute(
			{ startDate: "invalid_day_string_xyz" },
			ctx,
		);

		expect(result.success).toBe(true);
		const data = result.data as { dateRange: { start: string; end: string } };
		expect(data.dateRange.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(data.dateRange.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("searchTeamMembersTool", () => {
	it("caps results to 25 records when many users match", async () => {
		const manyUsers = Array.from({ length: 40 }, (_, i) => ({
			id: `u-${i}`,
			name: `User ${i}`,
			email: `user${i}@brainee.org`,
			role: "user",
			peerLeadId: null,
			isActive: true,
			joinDate: "2026-01-01",
		}));

		const ctx = createMockContext({ users: manyUsers });
		const result = await searchTeamMembersTool.execute({ query: "User" }, ctx);

		expect(result.success).toBe(true);
		const data = result.data as unknown[];
		expect(data).toHaveLength(25);
		expect((result as { hasMore?: boolean }).hasMore).toBe(true);
		expect((result as { totalMatches?: number }).totalMatches).toBe(40);
	});
});
