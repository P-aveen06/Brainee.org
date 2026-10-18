import { demoPeople } from "../../../shared/demo-startup.ts";
import type { GraphDatabase } from "../../../shared/graph/query.ts";
import {
	sampleClients,
	sampleProjectMembers,
	sampleProjects,
} from "./sample-catalog.ts";
import { addSample, dateOffset, node } from "./sample-data.ts";

export function projectValues(
	project: (typeof sampleProjects)[number],
	index: number,
	adminId: string,
	monday: string,
) {
	return {
		id: project.id,
		code: project.code,
		name: project.name,
		projectType: project.client === null ? "internal" : "client",
		clientCompanyId:
			project.client === null ? null : sampleClients[project.client].id,
		clientProjectName: project.client === null ? null : project.name,
		ownerId: project.ownerId,
		createdById: adminId,
		priority:
			project.health === "red"
				? "urgent"
				: project.health === "amber"
					? "high"
					: "medium",
		status: "active",
		currentStageKey: project.stage,
		healthOverride: project.health,
		description: project.outcome,
		startDate: dateOffset(monday, -35 + index),
		targetEndDate: dateOffset(monday, 14 + index * 3),
		engagementModel: project.client === null ? null : "fixed_bid",
		contractValue: project.client === null ? null : 1200000 + index * 180000,
		currency: "INR",
	};
}
export function taskValues(
	project: (typeof sampleProjects)[number],
	p: number,
	t: number,
	adminId: string,
	monday: string,
) {
	return {
		id: `sample-task-${p}-${t}`,
		projectId: project.id,
		taskNumber: t + 1,
		title: project.tasks[t],
		description: `${project.outcome} Acceptance is tracked in the project checklist.`,
		status:
			t === 0
				? "done"
				: t === 1
					? "in_progress"
					: t === 2 && project.blocker
						? "blocked"
						: "todo",
		priority: t === 2 && project.blocker ? "high" : "medium",
		assigneeId: project.members[t % project.members.length],
		createdById: adminId,
		stageKey: project.stage,
		startDate: dateOffset(monday, -7),
		dueDate: dateOffset(monday, t - (project.health === "red" ? 5 : 1)),
		estimateHours: 4 + t * 2,
		actualHours: t === 0 ? 4 : null,
		completedAt:
			t === 0 ? new Date(`${dateOffset(monday, -2)}T12:00:00Z`) : null,
		blockedReason: t === 2 ? project.blocker : null,
		sequence: t + 1,
	};
}
export async function seedSampleWork(
	db: GraphDatabase,
	adminId: string,
	monday: string,
) {
	await addSample(db, "Company", {
		id: "sample-company",
		name: "Northstar Studio",
		code: "DEMO-NS",
		isInternal: true,
		contactEmail: "hello@northstar.example.test",
		notes:
			"Fictional 14-person product engineering startup with four internal initiatives and six client engagements.",
	});
	for (const client of sampleClients) {
		await addSample(db, "Company", {
			id: client.id,
			name: client.name,
			code: client.code,
			isInternal: false,
			notes: `Fictional ${client.sector} client of Northstar Studio.`,
		});
		await addSample(db, "ClientContact", {
			id:
				client.id === "sample-client"
					? "sample-contact-willow-primary"
					: `sample-contact-${client.id}`,
			companyId: client.id,
			name: client.contact,
			title: "Program Director",
			email: `${client.contact.toLowerCase().replaceAll(" ", ".")}@example.test`,
			role: "primary",
			isPrimary: true,
			isActive: true,
		});
	}
	const stages = [
		["planning", "Planning"],
		["proposal", "Proposal"],
		["discovery", "Discovery"],
		["development", "Development"],
		["testing", "Testing & QA"],
		["deployment", "Deployment"],
		["closure", "Closure"],
	];
	const stageModel = node("StageDefinition");
	for (const [index, [key, name]] of stages.entries())
		await db
			.insert(stageModel)
			.values({ id: `sample-stage-${key}`, key, name, sequence: index + 1 })
			.onConflictDoNothing({ target: stageModel.key });
	for (const [p, project] of sampleProjects.entries()) {
		await addSample(db, "Project", projectValues(project, p, adminId, monday));
		await addSample(db, "StageProgress", {
			id: `sample-progress-${project.id}`,
			projectId: project.id,
			stageKey: project.stage,
			status: "in_progress",
			startedAt: new Date(`${dateOffset(monday, -7)}T09:00:00Z`),
			notes: project.decision,
		});
		for (const userId of sampleProjectMembers[project.id]) {
			const assignments = sampleProjects.filter((entry) =>
				sampleProjectMembers[entry.id].includes(userId),
			).length;
			await addSample(db, "ProjectMembership", {
				id: `sample-member-${project.id}-${userId}`,
				projectId: project.id,
				userId,
				role: userId === project.ownerId ? "manager" : "contributor",
				allocationPercent: Math.floor(100 / assignments),
				joinedAt: dateOffset(monday, -21),
				addedById: adminId,
			});
		}
		for (let t = 0; t < 4; t++)
			await addSample(db, "Task", taskValues(project, p, t, adminId, monday));
	}
	const originalAssignments: Record<string, number> = {
		"sample-anika": 1,
		"sample-rohan": 2,
		"sample-leena": 3,
		"sample-kiran": 4,
	};
	for (const person of demoPeople) {
		const original = originalAssignments[person.id];
		const assetId = original
			? `sample-asset-${original}`
			: `sample-laptop-${person.id}`;
		const userId = person.persona === "ceo" ? adminId : person.id;
		await addSample(db, "Asset", {
			id: assetId,
			assetTag: original
				? `DEMO-${String(original).padStart(3, "0")}`
				: `DEMO-LAP-${person.id.replace("sample-", "").toUpperCase()}`,
			name: `${person.name.split(" ")[0]}'s work laptop`,
			category: "laptop",
			model:
				person.persona === "architect"
					? "Apple MacBook Pro 14"
					: "Lenovo ThinkPad T14",
			ownerCompanyId: "sample-company",
			status: "assigned",
			purchaseDate: dateOffset(monday, -180),
			purchaseCost: 125000,
			warrantyExpiry: dateOffset(monday, 550),
			notes: "Fictional equipment for the local startup.",
		});
		await addSample(db, "AssetAssignment", {
			id: original
				? `sample-assignment-${original}`
				: `sample-assignment-${person.id}`,
			assetId,
			userId,
			assignedDate: dateOffset(monday, -30),
			assignedByUserId: adminId,
			acknowledgedAt: new Date(`${dateOffset(monday, -29)}T09:00:00Z`),
		});
	}
	for (let i = 5; i <= 8; i++)
		await addSample(db, "Asset", {
			id: `sample-asset-${i}`,
			assetTag: `DEMO-${String(i).padStart(3, "0")}`,
			name: `Office Monitor ${i - 4}`,
			model: "Dell UltraSharp U2723QE",
			category: "monitor",
			ownerCompanyId: "sample-company",
			status: "in_inventory",
			purchaseDate: dateOffset(monday, -180),
			purchaseCost: 35000,
		});
}
