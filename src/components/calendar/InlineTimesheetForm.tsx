import { useRouter } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { logTimesheet } from "#/api/timesheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InlineTimesheetFormProps = {
	date: string;
	defaultHours?: number;
	standardHours?: number;
};

export function InlineTimesheetForm({
	date,
	defaultHours,
	standardHours = 8,
}: InlineTimesheetFormProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [isEditing, setIsEditing] = useState(defaultHours === undefined);
	const initialHours = String(defaultHours ?? standardHours);
	const [hours, setHours] = useState(initialHours);

	function startEditing() {
		setHours(initialHours);
		setSuccess(false);
		setIsEditing(true);
	}

	function cancelEditing() {
		setHours(initialHours);
		setIsEditing(false);
	}

	async function onSubmit(formData: FormData) {
		setError(null);
		setSuccess(false);
		startTransition(async () => {
			const dateVal = formData.get("date") as string;
			const hoursVal = formData.get("hours") as string;

			const result = await logTimesheet({
				data: {
					date: dateVal,
					hours: Number(hoursVal),
				},
			});

			if (result.error) {
				setError(result.error);
				toast.error("Timesheet failed", { description: result.error });
			} else {
				setSuccess(true);
				setIsEditing(false);
				toast.success("Hours logged successfully");
				router.invalidate();
			}
		});
	}

	if (!isEditing && !success) {
		return (
			<Button
				variant="outline"
				size="sm"
				className="mt-2 w-fit"
				onClick={startEditing}
			>
				Update Timesheet
			</Button>
		);
	}

	return (
		<div className="mt-2 w-full">
			{success && (
				<div className="mb-2 p-2 text-sm text-status-logged-foreground bg-status-logged rounded-md">
					Hours logged successfully!
				</div>
			)}
			<form action={onSubmit} className="flex flex-col gap-2">
				<input type="hidden" name="date" value={date} />
				<div className="flex gap-2 items-center">
					<Input
						type="number"
						name="hours"
						value={hours}
						onChange={(event) => setHours(event.target.value)}
						min={0}
						max={24}
						step={0.5}
						required
						className="w-24 bg-background"
					/>
					<span className="text-sm text-muted-foreground mr-2">hours</span>
					<Button type="submit" disabled={isPending} size="sm">
						{isPending ? "Saving..." : "Save"}
					</Button>
					{defaultHours !== undefined && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={cancelEditing}
							disabled={isPending}
						>
							Cancel
						</Button>
					)}
				</div>
				{error && <p className="text-sm text-destructive">{error}</p>}
			</form>
		</div>
	);
}
