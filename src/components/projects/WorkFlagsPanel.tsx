"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	acknowledgeWorkFlag,
	dismissWorkFlag,
	scanProjectWorkFlags,
} from "@/api/work-flags";
import { DataTableToolbar } from "@/components/layout/data-table-layout";
import { Button } from "@/components/ui/button";
import type { ProjectAccess } from "@/lib/project-access";
import { cn } from "@/lib/utils";
import { WorkFlagCard, type WorkFlagItemData } from "./WorkFlagCard";

const FLAG_TABS = [
	{ value: "open", label: "Open Flags" },
	{ value: "acknowledged", label: "Acknowledged" },
	{ value: "dismissed", label: "Dismissed" },
	{ value: "all", label: "All History" },
];

interface WorkFlagsPanelProps {
	projectId: string;
	flags: WorkFlagItemData[];
	access: ProjectAccess;
	currentUserId?: string;
	onSuccess: () => void;
}

export function WorkFlagsPanel({
	projectId,
	flags,
	access,
	currentUserId,
	onSuccess,
}: WorkFlagsPanelProps) {
	const [activeTab, setActiveTab] = useState("open");
	const [isPending, startTransition] = useTransition();

	const filteredFlags = useMemo(() => {
		if (activeTab === "all") return flags;
		return flags.filter((f) => f.status === activeTab);
	}, [flags, activeTab]);

	const openCount = useMemo(
		() => flags.filter((f) => f.status === "open").length,
		[flags],
	);

	const handleScan = () => {
		startTransition(async () => {
			try {
				const res = await scanProjectWorkFlags({
					data: { projectId },
				});

				if ("error" in res && res.error) {
					toast.error(String(res.error));
				} else {
					const count = "generatedCount" in res ? res.generatedCount : 0;
					toast.success(
						count > 0
							? `Scan complete: ${count} new work flag(s) identified.`
							: "Scan complete: No new work flags detected.",
					);
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to scan project for work flags.");
			}
		});
	};

	const handleAcknowledge = (flagId: string) => {
		startTransition(async () => {
			try {
				const res = await acknowledgeWorkFlag({
					data: { flagId },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Flag acknowledged.");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to acknowledge flag.");
			}
		});
	};

	const handleDismiss = (flagId: string) => {
		startTransition(async () => {
			try {
				const res = await dismissWorkFlag({
					data: { flagId },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Flag dismissed.");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to dismiss flag.");
			}
		});
	};

	return (
		<div className="space-y-4">
			{/* Standardized Toolbar */}
			<DataTableToolbar>
				<div className="flex items-center gap-2">
					<div className="flex items-center rounded-lg bg-surface-alt p-0.5 border border-border/50">
						{FLAG_TABS.map((tab) => (
							<button
								key={tab.value}
								type="button"
								onClick={() => setActiveTab(tab.value)}
								className={cn(
									"rounded-md px-2.5 py-1 text-xs font-medium transition-all",
									activeTab === tab.value
										? "bg-card text-foreground shadow-xs font-semibold"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{tab.label}
							</button>
						))}
					</div>
					<span className="hidden text-xs text-muted-foreground sm:inline-block ml-2">
						{openCount} open
					</span>
				</div>

				<div className="flex items-center gap-2">
					{access.canContribute && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleScan}
							disabled={isPending}
							className="h-8 text-xs gap-1.5"
						>
							<RefreshCw
								className={`size-3.5 ${isPending ? "animate-spin" : ""}`}
							/>
							Run Rules Scan
						</Button>
					)}
				</div>
			</DataTableToolbar>

			{filteredFlags.length === 0 ? (
				<div className="border border-border/80 bg-card p-12 text-center space-y-2">
					<AlertTriangle className="size-8 mx-auto text-muted-foreground/50" />
					<h4 className="text-sm font-semibold text-foreground">
						No {activeTab === "all" ? "" : activeTab} work flags found
					</h4>
					<p className="text-xs text-muted-foreground max-w-sm mx-auto">
						{activeTab === "open"
							? "Everything looks healthy. No stalled tasks or unlinked work items detected."
							: "No flags in this category."}
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{filteredFlags.map((flag) => (
						<WorkFlagCard
							key={flag.id}
							flag={flag}
							canManage={access.canManage}
							currentUserId={currentUserId}
							isPending={isPending}
							onAcknowledge={handleAcknowledge}
							onDismiss={handleDismiss}
						/>
					))}
				</div>
			)}
		</div>
	);
}
