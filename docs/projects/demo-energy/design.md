# Solstice Energy Insights — Solution design

> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.

## Solution approach

Preserve raw readings independently from normalized analytics. Normalize timestamps to UTC while retaining source time-zone metadata, units and meter identity. Mark missing intervals and distinguish data-quality anomalies from generation anomalies.

## Decision baseline

Store raw meter readings separately and normalize all timestamps to UTC.

## Work packages and interfaces

### 1. Map meter data sources

Map the meter sources and their data contracts.

- Inventory meter identities, exports and source owners.
- Document timestamp zones, cadence, units and quality flags.
- Request representative readings for a full operating week.

### 2. Prototype generation insights

Prototype generation insights with clear data-quality cues.

- Define daily generation and site comparison views.
- Build synthetic examples with gaps, zero output and missing meters.
- Review units, UTC normalization and empty states with analysts.

### 3. Validate sample meter readings

Validate supplied readings before analytics assumptions are frozen.

- Confirm receipt and coverage of a representative operating week.
- Check duplicate readings, units, gaps and time-zone conversions.
- Record quality findings and resolve source-owner questions.

### 4. Plan anomaly detection thresholds

Propose explainable anomaly thresholds for analyst review.

- Separate sensor-quality rules from generation-deviation rules.
- Draft threshold examples and expected false-positive cases.
- Review thresholds against available data and record assumptions.

## Validation and failure scenarios

Review a full operating week of representative meter data when supplied. Check timestamp alignment, units, duplicates, gaps and generation aggregates; proposed thresholds require analyst review and remain provisional.

## Dependency handling

Solstice must provide representative meter data covering a full operating week.

Pending external decisions remain explicit assumptions. Use synthetic data for local checks. Record interface examples, authorization denials and recovery evidence with the relevant task. Never include credentials or personal source data in review artifacts.
