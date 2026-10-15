import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { AnimatedNumber } from "@/components/motion";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface StatGroupProps extends React.HTMLAttributes<HTMLDivElement> {
	columns?: 3 | 4 | 5;
}

export function StatGroup({
	columns = 4,
	className,
	...props
}: StatGroupProps) {
	return (
		<div
			className={cn(
				"grid overflow-hidden rounded-xl border-0 bg-card py-2 sm:grid-cols-2 shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
				columns === 5
					? "lg:grid-cols-5"
					: columns === 3
						? "lg:grid-cols-3"
						: "lg:grid-cols-4",
				className,
			)}
			{...props}
		/>
	);
}

interface StatCardProps {
	label: string;
	value: React.ReactNode;
	suffix?: string;
	icon: LucideIcon;
	highlight?: boolean;
	info?: React.ReactNode;
	description?: string;
}

export function StatCard({
	label,
	value,
	suffix,
	icon: Icon,
	highlight = false,
	info,
	description,
}: StatCardProps) {
	return (
		<div className="relative flex min-w-0 items-center gap-2.5 px-3 py-2 sm:border-l sm:border-border/40 sm:px-3.5 sm:first:border-l-0">
			<div
				className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
					highlight
						? "bg-pale-orange text-logo-orange dark:bg-pale-orange/20"
						: "bg-surface-alt text-accent dark:bg-surface-alt dark:text-accent"
				}`}
			>
				<Icon className="size-4" aria-hidden="true" />
			</div>
			<div className="min-w-0">
				<p className="font-heading text-2xl font-bold leading-none tracking-[-0.04em]">
					{typeof value === "number" ? <AnimatedNumber value={value} /> : value}
					{suffix && (
						<span className="ml-1 text-sm font-normal text-muted-foreground">
							{suffix}
						</span>
					)}
				</p>
				<p className="mt-1 truncate text-xs font-medium text-muted-foreground">
					{label}
				</p>
				{description && (
					<p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
						{description}
					</p>
				)}
			</div>
			{info && (
				<Popover>
					<PopoverTrigger
						aria-label={`${label} breakdown`}
						className="absolute right-1 top-0 flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					>
						<Info className="size-3.5" />
					</PopoverTrigger>
					<PopoverContent align="end" className="w-60">
						{info}
					</PopoverContent>
				</Popover>
			)}
		</div>
	);
}
