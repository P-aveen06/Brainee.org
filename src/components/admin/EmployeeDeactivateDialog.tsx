"use client";

import { AlertTriangle, Laptop, Loader2, UserMinus, Users } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	deactivateEmployee,
	getEmployeeDeactivationPreview,
} from "@/api/employees";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { DeactivationBlockersBanner } from "./DeactivationBlockersBanner";
import { DeactivationSuccessorFields } from "./DeactivationSuccessorFields";

interface UserOption {
	id: string;
	name: string | null;
}

interface EmployeeDeactivateDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	employee: { id: string; name: string | null } | null;
	allUsers: UserOption[];
	onSuccess: () => void;
}

type Preview = Awaited<ReturnType<typeof getEmployeeDeactivationPreview>>;
type PreviewOk = Extract<Preview, { canProceed: boolean }>;

export function EmployeeDeactivateDialog({
	open,
	onOpenChange,
	employee,
	allUsers,
	onSuccess,
}: EmployeeDeactivateDialogProps) {
	const [preview, setPreview] = useState<PreviewOk | null>(null);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);

	const [exitDate, setExitDate] = useState(() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	});
	const [exitReason, setExitReason] = useState("");
	const [reassignReportsTo, setReassignReportsTo] = useState<string>("");
	const [isPending, startTransition] = useTransition();

	const loadPreview = useCallback(async (userId: string) => {
		setIsLoadingPreview(true);
		setPreviewError(null);
		try {
			const res = await getEmployeeDeactivationPreview({
				data: { userId },
			});
			if ("error" in res) {
				setPreviewError(res.error || "Failed to load preview");
				setPreview(null);
			} else {
				setPreview(res as PreviewOk);
			}
		} catch (err) {
			setPreviewError(
				err instanceof Error
					? err.message
					: "Failed to load deactivation preview",
			);
			setPreview(null);
		} finally {
			setIsLoadingPreview(false);
		}
	}, []);

	useEffect(() => {
		if (open && employee) {
			setExitReason("");
			setReassignReportsTo("");
			loadPreview(employee.id);
		} else {
			setPreview(null);
			setPreviewError(null);
		}
	}, [open, employee, loadPreview]);

	const leadCandidates = allUsers.filter((u) => u.id !== employee?.id);
	const reportCount = preview?.directReports.length ?? 0;
	const blockers = preview?.blockers ?? [];
	const hasBlockers = blockers.length > 0;

	useEffect(() => {
		if (reportCount > 0 && leadCandidates.length > 0 && !reassignReportsTo) {
			setReassignReportsTo(leadCandidates[0].id);
		}
	}, [reportCount, leadCandidates, reassignReportsTo]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!employee) return;
		if (reportCount > 0 && !reassignReportsTo) {
			toast.error("Please pick a new lead for their direct reports.");
			return;
		}

		startTransition(async () => {
			try {
				const res = await deactivateEmployee({
					data: {
						userId: employee.id,
						exitDate,
						exitReason: exitReason.trim() || undefined,
						reassignReportsTo: reportCount > 0 ? reassignReportsTo : undefined,
					},
				});
				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success(`${employee.name || "Employee"} has been offboarded.`);
					onOpenChange(false);
					onSuccess();
				}
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to offboard employee.",
				);
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-destructive">
						<UserMinus className="size-5" />
						Offboard {employee?.name || "Employee"}
					</DialogTitle>
					<DialogDescription>
						Offboarding revokes all application access, reassigns direct
						reports, and marks assigned IT assets as unreturned pending
						check-in.
					</DialogDescription>
				</DialogHeader>

				{isLoadingPreview && (
					<div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
						<Loader2 className="size-4 animate-spin" />
						Checking open approvals, direct reports, and IT assets...
					</div>
				)}

				{previewError && (
					<Alert variant="destructive">
						<AlertTriangle className="size-4" />
						<AlertDescription>{previewError}</AlertDescription>
					</Alert>
				)}

				{!isLoadingPreview && !previewError && (
					<form onSubmit={handleSubmit} className="space-y-4.5 py-1">
						<DeactivationBlockersBanner
							blockers={blockers}
							ownedProjects={preview?.ownedProjects}
						/>

						{/* Successor Lead Selection Subcomponent */}
						<DeactivationSuccessorFields
							reportCount={reportCount}
							reassignReportsTo={reassignReportsTo}
							onReassignReportsToChange={setReassignReportsTo}
							leadCandidates={leadCandidates}
							directReports={preview?.directReports}
						/>

						<div className="space-y-1.5">
							<Label htmlFor="exitDate">
								Last working day <span className="text-destructive">*</span>
							</Label>
							<Input
								id="exitDate"
								type="date"
								value={exitDate}
								onChange={(e) => setExitDate(e.target.value)}
								required
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="exitReason">Reason (optional)</Label>
							<Textarea
								id="exitReason"
								value={exitReason}
								onChange={(e) => setExitReason(e.target.value)}
								placeholder="Resignation, end of contract, ..."
								rows={2}
								maxLength={500}
							/>
						</div>

						{preview && (
							<div className="space-y-2 border border-border bg-muted/40 p-3 text-xs">
								<p className="font-medium text-foreground">This will also:</p>
								<ul className="space-y-1 text-muted-foreground">
									<li className="flex items-center gap-2">
										<Users className="size-3.5 shrink-0" />
										{reportCount > 0
											? `Move ${reportCount} direct report(s) to the selected peer lead`
											: "Move no direct reports (they lead nobody)"}
									</li>
									<li className="flex items-center gap-2">
										<Laptop className="size-3.5 shrink-0" />
										{preview.heldAssets.length > 0
											? `Flag ${preview.heldAssets.length} physical asset(s) as unreturned for IT return collection`
											: "No IT assets currently assigned"}
									</li>
								</ul>
							</div>
						)}

						<DialogFooter className="pt-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={isPending}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="destructive"
								disabled={isPending || hasBlockers}
							>
								{isPending ? "Offboarding..." : "Offboard Employee"}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
