"use client";

import { useRouter } from "@tanstack/react-router";
import {
	type ReactElement,
	useCallback,
	useEffect,
	useRef,
	useState,
	useTransition,
} from "react";
import { toast } from "sonner";
import { applyForWfh } from "#/api/leaves";
import { getWfhQuota } from "#/api/wfh-policy";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { type DayPortion, getTodayIsoDate } from "@/lib/leave-policy";
import { isCurrentWfhQuotaRequest } from "@/lib/wfh-policy";

type WfhRequestSheetProps = {
	trigger?: ReactElement;
	initialDate?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

type WfhRequestFormProps = {
	initialDate?: string;
	className?: string;
};

export function WfhRequestForm({
	initialDate,
	className = "space-y-4",
}: WfhRequestFormProps) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [date, setDate] = useState(initialDate ?? getTodayIsoDate());
	const [dayPortion, setDayPortion] = useState<DayPortion>("full_day");
	const [quota, setQuota] = useState<{
		used: number;
		remaining: number;
		cycleStart: string;
		cycleEnd: string;
	} | null>(null);
	const [quotaError, setQuotaError] = useState<string | null>(null);
	const quotaRequestId = useRef(0);

	const refreshQuota = useCallback(async (selectedDate: string) => {
		const requestId = ++quotaRequestId.current;
		setQuota(null);
		setQuotaError(null);

		try {
			const result = await getWfhQuota({ data: { date: selectedDate } });
			if (!isCurrentWfhQuotaRequest(requestId, quotaRequestId.current)) {
				return;
			}
			if ("error" in result && result.error) {
				setQuotaError(result.error);
				return;
			}
			setQuota(result);
			setQuotaError(null);
		} catch {
			if (isCurrentWfhQuotaRequest(requestId, quotaRequestId.current)) {
				setQuotaError("Unable to load your WFH allowance right now.");
			}
		}
	}, []);

	useEffect(() => {
		void refreshQuota(date);
		return () => {
			quotaRequestId.current += 1;
		};
	}, [date, refreshQuota]);

	const handleSubmit = async (formData: FormData) => {
		setError(null);
		startTransition(async () => {
			const result = await applyForWfh({
				data: {
					date: date,
					day_portion: dayPortion,
					reason: formData.get("reason")?.toString() || "",
				},
			});
			if (result.error) {
				setError(result.error);
				toast.error("WFH request failed", { description: result.error });
				return;
			}

			toast.success("WFH request submitted");
			router.invalidate();
			setDayPortion("full_day");
			void refreshQuota(date);
		});
	};

	return (
		<form action={handleSubmit} className={className}>
			<input type="hidden" name="day_portion" value={dayPortion} />

			{error && <div className="text-sm text-destructive">{error}</div>}
			{quota ? (
				<div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
					<span className="font-medium">WFH allowance:</span> {quota.used} day
					{quota.used === 1 ? "" : "s"} used · {quota.remaining} day
					{quota.remaining === 1 ? "" : "s"} remaining
				</div>
			) : quotaError ? (
				<div className="text-sm text-muted-foreground">{quotaError}</div>
			) : (
				<div className="text-sm text-muted-foreground">
					Loading WFH allowance…
				</div>
			)}

			<div className="space-y-2">
				<Label htmlFor="wfh_date">Date</Label>
				<DatePicker id="wfh_date" name="date" value={date} onChange={setDate} />
			</div>

			<div className="space-y-2">
				<Label>Day Portion</Label>
				<Select
					value={dayPortion}
					onValueChange={(value) => {
						if (value) {
							setDayPortion(value as DayPortion);
						}
					}}
				>
					<SelectTrigger className="w-full">
						<SelectValue>
							{dayPortion === "full_day"
								? "Full Day"
								: dayPortion === "first_half"
									? "First Half"
									: "Second Half"}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="full_day">Full Day</SelectItem>
						<SelectItem value="first_half">First Half</SelectItem>
						<SelectItem value="second_half">Second Half</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-2">
				<Label htmlFor="wfh_reason">Reason (Optional)</Label>
				<Input id="wfh_reason" name="reason" maxLength={500} />
			</div>

			<Button type="submit" className="w-full" disabled={isPending}>
				{isPending ? "Submitting..." : "Submit Request"}
			</Button>
		</form>
	);
}

export function WfhRequestSheet({
	trigger,
	initialDate,
	open,
	onOpenChange,
}: WfhRequestSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			{trigger !== undefined ? (
				<SheetTrigger render={trigger}>Apply for WFH</SheetTrigger>
			) : !open && onOpenChange === undefined ? (
				<SheetTrigger render={<Button type="button" variant="outline" />}>
					Apply for WFH
				</SheetTrigger>
			) : null}
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Apply for WFH</SheetTitle>
				</SheetHeader>
				<SheetBody>
					<WfhRequestForm initialDate={initialDate} className="space-y-4" />
				</SheetBody>
			</SheetContent>
		</Sheet>
	);
}
