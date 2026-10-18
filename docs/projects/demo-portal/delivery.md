# Willow Customer Portal — Delivery and acceptance plan

> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.

## Execution and evidence

Work packages below describe the intended result and actionable subtasks. Current assignees, estimates, dates and completion state remain in the application. Coordinate dependencies before sequencing work; a blocked upstream approval cannot be replaced with a guessed result.

## 1. Confirm customer access requirements

Objective
Define the customer access contract before building account-scoped screens.

Implementation
1. Map customer and support permissions for order and return actions.
2. Specify sign-in, expired-session and account-recovery journeys.
3. Record cross-account denial cases and review with the project lead.

Acceptance criteria
A permission matrix and reviewed journey map cover each role; negative cases prevent another customer's order access.

Evidence
Attach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.

### Subtasks

- Map customer and support permissions for order and return actions.
- Specify sign-in, expired-session and account-recovery journeys.
- Record cross-account denial cases and review with the project lead.

## 2. Build the order tracking overview

Objective
Build an order overview that explains shipment progress and next actions.

Implementation
1. Map order API fields to order cards and shipment milestones.
2. Implement loading, empty, delayed-shipment and API-error states.
3. Verify keyboard navigation and mobile order-detail journeys.

Acceptance criteria
Customers can open their own orders, identify shipment status and recover from errors without losing context.

Evidence
Attach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.

### Subtasks

- Map order API fields to order cards and shipment milestones.
- Implement loading, empty, delayed-shipment and API-error states.
- Verify keyboard navigation and mobile order-detail journeys.

## 3. Integrate the returns API

Objective
Integrate return eligibility and return submission with traceable outcomes.

Implementation
1. Confirm returns API examples, eligibility rules and error codes.
2. Implement idempotent return submission and confirmation references.
3. Test ineligible items, duplicate requests and upstream timeouts.

Acceptance criteria
Eligible returns produce one reference; ineligible and failed requests explain the next action. Track onboarding-copy approval separately as the recorded UAT dependency.

Evidence
Attach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.

### Subtasks

- Confirm returns API examples, eligibility rules and error codes.
- Implement idempotent return submission and confirmation references.
- Test ineligible items, duplicate requests and upstream timeouts.

## 4. Prepare onboarding acceptance tests

Objective
Prepare evidence-based onboarding acceptance tests for customer UAT.

Implementation
1. Draft first-login, returning-user and support-handoff scenarios.
2. Obtain Willow approval of the revised onboarding copy.
3. Run the approved scenarios and attach defects and retest evidence.

Acceptance criteria
Each approved onboarding scenario has an expected result and evidence; unresolved copy approval is visible before UAT starts.

Evidence
Attach the reviewed artifact or reproducible check results. Record unresolved decisions and dependency owners; do not mark pending approvals as complete.

### Subtasks

- Draft first-login, returning-user and support-handoff scenarios.
- Obtain Willow approval of the revised onboarding copy.
- Run the approved scenarios and attach defects and retest evidence.

## Architecture review

Objective
Review the solution boundaries and failure modes for Willow Customer Portal.

Design
Resolve customer identity on the server; scope every order and return lookup to that identity. Translate order and returns APIs into a stable view model. Use idempotency keys for return requests and distinguish pending, failed and confirmed responses.

Recorded decision
Keep release one focused on onboarding and order tracking; defer loyalty points.

Review checklist
1. Trace the core journey and authorization boundaries.
2. Check data ownership, upstream failures, retries and evidence retention.
3. Review the project-specific validation plan: Exercise first-time and returning customer journeys, cross-account access denial, missing shipment updates and duplicate return submissions. Use synthetic order data; record UAT evidence after Willow approves onboarding copy.

Acceptance criteria
Record a reviewed architecture decision with alternatives, unresolved dependencies and follow-up owners. Willow must approve the revised onboarding copy before UAT can start.

## Quality gate

Exercise first-time and returning customer journeys, cross-account access denial, missing shipment updates and duplicate return submissions. Use synthetic order data; record UAT evidence after Willow approves onboarding copy.

For each scenario record the input, expected result, actual result and evidence reference. Log defects with severity and owner; require retest evidence before closing them. The lead records the readiness decision and any conditions.

## Handoff

Provide reviewed documentation, open risks, support ownership and a recovery or rollback approach appropriate to the project stage. A readiness review does not execute a deployment.
