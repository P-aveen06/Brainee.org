# Finch Risk Analytics — Solution design

> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.

## Solution approach

Version source snapshots, transformations and feature definitions together. Link each dashboard aggregate to its ledger inputs and reconciliation result. Quarantine mismatches; do not label unverified September totals as validated.

## Decision baseline

Version feature definitions and reconcile every aggregate against the ledger.

## Work packages and interfaces

### 1. Define risk metric lineage

Define reproducible lineage for lending-risk metrics.

- Map dashboard measures to source ledger fields and owners.
- Version feature formulas, windows and exclusion rules.
- Review a worked metric trace from source to dashboard.

### 2. Build reconciliation pipelines

Build pipelines that expose reconciliation gaps.

- Implement source normalization and duplicate-transaction checks.
- Compare source and derived counts and monetary totals.
- Record mismatch evidence and prevent unverified publication.

### 3. Validate September ledger totals

Validate September totals after source reconciliation.

- Request the corrected September ledger and reconciliation sign-off.
- Compare corrected totals with the frozen validation dataset.
- Document residual differences and obtain data-owner review.

### 4. Prepare model audit evidence

Prepare a reviewable model and metric audit pack.

- Collect feature versions, ledger checks and validation evidence.
- Document known limitations and unresolved reconciliation items.
- Walk a dashboard metric back to source with the reviewer.

## Validation and failure scenarios

Reconcile source and derived counts and amounts, test missing and duplicate transactions and reproduce an aggregate from its lineage. Keep the September validation gate open until Finch resolves the source ledger.

## Dependency handling

Finch must reconcile the September source ledger before model validation can close.

Pending external decisions remain explicit assumptions. Use synthetic data for local checks. Record interface examples, authorization denials and recovery evidence with the relevant task. Never include credentials or personal source data in review artifacts.
