import type { Graph } from "falkordb";
import type { Actor } from "./data-executor.ts";
import { requestLeave, requestWfh } from "./request-operations.ts";

export async function peopleOperation(
	graph: Graph,
	name: string,
	payload: unknown,
	actor: Actor,
) {
	const input = payload as Record<string, string>;
	if (name === "leave.request") return requestLeave(graph, payload, actor);
	if (name === "wfh.request") return requestWfh(graph, payload, actor);
	const params = { ...input, actorId: actor.id, now: Date.now() };
	let query = "";
	if (name === "employees.changeRole") {
		if (
			actor.role !== "admin" ||
			!["user", "lead", "admin", "hr"].includes(input.newRole)
		)
			throw new Error("Role change is not permitted.");
		query = `MATCH (a:Employee {id:$actorId}) WHERE a.isActive=true AND a.role='admin'
MATCH (u:Employee {id:$userId}) OPTIONAL MATCH (other:Employee) WHERE other.role='admin' AND other.isActive=true AND other.id<>u.id
WITH u,count(other) AS others WHERE u.role<>'admin' OR $newRole='admin' OR others>0
SET u.role=$newRole,u.updatedAt=$now RETURN collect({id:u.id}) AS rows`;
	} else if (name === "leave.approve") {
		query = `MATCH (a:Employee {id:$actorId}) WHERE a.isActive=true
MATCH (r:LeaveRequest {id:$id,status:'pending'}),(employee:Employee)
WHERE employee.id=r.userId AND (a.role='admin' OR (a.role IN ['lead','user'] AND employee.peerLeadId=a.id AND employee.id<>a.id))
MATCH (b:LeaveBalance {cycleStart:$cycleStart})
WHERE b.userId=r.userId AND b.leaveType=r.leaveType AND b.used+r.totalDays<=b.totalLimit
SET r.status='approved',r.approvedBy=a.id,r.updatedAt=$now,b.used=b.used+r.totalDays,b.updatedAt=$now
MERGE (r)-[:APPROVED_BY]->(a) MERGE (r)-[:USES_BALANCE]->(b) RETURN collect({id:r.id}) AS rows`;
	} else if (name === "leave.revoke") {
		query = `MATCH (a:Employee {id:$actorId}) WHERE a.isActive=true AND a.role='admin'
MATCH (r:LeaveRequest {id:$id}) WHERE r.status IN ['approved','pending_cancellation']
OPTIONAL MATCH (b:LeaveBalance {cycleStart:$cycleStart}) WHERE b.userId=r.userId AND b.leaveType=r.leaveType
SET r.status='revoked',r.revokedBy=a.id,r.revokeReason=$reason,r.updatedAt=$now
FOREACH (_ IN CASE WHEN b IS NULL THEN [] ELSE [1] END | SET b.used=CASE WHEN b.used-r.totalDays<0 THEN 0 ELSE b.used-r.totalDays END,b.updatedAt=$now)
MERGE (r)-[:REVOKED_BY]->(a) RETURN collect({id:r.id}) AS rows`;
	} else throw new Error("Unknown people operation.");
	const result = await graph.query<{ rows: { id: string }[] }>(query, {
		params,
		TIMEOUT: 5000,
	});
	return result.data?.[0].rows ?? [];
}
