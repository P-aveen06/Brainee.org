import type * as React from "react";
import { cn } from "@/lib/utils";

export function DataTableContainer({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs",
				className,
			)}
			{...props}
		>
			<div className="max-w-full overflow-x-auto">{children}</div>
		</div>
	);
}

export function DataTableToolbar({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"flex flex-col flex-wrap items-start justify-between gap-2.5 sm:flex-row sm:items-center",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}

export function DataTableFilters({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("flex flex-1 items-center gap-2 flex-wrap", className)}
			{...props}
		>
			{children}
		</div>
	);
}

export function DataTableActions({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn("flex items-center gap-2 self-end sm:self-auto", className)}
			{...props}
		>
			{children}
		</div>
	);
}
