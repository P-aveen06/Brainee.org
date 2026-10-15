"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PageTabItem {
	value: string;
	label: React.ReactNode;
}

interface PageTabsProps
	extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
	items: readonly PageTabItem[];
	value: string;
	onChange: (value: string) => void;
	ariaLabel?: string;
}

export function PageTabs({
	items,
	value,
	onChange,
	ariaLabel = "Page sections",
	className,
	...props
}: PageTabsProps) {
	const scrollRef = React.useRef<HTMLDivElement>(null);
	const [canScrollRight, setCanScrollRight] = React.useState(false);

	const checkScroll = React.useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		const hasOverflowRight =
			el.scrollWidth - el.scrollLeft - el.clientWidth > 4;
		setCanScrollRight(hasOverflowRight);
	}, []);

	React.useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		checkScroll();
		el.addEventListener("scroll", checkScroll, { passive: true });
		window.addEventListener("resize", checkScroll);
		return () => {
			el.removeEventListener("scroll", checkScroll);
			window.removeEventListener("resize", checkScroll);
		};
	}, [checkScroll]);

	return (
		<div className="relative min-w-0 max-w-full">
			<div
				ref={scrollRef}
				className={cn("min-w-0 max-w-full overflow-x-auto", className)}
				{...props}
			>
				<div
					className="flex w-max min-w-full items-center gap-1 border-b border-border"
					role="tablist"
					aria-label={ariaLabel}
				>
					{items.map((item) => {
						const isActive = value === item.value;
						return (
							<button
								key={item.value}
								type="button"
								role="tab"
								aria-selected={isActive}
								onClick={() => onChange(item.value)}
								className={cn(
									"-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
									isActive
										? "border-accent text-foreground"
										: "border-transparent text-muted-foreground hover:text-foreground",
								)}
							>
								{item.label}
							</button>
						);
					})}
				</div>
			</div>
			{canScrollRight && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10"
				/>
			)}
		</div>
	);
}
