# Willow Customer Portal — Project brief

> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.

## Outcome and audience

Self-service orders, returns and onboarding for Willow customers.

Retail customers, customer support agents and Willow's product owner.

## Scope

Customer onboarding, authenticated order history, shipment milestones and return initiation with a clear support handoff.

## Exclusions

Loyalty points, promotions, payments and changes to warehouse fulfilment are deferred.

## Ownership

Project lead: sample-lead. Delivery contributors: sample-anika, sample-rohan. Solution architect: sample-dev. Refer to the application membership list for current staffing.

## Recorded delivery context

Stage: development. Health: amber. These are fixture context; consult the application for current state.

Decision: Keep release one focused on onboarding and order tracking; defer loyalty points.

Dependency: Willow must approve the revised onboarding copy before UAT can start.

## Success and acceptance

1. A permission matrix and reviewed journey map cover each role; negative cases prevent another customer's order access.
2. Customers can open their own orders, identify shipment status and recover from errors without losing context.
3. Eligible returns produce one reference; ineligible and failed requests explain the next action. Track onboarding-copy approval separately as the recorded UAT dependency.
4. Each approved onboarding scenario has an expected result and evidence; unresolved copy approval is visible before UAT starts.

## Review and change control

The project lead reviews scope and acceptance evidence; the architect reviews technical decisions. Record proposed scope changes in project discussions before changing the delivery baseline. Client approval and policy decisions must be recorded explicitly.
