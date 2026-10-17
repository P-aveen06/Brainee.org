# Local migration verification

Verified 17 October 2026 after the approved cutover.

- App TypeScript check, 244 tests across 43 files, and the local production build passed.
- The Docker service build passed its TypeScript check and 4 unit/HTTP tests.
- Both real-engine integration suites passed, using disposable graphs only.
- Container recreation preserved the disposable recovery record; an isolated RDB restore recovered its ID, decimal hours and date. Restore checks verified both schema versions.
- The final service reports ready with schema `0002-business-rules`. Only `brainee_dev` remains; temporary test graphs were removed.
- Repeating the live seed preserved all record counts and its date anchor.
- The live graph contains 8 employees, 3 projects, 12 tasks, 24 leave balances, 5 leave requests, 3 WFH requests, 40 timesheets, 6 assets and 4 assignments.
- The expanded seed was applied locally on 17 October 2026; it adds 6 nested tasks, 6 checklist items, 6 threaded comments, 11 task-linked daily updates and items, 6 project events and a client contact.
- Browser sign-in, dashboard, project overview/task list, equipment assignments and team calendar loaded successfully from the graph after recovery.
- D1 bindings, Drizzle dependencies/configuration and legacy SQL seed/migration entrypoints are absent from the active project. Uploaded files continue using R2.
- Offline pre-cutover source and SQLite backups are under ignored `.local/backups/before-graph-cutover-20261017T112126/`. Graph RDB backups are under `.local/backups/falkordb/`.

The sample workweek is Monday–Friday, 8 hours/day. Sample allowances are examples. Temporary administrator login remains test@example.com / TestLogin123! and requires the local test-auth flag. Production and Git history were not changed.
