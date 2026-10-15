/**
 * Pure rules governing an employee departure.
 *
 * Deactivation is deliberately soft. A hard delete is impossible anyway:
 * `audit_logs.actor_id`, `leave_requests.approved_by`, `asset_assignments.assigned_by_user_id`
 * and `users.peer_lead_id` all reference users with ON DELETE no action, while
 * `timesheets` / `leave_balances` / `notifications` cascade and would destroy history.
 *
 * These functions take a plain snapshot so they can be unit tested without a database.
 */

export type Role = "user" | "lead" | "admin";

export type DeactivationBlocker =
	| { code: "self_deactivation"; message: string }
	| { code: "last_admin"; message: string }
	| { code: "reports_need_reassignment"; message: string; reportCount: number }
	| { code: "invalid_reassign_target"; message: string }
	| { code: "owns_projects"; message: string; projectIds: string[] };

export interface DeactivationSnapshot {
	/** The user being deactivated. */
	targetUserId: string;
	targetRole: Role;
	targetIsActive: boolean;
	/** The admin performing the deactivation. */
	actorUserId: string;
	/** Ids of users whose `peer_lead_id` points at the target. */
	directReportIds: string[];
	/** The target's own lead, used when the successor is one of their reports. */
	targetPeerLeadId: string | null;
	/** Active admins other than the target. */
	otherActiveAdminCount: number;
	/** Where the target's direct reports should be moved, if anywhere. */
	reassignReportsTo: string | null;
	/** Whether `reassignReportsTo` resolves to an active user (caller looks this up). */
	reassignTargetIsActive: boolean;
	/** Ids of active or in-flight projects owned by the target user. */
	ownedProjectIds?: string[];
}

export interface ReportReassignment {
	/** Reports that move to `newLeadId`. */
	userIds: string[];
	newLeadId: string | null;
	/**
	 * Set only when the chosen successor was themselves one of the reports —
	 * a promotion from within the team. They cannot become their own lead, so
	 * they move up to the departing person's lead instead (which may be null,
	 * making them a root of the org chart).
	 */
	successorId: string | null;
	successorNewLeadId: string | null;
}

export interface DeactivationAssessment {
	blockers: DeactivationBlocker[];
	canProceed: boolean;
	/** Reports to move, and where. Empty when there is nothing to move. */
	reportsToReassign: ReportReassignment;
}

/**
 * Decides whether a deactivation may proceed, and what must happen alongside it.
 *
 * The direct-reports rule is the important one: a departed lead currently keeps
 * receiving their reports' approval routing and notifications forever, and
 * `getCurrentAppUser` re-derives their `lead` role from the org chart on every
 * request — so clearing `role` alone does nothing. The reports must move.
 */
export function assessDeactivation(
	snapshot: DeactivationSnapshot,
): DeactivationAssessment {
	const blockers: DeactivationBlocker[] = [];

	if (snapshot.targetUserId === snapshot.actorUserId) {
		blockers.push({
			code: "self_deactivation",
			message: "You cannot deactivate your own account.",
		});
	}

	if (snapshot.targetRole === "admin" && snapshot.otherActiveAdminCount === 0) {
		blockers.push({
			code: "last_admin",
			message: "Cannot deactivate the last active admin in the system.",
		});
	}

	const reportCount = snapshot.directReportIds.length;
	if (reportCount > 0) {
		if (!snapshot.reassignReportsTo) {
			blockers.push({
				code: "reports_need_reassignment",
				message: `This person leads ${reportCount} employee${
					reportCount === 1 ? "" : "s"
				}. Choose a new peer lead for them before deactivating.`,
				reportCount,
			});
		} else if (
			snapshot.reassignReportsTo === snapshot.targetUserId ||
			!snapshot.reassignTargetIsActive
		) {
			blockers.push({
				code: "invalid_reassign_target",
				message: "The new peer lead must be a different, active employee.",
			});
		}
	}

	const ownedProjects = snapshot.ownedProjectIds ?? [];
	if (ownedProjects.length > 0) {
		blockers.push({
			code: "owns_projects",
			message: `This person owns ${ownedProjects.length} project${
				ownedProjects.length === 1 ? "" : "s"
			}. Transfer project ownership before deactivating.`,
			projectIds: ownedProjects,
		});
	}

	const successorIsAReport =
		reportCount > 0 &&
		snapshot.reassignReportsTo !== null &&
		snapshot.directReportIds.includes(snapshot.reassignReportsTo);

	return {
		blockers,
		canProceed: blockers.length === 0,
		reportsToReassign: {
			userIds:
				reportCount > 0
					? snapshot.directReportIds.filter(
							(id) => id !== snapshot.reassignReportsTo,
						)
					: [],
			newLeadId: reportCount > 0 ? snapshot.reassignReportsTo : null,
			successorId: successorIsAReport ? snapshot.reassignReportsTo : null,
			successorNewLeadId: successorIsAReport ? snapshot.targetPeerLeadId : null,
		},
	};
}

export type AccessState = "anonymous" | "active" | "deactivated";

/**
 * Distinguishes "not signed in" from "signed in but no longer employed".
 *
 * These need different destinations: sending a deactivated user to sign-in
 * loops, because password sign-in can still re-authenticate them (deactivation here is
 * an app-level state, independent of login credentials).
 */
export function resolveAccessState(
	user: { isActive: boolean } | null | undefined,
): AccessState {
	if (!user) return "anonymous";
	return user.isActive ? "active" : "deactivated";
}
