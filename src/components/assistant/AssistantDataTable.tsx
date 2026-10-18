"use client";

import type React from "react";
import { useMemo } from "react";
import {
	DataTable,
	type DataTableColumn,
	type DataTableRow,
	type DataTableValue,
} from "@/components/assistant-ui/elements/data-table";

interface MdastNode {
	type?: string;
	value?: string;
	align?: ("left" | "right" | "center" | null)[];
	children?: MdastNode[];
}

function extractText(node: unknown): string {
	if (!node || typeof node !== "object") return "";
	const n = node as MdastNode;
	if (typeof n.value === "string") return n.value;
	if (Array.isArray(n.children)) {
		return n.children.map(extractText).join("");
	}
	return "";
}

const BADGE_STATUSES = new Set([
	"active",
	"inactive",
	"pending",
	"approved",
	"rejected",
	"in progress",
	"in_progress",
	"completed",
	"complete",
	"done",
	"at risk",
	"at_risk",
	"on track",
	"on_track",
	"blocked",
	"high",
	"medium",
	"low",
	"critical",
]);

export function AssistantMarkdownTable({
	node,
	children,
	...tableProps
}: React.ComponentProps<"table"> & { node?: unknown }) {
	const parsed = useMemo(() => {
		const mdast = node as MdastNode | undefined;
		if (
			!mdast ||
			mdast.type !== "table" ||
			!Array.isArray(mdast.children) ||
			mdast.children.length < 2
		) {
			return null;
		}

		const headerRow = mdast.children[0];
		if (
			!headerRow ||
			!Array.isArray(headerRow.children) ||
			headerRow.children.length === 0
		) {
			return null;
		}

		const headerLabels = headerRow.children.map((cell) =>
			extractText(cell).trim(),
		);
		const dataRows = mdast.children.slice(1);

		const columns: DataTableColumn[] = headerLabels.map((label, idx) => {
			const safeKey = `col_${idx}_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
			const align = mdast.align?.[idx] === "right" ? "end" : "start";
			return {
				key: safeKey,
				label: label || `Column ${idx + 1}`,
				align,
				sortable: true,
				priority: idx === 0 ? "primary" : "secondary",
			};
		});

		const rows: DataTableRow[] = [];
		for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
			const rowNode = dataRows[rIdx];
			if (!rowNode || !Array.isArray(rowNode.children)) continue;

			const rowRecord: Record<string, DataTableValue> = {
				__id: `row_${rIdx}`,
			};

			for (let cIdx = 0; cIdx < columns.length; cIdx++) {
				const col = columns[cIdx];
				if (!col) continue;
				const cellNode = rowNode.children[cIdx];
				const raw = cellNode ? extractText(cellNode).trim() : "";

				// Parse numbers, booleans, strings
				if (/^-?\d+(\.\d+)?$/.test(raw)) {
					rowRecord[col.key] = Number(raw);
				} else if (/^(true|false)$/i.test(raw)) {
					rowRecord[col.key] = raw.toLowerCase() === "true";
				} else {
					rowRecord[col.key] = raw;
				}
			}
			rows.push(rowRecord);
		}

		if (rows.length === 0) return null;

		// Detect column formats based on row data
		for (const col of columns) {
			const sampleVals = rows
				.map((r) => r[col.key])
				.filter(
					(v): v is Exclude<DataTableValue, null | undefined> =>
						v !== null && v !== undefined && v !== "",
				);

			if (sampleVals.length === 0) continue;

			const allNumbers = sampleVals.every((v) => typeof v === "number");
			if (allNumbers) {
				col.align = "end";
				col.format = { kind: "number" };
				continue;
			}

			const allDates = sampleVals.every(
				(v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v),
			);
			if (allDates) {
				col.format = { kind: "date", style: "date" };
				continue;
			}

			const allBadges = sampleVals.every(
				(v) => typeof v === "string" && BADGE_STATUSES.has(v.toLowerCase()),
			);
			if (allBadges) {
				col.format = {
					kind: "badge",
					tones: {
						active: "success",
						approved: "success",
						completed: "success",
						done: "success",
						"on track": "success",
						on_track: "success",
						low: "neutral",
						pending: "warning",
						"in progress": "warning",
						in_progress: "warning",
						medium: "warning",
						"at risk": "danger",
						at_risk: "danger",
						blocked: "danger",
						rejected: "danger",
						critical: "danger",
						high: "danger",
					},
				};
			}
		}

		return { columns, rows };
	}, [node]);

	if (parsed) {
		return (
			<div className="my-3 w-full overflow-hidden rounded-xl border border-border/80 bg-card/60 shadow-xs">
				<DataTable
					columns={parsed.columns}
					rows={parsed.rows}
					rowKey="__id"
					className="w-full"
				/>
			</div>
		);
	}

	// Fallback to standard styled HTML table if AST node parsing is unavailable
	return (
		<div className="my-2.5 w-full overflow-x-auto rounded-lg border border-border/80 shadow-2xs">
			<table
				className="w-full border-collapse text-left text-xs"
				{...tableProps}
			>
				{children}
			</table>
		</div>
	);
}
