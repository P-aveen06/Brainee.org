import { useRouter } from "@tanstack/react-router";
import { AlertCircle, Check } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getLeaveBalancesForUser, updateLeaveBalance } from "#/api/admin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type LeaveBalance = {
	id: string;
	leave_type: string;
	total_limit: number;
	used: number;
	cycle_start: string;
	cycle_end: string;
};

type SystemLeaveType = {
	id: string;
	name: string;
	slug: string;
	default_days: number;
};

export function LeaveBalanceEditor({
	userId,
	year,
}: {
	userId: string;
	year: number;
}) {
	const router = useRouter();
	const [balances, setBalances] = useState<Record<string, LeaveBalance>>({});
	const [activeLeaveTypes, setActiveLeaveTypes] = useState<SystemLeaveType[]>(
		[],
	);
	const [loading, setLoading] = useState(true);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	// Local state for edits
	const [edits, setEdits] = useState<Record<string, string>>({});

	useEffect(() => {
		async function fetchData() {
			setLoading(true);
			setError(null);

			try {
				const result = await getLeaveBalancesForUser({ data: userId });
				if (result && "leaveTypes" in result) {
					setActiveLeaveTypes(result.leaveTypes);

					const balanceMap: Record<string, LeaveBalance> = {};
					result.balances.forEach((b: LeaveBalance) => {
						balanceMap[b.leave_type] = b;
					});

					setBalances(balanceMap);

					// Initialize edits with current limits or default days
					const initialEdits: Record<string, string> = {};
					result.leaveTypes.forEach((type: SystemLeaveType) => {
						initialEdits[type.slug] =
							balanceMap[type.slug]?.total_limit?.toString() ||
							type.default_days.toString();
					});
					setEdits(initialEdits);
				}
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to load balances",
				);
			}
			setLoading(false);
		}

		fetchData();
	}, [userId]);

	const handleUpdate = (type: string) => {
		setError(null);
		setSuccessMsg(null);

		const newLimit = parseFloat(edits[type]);
		if (Number.isNaN(newLimit) || newLimit < 0) {
			setError(`Invalid limit for ${type}`);
			return;
		}

		startTransition(async () => {
			const result = await updateLeaveBalance({
				data: {
					userId,
					leaveType: type,
					year,
					newLimit,
				},
			});
			if ("error" in result && result.error) {
				setError(result.error);
				toast.error("Balance update failed", { description: result.error });
			} else {
				setSuccessMsg(`Updated ${type} balance to ${newLimit} days.`);
				toast.success(`${type} balance updated to ${newLimit} days`);
				router.invalidate();
				// Update local balance state
				setBalances((prev) => ({
					...prev,
					[type]: {
						...prev[type],
						total_limit: newLimit,
						used: prev[type]?.used || 0,
						cycle_start: prev[type]?.cycle_start || "",
						cycle_end: prev[type]?.cycle_end || "",
					},
				}));
			}
		});
	};

	if (loading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{error && (
				<Alert variant="destructive" className="py-2 px-3">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription className="text-xs">{error}</AlertDescription>
				</Alert>
			)}
			{successMsg && (
				<Alert className="py-2 px-3 bg-pale-green text-accent border-accent/20">
					<Check className="h-4 w-4" />
					<AlertDescription className="text-xs">{successMsg}</AlertDescription>
				</Alert>
			)}

			{activeLeaveTypes.map((type) => {
				const balance = balances[type.slug];
				const used = balance?.used || 0;

				return (
					<div
						key={type.slug}
						className="p-3 border rounded-md space-y-3 bg-card"
					>
						<div className="flex justify-between items-center">
							<div className="space-y-0.5">
								<Label className="capitalize text-sm font-medium">
									{type.name}
								</Label>
								{balance?.cycle_start && balance?.cycle_end ? (
									<p className="text-xs text-muted-foreground">
										Cycle: {new Date(balance.cycle_start).toLocaleDateString()}{" "}
										- {new Date(balance.cycle_end).toLocaleDateString()}
									</p>
								) : (
									<p className="text-xs text-muted-foreground">
										{balance
											? "Cycle: Not set (Save dates to calculate)"
											: "Status: Not Assigned"}
									</p>
								)}
							</div>
							<div className="text-xs font-medium text-muted-foreground">
								<span className="text-foreground">{used}</span> used
							</div>
						</div>
						<div className="flex items-end gap-3">
							<div className="space-y-1.5 flex-1">
								<Label className="text-xs text-muted-foreground">
									Leave Count per Person
								</Label>
								<Input
									type="number"
									min={used}
									step="0.5"
									value={edits[type.slug] || ""}
									onChange={(e) =>
										setEdits({ ...edits, [type.slug]: e.target.value })
									}
									disabled={isPending}
								/>
							</div>
							<Button
								size="sm"
								variant={balance ? "secondary" : "default"}
								onClick={() => handleUpdate(type.slug)}
								disabled={
									isPending ||
									(!!balance &&
										parseFloat(edits[type.slug]) === balance.total_limit)
								}
								className="rounded-full"
							>
								{balance ? "Update" : "Assign"}
							</Button>
						</div>
					</div>
				);
			})}
		</div>
	);
}
