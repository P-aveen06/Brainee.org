"use client";

import { lazy, Suspense } from "react";
import type { AssistantChartSpec } from "@/lib/ai/chart-types";

const AssistantChart = lazy(() =>
	import("./AssistantChart").then((module) => ({
		default: module.AssistantChart,
	})),
);

export function AssistantChartLoader({ chart }: { chart: AssistantChartSpec }) {
	return (
		<Suspense
			fallback={
				<output
					className="my-3 h-56 max-w-3xl animate-pulse rounded-xl border border-border bg-card"
					aria-label="Loading chart"
				>
					<span className="sr-only">Loading chart</span>
				</output>
			}
		>
			<AssistantChart chart={chart} />
		</Suspense>
	);
}
