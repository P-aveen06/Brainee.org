import { useLayoutEffect, useRef, useState } from "react";
import { SidebarMenu } from "#/components/ui/sidebar";
import type { NavItem } from "#/lib/navigation";
import { SidebarNavItem } from "./SidebarNavItem";

/** Nested nav list with one indicator dot that glides to the active item. */
export function SidebarGroupItems({
	items,
	activeHref,
	pendingApprovalCount,
}: {
	items: NavItem[];
	activeHref: string | null | undefined;
	pendingApprovalCount: number;
}) {
	const listRef = useRef<HTMLUListElement>(null);
	const [dotTop, setDotTop] = useState<number | null>(null);
	const hasActive = items.some((i) => i.href === activeHref);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the active item changes
	useLayoutEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const measure = () => {
			const row = list
				.querySelector('[aria-current="page"]')
				?.closest<HTMLElement>("li");
			setDotTop(row ? row.offsetTop + row.offsetHeight / 2 : null);
		};
		measure();
		// Sections measure as 0 while hidden, so re-measure when the list resizes
		const observer = new ResizeObserver(measure);
		observer.observe(list);
		return () => observer.disconnect();
	}, [activeHref]);

	return (
		<SidebarMenu
			ref={listRef}
			className="relative ml-5 w-auto gap-1 border-l border-sidebar-foreground/25 pl-3 group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:pl-0"
		>
			<span
				aria-hidden="true"
				style={{ top: dotTop ?? 0 }}
				className={`pointer-events-none absolute -left-[3.5px] size-1.5 -translate-y-1/2 rounded-full bg-accent transition-[top,opacity] duration-500 ease-bounce group-data-[collapsible=icon]:hidden ${
					hasActive && dotTop !== null ? "opacity-100" : "opacity-0"
				}`}
			/>
			{items.map((item) => (
				<SidebarNavItem
					key={item.href}
					item={item}
					isActive={activeHref === item.href}
					pendingApprovalCount={pendingApprovalCount}
				/>
			))}
		</SidebarMenu>
	);
}
