# Cedar Patient Scheduling — Solution design

> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.

## Solution approach

Keep patient identifiers separate from scheduling events. Use opaque references in calendar payloads, authorize each operation and audit access. Model slot reservations and conflict responses; leave retention durations undecided until Cedar security confirms them.

## Decision baseline

Separate patient identifiers from scheduling events and audit every access.

## Work packages and interfaces

### 1. Map appointment workflows

Document current and target appointment workflows.

- Map booking, rescheduling and cancellation actors and handoffs.
- Identify clinician-capacity, slot-conflict and no-show edge cases.
- Review workflow diagrams and unresolved questions with Cedar.

### 2. Prototype the clinician calendar

Prototype a clinician calendar that exposes capacity and conflicts.

- Sketch day and week views with availability and appointment states.
- Add loading, no-availability and conflicting-reservation states.
- Walk keyboard and coordinator scenarios using synthetic patients.

### 3. Review patient data retention

Resolve retention and access requirements before model approval.

- Inventory scheduling identifiers, event payloads and access logs.
- Request retention, deletion and audit requirements from Cedar security.
- Document the approved decision or retain the explicit model-freeze blocker.

### 4. Plan scheduling service contracts

Specify scheduling service operations and failure semantics.

- Define availability, reservation, confirmation and cancellation contracts.
- Specify idempotency, slot-conflict and unauthorized responses.
- Review example requests, audit fields and open retention assumptions.

## Validation and failure scenarios

Walk synthetic booking and rescheduling scenarios with coordinators. Review overlapping bookings, time-zone boundaries, cancelled appointments, audit coverage and retention decisions before freezing the model.

## Dependency handling

Cedar's security team must confirm the retention policy before the data model is frozen.

Pending external decisions remain explicit assumptions. Use synthetic data for local checks. Record interface examples, authorization denials and recovery evidence with the relevant task. Never include credentials or personal source data in review artifacts.
