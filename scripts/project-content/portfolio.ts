export type Work = [goal: string, steps: [string, string, string], acceptance: string];
export type Plan = { audience: string; scope: string; exclusions: string; design: string; validation: string; work: [Work, Work, Work, Work] };
export const portfolio: Record<string, Plan> = {
	"sample-portal": {
		audience: "Retail customers, customer support agents and Willow's product owner",
		scope: "Customer onboarding, authenticated order history, shipment milestones and return initiation with a clear support handoff.",
		exclusions: "Loyalty points, promotions, payments and changes to warehouse fulfilment are deferred.",
		design: "Resolve customer identity on the server; scope every order and return lookup to that identity. Translate order and returns APIs into a stable view model. Use idempotency keys for return requests and distinguish pending, failed and confirmed responses.",
		validation: "Exercise first-time and returning customer journeys, cross-account access denial, missing shipment updates and duplicate return submissions. Use synthetic order data; record UAT evidence after Willow approves onboarding copy.",
		work: [
			["Define the customer access contract before building account-scoped screens.", ["Map customer and support permissions for order and return actions", "Specify sign-in, expired-session and account-recovery journeys", "Record cross-account denial cases and review with the project lead"], "A permission matrix and reviewed journey map cover each role; negative cases prevent another customer's order access."],
			["Build an order overview that explains shipment progress and next actions.", ["Map order API fields to order cards and shipment milestones", "Implement loading, empty, delayed-shipment and API-error states", "Verify keyboard navigation and mobile order-detail journeys"], "Customers can open their own orders, identify shipment status and recover from errors without losing context."],
			["Integrate return eligibility and return submission with traceable outcomes.", ["Confirm returns API examples, eligibility rules and error codes", "Implement idempotent return submission and confirmation references", "Test ineligible items, duplicate requests and upstream timeouts"], "Eligible returns produce one reference; ineligible and failed requests explain the next action. Track onboarding-copy approval separately as the recorded UAT dependency."],
			["Prepare evidence-based onboarding acceptance tests for customer UAT.", ["Draft first-login, returning-user and support-handoff scenarios", "Obtain Willow approval of the revised onboarding copy", "Run the approved scenarios and attach defects and retest evidence"], "Each approved onboarding scenario has an expected result and evidence; unresolved copy approval is visible before UAT starts."],
		],
	},
	"sample-hub": {
		audience: "Northstar employees, support authors and knowledge maintainers",
		scope: "A searchable library of delivery playbooks and migrated support articles using the support team's existing categories.",
		exclusions: "Automatic publication of AI answers, external customer access and a company-wide taxonomy redesign are deferred.",
		design: "Represent articles with category, owner, revision and publication state. Search only content visible to the signed-in employee; apply visibility checks before returning snippets. Preserve source links and show an actionable no-results state.",
		validation: "Use a curated query set with expected articles, restricted-content checks, broken-link review and keyboard/screen-reader checks. Log migration corrections against source articles.",
		work: [
			["Make the existing support taxonomy usable for the first migration.", ["Inventory support categories and representative source articles", "Map duplicate category names and assign content owners", "Review a category-to-article mapping with support maintainers"], "Every migration candidate has one canonical category, an owner and an explicit disposition."],
			["Deliver useful article retrieval with permission-aware results.", ["Define query matching and searchable title, summary and category fields", "Implement result snippets, filters and no-results recovery", "Test expected-result queries and restricted article exclusion"], "The reviewed query set returns expected articles; hidden articles never appear in titles, counts or snippets."],
			["Check migrated content for accuracy and ownership before publication.", ["Compare migrated articles against source formatting and links", "Resolve stale instructions and route ambiguities to article owners", "Record publication approval and unresolved migration defects"], "Each published article has a source reference, valid links, a named owner and recorded review."],
			["Verify that search is accessible across input methods.", ["Test focus order from query input through filters and results", "Check result announcements, headings and empty-state messages", "Retest contrast, zoom and keyboard-only article opening"], "Core search journeys are usable with keyboard and assistive technology; failures include reproducible steps and retest evidence."],
		],
	},
	"sample-ops": {
		audience: "Operations leads, staffing coordinators and delivery managers",
		scope: "Regional delivery queues, staffing indicators and operational alerts across three operating regions with fifteen-minute metric refreshes.",
		exclusions: "Payroll, automated staff reassignment and real-time refresh guarantees are outside this iteration.",
		design: "Maintain a metric dictionary with source, owner, unit and refresh timestamp. Aggregate per authorized region. Expose freshness and unavailable values; evaluate alerts against versioned thresholds and suppress duplicates until recovery.",
		validation: "Reconcile dashboard totals with source fixtures, verify regional isolation and test stale feeds, threshold boundaries, repeated breaches and recovery.",
		work: [
			["Define consistent operating metrics and their ownership.", ["List queue age, backlog and staffing measures with source systems", "Specify aggregation windows, units and missing-data handling", "Review metric examples and refresh expectations with operations"], "Each metric has a reviewed formula, owner, source and worked example; unknown values remain visibly unknown."],
			["Build regional queue exploration without ambiguous totals.", ["Map the three regions and authorized queue memberships", "Implement region filters with loading, empty and stale-data states", "Reconcile filtered and all-region totals against fixtures"], "Filters show only permitted regions and consistent totals; users can identify the last refresh and unavailable feeds."],
			["Create actionable operating alerts with predictable lifecycle rules.", ["Document alert thresholds, recipients and escalation ownership", "Implement breach, deduplication and recovery state transitions", "Test repeated breaches, missing data and recovery notifications"], "One active incident exists per breached rule and region; recovery closes the incident and missing data is separately identified."],
			["Validate thresholds before operations relies on the dashboard.", ["Build boundary fixtures below, at and above each threshold", "Compare displayed severity with the reviewed threshold table", "Record operations review and remaining tuning actions"], "All threshold boundaries match reviewed expectations, and each remaining tuning action has an owner."],
		],
	},
	"sample-care": {
		audience: "Scheduling coordinators, clinicians and Cedar's security reviewers",
		scope: "Discovery of appointment booking, rescheduling, cancellations and clinician capacity with a reviewed scheduling service contract.",
		exclusions: "Clinical records, diagnosis, billing and production patient-data ingestion are outside discovery scope.",
		design: "Keep patient identifiers separate from scheduling events. Use opaque references in calendar payloads, authorize each operation and audit access. Model slot reservations and conflict responses; leave retention durations undecided until Cedar security confirms them.",
		validation: "Walk synthetic booking and rescheduling scenarios with coordinators. Review overlapping bookings, time-zone boundaries, cancelled appointments, audit coverage and retention decisions before freezing the model.",
		work: [
			["Document current and target appointment workflows.", ["Map booking, rescheduling and cancellation actors and handoffs", "Identify clinician-capacity, slot-conflict and no-show edge cases", "Review workflow diagrams and unresolved questions with Cedar"], "Each workflow names its actor, input, decision points and outcome; open policy questions have reviewers."],
			["Prototype a clinician calendar that exposes capacity and conflicts.", ["Sketch day and week views with availability and appointment states", "Add loading, no-availability and conflicting-reservation states", "Walk keyboard and coordinator scenarios using synthetic patients"], "Reviewers can find an available slot, recognize a conflict and explain rescheduling without seeing unnecessary patient identifiers."],
			["Resolve retention and access requirements before model approval.", ["Inventory scheduling identifiers, event payloads and access logs", "Request retention, deletion and audit requirements from Cedar security", "Document the approved decision or retain the explicit model-freeze blocker"], "Security confirms retention decisions in writing; until then the data model remains unapproved and the dependency remains visible."],
			["Specify scheduling service operations and failure semantics.", ["Define availability, reservation, confirmation and cancellation contracts", "Specify idempotency, slot-conflict and unauthorized responses", "Review example requests, audit fields and open retention assumptions"], "Contracts include successful and failing examples and enforce identifier separation; unresolved retention assumptions are marked for review."],
		],
	},
	"sample-fleet": {
		audience: "Dispatchers, logistics operations and Atlas integration engineers",
		scope: "Shipment event ingestion, live tracking views and exception alerts for Atlas distribution routes.",
		exclusions: "Route optimization, driver payroll and changes to GPS device firmware are deferred.",
		design: "Buffer provider events through a queue, validate their schema and process them idempotently. Preserve event and receipt times, tolerate out-of-order updates and expose stale positions. Keep GPS credentials server-side and isolate invalid events for replay.",
		validation: "Use synthetic duplicate, late, missing and malformed GPS events. Verify shipment ordering, alert deduplication and recovery. Provider integration evidence remains pending until Atlas supplies sandbox credentials.",
		work: [
			["Define a canonical shipment event contract.", ["Map provider identifiers, coordinates and event timestamps", "Specify validation, event identity and out-of-order handling", "Review valid, duplicate and malformed event examples"], "Schema examples define identity and ordering; malformed events have a documented quarantine outcome."],
			["Build reliable shipment tracking over an idempotent event stream.", ["Implement queued ingestion and duplicate-event protection", "Expose latest shipment state with stale and unavailable indicators", "Verify delayed events, replay and empty shipment histories"], "Replaying a duplicate does not advance state twice; late events do not overwrite newer positions and stale data is visible."],
			["Connect the GPS sandbox when Atlas provisions access.", ["Record the credential request and sandbox endpoint requirements", "Configure server-side sandbox authentication after credentials arrive", "Capture a sample event exchange and test authentication failures"], "A redacted sandbox exchange verifies connectivity; missing credentials keep integration testing explicitly blocked."],
			["Configure shipment exception rules dispatchers can act on.", ["Define late, off-route and no-signal conditions with Atlas", "Implement deduplicated alerts and recovery transitions", "Test threshold boundaries and dispatcher escalation ownership"], "Each rule has an owner, a reproducible breach example and recovery evidence; repeated events do not create repeated incidents."],
		],
	},
};
