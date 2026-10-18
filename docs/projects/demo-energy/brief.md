# Solstice Energy Insights — Project brief

> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.

## Outcome and audience

Solar generation analytics and anomaly detection for Solstice's field assets.

Solstice field operations, energy analysts and meter-data owners.

## Scope

Meter source discovery, generation insight prototypes, data-quality validation and proposed anomaly thresholds.

## Exclusions

Automated equipment control, live outage guarantees and production anomaly activation are outside discovery scope.

## Ownership

Project lead: sample-priya. Delivery contributors: sample-pooja. Solution architect: sample-dev. Refer to the application membership list for current staffing.

## Recorded delivery context

Stage: discovery. Health: amber. These are fixture context; consult the application for current state.

Decision: Store raw meter readings separately and normalize all timestamps to UTC.

Dependency: Solstice must provide representative meter data covering a full operating week.

## Success and acceptance

1. Each source has a documented contract and owner; missing representative data remains an explicit discovery dependency.
2. Analysts can distinguish low output from missing data, and every prototype identifies its synthetic or supplied data source.
3. A coverage and quality report references the supplied sample; absent representative data keeps validation blocked.
4. Each proposed rule states inputs, threshold, expected outcome and limitations; activation waits for representative-data review.

## Review and change control

The project lead reviews scope and acceptance evidence; the architect reviews technical decisions. Record proposed scope changes in project discussions before changing the delivery baseline. Client approval and policy decisions must be recorded explicitly.
