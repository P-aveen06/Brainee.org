import { queryParams } from "./params.ts";
import { randomUUID } from "node:crypto";
import type { Graph } from "falkordb";
import { byLabel } from "../../../shared/graph/model.ts";
import { recordValues } from "../../../shared/graph/write-values.ts";
import type { Actor } from "./data-executor.ts";

export async function createTaskOperation(
	graph: Graph,
	payload: unknown,
	actor: Actor,
) {
	const input = payload as { values: Record<string, unknown> };
	const values = recordValues(
		byLabel.get("Task")!,
		{ ...input.values, taskNumber: 0, createdById: actor.id },
		true,
	);
	const event = recordValues(
		byLabel.get("ProjectEvent")!,
		{
			id: randomUUID(),
			projectId: values.projectId,
			actorId: actor.id,
			eventType: "task_created",
			entityType: "task",
			entityId: values.id,
			details: "{}",
		},
		true,
	);
	const audit = recordValues(
		byLabel.get("AuditEvent")!,
		{
			id: randomUUID(),
			actorId: actor.id,
			action: "project_task_created",
			entityType: "project_task",
			entityId: values.id,
			newData: "{}",
		},
		true,
	);
	const query = `MATCH (a:Employee {id:$actorId}) WHERE a.isActive=true
MATCH (p:Project {id:$projectId}) WHERE a.role='admin' OR p.ownerId=a.id OR size([(p)<-[:IN_PROJECT]-(:ProjectMembership {userId:$actorId,isCurrent:true,role:'manager'}) | 1]) > 0 OR size([(p)<-[:IN_PROJECT]-(:ProjectMembership {userId:$actorId,isCurrent:true,role:'contributor'}) | 1]) > 0
OPTIONAL MATCH (previous:Task {projectId:p.id}) WITH a,p,coalesce(max(previous.taskNumber),0) AS maxNumber
OPTIONAL MATCH (parent:Task {id:$parentId})
WITH a,p,maxNumber,parent WHERE $parentId IS NULL OR parent.projectId=p.id
OPTIONAL MATCH (assignee:Employee {id:$assigneeId})
WITH a,p,maxNumber,parent,assignee WHERE $assigneeId IS NULL OR (assignee.isActive=true AND (p.ownerId=assignee.id OR size([(p)<-[:IN_PROJECT]-(:ProjectMembership {userId:$assigneeId,isCurrent:true}) | 1]) > 0))
OPTIONAL MATCH (source:Task {id:$sourceTaskId})
WITH a,p,maxNumber,parent,assignee,source WHERE $sourceTaskId IS NULL OR source.projectId=$sourceProjectId
SET p.taskCounter=CASE WHEN coalesce(p.taskCounter,0)>maxNumber THEN p.taskCounter+1 ELSE maxNumber+1 END
CREATE (t:Task) SET t += $values,t.taskNumber=p.taskCounter
MERGE (p)-[:HAS_TASK]->(t) MERGE (t)-[:CREATED_BY]->(a)
FOREACH (_ IN CASE WHEN parent IS NULL THEN [] ELSE [1] END | MERGE (t)-[:PARENT_TASK]->(parent))
FOREACH (_ IN CASE WHEN assignee IS NULL THEN [] ELSE [1] END | MERGE (t)-[:ASSIGNED_TO]->(assignee))
FOREACH (_ IN CASE WHEN source IS NULL THEN [] ELSE [1] END | MERGE (t)-[:DERIVED_FROM]->(source))
CREATE (e:ProjectEvent) SET e += $event,e.details='{"taskNumber":'+toString(t.taskNumber)+',"title":'+$titleJson+'}' MERGE (e)-[:IN_PROJECT]->(p)
CREATE (audit:AuditEvent) SET audit += $audit,audit.newData='{"projectId":'+$projectJson+',"taskNumber":'+toString(t.taskNumber)+',"title":'+$titleJson+'}' MERGE (audit)-[:ACTOR]->(a)
RETURN collect({taskId:t.id,taskNumber:t.taskNumber}) AS rows`;
	const params = {
		values,
		event,
		audit,
		actorId: actor.id,
		projectId: values.projectId,
		parentId: values.parentTaskId ?? null,
		assigneeId: values.assigneeId ?? null,
		sourceTaskId: values.sourceTaskId ?? null,
		sourceProjectId: values.sourceProjectId ?? null,
		titleJson: JSON.stringify(values.title),
		projectJson: JSON.stringify(values.projectId),
	};
	const result = await graph.query<{
		rows: { taskId: string; taskNumber: number }[];
	}>(query, { params: queryParams(params), TIMEOUT: 5000 });
	const created = result.data?.[0].rows[0];
	if (!created)
		throw new Error(
			"Task creation is not permitted or a project reference changed.",
		);
	return { ...created, success: true };
}
