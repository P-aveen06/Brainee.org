from .graph import TASK_FIELDS
from .retrieval import source_for


def page(items, offset, limit):
    return {"items": items[:limit], "offset": offset, "hasMore": len(items) > limit,
            "nextOffset": offset + limit if len(items) > limit else None}


async def implementation_context(graph, actor_id, payload):
    project = await graph.project(actor_id, payload["projectId"])
    project_id, code = project["id"], project["projectCode"]
    task_id = payload.get("taskId", "")
    root_id = None
    if task_id:
        roots = await graph.read("""MATCH (seed:Task {id:$taskId})-[:PARENT_TASK*0..50]->(root:Task)
WHERE seed.projectId=$projectId AND root.projectId=$projectId AND root.parentTaskId IS NULL
RETURN root.id LIMIT 1""", actor_id, taskId=task_id, projectId=project_id)
        if not roots:
            raise ValueError("Task not found in this project, or its hierarchy is incomplete.")
        root_id = roots[0]
    task_match = ("MATCH (root:Task {id:$rootId})<-[:PARENT_TASK*0..50]-(t:Task) "
                  "WHERE t.projectId=$projectId WITH DISTINCT t" if root_id else
                  "MATCH (p:Project {id:$projectId})-[:HAS_TASK]->(t:Task) WITH DISTINCT t")
    params = {"projectId": project_id, "rootId": root_id or "", "code": code,
              "offset": payload.get("offset", 0), "limit": payload.get("limit", 50) + 1}
    offset, limit = params["offset"], params["limit"] - 1
    section = payload.get("section", "all")
    queries = {
        "tasks": task_match + f" OPTIONAL MATCH (t)-[:ASSIGNED_TO]->(u:Employee) RETURN {TASK_FIELDS} "
                 "ORDER BY t.taskNumber SKIP $offset LIMIT $limit",
        "decisions": """MATCH (n:Comment)-[:IN_PROJECT]->(p:Project {id:$projectId})
RETURN {id:n.id,type:CASE WHEN n.isDecision THEN 'decision' ELSE 'discussion' END,
projectId:p.id,projectCode:p.code,title:CASE WHEN n.isDecision THEN 'Decision' ELSE 'Discussion' END,
text:n.body,taskId:n.taskId,documentId:n.documentId,authorId:n.authorId,updatedAt:n.updatedAt}
ORDER BY n.isDecision DESC,n.createdAt DESC,n.id SKIP $offset LIMIT $limit""",
        "documents": """MATCH (n:DocumentVersion)-[:IN_PROJECT]->(p:Project {id:$projectId})
WHERE n.status <> 'superseded'
RETURN {id:n.id,type:'document',projectId:p.id,projectCode:p.code,title:n.title,
description:n.description,category:n.category,version:n.version,indexStatus:
CASE WHEN n.deliveryTextChecksum=n.checksum THEN coalesce(n.deliveryIndexStatus,'not_indexed')
ELSE 'not_indexed' END}
ORDER BY n.createdAt DESC,n.id SKIP $offset LIMIT $limit""",
        "updates": """MATCH (n:DailyUpdate)-[:IN_PROJECT]->(p:Project {id:$projectId})
WHERE n.status='submitted'
RETURN {id:n.id,type:'update',projectId:p.id,projectCode:p.code,title:'Daily update',
date:n.date,summary:n.summary,blockers:n.blockers,userId:n.userId}
ORDER BY n.date DESC,n.id SKIP $offset LIMIT $limit""",
        "people": """MATCH (n:Employee)-[:HAS_MEMBERSHIP]->(m:ProjectMembership)
-[:IN_PROJECT]->(p:Project {id:$projectId}) WHERE n.isActive=true AND m.isCurrent=true
RETURN {id:n.id,type:'person',projectId:p.id,projectCode:p.code,title:n.name,projectRole:m.role}
ORDER BY n.name,n.id SKIP $offset LIMIT $limit""",
    }
    if section not in ("all", *queries):
        raise ValueError("Unknown implementation context section.")
    result = {"scope": "company_delivery", "project": project, "rootTaskId": root_id,
              "sources": [source_for(project)],
              "notes": ["Decisions, documents, updates and memberships are project context; check explicit task links.",
                        "Dependency edges and inferred expertise are not recorded; task hierarchy and contributions are evidence."]}
    for name, query in queries.items():
        if section not in ("all", name):
            continue
        items = await graph.read(query, actor_id, **params)
        result[name] = page(items, offset, limit)
        for item in result[name]["items"]:
            item["excerpt"] = item.get("text", "")
            item["source"] = source_for(item)
            result["sources"].append(item["source"])
    if section in ("all", "tasks"):
        totals = await graph.read(task_match + """
WITH t,size([(t)<-[:PARENT_TASK]-(child:Task) WHERE child.projectId=$projectId | child.id])=0 AS leaf
RETURN {taskCount:count(t),leafTaskCount:sum(CASE WHEN leaf THEN 1 ELSE 0 END),
estimatedHours:sum(CASE WHEN leaf THEN coalesce(t.estimateHours,0) ELSE 0 END),
actualHours:sum(CASE WHEN leaf THEN coalesce(t.actualHours,0) ELSE 0 END),
missingLeafEstimates:sum(CASE WHEN leaf AND t.estimateHours IS NULL THEN 1 ELSE 0 END),
missingLeafActuals:sum(CASE WHEN leaf AND t.actualHours IS NULL THEN 1 ELSE 0 END)}""", actor_id, **params)
        summary = totals[0]
        summary["method"] = "Sum leaf tasks only; parent estimates are preserved on tasks and excluded from totals."
        summary["completeEstimates"] = summary["missingLeafEstimates"] == 0 and summary["leafTaskCount"] > 0
        if summary["leafTaskCount"] == summary["missingLeafEstimates"]:
            summary["estimatedHours"] = None
        if summary["leafTaskCount"] == summary["missingLeafActuals"]:
            summary["actualHours"] = None
        result["estimateSummary"] = summary
    return result
