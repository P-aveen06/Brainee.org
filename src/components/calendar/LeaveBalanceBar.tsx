"use client";

import { formatLeaveType } from "@/lib/leave-policy";

type BalanceItem = {
	leave_type: string;
	total_limit: number;
	used: number;
};

type WfhBalance = {
	total_limit: number;
	used: number;
};

interface LeaveBalanceBarProps {
	balances: BalanceItem[];
	wfh?: WfhBalance | null;
}

type BalanceCardData = {
	key: string;
	label: string;
	total: number;
	used: number;
	accentClass: string;
};

function BalanceCard({
	label,
	total,
	used,
	accentClass,
}: Omit<BalanceCardData, "key">) {
	const remaining = total - used;
	const pct = total > 0 ? (remaining / total) * 100 : 0;

	return (
		<div className="flex min-w-[160px] flex-1 items-center gap-3 px-4 py-3 sm:border-l sm:border-border sm:first:border-l-0">
			<div className="flex-1 min-w-0">
				<p className="truncate text-xs font-medium text-muted-foreground">
					{label}
				</p>
				<p className="font-heading text-lg font-bold tracking-[-0.035em]">
					{remaining}
					<span className="text-xs text-muted-foreground ml-1">/ {total}</span>
				</p>
			</div>
			<div className="h-8 w-8 shrink-0">
				<svg
					viewBox="0 0 36 36"
					className="h-8 w-8 -rotate-90"
					aria-hidden="true"
				>
					<circle
						cx="18"
						cy="18"
						r="15.5"
						fill="none"
						stroke="currentColor"
						strokeWidth="3"
						pathLength="100"
						className="text-border"
					/>
					<circle
						cx="18"
						cy="18"
						r="15.5"
						fill="none"
						stroke="currentColor"
						strokeWidth="3"
						pathLength="100"
						strokeDasharray={remaining <= 0 ? "100 0" : `${pct} ${100 - pct}`}
						strokeLinecap="round"
						className={
							remaining <= 0
								? "text-destructive"
								: pct > 50
									? accentClass
									: pct > 20
										? "text-coral"
										: "text-destructive"
						}
					/>
				</svg>
			</div>
		</div>
	);
}

export function LeaveBalanceBar({ balances, wfh }: LeaveBalanceBarProps) {
	const cards: BalanceCardData[] = (balances ?? []).map((b) => ({
		key: b.leave_type,
		label: formatLeaveType(b.leave_type),
		total: b.total_limit,
		used: b.used,
		accentClass: "text-status-logged-foreground",
	}));

	if (wfh) {
		cards.push({
			key: "__wfh__",
			label: "WFH",
			total: wfh.total_limit,
			used: wfh.used,
			accentClass: "text-status-wfh-foreground",
		});
	}

	if (cards.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-wrap overflow-hidden rounded-xl bg-surface py-1">
			{cards.map((card) => (
				<BalanceCard
					key={card.key}
					label={card.label}
					total={card.total}
					used={card.used}
					accentClass={card.accentClass}
				/>
			))}
		</div>
	);
}
