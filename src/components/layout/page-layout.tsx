import type * as React from "react";
import { cn } from "@/lib/utils";

export function Page({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("min-w-0 space-y-4 sm:space-y-5", className)} {...props}>
			{children}
		</div>
	);
}

interface PageHeaderProps
	extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
	title: React.ReactNode;
	description?: React.ReactNode;
	icon?: React.ReactNode;
	leading?: React.ReactNode;
	actions?: React.ReactNode;
}

export function PageHeader({
	title,
	description,
	icon,
	leading,
	actions,
	className,
	...props
}: PageHeaderProps) {
	return (
		<header
			className={cn(
				"flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
				className,
			)}
			{...props}
		>
			<div className="flex min-w-0 flex-1 items-center gap-2.5 sm:basis-80">
				{leading}
				<div className="min-w-0">
					<h1 className="font-heading text-lg font-semibold tracking-[-0.025em] text-foreground">
						<span className="min-w-0">{title}</span>
					</h1>
				</div>
			</div>
			{actions && (
				<div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
					{actions}
				</div>
			)}
		</header>
	);
}

interface PageSectionProps
	extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
	title?: React.ReactNode;
	description?: React.ReactNode;
	actions?: React.ReactNode;
}

export function PageSection({
	title,
	description,
	actions,
	className,
	children,
	...props
}: PageSectionProps) {
	return (
		<section className={cn("min-w-0 space-y-3", className)} {...props}>
			{(title || description || actions) && (
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0">
						{title && (
							<h2 className="font-heading text-lg font-semibold tracking-[-0.025em] text-foreground">
								{title}
							</h2>
						)}
						{description && (
							<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
								{description}
							</p>
						)}
					</div>
					{actions && <div className="shrink-0">{actions}</div>}
				</div>
			)}
			{children}
		</section>
	);
}

export function PageLoading({ label }: { label: string }) {
	return (
		<div className="flex min-h-80 items-center justify-center">
			<p className="text-sm text-muted-foreground">{label}</p>
		</div>
	);
}

interface AuthPageLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
	contentClassName?: string;
}

export function AuthPageLayout({
	className,
	contentClassName,
	children,
	...props
}: AuthPageLayoutProps) {
	return (
		<main
			className={cn(
				"relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12",
				className,
			)}
			{...props}
		>
			<div className="pointer-events-none absolute -left-40 -top-40 size-96 bg-[#7612fa]/10 blur-3xl" />
			<div className="pointer-events-none absolute -bottom-40 -right-40 size-96 bg-[#fa12e3]/10 blur-3xl" />
			<div className={cn("relative w-full max-w-md", contentClassName)}>
				{children}
			</div>
		</main>
	);
}
