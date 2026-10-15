import type { LucideIcon } from "lucide-react";
import { m } from "motion/react";
import type * as React from "react";
import { createContext, useContext } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { cn } from "#/lib/utils";

export interface TileContextValue {
	index: number;
	editing?: boolean;
}

export const TileContext = createContext<TileContextValue>({
	index: 0,
	editing: false,
});

/** Shared shell for dashboard widgets: icon + title, optional action, body. */
export function Tile({
	title,
	icon: Icon,
	action,
	className,
	contentClassName,
	children,
}: {
	title: string;
	icon: LucideIcon;
	action?: React.ReactNode;
	className?: string;
	contentClassName?: string;
	children: React.ReactNode;
}) {
	const { index, editing } = useContext(TileContext);
	const cardDelay = editing ? 0 : index * 0.05;
	const contentDelay = editing ? 0 : cardDelay + 0.18;

	return (
		<m.div
			initial={{ opacity: 0, y: 14, scale: 0.985 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.35, delay: cardDelay, ease: [0.2, 0, 0, 1] }}
			className="h-full"
		>
			<Card className={cn("flex h-full flex-col", className)}>
				<m.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{
						duration: 0.38,
						delay: contentDelay,
						ease: [0.2, 0, 0, 1],
					}}
					className="flex flex-1 flex-col min-h-0"
				>
					<CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
						<CardTitle className="text-sm font-semibold">
							<Icon className="size-4" aria-hidden="true" />
							{title}
						</CardTitle>
						{action}
					</CardHeader>
					<CardContent
						className={cn("min-h-0 flex-1 flex flex-col", contentClassName)}
					>
						{children}
					</CardContent>
				</m.div>
			</Card>
		</m.div>
	);
}
