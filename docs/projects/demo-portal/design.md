# Willow Customer Portal — Solution design

> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.

## Solution approach

Resolve customer identity on the server; scope every order and return lookup to that identity. Translate order and returns APIs into a stable view model. Use idempotency keys for return requests and distinguish pending, failed and confirmed responses.

## Decision baseline

Keep release one focused on onboarding and order tracking; defer loyalty points.

## Work packages and interfaces

### 1. Confirm customer access requirements

Define the customer access contract before building account-scoped screens.

- Map customer and support permissions for order and return actions.
- Specify sign-in, expired-session and account-recovery journeys.
- Record cross-account denial cases and review with the project lead.

### 2. Build the order tracking overview

Build an order overview that explains shipment progress and next actions.

- Map order API fields to order cards and shipment milestones.
- Implement loading, empty, delayed-shipment and API-error states.
- Verify keyboard navigation and mobile order-detail journeys.

### 3. Integrate the returns API

Integrate return eligibility and return submission with traceable outcomes.

- Confirm returns API examples, eligibility rules and error codes.
- Implement idempotent return submission and confirmation references.
- Test ineligible items, duplicate requests and upstream timeouts.

### 4. Prepare onboarding acceptance tests

Prepare evidence-based onboarding acceptance tests for customer UAT.

- Draft first-login, returning-user and support-handoff scenarios.
- Obtain Willow approval of the revised onboarding copy.
- Run the approved scenarios and attach defects and retest evidence.

## Validation and failure scenarios

Exercise first-time and returning customer journeys, cross-account access denial, missing shipment updates and duplicate return submissions. Use synthetic order data; record UAT evidence after Willow approves onboarding copy.

## Dependency handling

Willow must approve the revised onboarding copy before UAT can start.

Pending external decisions remain explicit assumptions. Use synthetic data for local checks. Record interface examples, authorization denials and recovery evidence with the relevant task. Never include credentials or personal source data in review artifacts.
