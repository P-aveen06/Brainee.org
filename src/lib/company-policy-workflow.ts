import { AppError } from "./errors";

export type CompanyPolicyStatus = "draft" | "published" | "archived";

export function assertCompanyPolicyAdmin(role: string) {
	if (role !== "admin") {
		throw new AppError("You are not allowed to review policy documents.");
	}
}

export function createPolicyDraftRevision(previousVersion?: number) {
	return {
		status: "draft" as const,
		version: previousVersion === undefined ? 1 : previousVersion + 1,
	};
}

export function assertCompanyPolicyTransition(
	current: CompanyPolicyStatus,
	next: "published" | "archived",
) {
	if (next === "published" && current !== "draft") {
		throw new AppError("Only a draft policy document can be published.");
	}
	if (next === "archived" && current === "archived") {
		throw new AppError("This policy document is already archived.");
	}
}

export function parsePolicyEffectiveDate(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new AppError("Choose a valid effective date.");
	}
	const date = new Date(`${value}T00:00:00.000Z`);
	if (
		Number.isNaN(date.getTime()) ||
		date.toISOString().slice(0, 10) !== value
	) {
		throw new AppError("Choose a valid effective date.");
	}
	return date;
}
