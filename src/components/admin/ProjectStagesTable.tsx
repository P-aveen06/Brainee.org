"use client";

import { Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export interface StageItem {
	id: string;
	key: string;
	name: string;
	description?: string | null;
	sequence: number;
	appliesToType?: string | null;
	isActive: boolean;
}

interface ProjectStagesTableProps {
	stages: StageItem[];
	onEditStage: (stage: StageItem) => void;
}

export function ProjectStagesTable({
	stages,
	onEditStage,
}: ProjectStagesTableProps) {
	return (
		<div className="overflow-hidden rounded-xl border border-border bg-card">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-[80px]">Seq</TableHead>
						<TableHead className="w-[160px]">Key</TableHead>
						<TableHead className="min-w-[160px]">Name</TableHead>
						<TableHead>Description</TableHead>
						<TableHead className="w-[100px]">Status</TableHead>
						<TableHead className="w-[80px] text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{stages.map((stage) => (
						<TableRow key={stage.id}>
							<TableCell className="font-semibold text-xs text-primary">
								#{stage.sequence}
							</TableCell>
							<TableCell className="font-mono text-xs text-muted-foreground">
								{stage.key}
							</TableCell>
							<TableCell className="font-medium text-xs text-foreground">
								{stage.name}
							</TableCell>
							<TableCell className="text-xs text-muted-foreground">
								{stage.description || "—"}
							</TableCell>
							<TableCell>
								<Badge
									variant={stage.isActive ? "outline" : "secondary"}
									className="text-[11px]"
								>
									{stage.isActive ? "Active" : "Disabled"}
								</Badge>
							</TableCell>
							<TableCell className="text-right">
								<Button
									variant="ghost"
									size="icon-xs"
									onClick={() => onEditStage(stage)}
								>
									<Edit className="size-3.5" />
								</Button>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
