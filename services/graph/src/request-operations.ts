import { queryParams } from "./params.ts";
import type { Graph } from "falkordb";
import { byLabel } from "../../../shared/graph/model.ts";
import { recordValues } from "../../../shared/graph/write-values.ts";
import type { Actor } from "./data-executor.ts";

const options = (params: Record<string, unknown>) => ({
	params: queryParams(params),
	TIMEOUT: 5000,
});

export async function requestWfh(graph: Graph, payload: unknown, actor: Actor) {
	const input = payload as {
		values: Record<string, unknown>;
		cycleStart: string;
		cycleEnd: string;
		defaultAllowance: number;
	};
	const values = recordValues(
		byLabel.get("WfhRequest")!,
		{ ...input.values, userId: actor.id, status: "pending" },
		true,
	);
	const requested = values.isHalfDay ? 0.5 : 1;
	const query = `MATCH (u:Employee {id:$actorId}) WHERE u.isActive=true
OPTIONAL MATCH (duplicate:WfhRequest {userId:$actorId,date:$date})
WITH u,count(duplicate) AS duplicates WHERE duplicates=0
OPTIONAL MATCH (leave:LeaveRequest {userId:$actorId}) WHERE leave.status IN ['pending','approved','pending_cancellation'] AND ${startSlot("leave")} <= $endSlot AND ${endSlot("leave")} >= $startSlot
WITH u,count(leave) AS overlaps WHERE overlaps=0
OPTIONAL MATCH (reserved:WfhRequest {userId:$actorId}) WHERE reserved.date>=$cycleStart AND reserved.date<=$cycleEnd AND reserved.status IN ['pending','approved','pending_cancellation']
WITH u,coalesce(sum(CASE WHEN reserved IS NULL THEN 0 WHEN reserved.isHalfDay THEN 0.5 ELSE 1 END),0) AS used
OPTIONAL MATCH (policy:WfhPolicy {id:'1'})
WITH u,used,coalesce(policy.annualAllowance,$defaultAllowance) AS allowance WHERE used+$requested<=allowance
CREATE (r:WfhRequest) SET r += $values MERGE (u)-[:REQUESTED]->(r)
RETURN collect({id:r.id}) AS rows`;
	const result = await graph.query<{ rows: { id: string }[] }>(
		query,
		options({
			...input,
			values,
			actorId: actor.id,
			date: values.date,
			requested,
			startSlot:
				String(values.date) +
				(values.isHalfDay && values.halfDayPeriod === "second_half"
					? "1"
					: "0"),
			endSlot:
				String(values.date) +
				(values.isHalfDay && values.halfDayPeriod === "first_half" ? "0" : "1"),
		}),
	);
	return { meta: { changes: result.data?.[0].rows.length ?? 0 } };
}

function startSlot(name: string) {
	return `${name}.startDate+CASE WHEN ${name}.isHalfDayStart AND ${name}.halfDayStartPeriod='second_half' THEN '1' ELSE '0' END`;
}
function endSlot(name: string) {
	return `${name}.endDate+CASE WHEN ${name}.startDate=${name}.endDate THEN CASE WHEN ${name}.isHalfDayStart AND ${name}.halfDayStartPeriod='first_half' THEN '0' ELSE '1' END ELSE CASE WHEN ${name}.isHalfDayEnd AND ${name}.halfDayEndPeriod='first_half' THEN '0' ELSE '1' END END`;
}

export async function requestLeave(
	graph: Graph,
	payload: unknown,
	actor: Actor,
) {
	const input = payload as {
		values: Record<string, unknown>;
		cycleStart: string;
		operationId?: string;
	};
	const values = recordValues(
		byLabel.get("LeaveRequest")!,
		{ ...input.values, userId: actor.id, status: "pending" },
		true,
	);
	const query = `MATCH (u:Employee {id:$actorId}) WHERE u.isActive=true
MATCH (kind:LeaveType {slug:$type})
MATCH (balance:LeaveBalance {userId:$actorId,leaveType:$type,cycleStart:$cycleStart}) WHERE balance.totalLimit-balance.used >= $days
OPTIONAL MATCH (existing:LeaveRequest {userId:$actorId}) WHERE existing.status IN ['pending','approved','pending_cancellation'] AND ${startSlot("existing")} <= $endSlot AND ${endSlot("existing")} >= $startSlot
WITH u,kind,balance,count(existing) AS overlap WHERE overlap=0
OPTIONAL MATCH (w:WfhRequest {userId:$actorId}) WHERE w.status IN ['pending','approved','pending_cancellation'] AND w.date+CASE WHEN w.isHalfDay AND w.halfDayPeriod='second_half' THEN '1' ELSE '0' END <= $endSlot AND w.date+CASE WHEN w.isHalfDay AND w.halfDayPeriod='first_half' THEN '0' ELSE '1' END >= $startSlot
WITH u,kind,balance,count(w) AS wfhOverlap WHERE wfhOverlap=0
CREATE (r:LeaveRequest) SET r += $values MERGE (u)-[:REQUESTED]->(r) MERGE (r)-[:OF_LEAVE_TYPE]->(kind) MERGE (r)-[:USES_BALANCE]->(balance)
RETURN collect({id:r.id}) AS rows`;
	const first =
		values.isHalfDayStart && values.halfDayStartPeriod === "second_half"
			? "1"
			: "0";
	const last =
		values.startDate === values.endDate
			? values.isHalfDayStart && values.halfDayStartPeriod === "first_half"
				? "0"
				: "1"
			: values.isHalfDayEnd && values.halfDayEndPeriod === "first_half"
				? "0"
				: "1";
	const result = await graph.query<{ rows: { id: string }[] }>(
		query,
		options({
			values,
			actorId: actor.id,
			type: values.leaveType,
			days: values.totalDays,
			cycleStart: input.cycleStart,
			startSlot: String(values.startDate) + first,
			endSlot: String(values.endDate) + last,
		}),
	);
	return result.data?.[0].rows ?? [];
}
