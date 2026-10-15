import { useRouter } from "@tanstack/react-router";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateEmployeeRole, updateEmployeeSettings } from "#/api/admin";

type UserRow = {
	id: string;
	name: string | null;
	email: string | null;
	role: string | null;
	standard_hours: number | null;
	peer_lead_id: string | null;
	join_date: string | null;
	birthday: string | null;
};

const ROLES = ["user", "lead", "admin", "hr"] as const;
type Role = (typeof ROLES)[number];

function isRole(value: string): value is Role {
	return ROLES.includes(value as Role);
}

function normalizeRole(value: string | null | undefined): Role {
	const role = value ?? "";
	return isRole(role) ? role : "user";
}

interface UseEmployeeEditProps {
	user: UserRow | null;
	onOpenChange: (open: boolean) => void;
}

export function useEmployeeEdit({ user, onOpenChange }: UseEmployeeEditProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	// Form state
	const [role, setRole] = useState<Role>(normalizeRole(user?.role));
	const [standardHours, setStandardHours] = useState(
		user?.standard_hours?.toString() || "8",
	);
	const [peerLeadId, setPeerLeadId] = useState<string>(
		user?.peer_lead_id || "none",
	);
	const [joinDate, setJoinDate] = useState<string>(user?.join_date || "");
	const [birthday, setBirthday] = useState<string>(user?.birthday || "");

	// Sync state when user changes or sheet opens
	useEffect(() => {
		if (user) {
			setRole(normalizeRole(user.role));
			setStandardHours(user.standard_hours?.toString() || "8");
			setPeerLeadId(user.peer_lead_id || "none");
			setJoinDate(user.join_date || "");
			setBirthday(user.birthday || "");
			setError(null);
		}
	}, [user]);

	function handleSave() {
		if (!user) return;
		setError(null);

		const hours = parseFloat(standardHours);
		if (Number.isNaN(hours) || hours < 1 || hours > 24) {
			setError("Standard hours must be between 1 and 24.");
			return;
		}

		startTransition(async () => {
			// 1. Update settings
			const settingsResult = await updateEmployeeSettings({
				data: {
					userId: user.id,
					standardHours: hours,
					peerLeadId: peerLeadId === "none" ? null : peerLeadId,
					joinDate: joinDate || null,
					birthday: birthday || null,
				},
			});

			if ("error" in settingsResult && settingsResult.error) {
				setError(settingsResult.error);
				toast.error("Update failed", { description: settingsResult.error });
				return;
			}

			// 2. Update role if changed
			if (role !== user.role) {
				const roleResult = await updateEmployeeRole({
					data: {
						userId: user.id,
						newRole: role,
					},
				});
				if ("error" in roleResult && roleResult.error) {
					setError(roleResult.error);
					toast.error("Role update failed", { description: roleResult.error });
					return;
				}
			}

			toast.success("Employee updated");
			router.invalidate();
			onOpenChange(false);
		});
	}

	return {
		isPending,
		error,
		setError,
		role,
		setRole,
		standardHours,
		setStandardHours,
		peerLeadId,
		setPeerLeadId,
		joinDate,
		setJoinDate,
		birthday,
		setBirthday,
		handleSave,
	};
}
