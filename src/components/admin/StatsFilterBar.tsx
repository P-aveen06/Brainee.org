import { useNavigate, useSearch } from "@tanstack/react-router";
import { endOfMonth, format, parseISO, startOfMonth, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface Employee {
	id: string;
	name: string;
}

interface StatsFilterBarProps {
	employees?: Employee[];
}

type StatsSearch = {
	userId?: string;
	status?: string;
	startDate?: string;
	endDate?: string;
};

export default function StatsFilterBar({
	employees: _employees,
}: StatsFilterBarProps = {}) {
	const navigate = useNavigate();
	const search = useSearch({ from: "/_authenticated/admin/stats" });

	const selectedStatus = search.status || "all";
	const startDateStr = search.startDate;
	const endDateStr = search.endDate;

	const dateRange: DateRange | undefined = startDateStr
		? {
				from: parseISO(startDateStr),
				to: endDateStr ? parseISO(endDateStr) : undefined,
			}
		: undefined;

	const updateFilters = (
		updates: Partial<Record<keyof StatsSearch, string | null>>,
	) => {
		navigate({
			to: "/admin/stats",
			search: (prev) => {
				const next: StatsSearch = {
					userId: prev.userId,
					status: prev.status,
					startDate: prev.startDate,
					endDate: prev.endDate,
				};
				Object.entries(updates).forEach(([key, value]) => {
					const searchKey = key as keyof StatsSearch;
					if (value) {
						next[searchKey] = value;
					} else {
						next[searchKey] = undefined;
					}
				});
				return next;
			},
		});
	};

	const handleDateRangeChange = (range: DateRange | undefined) => {
		if (!range) {
			updateFilters({ startDate: null, endDate: null });
			return;
		}

		const updates: Record<string, string | null> = {};
		if (range.from) {
			updates.startDate = format(range.from, "yyyy-MM-dd");
		} else {
			updates.startDate = null;
		}

		if (range.to) {
			updates.endDate = format(range.to, "yyyy-MM-dd");
		} else {
			updates.endDate = null;
		}

		updateFilters(updates);
	};

	const applyPreset = (preset: "7d" | "30d" | "month" | "all") => {
		const today = new Date();
		let from: Date | null = null;
		let to: Date | null = today;

		if (preset === "7d") {
			from = subDays(today, 7);
		} else if (preset === "30d") {
			from = subDays(today, 30);
		} else if (preset === "month") {
			from = startOfMonth(today);
			to = endOfMonth(today);
		} else if (preset === "all") {
			updateFilters({ startDate: null, endDate: null });
			return;
		}

		if (from && to) {
			updateFilters({
				startDate: format(from, "yyyy-MM-dd"),
				endDate: format(to, "yyyy-MM-dd"),
			});
		}
	};

	const today = new Date();
	const todayStr = format(today, "yyyy-MM-dd");
	const is7d =
		startDateStr === format(subDays(today, 7), "yyyy-MM-dd") &&
		endDateStr === todayStr;
	const is30d =
		(!startDateStr && !endDateStr) ||
		(startDateStr === format(subDays(today, 30), "yyyy-MM-dd") &&
			endDateStr === todayStr);
	const isMonth =
		startDateStr === format(startOfMonth(today), "yyyy-MM-dd") &&
		(endDateStr === format(endOfMonth(today), "yyyy-MM-dd") ||
			endDateStr === todayStr);

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 py-1">
			<div className="flex flex-wrap items-center gap-3">
				{/* Custom range picker */}
				<div className="flex items-center gap-1.5">
					<span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
						Range
					</span>
					<DateRangePicker
						date={dateRange}
						setDate={handleDateRangeChange}
						className="w-[230px] h-8 text-xs"
					/>
				</div>

				{/* Quick range buttons with standard styling */}
				<div className="flex items-center gap-1.5">
					<Button
						variant={is7d ? "default" : "outline"}
						size="sm"
						className="h-8 text-xs px-2.5 rounded-md"
						onClick={() => applyPreset("7d")}
					>
						7 Days
					</Button>
					<Button
						variant={is30d ? "default" : "outline"}
						size="sm"
						className="h-8 text-xs px-2.5 rounded-md"
						onClick={() => applyPreset("30d")}
					>
						30 Days
					</Button>
					<Button
						variant={isMonth ? "default" : "outline"}
						size="sm"
						className="h-8 text-xs px-2.5 rounded-md"
						onClick={() => applyPreset("month")}
					>
						This Month
					</Button>
					{startDateStr && (
						<Button
							variant="ghost"
							size="sm"
							className="h-8 text-xs px-2 text-muted-foreground hover:text-foreground"
							onClick={() => applyPreset("all")}
						>
							Clear
						</Button>
					)}
				</div>

				{/* Status filter */}
				<div className="flex items-center gap-1.5">
					<span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
						Status
					</span>
					<Select
						value={selectedStatus}
						onValueChange={(val) => updateFilters({ status: val })}
					>
						<SelectTrigger className="w-[125px] h-8 text-xs rounded-full">
							<SelectValue placeholder="All Statuses">
								{selectedStatus === "all"
									? "All Statuses"
									: selectedStatus.charAt(0).toUpperCase() +
										selectedStatus.slice(1)}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							<SelectItem value="approved">Approved</SelectItem>
							<SelectItem value="pending">Pending</SelectItem>
							<SelectItem value="rejected">Rejected</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	);
}
