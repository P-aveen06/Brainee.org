import { Check, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { logTimesheet } from "#/api/timesheets";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { getTodayIsoDate } from "#/lib/leave-policy";

/** Inline "log today's hours" control for the hero. */
export function HeroQuickLog({
	standardHours,
	existingLog,
	onChanged,
}: {
	standardHours: number;
	existingLog: { id: string; hours: number } | null;
	onChanged: () => void;
}) {
	const [editing, setEditing] = useState(!existingLog);
	const [hours, setHours] = useState(
		String(existingLog?.hours ?? standardHours),
	);
	const [isPending, startTransition] = useTransition();

	function submit(e: React.FormEvent) {
		e.preventDefault();
		startTransition(async () => {
			const result = await logTimesheet({
				data: { date: getTodayIsoDate(), hours: Number(hours) },
			});
			if (result && "error" in result && result.error) {
				toast.error("Timesheet failed", { description: result.error });
				return;
			}
			toast.success("Hours logged");
			setEditing(false);
			onChanged();
		});
	}

	if (!editing && existingLog) {
		return (
			<div className="flex h-9 items-center gap-2 rounded-xl bg-status-logged/20 pr-1 pl-3 text-[13px] text-status-logged-foreground">
				<Check className="size-4" aria-hidden="true" />
				<span>
					Logged <strong>{existingLog.hours}h</strong> today
				</span>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Edit today's hours"
					onClick={() => {
						setHours(String(existingLog.hours));
						setEditing(true);
					}}
				>
					<Pencil />
				</Button>
			</div>
		);
	}

	return (
		<form onSubmit={submit} className="flex items-center gap-2">
			<Input
				type="number"
				value={hours}
				onChange={(e) => setHours(e.target.value)}
				min={0}
				max={24}
				step={0.5}
				required
				aria-label="Hours worked today"
				className="w-20"
			/>
			<Button type="submit" variant="outline" disabled={isPending}>
				{isPending ? "Saving..." : existingLog ? "Update" : "Log hours"}
			</Button>
			{existingLog && (
				<Button type="button" variant="ghost" onClick={() => setEditing(false)}>
					Cancel
				</Button>
			)}
		</form>
	);
}
