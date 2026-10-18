/** Fictional local startup identities. These labels never grant application permissions. */
export type DemoPersona = "ceo" | "hr" | "lead" | "architect" | "employee";
export interface DemoPerson {
	id: string;
	authId: string;
	name: string;
	email: string;
	persona: DemoPersona;
	title: string;
	role: "admin" | "hr" | "lead" | "user";
	birthday: string;
	peerLeadId: string | null;
}
const person = (
	id: string,
	name: string,
	persona: DemoPersona,
	title: string,
	birthday: string,
	peerLeadId: string | null,
): DemoPerson => ({
	id,
	name,
	persona,
	title,
	birthday,
	peerLeadId,
	authId: id === "sample-admin" ? "test-sample-user" : `sample:${id}`,
	email:
		id === "sample-admin"
			? "test@example.com"
			: `${id.replace("sample-", "")}@northstar.example.test`,
	role:
		persona === "ceo"
			? "admin"
			: persona === "hr"
				? "hr"
				: persona === "lead"
					? "lead"
					: "user",
});
export const demoPeople: DemoPerson[] = [
	person(
		"sample-admin",
		"Aditi Deshmukh",
		"ceo",
		"CEO & Co-founder",
		"2026-10-16",
		null,
	),
	person(
		"sample-hr",
		"Arjun Mehta",
		"hr",
		"People & Culture Manager",
		"2026-10-16",
		"sample-admin",
	),
	person(
		"sample-lead",
		"Maya Rao",
		"lead",
		"Product Engineering Lead",
		"2026-10-16",
		"sample-admin",
	),
	person(
		"sample-vikram",
		"Vikram Menon",
		"lead",
		"Platform Engineering Lead",
		"2026-10-16",
		"sample-admin",
	),
	person(
		"sample-priya",
		"Priya Sen",
		"lead",
		"Delivery Engineering Lead",
		"2026-10-16",
		"sample-admin",
	),
	person(
		"sample-dev",
		"Dev Malhotra",
		"architect",
		"Solution Architect",
		"2026-10-16",
		"sample-admin",
	),
	person(
		"sample-anika",
		"Anika Shah",
		"employee",
		"Frontend Engineer",
		"2026-10-16",
		"sample-lead",
	),
	person(
		"sample-rohan",
		"Rohan Nair",
		"employee",
		"Backend Engineer",
		"2026-10-16",
		"sample-lead",
	),
	person(
		"sample-sara",
		"Sara Thomas",
		"employee",
		"Product Designer",
		"2026-10-16",
		"sample-lead",
	),
	person(
		"sample-leena",
		"Leena Das",
		"employee",
		"Full Stack Engineer",
		"2026-10-16",
		"sample-vikram",
	),
	person(
		"sample-kiran",
		"Kiran Patel",
		"employee",
		"Data Engineer",
		"2026-10-16",
		"sample-vikram",
	),
	person(
		"sample-ishan",
		"Ishan Gupta",
		"employee",
		"DevOps Engineer",
		"2026-10-16",
		"sample-vikram",
	),
	person(
		"sample-neha",
		"Neha Iyer",
		"employee",
		"QA Engineer",
		"2026-10-16",
		"sample-priya",
	),
	person(
		"sample-pooja",
		"Pooja Nambiar",
		"employee",
		"Full Stack Engineer",
		"2026-10-16",
		"sample-priya",
	),
];
export const demoPersonaLabels: Record<DemoPersona, string> = {
	ceo: "CEO",
	hr: "HR",
	lead: "Project Lead",
	architect: "Solution Architect",
	employee: "Employee",
};
export function demoPersonForAuth(authId: string) {
	return demoPeople.find((entry) => entry.authId === authId);
}
