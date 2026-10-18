import { demoPeople } from "../../../shared/demo-startup.ts";
export const sampleEmployees = demoPeople.filter(
	(person) => person.persona !== "ceo",
);
export const sampleClients = [
	{
		id: "sample-client",
		name: "Willow Retail",
		code: "DEMO-WR",
		contact: "Priya Sharma",
		sector: "Retail",
	},
	{
		id: "sample-client-care",
		name: "Cedar Health",
		code: "DEMO-CH",
		contact: "Nikhil Sethi",
		sector: "Healthcare",
	},
	{
		id: "sample-client-fleet",
		name: "Atlas Logistics",
		code: "DEMO-AL",
		contact: "Meera Kapoor",
		sector: "Logistics",
	},
	{
		id: "sample-client-finance",
		name: "Finch Finance",
		code: "DEMO-FF",
		contact: "Rahul Bhat",
		sector: "Financial services",
	},
	{
		id: "sample-client-learning",
		name: "Lumina Learning",
		code: "DEMO-LL",
		contact: "Tara Dutta",
		sector: "Education",
	},
	{
		id: "sample-client-energy",
		name: "Solstice Energy",
		code: "DEMO-SE",
		contact: "Kabir Joshi",
		sector: "Renewable energy",
	},
];
export const sampleProjects = [
	{
		id: "sample-portal",
		code: "DEMO-PORTAL",
		name: "Willow Customer Portal",
		client: 0,
		ownerId: "sample-lead",
		members: ["sample-anika", "sample-rohan"],
		stage: "development",
		health: "amber",
		outcome:
			"Self-service orders, returns and onboarding for Willow customers.",
		decision:
			"Keep release one focused on onboarding and order tracking; defer loyalty points.",
		blocker:
			"Willow must approve the revised onboarding copy before UAT can start.",
		tasks: [
			"Confirm customer access requirements",
			"Build the order tracking overview",
			"Integrate the returns API",
			"Prepare onboarding acceptance tests",
		],
	},
	{
		id: "sample-hub",
		code: "DEMO-HUB",
		name: "Company Knowledge Hub",
		client: null,
		ownerId: "sample-lead",
		members: ["sample-anika", "sample-sara"],
		stage: "testing",
		health: "green",
		outcome: "Searchable internal delivery playbooks and company knowledge.",
		decision:
			"Use the support team's existing categories for the first content migration.",
		blocker: null,
		tasks: [
			"Agree knowledge taxonomy",
			"Build article search",
			"Review migrated support articles",
			"Validate accessible search results",
		],
	},
	{
		id: "sample-ops",
		code: "DEMO-OPS",
		name: "Operations Command Center",
		client: null,
		ownerId: "sample-vikram",
		members: ["sample-leena"],
		stage: "development",
		health: "green",
		outcome:
			"Internal staffing and delivery metrics for Northstar's operating teams.",
		decision:
			"Use three operating regions and refresh queue metrics every fifteen minutes.",
		blocker: null,
		tasks: [
			"Define delivery metric contracts",
			"Build regional queue filters",
			"Add operational alert rules",
			"Validate dashboard thresholds",
		],
	},
	{
		id: "sample-care",
		code: "DEMO-CARE",
		name: "Cedar Patient Scheduling",
		client: 1,
		ownerId: "sample-lead",
		members: ["sample-rohan", "sample-sara"],
		stage: "discovery",
		health: "amber",
		outcome:
			"Appointment scheduling and clinician capacity planning for Cedar Health.",
		decision:
			"Separate patient identifiers from scheduling events and audit every access.",
		blocker:
			"Cedar's security team must confirm the retention policy before the data model is frozen.",
		tasks: [
			"Map appointment workflows",
			"Prototype the clinician calendar",
			"Review patient data retention",
			"Plan scheduling service contracts",
		],
	},
	{
		id: "sample-fleet",
		code: "DEMO-FLEET",
		name: "Atlas Fleet Visibility",
		client: 2,
		ownerId: "sample-vikram",
		members: ["sample-leena", "sample-ishan"],
		stage: "development",
		health: "red",
		outcome:
			"Live shipment events and exception alerts across Atlas distribution routes.",
		decision:
			"Use an event queue with idempotent consumers for duplicate GPS events.",
		blocker:
			"Atlas has not provisioned the GPS sandbox credentials; ingestion testing is delayed.",
		tasks: [
			"Define shipment event schema",
			"Build the live tracking service",
			"Connect the GPS provider sandbox",
			"Configure shipment exception alerts",
		],
	},
	{
		id: "sample-finance",
		code: "DEMO-FIN",
		name: "Finch Risk Analytics",
		client: 3,
		ownerId: "sample-vikram",
		members: ["sample-kiran", "sample-ishan"],
		stage: "testing",
		health: "amber",
		outcome:
			"Auditable lending risk dashboards from Finch's reconciled transaction data.",
		decision:
			"Version feature definitions and reconcile every aggregate against the ledger.",
		blocker:
			"Finch must reconcile the September source ledger before model validation can close.",
		tasks: [
			"Define risk metric lineage",
			"Build reconciliation pipelines",
			"Validate September ledger totals",
			"Prepare model audit evidence",
		],
	},
	{
		id: "sample-delivery",
		code: "DEMO-DELIVERY",
		name: "Delivery Automation",
		client: null,
		ownerId: "sample-priya",
		members: ["sample-neha"],
		stage: "development",
		health: "green",
		outcome:
			"Reusable release gates and EOD reporting across internal delivery workflows.",
		decision:
			"Require passing smoke checks and an explicit rollback plan before releases.",
		blocker: null,
		tasks: [
			"Agree release acceptance gates",
			"Build the release checklist workflow",
			"Add end-to-end smoke coverage",
			"Document the rollback playbook",
		],
	},
	{
		id: "sample-design",
		code: "DEMO-DESIGN",
		name: "Northstar Design System",
		client: null,
		ownerId: "sample-priya",
		members: ["sample-pooja"],
		stage: "development",
		health: "green",
		outcome:
			"Shared accessible product components and consistent interaction patterns.",
		decision:
			"Reuse the existing component primitives and publish token changes with examples.",
		blocker: null,
		tasks: [
			"Inventory shared product components",
			"Implement accessible form patterns",
			"Document component usage",
			"Prepare the first token release",
		],
	},
	{
		id: "sample-learning",
		code: "DEMO-LEARN",
		name: "Lumina Learning Platform",
		client: 4,
		ownerId: "sample-priya",
		members: ["sample-neha"],
		stage: "deployment",
		health: "green",
		outcome:
			"Course delivery, learner progress and instructor reporting for Lumina.",
		decision:
			"Release to the pilot cohort first and watch completion and error rates.",
		blocker: null,
		tasks: [
			"Confirm pilot cohort access",
			"Validate course progress tracking",
			"Run pilot readiness checks",
			"Prepare deployment monitoring",
		],
	},
	{
		id: "sample-energy",
		code: "DEMO-ENERGY",
		name: "Solstice Energy Insights",
		client: 5,
		ownerId: "sample-priya",
		members: ["sample-pooja"],
		stage: "discovery",
		health: "amber",
		outcome:
			"Solar generation analytics and anomaly detection for Solstice's field assets.",
		decision:
			"Store raw meter readings separately and normalize all timestamps to UTC.",
		blocker:
			"Solstice must provide representative meter data covering a full operating week.",
		tasks: [
			"Map meter data sources",
			"Prototype generation insights",
			"Validate sample meter readings",
			"Plan anomaly detection thresholds",
		],
	},
];
export const sampleProjectMembers: Record<string, string[]> =
	Object.fromEntries(
		sampleProjects.map((project) => [
			project.id,
			[project.ownerId, ...project.members, "sample-dev"],
		]),
	);
