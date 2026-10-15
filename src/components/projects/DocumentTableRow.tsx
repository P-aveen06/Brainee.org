"use client";

import { Download, History, MoreVertical, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/date-format";
import type { ProjectAccess } from "@/lib/project-access";
import type { DocumentItemData } from "./DocumentVersionHistoryDialog";

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentTableRowProps {
	doc: DocumentItemData;
	access: ProjectAccess;
	isPending: boolean;
	onDownload: (id: string) => void;
	onSupersede: (id: string) => void;
	onHistory: (doc: DocumentItemData) => void;
	onDelete: (id: string) => void;
}

export function DocumentTableRow({
	doc,
	access,
	isPending,
	onDownload,
	onSupersede,
	onHistory,
	onDelete,
}: DocumentTableRowProps) {
	return (
		<TableRow>
			<TableCell>
				<div className="space-y-0.5">
					<p className="text-xs font-semibold text-foreground leading-snug">
						{doc.title}
					</p>
					<p className="text-[11px] text-muted-foreground font-mono truncate max-w-sm">
						{doc.fileName}
					</p>
				</div>
			</TableCell>
			<TableCell>
				<Badge variant="outline" className="capitalize text-[10px]">
					{doc.category}
				</Badge>
			</TableCell>
			<TableCell>
				{doc.version > 1 ? (
					<button
						type="button"
						className="cursor-pointer font-mono text-[10px] text-primary hover:underline flex items-center gap-1 font-semibold"
						onClick={() => onHistory(doc)}
						title="View revision history"
					>
						v{doc.version}
						<History className="size-2.5" />
					</button>
				) : (
					<span className="font-mono text-[10px] text-muted-foreground">
						v1
					</span>
				)}
			</TableCell>
			<TableCell className="text-xs font-mono text-muted-foreground">
				{formatBytes(doc.sizeBytes)}
			</TableCell>
			<TableCell className="text-xs text-muted-foreground">
				{doc.uploaderName || "—"}
			</TableCell>
			<TableCell className="text-xs text-muted-foreground">
				{doc.createdAt ? formatDateDisplay(doc.createdAt) : "—"}
			</TableCell>
			<TableCell className="text-right">
				<div className="flex items-center justify-end gap-1">
					<Button
						variant="ghost"
						size="icon-xs"
						className="size-7"
						onClick={() => onDownload(doc.id)}
						disabled={isPending}
						title="Download file"
					>
						<Download className="size-3.5" />
					</Button>

					{access.canContribute && (
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										variant="ghost"
										size="icon-xs"
										className="size-7 p-0"
									/>
								}
							>
								<MoreVertical className="size-3.5 text-muted-foreground" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => onSupersede(doc.id)}>
									<Upload className="mr-2 size-3.5" />
									Upload New Version
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => onHistory(doc)}>
									<History className="mr-2 size-3.5" />
									Revision History
								</DropdownMenuItem>
								{access.canManage && (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											onClick={() => onDelete(doc.id)}
										>
											<Trash2 className="mr-2 size-3.5" />
											Delete Document
										</DropdownMenuItem>
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</TableCell>
		</TableRow>
	);
}
