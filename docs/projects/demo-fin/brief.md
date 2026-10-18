# Finch Risk Analytics — Project brief

> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.

## Outcome and audience

Auditable lending risk dashboards from Finch's reconciled transaction data.

Finch risk analysts, data owners and audit reviewers.

## Scope

Reconciled lending-risk metrics, versioned feature lineage and a traceable validation evidence pack.

## Exclusions

Automated lending decisions, new credit policy and claims of model approval are outside this delivery.

## Ownership

Project lead: sample-vikram. Delivery contributors: sample-kiran, sample-ishan. Solution architect: sample-dev. Refer to the application membership list for current staffing.

## Recorded delivery context

Stage: testing. Health: amber. These are fixture context; consult the application for current state.

Decision: Version feature definitions and reconcile every aggregate against the ledger.

Dependency: Finch must reconcile the September source ledger before model validation can close.

## Success and acceptance

1. Each measure references a source snapshot and formula version; a reviewer can reproduce the worked example.
2. Reconciliation reports identify mismatched rows and totals; reruns produce consistent results for the same snapshot.
3. Validation evidence references the corrected source; unresolved source differences keep this task blocked.
4. The pack includes reproducible lineage and explicit unresolved items; it does not imply approval where evidence is pending.

## Review and change control

The project lead reviews scope and acceptance evidence; the architect reviews technical decisions. Record proposed scope changes in project discussions before changing the delivery baseline. Client approval and policy decisions must be recorded explicitly.
