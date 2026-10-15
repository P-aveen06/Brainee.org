import type * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "subtle" | "elevated" | "ghost";

interface CardProps extends React.ComponentProps<"div"> {
	variant?: CardVariant;
}

const cardVariants: Record<CardVariant, string> = {
	default:
		"border-0 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-[box-shadow,ring] duration-200 ease-out hover:shadow-[0_2px_5px_rgba(0,0,0,0.04)] dark:hover:shadow-[0_2px_5px_rgba(0,0,0,0.2)] hover:ring-1 hover:ring-foreground/[0.03] dark:hover:ring-white/[0.04] motion-reduce:transition-none",
	subtle:
		"border-0 bg-card transition-colors duration-200 ease-out hover:bg-card/90",
	elevated:
		"border-0 bg-card shadow-[0_4px_16px_rgba(9,12,29,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.25)] transition-[box-shadow,ring] duration-200 ease-out hover:shadow-[0_4px_18px_rgba(9,12,29,0.07)] dark:hover:shadow-[0_4px_18px_rgba(0,0,0,0.28)] hover:ring-1 hover:ring-foreground/[0.03] dark:hover:ring-white/[0.04] motion-reduce:transition-none",
	ghost: "border-0 bg-transparent",
};

function Card({ className, variant = "default", ...props }: CardProps) {
	return (
		<div
			data-slot="card"
			data-variant={variant}
			className={cn(
				"rounded-xl border-0 text-card-foreground",
				cardVariants[variant],
				className,
			)}
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				"flex flex-col gap-1 px-3 py-3 sm:px-3.5 sm:py-3.5",
				className,
			)}
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-title"
			className={cn(
				"flex items-center gap-2 font-heading text-base font-semibold leading-tight tracking-[-0.025em] text-foreground [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-description"
			className={cn("text-sm leading-relaxed text-muted-foreground", className)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-content"
			className={cn("px-3 pb-3 pt-0 sm:px-3.5 sm:pb-3.5 sm:pt-0", className)}
			{...props}
		/>
	);
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
