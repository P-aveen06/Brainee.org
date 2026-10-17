# Local FalkorDB setup

The app uses FalkorDB as its only database. D1/Drizzle configuration and SQL seed scripts have been removed. Old local SQL records remain only in ignored offline backups; nothing is copied into the new graph automatically. R2 continues to hold uploaded files.

```sh
bun run graph:setup
bun run graph:up
bun run graph:seed
bun run dev
```

Configure a random `SESSION_SECRET` and `TEST_AUTH_ENABLED=true` in `.dev.vars` first. `graph:setup` writes the local service URL/token there without printing credentials. After seeding, open http://localhost:3000 and choose a startup role and named teammate. The role picker works only on localhost and issues a signed session for the stored account.

## How it connects

Browser → signed-session server functions → private Node graph service → FalkorDB. The Worker derives the subject from the signed session; the service resolves the current active employee and role. Existing server middleware and domain permission checks remain in place. The service accepts structured application operations; it exposes no raw Cypher endpoint. The shared typed query layer compiles allowed model names, fields and expressions into parameterized Cypher. Foreign-key relationships are maintained in the same write query.

The service is bound to 127.0.0.1:3100. FalkorDB Browser is available at http://localhost:3001 and bound to loopback; the database port 6379 remains private. In the Browser, connect to `localhost:6379` with username `admin` and the `GRAPH_ADMIN_PASSWORD` value from ignored `.local/falkordb/.env`, then select `brainee_dev`. Local passwords and ACLs live under ignored `.local/falkordb/`; no credentials belong in Git. Persistent data uses the Docker volume `brainee_graph-data`.

## Checks

```sh
bun run graph:health
bun run graph:test
bun run graph:test:recovery
bun run typecheck
bun run test
bun run build
```

The real-engine suites cover fresh/repeated schema migration, required and unique fields, rollback, task numbering, role/project restrictions, leave approval/revocation balances, leave/WFH overlap and concurrent duplicate submissions. They also verify relationship maintenance, conversation cleanup and repeatable sample seeding. Each test deletes only its own randomly named test graph. Schema migrations are additive and checksum-checked. Critical leave and task operations run as one native write query.

The Node package has its own npm lockfile; Docker builds type-check it and run HTTP/config/schema tests. The main app uses Bun. For checks outside Docker, install the service's own dev dependencies with `npm ci --prefix services/graph`, then run `bun run graph:typecheck` and `bun run graph:test:unit`.

## Samples

`graph:seed` runs only against `brainee_dev`, only when explicitly invoked. It adds 8 fictional employees, 3 projects with different staffing levels, 18 tasks including nested follow-ups, 6 development checklist items, threaded project decisions, task-linked daily updates, 3 sample leave types, 24 balances, 5 leave requests, 3 WFH requests, 40 timesheets, 6 assets and 4 assignments. It also adds a sample client contact and project activity. Sample dates are anchored on first run; repeat runs leave edits intact. The test account is an administrator. Other fictional identities cannot sign in through the temporary shared login.

The sample calendar uses a Monday–Friday workweek, 8 hours/day and Asia/Kolkata. Leave allowances and WFH limits are illustrative. Approve your real policy before using the app for team decisions. Uploaded policy files are not faked or seeded.

## Backups and stopping

```sh
bun run graph:backup
bun run graph:restore-check
bun run graph:down
```

Backups are consistent RDB snapshots in `.local/backups/falkordb/`. Restore checks load snapshots into an isolated temporary container without replacing the active volume. Keep credentials/ACLs separately: they are not in the snapshot. `graph:down` retains the data volume. There is no automatic deletion/reset command. Production has not been accessed or changed.
