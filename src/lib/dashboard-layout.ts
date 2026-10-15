export type WidgetId = "approvals" | "team" | "hours" | "leave" | "work";

/** Grid span on the 6-column bento: sm = a third, md = half, lg = full width. */
export type WidgetSize = "sm" | "md" | "lg";

interface WidgetMeta {
	title: string;
	size: WidgetSize;
	/** Roles that can see the widget; omitted means everyone. */
	roles?: string[];
}

export const WIDGETS: Record<WidgetId, WidgetMeta> = {
	approvals: {
		title: "Pending approvals",
		size: "md",
		roles: ["lead", "admin"],
	},
	team: { title: "Team today", size: "sm" },
	hours: { title: "Hours this month", size: "sm" },
	leave: { title: "Leave & WFH", size: "sm" },
	work: { title: "My work", size: "md" },
};

interface DefaultEntry {
	id: WidgetId;
	hidden?: boolean;
}

// Team, hours and leave sit three to a row; approvals and work pair up beneath.
const DEFAULTS: Record<"user" | "lead" | "admin" | "hr", DefaultEntry[]> = {
	user: [{ id: "team" }, { id: "hours" }, { id: "leave" }, { id: "work" }],
	lead: [
		{ id: "team" },
		{ id: "hours" },
		{ id: "leave" },
		{ id: "approvals" },
		{ id: "work" },
	],
	admin: [
		{ id: "team" },
		{ id: "hours" },
		{ id: "leave" },
		{ id: "approvals" },
		{ id: "work" },
	],
	hr: [{ id: "team" }, { id: "hours" }, { id: "leave" }, { id: "work" }],
};

export interface LayoutEntry {
	id: WidgetId;
	hidden: boolean;
	size?: WidgetSize;
}

function roleKey(role: string): keyof typeof DEFAULTS {
	return role in DEFAULTS ? (role as keyof typeof DEFAULTS) : "user";
}

export function isWidgetId(value: unknown): value is WidgetId {
	return typeof value === "string" && value in WIDGETS;
}

export function getDefaultLayout(role: string): LayoutEntry[] {
	return DEFAULTS[roleKey(role)].map((d) => ({
		id: d.id,
		hidden: d.hidden === true,
	}));
}

/**
 * Merges a saved layout with what the role may see: unknown or no-longer-allowed
 * widgets are dropped, and widgets added since saving are appended in default order.
 */
export function resolveLayout(saved: unknown, role: string): LayoutEntry[] {
	const defaults = getDefaultLayout(role);
	if (!Array.isArray(saved)) return defaults;

	const allowed = new Set(defaults.map((d) => d.id));
	const seen = new Set<WidgetId>();
	const result: LayoutEntry[] = [];

	for (const entry of saved) {
		if (!entry || typeof entry !== "object") continue;
		const raw = entry as { id?: unknown; hidden?: unknown; size?: unknown };
		// "updates" and "tasks" were merged into "work"; keep the user's slot.
		const id = raw.id === "updates" || raw.id === "tasks" ? "work" : raw.id;
		const { hidden, size } = raw;
		if (!isWidgetId(id) || !allowed.has(id) || seen.has(id)) continue;
		seen.add(id);
		const validSize =
			size === "sm" || size === "md" || size === "lg" ? size : undefined;
		result.push({
			id,
			hidden: hidden === true,
			...(validSize ? { size: validSize } : {}),
		});
	}
	for (const d of defaults) if (!seen.has(d.id)) result.push(d);
	return result;
}

const COLUMNS: Record<WidgetSize, number> = { sm: 2, md: 3, lg: 6 };

/** "My work" takes the full row when there's no approvals card to sit beside. */
export function widgetSize(id: WidgetId, visible: WidgetId[]): WidgetSize {
	if (id === "work" && !visible.includes("approvals")) return "lg";
	return WIDGETS[id].size;
}

/** Rows the 6-column grid will use, mirroring CSS auto-placement. */
export function countGridRows(sizes: WidgetSize[]): number {
	let rows = 0;
	let used = 6;
	for (const size of sizes) {
		const span = COLUMNS[size];
		if (used + span > 6) {
			rows++;
			used = 0;
		}
		used += span;
	}
	return rows;
}

export interface PackedWidget {
	id: WidgetId;
	span: number;
	colClass: string;
	size: WidgetSize;
}

/**
 * Packs widgets into 6-column bento rows with ZERO empty spaces.
 * Guarantees every row sums to exactly 6 columns, dynamically adjusting
 * column spans so no awkward gaps are left in any combination.
 */
export function packBentoGrid(entries: LayoutEntry[]): PackedWidget[] {
	const visible = entries.filter((e) => !e.hidden);
	const visibleIds = visible.map((e) => e.id);

	const items = visible.map((e) => {
		const targetSize = e.size ?? widgetSize(e.id, visibleIds);
		const span = COLUMNS[targetSize];
		return {
			id: e.id,
			requestedSize: e.size,
			desiredSpan: span,
		};
	});

	const rows: (typeof items)[] = [];
	let currentRow: typeof items = [];
	let currentSum = 0;

	for (const item of items) {
		if (currentSum + item.desiredSpan > 6 && currentRow.length > 0) {
			rows.push(currentRow);
			currentRow = [];
			currentSum = 0;
		}
		currentRow.push(item);
		currentSum += item.desiredSpan;
	}
	if (currentRow.length > 0) {
		rows.push(currentRow);
	}

	const packed: PackedWidget[] = [];

	for (const row of rows) {
		if (row.length === 1) {
			// Single card in a row always spans all 6 columns (lg)
			packed.push({
				id: row[0].id,
				span: 6,
				colClass: "md:col-span-6",
				size: "lg",
			});
		} else if (row.length === 2) {
			const [first, second] = row;
			let s1 = 3;
			let s2 = 3;
			if (first.requestedSize === "sm" && second.requestedSize !== "sm") {
				s1 = 2;
				s2 = 4;
			} else if (
				second.requestedSize === "sm" &&
				first.requestedSize !== "sm"
			) {
				s1 = 4;
				s2 = 2;
			}
			packed.push({
				id: first.id,
				span: s1,
				colClass:
					s1 === 2
						? "md:col-span-2"
						: s1 === 4
							? "md:col-span-4"
							: "md:col-span-3",
				size: s1 === 2 ? "sm" : "md",
			});
			packed.push({
				id: second.id,
				span: s2,
				colClass:
					s2 === 2
						? "md:col-span-2"
						: s2 === 4
							? "md:col-span-4"
							: "md:col-span-3",
				size: s2 === 2 ? "sm" : "md",
			});
		} else if (row.length === 3) {
			// Three cards in a row: 2 + 2 + 2 = 6 (all small)
			for (const item of row) {
				packed.push({
					id: item.id,
					span: 2,
					colClass: "md:col-span-2",
					size: "sm",
				});
			}
		}
	}

	return packed;
}
