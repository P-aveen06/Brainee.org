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
		"1990-01-10",
		null,
	),
	person(
		"sample-hr",
		"Arjun Mehta",
		"hr",
		"People & Culture Manager",
		"1992-03-12",
		"sample-admin",
	),
	person(
		"sample-lead",
		"Maya Rao",
		"lead",
		"Product Engineering Lead",
		"1988-01-15",
		"sample-admin",
	),
	person(
		"sample-vikram",
		"Vikram Menon",
		"lead",
		"Platform Engineering Lead",
		"1989-05-23",
		"sample-admin",
	),
	person(
		"sample-priya",
		"Priya Sen",
		"lead",
		"Delivery Engineering Lead",
		"1991-07-06",
		"sample-admin",
	),
	person(
		"sample-dev",
		"Dev Malhotra",
		"architect",
		"Solution Architect",
		"1987-11-14",
		"sample-admin",
	),
	person(
		"sample-anika",
		"Anika Shah",
		"employee",
		"Frontend Engineer",
		"1995-02-20",
		"sample-lead",
	),
	person(
		"sample-rohan",
		"Rohan Nair",
		"employee",
		"Backend Engineer",
		"1993-04-04",
		"sample-lead",
	),
	person(
		"sample-sara",
		"Sara Thomas",
		"employee",
		"Product Designer",
		"1996-12-08",
		"sample-lead",
	),
	person(
		"sample-leena",
		"Leena Das",
		"employee",
		"Full Stack Engineer",
		"1994-06-18",
		"sample-vikram",
	),
	person(
		"sample-kiran",
		"Kiran Patel",
		"employee",
		"Data Engineer",
		"1996-08-09",
		"sample-vikram",
	),
	person(
		"sample-ishan",
		"Ishan Gupta",
		"employee",
		"DevOps Engineer",
		"1994-10-28",
		"sample-vikram",
	),
	person(
		"sample-neha",
		"Neha Iyer",
		"employee",
		"QA Engineer",
		"1991-09-21",
		"sample-priya",
	),
	person(
		"sample-pooja",
		"Pooja Nambiar",
		"employee",
		"Full Stack Engineer",
		"1995-05-17",
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
