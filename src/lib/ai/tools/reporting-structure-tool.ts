import { users } from "@/db/schema";
import { callerTitle } from "../persona-context";
import type { ToolHandler } from "./tool-types";

export const getReportingStructureTool: ToolHandler = {
	name: "get_reporting_structure",
	description:
		"Find ALL active direct reports of a manager across system roles. Use for 'who reports to X' or reporting structure; do not substitute a role-filtered colleague search.",
	parameters: {
		type: "object",
		properties: { managerName: { type: "string" } },
		required: ["managerName"],
	},
	async execute(args, ctx) {
		const name = String(args.managerName ?? "")
			.trim()
			.toLowerCase();
		if (!name) return { success: false, error: "Supply the manager name." };
		const people = await ctx.db
			.select({
				id: users.id,
				name: users.name,
				authId: users.authId,
				role: users.role,
				peerLeadId: users.peerLeadId,
				isActive: users.isActive,
			})
			.from(users);
		const active = people.filter((person) => person.isActive);
		const exact = active.filter(
			(person) => person.id === name || person.name.toLowerCase() === name,
		);
		const matches = exact.length
			? exact
			: active.filter((person) => person.name.toLowerCase().includes(name));
		if (matches.length !== 1)
			return {
				success: false,
				error: matches.length
					? "More than one manager matches. Choose a full name."
					: "No active manager matches.",
				data: {
					candidates: matches.map((person) => ({
						id: person.id,
						name: person.name,
					})),
				},
			};
		const manager = matches[0];
		const reports = active.filter((person) => person.peerLeadId === manager.id);
		return {
			success: true,
			data: {
				manager: { id: manager.id, name: manager.name },
				complete: true,
				directReportCount: reports.length,
				directReports: reports.map((person) => ({
					id: person.id,
					name: person.name,
					jobTitle: callerTitle(person),
				})),
				semantics:
					"All active direct reports, including leads, HR and individual contributors; system role is not a reporting filter.",
			},
			groundedRecordIds: [manager.id, ...reports.map((person) => person.id)],
			groundedLabels: [manager, ...reports].map((person) => ({
				id: person.id,
				label: person.name,
			})),
		};
	},
};
