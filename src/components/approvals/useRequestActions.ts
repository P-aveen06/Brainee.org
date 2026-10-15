import { useRouter } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
	approveLeaveRequest,
	approveWfhRequest,
	rejectLeaveCancellation,
	rejectLeaveRequest,
	rejectWfhCancellation,
	rejectWfhRequest,
	revokeLeaveRequest,
	revokeWfhRequest,
} from "#/api/admin";

type RequestType = "leave" | "wfh";

interface RequestItem {
	id: string;
	type: RequestType;
	employeeName: string;
	status: string;
}

export function useRequestActions(request: RequestItem) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [dialogAction, setDialogAction] = useState<
		"reject" | "revoke" | "reject_cancellation" | null
	>(null);
	const [error, setError] = useState<string | null>(null);

	function handleApprove() {
		setError(null);
		startTransition(async () => {
			const result =
				request.type === "leave"
					? await approveLeaveRequest({ data: request.id })
					: await approveWfhRequest({ data: request.id });
			if ("error" in result && result.error) {
				setError(result.error);
				toast.error("Approval failed", { description: result.error });
			} else {
				toast.success(`${request.employeeName}'s request approved`);
				router.invalidate();
			}
		});
	}

	function handleRejectOrRevoke(reason: string) {
		setError(null);
		startTransition(async () => {
			const result =
				dialogAction === "reject"
					? request.type === "leave"
						? await rejectLeaveRequest({ data: { id: request.id, reason } })
						: await rejectWfhRequest({ data: { id: request.id, reason } })
					: dialogAction === "revoke"
						? request.type === "leave"
							? await revokeLeaveRequest({ data: { id: request.id, reason } })
							: await revokeWfhRequest({ data: { id: request.id, reason } })
						: request.type === "leave"
							? await rejectLeaveCancellation({
									data: { id: request.id, reason },
								})
							: await rejectWfhCancellation({
									data: { id: request.id, reason },
								});
			if ("error" in result && result.error) {
				setError(result.error);
				toast.error(
					`${dialogAction === "reject" ? "Rejection" : dialogAction === "revoke" ? "Revocation" : "Decline"} failed`,
					{ description: result.error },
				);
			} else {
				toast.success(
					`${request.employeeName}'s request ${
						dialogAction === "reject"
							? "rejected"
							: dialogAction === "revoke"
								? "revoked"
								: "cancellation declined"
					}`,
				);
				router.invalidate();
			}
			setDialogAction(null);
		});
	}

	return {
		isPending,
		error,
		setError,
		dialogAction,
		setDialogAction,
		handleApprove,
		handleRejectOrRevoke,
	};
}
