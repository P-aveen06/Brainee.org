# Solstice Energy Insights — Delivery and acceptance plan

> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.

## Execution and evidence

Work packages below describe the intended result and actionable subtasks. Current assignees, estimates, dates and completion state remain in the application. Coordinate dependencies before sequencing work; a blocked upstream approval cannot be replaced with a guessed result.

## 1. Map meter data sources

Objective
Map the meter sources and their data contracts.

Implementation
1. Inventory meter identities, exports and source owners.
2. Document timestamp zones, cadence, units and quality flags.
3. Request representative readings for a full operating week.

Acceptance criteria
Each source has a documented contract and owner; missing representative data remains an explicit discovery dependency.

Evidence
Attach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.

### Subtasks

- Inventory meter identities, exports and source owners.
- Document timestamp zones, cadence, units and quality flags.
- Request representative readings for a full operating week.

## 2. Prototype generation insights

Objective
Prototype generation insights with clear data-quality cues.

Implementation
1. Define daily generation and site comparison views.
2. Build synthetic examples with gaps, zero output and missing meters.
3. Review units, UTC normalization and empty states with analysts.

Acceptance criteria
Analysts can distinguish low output from missing data, and every prototype identifies its synthetic or supplied data source.

Evidence
Attach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.

### Subtasks

- Define daily generation and site comparison views.
- Build synthetic examples with gaps, zero output and missing meters.
- Review units, UTC normalization and empty states with analysts.

## 3. Validate sample meter readings

Objective
Validate supplied readings before analytics assumptions are frozen.

Implementation
1. Confirm receipt and coverage of a representative operating week.
2. Check duplicate readings, units, gaps and time-zone conversions.
3. Record quality findings and resolve source-owner questions.

Acceptance criteria
A coverage and quality report references the supplied sample; absent representative data keeps validation blocked.

Evidence
Attach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.

### Subtasks

- Confirm receipt and coverage of a representative operating week.
- Check duplicate readings, units, gaps and time-zone conversions.
- Record quality findings and resolve source-owner questions.

## 4. Plan anomaly detection thresholds

Objective
Propose explainable anomaly thresholds for analyst review.

Implementation
1. Separate sensor-quality rules from generation-deviation rules.
2. Draft threshold examples and expected false-positive cases.
3. Review thresholds against available data and record assumptions.

Acceptance criteria
Each proposed rule states inputs, threshold, expected outcome and limitations; activation waits for representative-data review.

Evidence
Attach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.

### Subtasks

- Separate sensor-quality rules from generation-deviation rules.
- Draft threshold examples and expected false-positive cases.
- Review thresholds against available data and record assumptions.

## Architecture review

Objective
Review the solution boundaries and failure modes for Solstice Energy Insights.

Design
Preserve raw readings independently from normalized analytics. Normalize timestamps to UTC while retaining source time-zone metadata, units and meter identity. Mark missing intervals and distinguish data-quality anomalies from generation anomalies.

Recorded decision
Store raw meter readings separately and normalize all timestamps to UTC.

Review checklist
1. Trace the core journey and authorization boundaries.
2. Check data ownership, upstream failures, retries and evidence retention.
3. Review the project-specific validation plan: Review a full operating week of representative meter data when supplied. Check timestamp alignment, units, duplicates, gaps and generation aggregates; proposed thresholds require analyst review and remain provisional.

Acceptance criteria
Record a reviewed architecture decision with alternatives, unresolved dependencies and follow-up owners. Solstice must provide representative meter data covering a full operating week.

## Quality gate

Review a full operating week of representative meter data when supplied. Check timestamp alignment, units, duplicates, gaps and generation aggregates; proposed thresholds require analyst review and remain provisional.

For each scenario record the input, expected result, actual result and evidence reference. Log defects with severity and owner; require retest evidence before closing them. The lead records the readiness decision and any conditions.

## Handoff

Provide reviewed documentation, open risks, support ownership and a recovery or rollback approach appropriate to the project stage. A readiness review does not execute a deployment.
