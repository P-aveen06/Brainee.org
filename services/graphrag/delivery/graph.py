"""Fixed graph queries. Model input is only ever bound as parameter values."""
from graphrag_sdk import FalkorDBConnection


GUARD = "MATCH (actor:Employee {id:$actorId}) WHERE actor.isActive=true WITH actor "
TASK_FIELDS = """{id:t.id,type:'task',projectId:t.projectId,projectCode:$code,
taskNumber:t.taskNumber,title:t.title,description:t.description,status:t.status,
priority:t.priority,parentTaskId:t.parentTaskId,estimateHours:t.estimateHours,
actualHours:t.actualHours,blockedReason:t.blockedReason,dueDate:t.dueDate,
assigneeId:u.id,assigneeName:u.name,
isLeaf:size([(t)<-[:PARENT_TASK]-(child:Task) WHERE child.projectId=$projectId | child.id])=0}"""

# These projections deliberately omit contracts, storage keys, credentials, and HR fields.
SEARCH_KINDS = {
    "task": (
        "MATCH (p:Project)-[:HAS_TASK]->(n:Task) OPTIONAL MATCH (n)-[:ASSIGNED_TO]->(u:Employee)",
        "coalesce(n.title,'')+' '+coalesce(n.description,'')+' '+coalesce(n.blockedReason,'')+' '+coalesce(u.name,'')",
        "{id:n.id,type:'task',projectId:p.id,projectCode:p.code,projectName:p.name,title:n.title,"
        "taskNumber:n.taskNumber,status:n.status,estimateHours:n.estimateHours,actualHours:n.actualHours,"
        "parentTaskId:n.parentTaskId,assigneeName:u.name}",
    ),
    "decision": (
        "MATCH (n:Comment)-[:IN_PROJECT]->(p:Project)", "coalesce(n.body,'')",
        "{id:n.id,type:CASE WHEN n.isDecision THEN 'decision' ELSE 'discussion' END,"
        "projectId:p.id,projectCode:p.code,projectName:p.name,title:'Project discussion',"
        "taskId:n.taskId,documentId:n.documentId,isDecision:n.isDecision,updatedAt:n.updatedAt}",
    ),
    "document": (
        "MATCH (n:DocumentVersion)-[:IN_PROJECT]->(p:Project) WHERE n.status <> 'superseded'",
        "coalesce(n.title,'')+' '+coalesce(n.description,'')+' '+CASE WHEN n.deliveryTextChecksum=n.checksum "
        "THEN coalesce(n.deliveryText,'') ELSE '' END",
        "{id:n.id,type:'document',projectId:p.id,projectCode:p.code,projectName:p.name,title:n.title,"
        "version:n.version,indexStatus:CASE WHEN n.deliveryTextChecksum=n.checksum "
        "THEN coalesce(n.deliveryIndexStatus,'not_indexed') ELSE 'not_indexed' END}",
    ),
    "update": (
        "MATCH (n:DailyUpdate)-[:IN_PROJECT]->(p:Project) WHERE n.status='submitted'",
        "coalesce(n.summary,'')+' '+coalesce(n.blockers,'')",
        "{id:n.id,type:'update',projectId:p.id,projectCode:p.code,projectName:p.name,"
        "title:'Daily update',date:n.date,userId:n.userId}",
    ),
    "project": (
        "MATCH (p:Project) WITH actor,p,p AS n",
        "coalesce(p.code,'')+' '+coalesce(p.name,'')+' '+coalesce(p.description,'')",
        "{id:p.id,type:'project',projectId:p.id,projectCode:p.code,projectName:p.name,title:p.name,status:p.status}",
    ),
    "person": (
        "MATCH (n:Employee)-[:HAS_MEMBERSHIP]->(m:ProjectMembership)-[:IN_PROJECT]->(p:Project) "
        "WHERE n.isActive=true AND m.isCurrent=true",
        "coalesce(n.name,'')+' '+coalesce(p.name,'')",
        "{id:n.id,type:'person',projectId:p.id,projectCode:p.code,projectName:p.name,title:n.name,projectRole:m.role}",
    ),
}


class DeliveryGraph:
    def __init__(self, connection: FalkorDBConnection):
        self.connection = connection

    async def read(self, query, actor_id, **params):
        result = await self.connection.graph.ro_query(
            GUARD + query, params={"actorId": actor_id, **params}, timeout=5000,
        )
        return [row[0] for row in result.result_set]

    async def authenticate(self, actor_id):
        rows = await self.read("RETURN actor.id", actor_id)
        if rows != [actor_id]:
            raise PermissionError("An active employee is required.")

    async def project(self, actor_id, value):
        rows = await self.read("""MATCH (p:Project)
WHERE p.id=$value OR toLower(p.code)=toLower($value)
RETURN {id:p.id,type:'project',projectId:p.id,projectCode:p.code,title:p.name,
description:p.description,status:p.status,ownerId:p.ownerId,targetEndDate:p.targetEndDate} LIMIT 1""",
                               actor_id, value=value)
        if not rows:
            raise ValueError("Project not found.")
        return rows[0]

    async def document(self, actor_id, document_id):
        rows = await self.read("""MATCH (n:DocumentVersion)-[:IN_PROJECT]->(p:Project)
WHERE n.id=$id AND n.status <> 'superseded'
RETURN {id:n.id,type:'document',projectId:p.id,projectCode:p.code,title:n.title,
version:n.version,checksum:n.checksum,text:CASE WHEN n.deliveryTextChecksum=n.checksum
THEN n.deliveryText ELSE null END,indexStatus:coalesce(n.deliveryIndexStatus,'not_indexed')}""",
                               actor_id, id=document_id)
        if not rows:
            raise ValueError("Current document not found.")
        return rows[0]

    async def search_kind(self, actor_id, kind, terms, ceiling):
        match, body, projection = SEARCH_KINDS[kind]
        return await self.read(f"""{match}
WITH p,n,{body} AS body,{projection} AS item
WITH item,body,[term IN $terms WHERE toLower(body) CONTAINS term] AS matched
WHERE size(matched)>0
RETURN {{item:item,body:body,matched:matched,score:size(matched)}}
ORDER BY size(matched) DESC,item.projectCode,item.id LIMIT $ceiling""",
                               actor_id, terms=terms, ceiling=ceiling)

