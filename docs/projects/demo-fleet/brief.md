# Atlas Fleet Visibility — Project brief

> Fictional Northstar Studio demo content. This is a proposed delivery specification; it does not certify completion, client approval or production readiness. Existing task status is the source for execution progress.

## Outcome and audience

Live shipment events and exception alerts across Atlas distribution routes.

Dispatchers, logistics operations and Atlas integration engineers.

## Scope

Shipment event ingestion, live tracking views and exception alerts for Atlas distribution routes.

## Exclusions

Route optimization, driver payroll and changes to GPS device firmware are deferred.

## Ownership

Project lead: sample-vikram. Delivery contributors: sample-leena, sample-ishan. Solution architect: sample-dev. Refer to the application membership list for current staffing.

## Recorded delivery context

Stage: development. Health: red. These are fixture context; consult the application for current state.

Decision: Use an event queue with idempotent consumers for duplicate GPS events.

Dependency: Atlas has not provisioned the GPS sandbox credentials; ingestion testing is delayed.

## Success and acceptance

1. Schema examples define identity and ordering; malformed events have a documented quarantine outcome.
2. Replaying a duplicate does not advance state twice; late events do not overwrite newer positions and stale data is visible.
3. A redacted sandbox exchange verifies connectivity; missing credentials keep integration testing explicitly blocked.
4. Each rule has an owner, a reproducible breach example and recovery evidence; repeated events do not create repeated incidents.

## Review and change control

The project lead reviews scope and acceptance evidence; the architect reviews technical decisions. Record proposed scope changes in project discussions before changing the delivery baseline. Client approval and policy decisions must be recorded explicitly.
