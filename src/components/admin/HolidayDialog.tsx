"use client";

import { useRouter } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createHoliday, deleteHoliday, updateHoliday } from "#/api/admin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type HolidayRow = {
	id: string;
	date: string;
	name: string;
	description: string | null;
	year: number;
};

type HolidayDialogProps = {
	holiday: HolidayRow | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	year: number;
};

export function HolidayDialog({
	holiday,
	open,
	onOpenChange,
}: HolidayDialogProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	// Form state
	const [date, setDate] = useState(holiday?.date || "");
	const [name, setName] = useState(holiday?.name || "");
	const [description, setDescription] = useState(holiday?.description || "");
	const [isRecurring, setIsRecurring] = useState(holiday?.year === 0);

	function handleSave() {
		setError(null);

		if (!date) {
			setError("Date is required.");
			return;
		}
		if (name.length < 2) {
			setError("Name must be at least 2 characters.");
			return;
		}

		startTransition(async () => {
			const computedYear = isRecurring ? 0 : new Date(date).getFullYear();
			const result = holiday
				? await updateHoliday({
						data: {
							id: holiday.id,
							date,
							name,
							description: description || null,
							year: computedYear,
						},
					})
				: await createHoliday({
						data: {
							date,
							name,
							description: description || null,
							year: computedYear,
						},
					});

			if ("error" in result && result.error) {
				setError(result.error);
				toast.error(holiday ? "Update failed" : "Creation failed", {
					description: result.error,
				});
				return;
			}

			toast.success(holiday ? "Holiday updated" : "Holiday created");
			router.invalidate();
			onOpenChange(false);
		});
	}

	function handleDelete() {
		if (!holiday) return;

		if (
			!confirm(`Are you sure you want to delete the holiday "${holiday.name}"?`)
		) {
			return;
		}

		startTransition(async () => {
			const result = await deleteHoliday({ data: holiday.id });
			if ("error" in result && result.error) {
				setError(result.error);
				toast.error("Delete failed", { description: result.error });
				return;
			}
			toast.success("Holiday deleted");
			router.invalidate();
			onOpenChange(false);
		});
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-[425px]">
				<SheetHeader>
					<SheetTitle>{holiday ? "Edit Holiday" : "Add Holiday"}</SheetTitle>
					<SheetDescription>
						{holiday
							? "Modify existing holiday details."
							: "Create a new public holiday."}
					</SheetDescription>
				</SheetHeader>

				<SheetBody className="space-y-4">
					{error && (
						<Alert variant="destructive" role="alert">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<div className="space-y-2">
						<Label htmlFor="holidayDate">Date</Label>
						<DatePicker
							id="holidayDate"
							value={date}
							onChange={setDate}
							disabled={isPending}
						/>
					</div>

					<div className="flex items-center space-x-2 pt-1 pb-2">
						<Checkbox
							id="holidayRecurring"
							checked={isRecurring}
							onCheckedChange={(checked) => setIsRecurring(Boolean(checked))}
							disabled={isPending}
						/>
						<Label
							htmlFor="holidayRecurring"
							className="text-sm font-medium cursor-pointer"
						>
							Recurring (Happens every year)
						</Label>
					</div>

					<div className="space-y-2">
						<Label htmlFor="holidayName">Name</Label>
						<Input
							id="holidayName"
							placeholder="e.g. New Year's Day"
							value={name}
							onChange={(e) => setName(e.target.value)}
							disabled={isPending}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="holidayDescription">Description (Optional)</Label>
						<Textarea
							id="holidayDescription"
							placeholder="Optional details about this holiday..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							disabled={isPending}
						/>
					</div>
				</SheetBody>

				<SheetFooter className="flex-row items-center sm:justify-between">
					<div className="mr-auto">
						{holiday && (
							<Button
								variant="destructive"
								onClick={handleDelete}
								disabled={isPending}
								type="button"
								className="rounded-full"
							>
								Delete
							</Button>
						)}
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
							type="button"
						>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							disabled={isPending}
							aria-busy={isPending}
							className="rounded-full"
						>
							{isPending ? "Saving..." : "Save"}
						</Button>
					</div>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
