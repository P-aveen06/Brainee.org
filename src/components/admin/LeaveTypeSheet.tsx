import { useRouter } from "@tanstack/react-router";
import { AlertCircle, Check } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createLeaveType, updateLeaveType } from "#/api/admin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PillToggle } from "@/components/ui/pill-toggle";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { AdvancePolicyForm } from "./AdvancePolicyForm";

type LeaveTypeRow = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	default_days: number;
	accrual_per_year?: number;
	created_at: string;
	apply_before_days?: number;
	apply_before_days_extended?: number;
	extended_limit_trigger?: number;
};

type EmployeeOption = {
	id: string;
	name: string;
	email: string;
	birthday?: string | null;
};

interface LeaveTypeSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedType: LeaveTypeRow | null;
	employees: EmployeeOption[];
	onSave: (saved: LeaveTypeRow) => void;
}

export function LeaveTypeSheet({
	open,
	onOpenChange,
	selectedType,
	employees,
	onSave,
}: LeaveTypeSheetProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	const [name, setName] = useState(selectedType?.name || "");
	const [slug, setSlug] = useState(selectedType?.slug || "");
	const [defaultDays, setDefaultDays] = useState(
		selectedType?.default_days.toString() || "0",
	);
	const [enableAccrual, setEnableAccrual] = useState(
		(selectedType?.accrual_per_year ?? 0) > 0,
	);
	const [accrualPerYear, setAccrualPerYear] = useState(
		(selectedType?.accrual_per_year ?? 0).toString(),
	);
	const [description, setDescription] = useState(
		selectedType?.description || "",
	);
	const [applyBeforeDays, setApplyBeforeDays] = useState(
		(selectedType?.apply_before_days ?? 0).toString(),
	);
	const [applyBeforeDaysExtended, setApplyBeforeDaysExtended] = useState(
		(selectedType?.apply_before_days_extended ?? 0).toString(),
	);
	const [extendedLimitTrigger, setExtendedLimitTrigger] = useState(
		(selectedType?.extended_limit_trigger ?? 0).toString(),
	);
	const [assignmentMode, setAssignmentMode] = useState<"all" | "selected">(
		"all",
	);
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

	const initialEnablePolicy =
		(selectedType?.apply_before_days ?? 0) > 0 ||
		(selectedType?.apply_before_days_extended ?? 0) > 0 ||
		(selectedType?.extended_limit_trigger ?? 0) > 0;

	const [enablePolicy, setEnablePolicy] = useState(initialEnablePolicy);

	const handleNameChange = (val: string) => {
		setName(val);
		if (
			!slug ||
			slug ===
				name
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/(^-|-$)+/g, "")
		) {
			setSlug(
				val
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/(^-|-$)+/g, ""),
			);
		}
	};

	const handleCreate = async () => {
		setError(null);
		if (!name || !slug) {
			setError("Name and slug are required.");
			return;
		}
		const days = parseFloat(defaultDays);
		if (Number.isNaN(days) || days < 0) {
			setError("Default days must be a positive number.");
			return;
		}
		if (!selectedType?.id && assignmentMode === "selected") {
			if (selectedUserIds.length === 0) {
				setError("Select at least one employee.");
				return;
			}
		}

		const accrual = enableAccrual ? parseFloat(accrualPerYear) || 0 : 0;
		const abDays = enablePolicy ? parseInt(applyBeforeDays, 10) || 0 : 0;
		const abExtDays = enablePolicy
			? parseInt(applyBeforeDaysExtended, 10) || 0
			: 0;
		const extTrigger = enablePolicy
			? parseInt(extendedLimitTrigger, 10) || 0
			: 0;

		startTransition(async () => {
			const result = selectedType?.id
				? await updateLeaveType({
						data: {
							id: selectedType.id,
							name,
							slug,
							defaultDays: days,
							accrualPerYear: accrual,
							description: description || null,
							applyBeforeDays: abDays,
							applyBeforeDaysExtended: abExtDays,
							extendedLimitTrigger: extTrigger,
						},
					})
				: await createLeaveType({
						data: {
							name,
							slug,
							defaultDays: days,
							accrualPerYear: accrual,
							description: description || null,
							applyBeforeDays: abDays,
							applyBeforeDaysExtended: abExtDays,
							extendedLimitTrigger: extTrigger,
							assignToAll: assignmentMode === "all",
							assignedUserIds: selectedUserIds,
						},
					});

			if ("error" in result && result.error) {
				setError(result.error);
				toast.error(selectedType?.id ? "Update failed" : "Creation failed", {
					description: result.error,
				});
				return;
			}

			if ("data" in result && result.data) {
				onSave({
					id: result.data.id,
					name: result.data.name,
					slug: result.data.slug,
					description: result.data.description,
					default_days: Number(result.data.defaultDays),
					accrual_per_year: Number(result.data.accrualPerYear ?? 0),
					created_at: result.data.createdAt
						? new Date(result.data.createdAt).toISOString()
						: new Date().toISOString(),
					apply_before_days: result.data.applyBeforeDays ?? undefined,
					apply_before_days_extended:
						result.data.applyBeforeDaysExtended ?? undefined,
					extended_limit_trigger: result.data.extendedLimitTrigger ?? undefined,
				});
			}
			toast.success(
				selectedType?.id ? "Leave type updated" : "Leave type created",
			);
			router.invalidate();
			onOpenChange(false);
		});
	};

	const toggleAssignedUser = (userId: string) => {
		setSelectedUserIds((current) =>
			current.includes(userId)
				? current.filter((id) => id !== userId)
				: [...current, userId],
		);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>
						{selectedType?.id ? "Edit Leave Type" : "Create Leave Type"}
					</SheetTitle>
					<SheetDescription>
						{selectedType?.id
							? "Update the configuration for this leave category."
							: "Define a new category of leave that employees can request."}
					</SheetDescription>
				</SheetHeader>

				<SheetBody className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							placeholder="e.g. Exam Leave"
							value={name}
							onChange={(e) => handleNameChange(e.target.value)}
							disabled={isPending}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="defaultDays">Default Days per Year</Label>
						<Input
							id="defaultDays"
							type="number"
							min="0"
							step="0.5"
							value={defaultDays}
							onChange={(e) => setDefaultDays(e.target.value)}
							disabled={isPending}
						/>
					</div>

					<div className="space-y-3 border-t border-border pt-4">
						<label
							htmlFor="enable-accrual"
							className="flex cursor-pointer items-center gap-2 select-none"
						>
							<Checkbox
								id="enable-accrual"
								checked={enableAccrual}
								onCheckedChange={(checked) => {
									const isChecked = Boolean(checked);
									setEnableAccrual(isChecked);
									if (isChecked) {
										if (!parseFloat(accrualPerYear)) setAccrualPerYear("1");
									} else {
										setAccrualPerYear("0");
									}
								}}
								disabled={isPending}
							/>
							<span className="text-sm font-semibold">
								Accrues with years of service
							</span>
						</label>

						{enableAccrual && (
							<div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
								<span className="min-w-24 flex-1 text-sm font-medium text-foreground">
									Extra days per completed year
								</span>
								<Input
									type="number"
									min="0"
									step="0.5"
									className="h-9 w-20 text-center"
									value={accrualPerYear}
									onChange={(e) => setAccrualPerYear(e.target.value)}
									disabled={isPending}
								/>
							</div>
						)}
					</div>

					<AdvancePolicyForm
						enablePolicy={enablePolicy}
						setEnablePolicy={setEnablePolicy}
						applyBeforeDays={applyBeforeDays}
						setApplyBeforeDays={setApplyBeforeDays}
						extendedLimitTrigger={extendedLimitTrigger}
						setExtendedLimitTrigger={setExtendedLimitTrigger}
						applyBeforeDaysExtended={applyBeforeDaysExtended}
						setApplyBeforeDaysExtended={setApplyBeforeDaysExtended}
						isPending={isPending}
					/>

					{!selectedType?.id && (
						<div className="space-y-3 border-t border-border pt-4">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-semibold">Assign To</Label>
								<PillToggle
									items={[
										{ value: "all", label: "All Employees" },
										{ value: "selected", label: "Selected" },
									]}
									value={assignmentMode}
									onChange={(value) =>
										setAssignmentMode(value === "selected" ? "selected" : "all")
									}
								/>
							</div>

							{assignmentMode === "selected" && (
								<div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-2">
									{employees.length === 0 ? (
										<div className="px-3 py-6 text-center text-sm text-muted-foreground">
											No employees available.
										</div>
									) : (
										employees.map((employee) => {
											const isSelected = selectedUserIds.includes(employee.id);

											return (
												<button
													key={employee.id}
													type="button"
													onClick={() => toggleAssignedUser(employee.id)}
													disabled={isPending}
													className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
														isSelected
															? "bg-primary text-primary-foreground"
															: "hover:bg-accent hover:text-accent-foreground"
													}`}
												>
													<span className="min-w-0">
														<span className="block truncate font-medium">
															{employee.name}
														</span>
														<span
															className={`block truncate text-xs ${
																isSelected
																	? "text-primary-foreground/70"
																	: "text-muted-foreground"
															}`}
														>
															{employee.email}
														</span>
													</span>
													{isSelected && <Check className="size-4 shrink-0" />}
												</button>
											);
										})
									)}
								</div>
							)}
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="desc">Description</Label>
						<Textarea
							id="desc"
							placeholder="Optional context about this leave type."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={isPending}
						/>
					</div>
				</SheetBody>

				<SheetFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
						className="rounded-full"
					>
						Cancel
					</Button>
					<Button
						onClick={handleCreate}
						disabled={isPending}
						className="rounded-full"
					>
						{isPending
							? "Saving..."
							: selectedType?.id
								? "Save Changes"
								: "Create Type"}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
