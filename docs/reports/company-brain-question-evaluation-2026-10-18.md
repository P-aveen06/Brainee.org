# Company Brain: 100-question evaluation

**Date:** 18 October 2026  
**Result:** 100 prompts submitted across five role perspectives in the local demo.

## Readout

The chat is already a useful front door for portfolio briefs, sourced decisions, task prioritization, approvals, and standup drafting. It is not yet dependable enough to carry the Company Brain promise end to end: the same in-scope project can be found in one turn and reported missing in another, and some related records disagree about owners, reporting lines, or leave history.

This is a functional chat prototype with promising answer quality, but the underlying retrieval and record consistency are not yet at the reliability bar implied by “one graph.” The run did not verify live company sources or synchronization from external docs, tickets, or chat systems.

## What worked

- **Useful chat answers:** portfolio summaries, task lists, blockers, role-specific priorities, and the employee standup were readable and actionable. The assistant separated recorded facts from recommendations when asked.
- **Decision provenance:** architecture decisions were attributed to project discussions. For Atlas Fleet Visibility, it linked the idempotent-consumer decision to a separate review task and correctly distinguished that decision from the missing GPS sandbox credentials.
- **Cross-project ownership:** the architect view connected five client blockers to assigned owners and due dates, and identified Dev Malhotra’s ten architecture reviews as a shared capacity dependency.
- **Source signaling:** many answers included project and record identifiers such as `DEMO-FLEET #3`; the assistant often said when dates, documents, API details, or compensation fields were not present in the returned records.
- **Privacy boundaries:** the architect persona declined to reveal Anika’s leave balances or reason, while employee and HR views answered role-appropriate personal or operational questions.
- **Freshness cues:** answers identified 17 October as the latest recorded activity and kept that distinct from upcoming task deadlines.

## Main gaps

1. **In-scope lookup failures are the largest blocker.** At least 13 answers had clear retrieval/completion failures or required clarification. Examples include Atlas Fleet and Finch Risk lookups for the CEO, Atlas lookups for Vikram, Delivery Automation for Priya (still unresolved after supplying `DEMO-DELIVERY`), and multiple Willow/Company Knowledge Hub requests for Anika. Several of those projects were answered successfully in other turns.
2. **Answers disagree across related queries.** The architect’s portfolio list said review-task assignees were unavailable, while the Atlas/Finch drill-downs named Dev. HR’s direct-report query named Dev as Aditi’s only report despite other HR answers listing several. Anika’s personal request-history query returned no requests while the calendar/availability and priority answers showed her approved 19 October leave.
3. **Project, task, and update access is uneven.** The employee persona could answer the Company Knowledge Hub decision and tagging rule, and list its tasks in a task-count answer, but said the project or its tasks were not visible in other turns. One employee project-list answer also reported the Knowledge Hub as Testing, while a checklist answer associated it with Development.
4. **The evidence graph remains narrow in this run.** The architect received no project documents, diagrams, or technical specs for the ten visible projects. This evaluation exercised seeded local project, task, discussion, update, people, and HR records; it did not demonstrate retrieval across connected production docs, tickets, and chat.
5. **Coverage is not the same as a pass.** All 100 prompts were submitted, but no formal binary rubric was set before the run. Do not read “100 questions” as “100 correct answers.”

## Alignment to the stated goal

| Goal focus | Evaluation readout |
|---|---|
| Chat is the hero | The role-based chat is a useful primary path and produced several strong workflows. Lookup instability currently makes it hard to trust as the single front door. |
| Knowledge from docs, tickets, and chats in one graph | Not demonstrated by the local seeded dataset. Project discussions and updates were retrievable; no project documents were returned, and external connectors were not tested. |
| Who owns what, and who knows what | Partially demonstrated in portfolio blockers, allocations, and task assignments; contradictory reporting and review-assignee answers need repair. |
| Trace decisions to their source | Promising: project decisions and recommendations often included source IDs and clear separation of recorded facts from inference. |
| Keep knowledge current as things change | Only snapshot freshness was exercised. The app surfaced recent dated events, but this run did not test source synchronization or change propagation. |
| Answers with clear sources | Often strong in project answers, uneven in HR and lookup failures. A source label does not compensate for retrieving the wrong or incomplete record. |

## Method and limits

Twenty questions were submitted for each of CEO Aditi Deshmukh, HR Arjun Mehta, Solution Architect Dev Malhotra, and Employee Anika Shah. The remaining twenty Project Lead questions were split across Maya Rao (8), Vikram Menon (6), and Priya Sen (6). The evaluation used the local Northstar Studio demo and its fictional records at `localhost:3000`; no production data or services were touched.

The local workspace already contained uncommitted code changes during the run, so these observations describe that working tree rather than a clean commit. A browser-automation runtime reset left 85 response records in the structured capture (some long answers were clipped); the remaining completed prompts were observed in the UI and are reflected in the qualitative findings, but their raw response text was not retained in that capture.

This is a product-behavior evaluation, not a verification of every fictional business record. The 13-question lookup count is a manual count of clear missing/clarification outcomes, not a full scored pass rate.
