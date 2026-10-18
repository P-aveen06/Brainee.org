# Cedar Patient Scheduling — Project brief

> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.

## Outcome and audience

Appointment scheduling and clinician capacity planning for Cedar Health.

Scheduling coordinators, clinicians and Cedar's security reviewers.

## Scope

Discovery of appointment booking, rescheduling, cancellations and clinician capacity with a reviewed scheduling service contract.

## Exclusions

Clinical records, diagnosis, billing and production patient-data ingestion are outside discovery scope.

## Ownership

Project lead: sample-lead. Delivery contributors: sample-rohan, sample-sara. Solution architect: sample-dev. Refer to the application membership list for current staffing.

## Recorded delivery context

Stage: discovery. Health: amber. These are fixture context; consult the application for current state.

Decision: Separate patient identifiers from scheduling events and audit every access.

Dependency: Cedar's security team must confirm the retention policy before the data model is frozen.

## Success and acceptance

1. Each workflow names its actor, input, decision points and outcome; open policy questions have reviewers.
2. Reviewers can find an available slot, recognize a conflict and explain rescheduling without seeing unnecessary patient identifiers.
3. Security confirms retention decisions in writing; until then the data model remains unapproved and the dependency remains visible.
4. Contracts include successful and failing examples and enforce identifier separation; unresolved retention assumptions are marked for review.

## Review and change control

The project lead reviews scope and acceptance evidence; the architect reviews technical decisions. Record proposed scope changes in project discussions before changing the delivery baseline. Client approval and policy decisions must be recorded explicitly.
