# Brainee.org

Team workspace for people, leave, projects, tasks and equipment. The app uses TanStack Start on Cloudflare Workers, one FalkorDB graph in local Docker, and R2 for uploaded files.

## Run locally

Requires Bun and Docker Desktop with its engine running.

```sh
bun install
cp .dev.vars.example .dev.vars
# Set SESSION_SECRET in .dev.vars to a random value from: openssl rand -hex 32
bun run graph:setup
bun run graph:up
bun run graph:seed
bun run dev
```

Open http://localhost:3000 and choose a role and teammate. The local demo requires `TEST_AUTH_ENABLED=true` and a seeded graph. It opens Company Brain with that person’s signed identity; the database determines their permissions. Passwords are not required.

The Northstar Studio sample contains 14 people, 10 projects (4 internal and 6 different clients), and a 3/3/4 project split across Maya Rao, Vikram Menon, and Priya Sen. CEO Aditi Deshmukh sees the company portfolio, solution architect Dev Malhotra participates in all ten projects, HR Arjun Mehta has people access, and eight employees each join one or two projects. Project tasks, decisions, daily updates, leave, and equipment are connected for Company Brain briefings.

See [the startup roster, portfolio, and Company Brain scenarios](docs/falkordb/STARTUP-DEMO.md) for the full setup.

## Assistant sales pitches

Ask the Assistant for a client pitch or case study. It can gather permitted project evidence, save a cited internal draft in the conversation, and open a side-by-side canvas with presentation and written-document views. Export a presentation as editable PowerPoint or PDF, and a written case study as editable Word or PDF. Missing outcomes and approvals appear as review items for the team.

Optional public research and pitch layout inspection use a local Playwright browser service. Install its Chromium runtime once with `bunx playwright install chromium`. Set `BROWSER_SERVICE_TOKEN` in `.dev.vars` to a random secret of at least 32 characters, keep `BROWSER_SERVICE_URL=http://127.0.0.1:3200`, then start this service in a second terminal with `bun run browser:serve`. The browser reads only HTTPS pages on exact administrator-approved hosts; add hosts with `BROWSER_PUBLIC_HOSTS` when needed. Research uses fixed generic searches and sends no project details. Page scripts and subresource requests are disabled. Layout inspection checks the generated preview at mobile and desktop widths; it does not verify how PowerPoint or Word will render the exported file. This companion service is intended for local development.

When upgrading the original sample dataset, the first seed reconciles only the known fictional startup accounts, project metadata, and staffing. Later runs preserve edits. Existing unrelated records are retained.

`graph:setup` retains existing graph passwords and configures the private Worker-to-service connection in ignored `.dev.vars`. The browser receives no graph credentials. FalkorDB is the only application database; there is no D1 binding, database selector or SQL fallback.

## Sample team

`graph:seed` explicitly adds a fictional company, 8 employees, 3 projects, 18 tasks (including 6 nested follow-ups), 6 development checklist items, threaded project decisions, task-linked daily updates, leave balances, 5 leave requests, 3 WFH requests, 6 assets and 4 assignments. It also adds client contact and project activity records, previous-week timesheets and reference leave types/stages. The sample calendar uses Monday–Friday, 8 hours/day, Asia/Kolkata. The dates stay anchored to the first seed run. Repeating the command preserves existing records and edits; it does not reset data. Sample leave allowances are examples, not approved company policy.

## Checks and data maintenance

```sh
bun run typecheck
bun run test
bun run build
bun run graph:test
bun run graph:health
bun run graph:backup
bun run graph:restore-check
```

`graph:test` uses disposable graphs; `graph:test:recovery` also recreates the local containers and tests an isolated restore. `graph:down` keeps the data volume. No reset command runs automatically.

See [local setup](docs/falkordb/LOCAL-SETUP.md) and [graph model](docs/falkordb/GRAPH-MODEL.md). All migration work is local. Production access and deployment remain human-controlled. Replace the shared test login before real team use.
