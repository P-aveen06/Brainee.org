# Northstar Studio startup demo

Open [the local role picker](http://localhost:3000/sign-in), choose a role and teammate, and continue into Company Brain. All identities and companies here are fictional. The picker requires `TEST_AUTH_ENABLED=true` and localhost. Sessions are signed; roles are resolved from the stored employee, never submitted by the browser.

## Public hackathon demo

For a public Worker deployment, role selection also requires `PUBLIC_DEMO_AUTH_ENABLED=true` alongside `TEST_AUTH_ENABLED=true`. This lets any visitor choose a fictional seeded identity, so enable it only while the graph contains synthetic demo data. Disable both flags after the hackathon.

## People and assignments

| Person | Position | Project assignment |
| --- | --- | --- |
| Aditi Deshmukh | CEO & Co-founder | Company-wide access |
| Arjun Mehta | People & Culture Manager | People operations; no project membership |
| Maya Rao | Product Engineering Lead | Willow Portal, Knowledge Hub, Cedar Scheduling |
| Vikram Menon | Platform Engineering Lead | Operations Command Center, Atlas Fleet, Finch Risk |
| Priya Sen | Delivery Engineering Lead | Delivery Automation, Design System, Lumina Learning, Solstice Insights |
| Dev Malhotra | Solution Architect | Architecture contributor across all ten projects |
| Anika Shah | Frontend Engineer | Willow Portal, Knowledge Hub |
| Rohan Nair | Backend Engineer | Willow Portal, Cedar Scheduling |
| Sara Thomas | Product Designer | Knowledge Hub, Cedar Scheduling |
| Leena Das | Full Stack Engineer | Operations Command Center, Atlas Fleet |
| Kiran Patel | Data Engineer | Finch Risk |
| Ishan Gupta | DevOps Engineer | Atlas Fleet, Finch Risk |
| Neha Iyer | QA Engineer | Delivery Automation, Lumina Learning |
| Pooja Nambiar | Full Stack Engineer | Design System, Solstice Insights |

Maya's direct reports are Anika, Rohan, and Sara. Vikram's are Leena, Kiran, and Ishan. Priya's are Neha and Pooja. All leads, the architect, and HR report to the CEO.

## Portfolio

| Code | Project | Company | Lead | Stage | Health |
| --- | --- | --- | --- | --- | --- |
| DEMO-PORTAL | Willow Customer Portal | Willow Retail | Maya | Development | Amber |
| DEMO-HUB | Company Knowledge Hub | Internal | Maya | Testing | Green |
| DEMO-OPS | Operations Command Center | Internal | Vikram | Development | Green |
| DEMO-CARE | Cedar Patient Scheduling | Cedar Health | Maya | Discovery | Amber |
| DEMO-FLEET | Atlas Fleet Visibility | Atlas Logistics | Vikram | Development | Red |
| DEMO-FIN | Finch Risk Analytics | Finch Finance | Vikram | Testing | Amber |
| DEMO-DELIVERY | Delivery Automation | Internal | Priya | Development | Green |
| DEMO-DESIGN | Northstar Design System | Internal | Priya | Development | Green |
| DEMO-LEARN | Lumina Learning Platform | Lumina Learning | Priya | Deployment | Green |
| DEMO-ENERGY | Solstice Energy Insights | Solstice Energy | Priya | Discovery | Amber |

The fixture connects 70 tasks (including subtasks and ten architecture reviews), 20 checklist items, 20 discussion entries, 20 project events, six primary client contacts, daily updates, timesheets, leave/WFH requests, and equipment assignments for all 14 people. Daily-update hours are distributed across a person's projects instead of giving them a full day on every project.

## Company Brain scenarios

- **CEO:** “Give me an executive briefing: internal versus client projects, urgent delivery risks, and three next actions.”
- **Lead:** “Which of my projects is blocked, who owns the dependency, and which direct-report approvals need attention?”
- **Architect:** “Review the integration risks across my projects and show the recorded architecture decisions.”
- **HR:** “Summarize headcount, reporting lines, and leave coverage this week.”
- **Employee:** “What should I focus on today across my assigned projects? Include blockers and due dates.”

`get_work_brief` computes scoped totals, project health, blocker ownership, own priorities, staffing, and update coverage before the model synthesizes an answer. Existing project discussion tools provide recorded decisions. Counts refer to visible projects; HR receives people data, with unavailable project allocation represented as unknown. Permission details can be refined independently of these fictional job titles.

## Reseeding

Run `bun run graph:backup` before `bun run graph:seed`. The first upgrade from the original small fixture reconciles known sample identities, project metadata, and staffing once, recorded by `SampleDataset:fictional-startup-v2`. It retains former membership history and unrelated records. Subsequent runs add missing fixture records without overwriting edits. Seeding is an explicit local CLI action and never runs on application startup.

## Detailed project content

After the startup fixture is seeded, run `bun run graph:backup` followed by `bun run graph:enrich` to enrich the ten existing local projects. This explicit operation uses only the loopback graph service and local R2 storage. It replaces known fixture boilerplate, preserves authored descriptions and existing task execution fields, and uses stable IDs so repeat runs do not add duplicates.

The enriched portfolio has 170 tasks: 40 delivery work packages, 10 architecture reviews and 120 subtasks. Each project receives three downloadable Markdown documents (brief, solution design and delivery/acceptance plan), also indexed for Company Brain. The documents describe proposed fictional delivery requirements, not evidence of completed work or client approval. New subtasks start as todo; existing task statuses are preserved, including completed parents. Review new follow-up work before treating a completed parent's expanded acceptance scope as satisfied.

Browse the [project documentation index](../projects/README.md) for all 30 source documents. They are generated from `scripts/project-content/`; edit that content and use a new document version for future revisions rather than changing an uploaded immutable version.
