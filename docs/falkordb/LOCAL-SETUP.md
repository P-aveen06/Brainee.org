# Local FalkorDB setup

Status checked 17 October 2026: FalkorDB and the private graph service are running and healthy; app database calls still use SQL. No backend selector or fallback has been added. The completed app will use FalkorDB alone. Your team graph starts clean; existing sample records are preserved only in an ignored offline backup.

From the project folder:

```sh
bun run graph:setup
bun run graph:up
bun run graph:health
bun run graph:test
bun run graph:test:recovery
```

- `graph:setup` generates local administrator/app passwords and a service token once. They stay in ignored `.local/falkordb/`; rerunning retains passwords.
- `graph:up` starts FalkorDB, applies the identity schema, and starts the private Node service. Images and the official client are pinned. Docker needs registry access to download images; its build also needs npm registry access.
- `graph:health` checks the service, schema checksum and operational constraints. Service HTTP is bound to `127.0.0.1:3100`; database ports are not published. There is no arbitrary-query HTTP endpoint.
- `graph:test` runs real-engine checks in a disposable, uniquely named test graph: migration reruns, clean roster, required/unique identities, rollback on a constraint error, concurrent duplicates and restricted credentials. It never deletes the team graph.
- `graph:test:recovery` creates a disposable task record in a separate test graph, recreates this project's containers while retaining the volume, verifies its values, and verifies the same record after restoring a snapshot into an isolated container. It removes its temporary graphs/containers afterward; the clean team graph is untouched.

```sh
bun run graph:backup
bun run graph:restore-check
bun run graph:down
```

`graph:backup` exports a consistent RDB snapshot into ignored `.local/backups/falkordb/`. `graph:restore-check` makes a backup and loads it into a separate temporary container with no network, then verifies the migration checksum. It does not overwrite the live volume. The standalone restore check verifies the schema record; `graph:test:recovery` additionally verifies a task ID, decimal hours and date. Recovery coverage will expand with domain migration. Keep the ignored credentials separately when backing up for real use; ACL configuration is not contained in an RDB snapshot.

`graph:down` stops/removes the project's containers while retaining its data volume. The scripts provide no volume-deletion/reset command and never seed demo employees automatically.

The graph service is an isolated Node package. Its Docker build uses `npm ci` with its own lockfile; the main app continues using Bun. Local service checks:

```sh
bun run graph:typecheck
bun run graph:test:unit
```

Current checkpoint: 242 app tests and 3 graph-service unit tests pass; both type checks and the local app build pass. The test runner reported a worker-termination timeout after passing the app tests; its exit status was zero. The initial registry connection failure cleared on retry. Real-engine integration tests now pass, including fresh and repeated migration, required/unique constraints, rollback, concurrent duplicate writes and restricted credentials. Container recreation retained credentials and the disposable test record; isolated backup restoration recovered its exact ID, hours and date. Final readiness is healthy, only `brainee_dev` remains, and it contains one schema marker with no business/sample records. The application migration is still pending.

Next: prove the engine/constraints/recovery, migrate domain operations and existing app calls (all 37 current tables), then remove D1/Drizzle bindings and configuration. Individual team accounts and approved reference policies precede real team use. Production is untouched.
