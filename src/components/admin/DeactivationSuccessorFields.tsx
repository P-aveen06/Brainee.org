"use client";

import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface UserOption {
	id: string;
	name: string | null;
}

interface DeactivationSuccessorFieldsProps {
	reportCount: number;
	reassignReportsTo: string;
	onReassignReportsToChange: (val: string) => void;
	leadCandidates: UserOption[];
	directReports?: Array<{ name: string | null; email: string | null }>;
}

export function DeactivationSuccessorFields({
	reportCount,
	reassignReportsTo,
	onReassignReportsToChange,
	leadCandidates,
	directReports = [],
}: DeactivationSuccessorFieldsProps) {
	if (reportCount === 0) return null;

	return (
		<div className="space-y-1.5">
			<Label htmlFor="reassignReportsTo">
				New peer lead for {reportCount} report{reportCount === 1 ? "" : "s"}{" "}
				<span className="text-destructive">*</span>
			</Label>
			<Select
				value={reassignReportsTo}
				onValueChange={(val) => {
					if (val) onReassignReportsToChange(val);
				}}
			>
				<SelectTrigger className="w-full" id="reassignReportsTo">
					<SelectValue placeholder="Select a new peer lead">
						{(() => {
							const u = leadCandidates.find((c) => c.id === reassignReportsTo);
							return u?.name || "Select a new peer lead";
						})()}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{leadCandidates.map((candidate) => (
						<SelectItem key={candidate.id} value={candidate.id}>
							{candidate.name || "Unknown"}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<p className="text-xs text-muted-foreground">
				{directReports.map((r) => r.name || r.email).join(", ")}
			</p>
		</div>
	);
}
