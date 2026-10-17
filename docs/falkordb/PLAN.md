# Brainee.org: FalkorDB plan

Updated 17 October 2026. Implementation started on `paveen/falkordb-migration`. Local Docker/service setup, identity constraints, concurrency and recovery checks are complete; the application data layer has not switched yet. See [local setup status](./LOCAL-SETUP.md).

**Final setup: FalkorDB is the only application database.** Remove D1, Drizzle, SQL runtime code, and D1 bindings/configuration when the replacement is complete. No database selector, dual writes, or fallback database. One offline backup/export of existing local data is a migration safeguard, not a second running database. No production access or changes.

## The important flow

1. **Save the current baseline.** Back up existing local data and capture expected results before replacing database code. Use exported fixtures for comparisons; the new app must not require D1 running alongside FalkorDB.
2. **Start FalkorDB in local Docker.** Use persistent storage, credentials, and a tested backup/restore process. Connect through a small private Node service so the current app runtime can stay in place. This service is backend code, not another database.
3. **Replace the data layer.** Model employees, projects, tasks, leave, assets, and their relationships. Replace all SQL reads/writes, including assistant tools and document metadata. Keep existing screens, permissions, business rules, and record IDs. Build in a migration branch; no selectable SQL implementation in the finished app.
4. **Verify and finish the replacement.** Test normal workflows, permissions, leave balances, duplicate submissions, persistence, and recovery against FalkorDB. Remove D1/Drizzle dependencies, bindings, seed commands and active configuration. The app must start and pass its checks with FalkorDB alone; an outage shows an error rather than switching databases.
5. **Prepare your team's data.** Create individual accounts and load employees, reporting lines, projects, schedules, holidays, and approved leave policies. Keep sample records in disposable tests, outside the team dataset.
6. **Build the assistant workflows.** Answer availability and policy questions first, then submit leave after an exact preview and your confirmation. Add project capacity analysis when reliable allocations and remaining-work estimates exist. Full office strength means everyone physically present; WFH/offsite work does not count as office presence.

```text
App screens + AI assistant
          |
Authenticated backend operations
          |
Private Node graph service
          |
FalkorDB in Docker -> persistent storage + backups
```

Uploaded file bytes stay in the existing R2 file storage; their metadata moves to FalkorDB. R2 is not a second application database.

**Done means:** the app uses only FalkorDB, existing workflows still work, your team's data persists, and the assistant answers from permitted records and confirms before submitting actions. Hosting is a later step.

Optional implementation detail: [graph model](./GRAPH-MODEL.md) and [assistant requirements](./AGENT-PLAN.md). You do not need to read those to review this flow.
