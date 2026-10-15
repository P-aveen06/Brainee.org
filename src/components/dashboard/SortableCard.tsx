import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import type * as React from "react";
import { Button } from "#/components/ui/button";
import type { WidgetSize } from "#/lib/dashboard-layout";
import { cn } from "#/lib/utils";
import { CardMascotHost, useIsCardPeeking } from "./PeekingMascot";

/**
 * Grid cell that becomes draggable in edit mode. A transparent overlay is the
 * drag surface so links and buttons inside the card can't be triggered mid-edit.
 */
export function SortableCard({
	id,
	title,
	editing,
	size = "sm",
	className,
	onHide,
	onResize,
	children,
}: {
	id: string;
	title: string;
	editing: boolean;
	size?: WidgetSize;
	className?: string;
	onHide: () => void;
	onResize?: (size: WidgetSize) => void;
	children: React.ReactNode;
}) {
	const isPeeking = useIsCardPeeking(id);
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id, disabled: !editing });

	return (
		<div
			ref={setNodeRef}
			style={{ transform: CSS.Translate.toString(transform), transition }}
			className={cn(
				"relative min-w-0 rounded-xl",
				className,
				isDragging && "z-30 opacity-90 shadow-xl",
				isPeeking && "z-20",
			)}
		>
			{!editing && <CardMascotHost cardId={id} />}
			<div
				className={cn(
					"relative z-10 h-full rounded-xl transition-[box-shadow,opacity] duration-200 ease-standard",
					editing &&
						"pointer-events-none select-none ring-2 ring-border ring-dashed",
				)}
			>
				{children}
			</div>
			{editing && (
				<>
					<button
						type="button"
						{...attributes}
						{...listeners}
						aria-label={`Drag to move ${title}`}
						className="absolute inset-0 z-10 cursor-grab rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
					/>
					<span className="pointer-events-none absolute top-2 left-2 z-20 flex items-center gap-1 rounded-md bg-foreground/90 px-1.5 py-1 text-[10px] font-medium text-background">
						<GripVertical className="size-3" aria-hidden="true" />
						{title}
					</span>
					<div className="absolute top-2 right-9 z-20 flex items-center rounded-md border border-border/70 bg-card p-0.5 shadow-xs">
						{(["sm", "md", "lg"] as const).map((s) => (
							<button
								key={s}
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onResize?.(s);
								}}
								className={cn(
									"rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold transition-colors",
									size === s
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-surface-alt hover:text-foreground",
								)}
							>
								{s.toUpperCase()}
							</button>
						))}
					</div>
					<Button
						variant="outline"
						size="icon-xs"
						className="absolute top-2 right-2 z-20 bg-card"
						aria-label={`Hide ${title}`}
						onClick={onHide}
					>
						<X />
					</Button>
				</>
			)}
		</div>
	);
}
