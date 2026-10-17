# FalkorDB migration

The local app now uses **one database: FalkorDB**. The private Node service connects the existing Worker app to the graph. There is no D1 configuration, database switch, dual write or SQL fallback.

1. Start local Docker with `bun run graph:up`.
2. The service checks the graph's identity and business constraints.
3. Existing app screens and assistant tools read/write through the typed graph layer. Signed sessions and existing permissions remain required. Leave approval balances and task numbering are native single-query operations.
4. Add the optional fictional team with `bun run graph:seed`; repeat runs preserve edits.
5. Verify with app tests/build, real graph tests, and backup/restore checks.

Old local SQL data is kept offline under ignored backups. The graph starts without imported legacy records. No production work is included.

Before real team use: replace the shared test login, approve leave/WFH policies and import real employees. Future assistant features follow [AGENT-PLAN.md](./AGENT-PLAN.md): read-only answers immediately, explicit confirmation before submitting an action; physical office presence excludes WFH.
