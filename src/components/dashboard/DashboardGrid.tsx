import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import type { DashboardExtras } from "#/lib/dashboard-extras.server";
import {
	type LayoutEntry,
	packBentoGrid,
	WIDGETS,
	type WidgetId,
	type WidgetSize,
} from "#/lib/dashboard-layout";
import type { getDashboardData } from "#/lib/dashboard-stats.server";
import { SortableCard } from "./SortableCard";
import type { UpdateProject } from "./types";
import { ApprovalsTile } from "./widgets/ApprovalsTile";
import { HoursTile } from "./widgets/HoursTile";
import { LeaveTile } from "./widgets/LeaveTile";
import { TeamTile } from "./widgets/TeamTile";
import { TileContext } from "./widgets/Tile";
import { WorkCard } from "./widgets/WorkCard";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export function DashboardGrid({
	layout,
	editing,
	data,
	extras,
	updates,
	standardHours,
	onChanged,
	onLayoutChange,
}: {
	layout: LayoutEntry[];
	editing: boolean;
	data: DashboardData;
	extras: DashboardExtras;
	updates: { today: string; projects: UpdateProject[] } | null;
	standardHours: number;
	onChanged: () => void;
	onLayoutChange: (next: LayoutEntry[]) => void;
}) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const { personalStats: stats } = data;

	function renderWidget(id: WidgetId, size: WidgetSize): ReactNode {
		switch (id) {
			case "approvals":
				return (
					<ApprovalsTile
						items={data.pendingApprovals}
						total={data.totalPending}
						onChanged={onChanged}
						size={size}
					/>
				);
			case "team":
				return (
					<TeamTile
						teamSize={data.teamStats.teamSize}
						availability={data.teamAvailability}
						size={size}
					/>
				);
			case "hours":
				return (
					<HoursTile
						hoursThisMonth={stats.hoursThisMonth}
						standardHours={standardHours}
						trend={extras.hoursTrend}
						offDates={extras.offDates}
						size={size}
					/>
				);
			case "leave":
				return (
					<LeaveTile stats={stats} wfhBalance={extras.wfhBalance} size={size} />
				);
			case "work":
				return (
					<WorkCard
						today={updates?.today ?? ""}
						projects={updates?.projects ?? []}
						tasks={extras.tasks}
						onChanged={onChanged}
						size={size}
					/>
				);
		}
	}

	const visible = layout.filter((e) => !e.hidden);
	const ids = visible.map((e) => e.id);
	const packed = packBentoGrid(layout);
	const packedMap = new Map(packed.map((p) => [p.id, p]));
	const totalSpan = packed.reduce((sum, p) => sum + p.span, 0);
	const rows = Math.max(Math.ceil(totalSpan / 6), 1);

	function onDragEnd({ active, over }: DragEndEvent) {
		if (!over || active.id === over.id) return;
		const from = ids.indexOf(active.id as WidgetId);
		const to = ids.indexOf(over.id as WidgetId);
		if (from < 0 || to < 0) return;
		const moved = arrayMove(visible, from, to);
		const rest = layout.filter((e) => !moved.some((m) => m.id === e.id));
		onLayoutChange([...moved, ...rest]);
	}

	function hide(id: WidgetId) {
		onLayoutChange(
			layout.map((e) => (e.id === id ? { ...e, hidden: true } : e)),
		);
	}

	function resize(id: WidgetId, size: WidgetSize) {
		onLayoutChange(layout.map((e) => (e.id === id ? { ...e, size } : e)));
	}

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={onDragEnd}
		>
			<SortableContext items={ids} strategy={rectSortingStrategy}>
				<div
					className="grid h-full grid-cols-1 gap-3 sm:gap-3.5 md:grid-cols-6 md:[grid-template-rows:var(--dash-rows)]"
					style={
						{
							"--dash-rows": rows > 1 ? `repeat(${rows - 1}, auto) 1fr` : "1fr",
						} as React.CSSProperties
					}
				>
					{visible.map((entry, index) => {
						const itemPacked = packedMap.get(entry.id);
						const size = itemPacked?.size ?? "sm";
						const colClass = itemPacked?.colClass ?? "md:col-span-2";
						return (
							<SortableCard
								key={entry.id}
								id={entry.id}
								title={WIDGETS[entry.id].title}
								editing={editing}
								size={size}
								className={colClass}
								onHide={() => hide(entry.id)}
								onResize={(newSize) => resize(entry.id, newSize)}
							>
								<TileContext.Provider value={{ index, editing }}>
									{renderWidget(entry.id, size)}
								</TileContext.Provider>
							</SortableCard>
						);
					})}
				</div>
			</SortableContext>
		</DndContext>
	);
}
