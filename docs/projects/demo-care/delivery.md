# Cedar Patient Scheduling — Delivery and acceptance plan

> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.

## Execution and evidence

Work packages below describe the intended result and actionable subtasks. Current assignees, estimates, dates and completion state remain in the application. Coordinate dependencies before sequencing work; a blocked upstream approval cannot be replaced with a guessed result.

## 1. Map appointment workflows

Objective
Document current and target appointment workflows.

Implementation
1. Map booking, rescheduling and cancellation actors and handoffs.
2. Identify clinician-capacity, slot-conflict and no-show edge cases.
3. Review workflow diagrams and unresolved questions with Cedar.

Acceptance criteria
Each workflow names its actor, input, decision points and outcome; open policy questions have reviewers.

Evidence
Attach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.

### Subtasks

- Map booking, rescheduling and cancellation actors and handoffs.
- Identify clinician-capacity, slot-conflict and no-show edge cases.
- Review workflow diagrams and unresolved questions with Cedar.

## 2. Prototype the clinician calendar

Objective
Prototype a clinician calendar that exposes capacity and conflicts.

Implementation
1. Sketch day and week views with availability and appointment states.
2. Add loading, no-availability and conflicting-reservation states.
3. Walk keyboard and coordinator scenarios using synthetic patients.

Acceptance criteria
Reviewers can find an available slot, recognize a conflict and explain rescheduling without seeing unnecessary patient identifiers.

Evidence
Attach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.

### Subtasks

- Sketch day and week views with availability and appointment states.
- Add loading, no-availability and conflicting-reservation states.
- Walk keyboard and coordinator scenarios using synthetic patients.

## 3. Review patient data retention

Objective
Resolve retention and access requirements before model approval.

Implementation
1. Inventory scheduling identifiers, event payloads and access logs.
2. Request retention, deletion and audit requirements from Cedar security.
3. Document the approved decision or retain the explicit model-freeze blocker.

Acceptance criteria
Security confirms retention decisions in writing; until then the data model remains unapproved and the dependency remains visible.

Evidence
Attach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.

### Subtasks

- Inventory scheduling identifiers, event payloads and access logs.
- Request retention, deletion and audit requirements from Cedar security.
- Document the approved decision or retain the explicit model-freeze blocker.

## 4. Plan scheduling service contracts

Objective
Specify scheduling service operations and failure semantics.

Implementation
1. Define availability, reservation, confirmation and cancellation contracts.
2. Specify idempotency, slot-conflict and unauthorized responses.
3. Review example requests, audit fields and open retention assumptions.

Acceptance criteria
Contracts include successful and failing examples and enforce identifier separation; unresolved retention assumptions are marked for review.

Evidence
Attach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.

### Subtasks

- Define availability, reservation, confirmation and cancellation contracts.
- Specify idempotency, slot-conflict and unauthorized responses.
- Review example requests, audit fields and open retention assumptions.

## Architecture review

Objective
Review the solution boundaries and failure modes for Cedar Patient Scheduling.

Design
Keep patient identifiers separate from scheduling events. Use opaque references in calendar payloads, authorize each operation and audit access. Model slot reservations and conflict responses; leave retention durations undecided until Cedar security confirms them.

Recorded decision
Separate patient identifiers from scheduling events and audit every access.

Review checklist
1. Trace the core journey and authorization boundaries.
2. Check data ownership, upstream failures, retries and evidence retention.
3. Review the project-specific validation plan: Walk synthetic booking and rescheduling scenarios with coordinators. Review overlapping bookings, time-zone boundaries, cancelled appointments, audit coverage and retention decisions before freezing the model.

Acceptance criteria
Record a reviewed architecture decision with alternatives, unresolved dependencies and follow-up owners. Cedar's security team must confirm the retention policy before the data model is frozen.

## Quality gate

Walk synthetic booking and rescheduling scenarios with coordinators. Review overlapping bookings, time-zone boundaries, cancelled appointments, audit coverage and retention decisions before freezing the model.

For each scenario record the input, expected result, actual result and evidence reference. Log defects with severity and owner; require retest evidence before closing them. The lead records the readiness decision and any conditions.

## Handoff

Provide reviewed documentation, open risks, support ownership and a recovery or rollback approach appropriate to the project stage. A readiness review does not execute a deployment.
