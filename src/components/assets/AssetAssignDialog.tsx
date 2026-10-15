import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { assignAsset, reassignAsset } from "@/api/assets";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface UserOption {
	id: string;
	name: string | null;
	email: string | null;
	role?: string | null;
}

interface DeploymentOption {
	id: string;
	userId: string;
	userName: string | null;
	roleTitle: string | null;
	startDate: string;
}

interface AssetAssignDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	asset: {
		id: string;
		assetTag: string;
		name: string;
		status?: string;
		currentAssignment?: {
			userId: string;
			userName: string | null;
		} | null;
	} | null;
	users: UserOption[];
	deployments: DeploymentOption[];
	today: string;
	initialUserId?: string;
	onSuccess: () => void;
}

export function AssetAssignDialog({
	open,
	onOpenChange,
	asset,
	users,
	deployments,
	today,
	initialUserId,
	onSuccess,
}: AssetAssignDialogProps) {
	const [isPending, startTransition] = useTransition();

	const isReassign = Boolean(asset?.currentAssignment?.userId);

	const [userId, setUserId] = useState("");
	const [clientDeploymentId, setClientDeploymentId] = useState<string>("none");
	const [assignedDate, setAssignedDate] = useState(today);
	const [conditionOut, setConditionOut] = useState<"new" | "good" | "fair">(
		"good",
	);
	const [notes, setNotes] = useState("");

	useEffect(() => {
		setAssignedDate(today);
		setConditionOut("good");
		setNotes("");
		setClientDeploymentId("none");
		if (initialUserId) {
			setUserId(initialUserId);
		} else if (users.length > 0) {
			// Pick first user that is not current assignee
			const candidate = users.find(
				(u) => u.id !== asset?.currentAssignment?.userId,
			);
			setUserId(candidate?.id || users[0].id);
		}
	}, [asset, users, today, initialUserId]);

	// Filter deployments for the selected user
	const userDeployments = deployments.filter((d) => d.userId === userId);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!asset || !userId) {
			toast.error("Please select an employee.");
			return;
		}

		startTransition(async () => {
			try {
				if (isReassign) {
					const res = await reassignAsset({
						data: {
							assetId: asset.id,
							newUserId: userId,
							clientDeploymentId:
								clientDeploymentId === "none" ? null : clientDeploymentId,
							reassignDate: assignedDate,
							conditionOut,
							notes: notes.trim() || null,
						},
					});

					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success(`Asset reassigned successfully`);
						onOpenChange(false);
						onSuccess();
					}
				} else {
					const res = await assignAsset({
						data: {
							assetId: asset.id,
							userId,
							clientDeploymentId:
								clientDeploymentId === "none" ? null : clientDeploymentId,
							assignedDate,
							conditionOut,
							notes: notes.trim() || null,
						},
					});

					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success(`Asset assigned to employee`);
						onOpenChange(false);
						onSuccess();
					}
				}
			} catch (_err) {
				toast.error("Failed to process assignment");
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{isReassign ? "Reassign Asset" : "Assign Asset / Account"}
					</DialogTitle>
					<DialogDescription>
						{isReassign ? (
							<>
								Transfer <strong>{asset?.assetTag}</strong> ({asset?.name}) from{" "}
								<strong>{asset?.currentAssignment?.userName}</strong> to another
								colleague.
							</>
						) : (
							<>
								Check out <strong>{asset?.assetTag}</strong> ({asset?.name}) to
								an employee.
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4.5 py-1">
					{/* Target Employee */}
					<div className="space-y-1.5">
						<Label htmlFor="employee">
							{isReassign ? "Transfer To Employee" : "Assign To Employee"} *
						</Label>
						<Select
							value={userId}
							onValueChange={(val) => {
								if (val) setUserId(val);
							}}
						>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Select employee">
									{(() => {
										const u = users.find((user) => user.id === userId);
										return u
											? `${u.name || "Unknown"} (${u.email})`
											: "Select employee";
									})()}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{users.map((u) => (
									<SelectItem
										key={u.id}
										value={u.id}
										disabled={u.id === asset?.currentAssignment?.userId}
									>
										{u.name || "Unknown"} ({u.email})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Optional Client Deployment Context */}
					{userDeployments.length > 0 && (
						<div className="space-y-1.5">
							<Label htmlFor="clientDeployment">
								Client Deployment Context (Optional)
							</Label>
							<Select
								value={clientDeploymentId}
								onValueChange={(val) => {
									if (val) setClientDeploymentId(val);
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select deployment">
										{(() => {
											if (
												!clientDeploymentId ||
												clientDeploymentId === "none"
											) {
												return "None (General / Internal Brainee.org work)";
											}
											const d = userDeployments.find(
												(dep) => dep.id === clientDeploymentId,
											);
											return d
												? `${d.roleTitle || "Deployed"} (Since ${d.startDate})`
												: "Select deployment";
										})()}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">
										None (General / Internal Brainee.org work)
									</SelectItem>
									{userDeployments.map((d) => (
										<SelectItem key={d.id} value={d.id}>
											{d.roleTitle || "Deployed"} (Since {d.startDate})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{/* Assignment Date & Condition */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="assignedDate">Assignment Date</Label>
							<Input
								id="assignedDate"
								type="date"
								value={assignedDate}
								onChange={(e) => setAssignedDate(e.target.value)}
								required
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="conditionOut">Condition at Checkout</Label>
							<Select
								value={conditionOut}
								onValueChange={(val) => {
									if (val === "new" || val === "good" || val === "fair") {
										setConditionOut(val);
									}
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Condition">
										{(() => {
											if (conditionOut === "new") {
												return (
													<div className="flex items-center gap-2">
														<span className="size-2 rounded-full bg-success/80 shrink-0" />
														<span>Brand New (Unopened)</span>
													</div>
												);
											}
											if (conditionOut === "good") {
												return (
													<div className="flex items-center gap-2">
														<span className="size-2 rounded-full bg-success shrink-0" />
														<span>Good (Clean / Working)</span>
													</div>
												);
											}
											if (conditionOut === "fair") {
												return (
													<div className="flex items-center gap-2">
														<span className="size-2 rounded-full bg-warning shrink-0" />
														<span>Fair (Minor Wear)</span>
													</div>
												);
											}
											return conditionOut;
										})()}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="new">
										<div className="flex items-center gap-2">
											<span className="size-2 rounded-full bg-success/80 shrink-0" />
											<span>Brand New (Unopened)</span>
										</div>
									</SelectItem>
									<SelectItem value="good">
										<div className="flex items-center gap-2">
											<span className="size-2 rounded-full bg-success shrink-0" />
											<span>Good (Clean / Working)</span>
										</div>
									</SelectItem>
									<SelectItem value="fair">
										<div className="flex items-center gap-2">
											<span className="size-2 rounded-full bg-warning shrink-0" />
											<span>Fair (Minor Wear)</span>
										</div>
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Notes */}
					<div className="space-y-1.5">
						<Label htmlFor="assignNotes">Assignment Notes</Label>
						<Textarea
							id="assignNotes"
							rows={2}
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Accessories included, charger serial, handover notes..."
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending
								? isReassign
									? "Reassigning..."
									: "Assigning..."
								: isReassign
									? "Confirm Transfer"
									: "Confirm Checkout"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
