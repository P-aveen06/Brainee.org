"use client";

interface PillToggleItem {
	value: string;
	label: React.ReactNode;
}

interface PillToggleProps {
	items: PillToggleItem[];
	value: string;
	onChange: (value: string) => void;
	appearance?: "segmented" | "filters";
	ariaLabel?: string;
}

export function PillToggle({
	items,
	value,
	onChange,
	appearance = "segmented",
	ariaLabel = "View options",
}: PillToggleProps) {
	const isFilters = appearance === "filters";

	return (
		<div
			className="min-w-0 max-w-full overflow-x-auto"
			role="tablist"
			aria-label={ariaLabel}
		>
			<div
				className={`flex w-max items-center gap-1 rounded-md p-1 ${isFilters ? "bg-transparent" : "bg-surface-alt"}`}
			>
				{items.map((item) => (
					<button
						key={item.value}
						type="button"
						role="tab"
						aria-selected={value === item.value}
						onClick={() => onChange(item.value)}
						className={`whitespace-nowrap rounded-md px-3 py-1.5 text-center text-xs font-medium transition-all duration-150 ${value === item.value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"}`}
					>
						{item.label}
					</button>
				))}
			</div>
		</div>
	);
}
