import type { Plan } from "./portfolio";
export const portfolioMore: Record<string, Plan> = {
	"sample-finance": {
		audience: "Finch risk analysts, data owners and audit reviewers",
		scope: "Reconciled lending-risk metrics, versioned feature lineage and a traceable validation evidence pack.",
		exclusions: "Automated lending decisions, new credit policy and claims of model approval are outside this delivery.",
		design: "Version source snapshots, transformations and feature definitions together. Link each dashboard aggregate to its ledger inputs and reconciliation result. Quarantine mismatches; do not label unverified September totals as validated.",
		validation: "Reconcile source and derived counts and amounts, test missing and duplicate transactions and reproduce an aggregate from its lineage. Keep the September validation gate open until Finch resolves the source ledger.",
		work: [
			["Define reproducible lineage for lending-risk metrics.", ["Map dashboard measures to source ledger fields and owners", "Version feature formulas, windows and exclusion rules", "Review a worked metric trace from source to dashboard"], "Each measure references a source snapshot and formula version; a reviewer can reproduce the worked example."],
			["Build pipelines that expose reconciliation gaps.", ["Implement source normalization and duplicate-transaction checks", "Compare source and derived counts and monetary totals", "Record mismatch evidence and prevent unverified publication"], "Reconciliation reports identify mismatched rows and totals; reruns produce consistent results for the same snapshot."],
			["Validate September totals after source reconciliation.", ["Request the corrected September ledger and reconciliation sign-off", "Compare corrected totals with the frozen validation dataset", "Document residual differences and obtain data-owner review"], "Validation evidence references the corrected source; unresolved source differences keep this task blocked."],
			["Prepare a reviewable model and metric audit pack.", ["Collect feature versions, ledger checks and validation evidence", "Document known limitations and unresolved reconciliation items", "Walk a dashboard metric back to source with the reviewer"], "The pack includes reproducible lineage and explicit unresolved items; it does not imply approval where evidence is pending."],
		],
	},
	"sample-delivery": {
		audience: "Delivery leads, QA engineers and release owners",
		scope: "Reusable release checklists, end-to-end smoke gates, rollback instructions and EOD evidence for internal delivery.",
		exclusions: "Automatic production deployment, bypassing human approvals and replacement of all CI systems are deferred.",
		design: "Represent release gates as explicit states with owner, evidence and decision timestamps. Require passing smoke checks and a reviewed rollback plan. Connect EOD summaries to recorded task and gate evidence; identify missing reports without inventing progress.",
		validation: "Exercise passing, failing and missing-evidence releases, permission checks, retries and rollback rehearsal in a local environment. Confirm failed smoke checks prevent release readiness.",
		work: [
			["Agree the minimum evidence for release readiness.", ["Inventory smoke, review and rollback gates with delivery owners", "Define passing, failing and missing-evidence outcomes", "Review gate ownership and approval criteria"], "Every required gate has a named owner and evidence requirement; release readiness requires all mandatory gates."],
			["Build a checklist workflow with auditable transitions.", ["Implement gate ownership, evidence references and state changes", "Expose pending, failed and ready states with actionable next steps", "Test unauthorized approvals and incomplete checklist submissions"], "The workflow records who changed each gate and why; missing evidence and failed gates remain visible."],
			["Add smoke checks for the critical delivery journey.", ["Select sign-in, project access and task-update smoke scenarios", "Implement repeatable fixtures and clear failure evidence", "Run passing and deliberately failing scenarios through readiness checks"], "Critical smoke scenarios are repeatable; a failure prevents readiness and provides a reproducible diagnostic."],
			["Write and rehearse the rollback procedure.", ["Document rollback triggers, owner and last-known-good reference", "Specify backup, restoration and post-rollback health checks", "Rehearse locally and record recovery evidence and gaps"], "A teammate can follow the playbook locally and verify recovery; production execution remains a human-controlled operation."],
		],
	},
	"sample-design": {
		audience: "Product engineers, designers and accessibility reviewers",
		scope: "An inventory of shared primitives, accessible form patterns, usage guidance and a versioned first token release.",
		exclusions: "A full visual rebrand, wholesale screen rewrites and replacement of existing primitives are outside scope.",
		design: "Build on existing component primitives. Express colors, spacing and typography through documented tokens. Specify focus, disabled, error and loading states; publish usage examples and migration notes with token revisions.",
		validation: "Review representative form journeys with keyboard and assistive technology, check visual states and contrast, and compare examples before and after token changes.",
		work: [
			["Inventory reusable components and their current variants.", ["Catalogue shared primitives and the screens consuming them", "Identify duplicate patterns and missing interaction states", "Prioritize the inventory with product and accessibility reviewers"], "The inventory links each component to consumers, supported states and a reviewed action or reuse decision."],
			["Implement accessible forms using the existing primitives.", ["Define labels, help text, validation and field-error associations", "Build keyboard focus, submission and pending-state patterns", "Verify screen-reader errors and loading and empty examples"], "Forms expose labels and errors programmatically, retain useful input on failure and support keyboard completion."],
			["Document component selection and correct usage.", ["Write anatomy, variants and interaction-state examples", "Show appropriate and inappropriate usage for common patterns", "Review copyable examples against the implemented primitives"], "Each priority component has a working example, accessibility notes and clear selection guidance."],
			["Prepare the first token release with migration evidence.", ["Record token names, values and intended semantic roles", "Compare representative screens and identify consumer changes", "Publish a local release draft with examples and migration notes"], "The release draft documents changed tokens and affected consumers, with reviewed visual and accessibility evidence."],
		],
	},
	"sample-learning": {
		audience: "Pilot learners, instructors and Lumina's rollout owner",
		scope: "Pilot access, course delivery, persisted learner progress, instructor reporting and rollout monitoring.",
		exclusions: "A general public launch, advanced certification and expansion beyond the pilot cohort are deferred.",
		design: "Authorize course access by cohort membership. Persist progress events idempotently and derive completion from explicit rules. Aggregate instructor reporting from recorded progress, and monitor errors and completion signals during the pilot.",
		validation: "Use synthetic pilot learners to verify enrollment, access denial, interrupted sessions, duplicate progress events and instructor totals. Rehearse monitoring and escalation locally before the human-led rollout.",
		work: [
			["Confirm the pilot roster and course access rules.", ["Review learner and instructor cohort membership with Lumina", "Map enrollment and role permissions to pilot courses", "Test allowed access and non-cohort denial cases"], "The approved roster maps to course permissions; non-cohort users cannot open protected course content."],
			["Validate durable and accurate learner progress.", ["Define lesson and course completion rules and event identity", "Test resume, retries, duplicate events and interrupted sessions", "Reconcile learner progress with instructor reporting totals"], "Progress survives session changes, retries do not inflate completion, and instructor totals match recorded learner states."],
			["Run the pilot readiness checklist with recorded evidence.", ["Exercise enrollment, lesson delivery and instructor reporting", "Review unresolved defects and support handoff ownership", "Record the pilot owner's readiness decision and release conditions"], "Critical journeys have evidence and a reviewed defect disposition; readiness is recorded separately from deployment execution."],
			["Prepare monitoring and response for the pilot window.", ["Define error, completion and event-freshness indicators", "Configure a local monitoring rehearsal and alert examples", "Document escalation contacts and pause or rollback criteria"], "The rollout owner can identify failures and the response owner; thresholds and a rehearsal result accompany the monitoring plan."],
		],
	},
	"sample-energy": {
		audience: "Solstice field operations, energy analysts and meter-data owners",
		scope: "Meter source discovery, generation insight prototypes, data-quality validation and proposed anomaly thresholds.",
		exclusions: "Automated equipment control, live outage guarantees and production anomaly activation are outside discovery scope.",
		design: "Preserve raw readings independently from normalized analytics. Normalize timestamps to UTC while retaining source time-zone metadata, units and meter identity. Mark missing intervals and distinguish data-quality anomalies from generation anomalies.",
		validation: "Review a full operating week of representative meter data when supplied. Check timestamp alignment, units, duplicates, gaps and generation aggregates; proposed thresholds require analyst review and remain provisional.",
		work: [
			["Map the meter sources and their data contracts.", ["Inventory meter identities, exports and source owners", "Document timestamp zones, cadence, units and quality flags", "Request representative readings for a full operating week"], "Each source has a documented contract and owner; missing representative data remains an explicit discovery dependency."],
			["Prototype generation insights with clear data-quality cues.", ["Define daily generation and site comparison views", "Build synthetic examples with gaps, zero output and missing meters", "Review units, UTC normalization and empty states with analysts"], "Analysts can distinguish low output from missing data, and every prototype identifies its synthetic or supplied data source."],
			["Validate supplied readings before analytics assumptions are frozen.", ["Confirm receipt and coverage of a representative operating week", "Check duplicate readings, units, gaps and time-zone conversions", "Record quality findings and resolve source-owner questions"], "A coverage and quality report references the supplied sample; absent representative data keeps validation blocked."],
			["Propose explainable anomaly thresholds for analyst review.", ["Separate sensor-quality rules from generation-deviation rules", "Draft threshold examples and expected false-positive cases", "Review thresholds against available data and record assumptions"], "Each proposed rule states inputs, threshold, expected outcome and limitations; activation waits for representative-data review."],
		],
	},
};
