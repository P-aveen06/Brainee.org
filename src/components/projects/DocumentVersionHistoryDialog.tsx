"use client";

import { Download, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/date-format";

export interface DocumentItemData {
	id: string;
	projectId: string;
	stageKey?: string | null;
	title: string;
	description?: string | null;
	category: string;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	version: number;
	supersedesDocumentId?: string | null;
	status: string;
	uploadedById?: string | null;
	uploaderName?: string | null;
	uploaderEmail?: string | null;
	createdAt?: Date | null;
}

interface DocumentVersionHistoryDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	documentTitle: string;
	versions: DocumentItemData[];
	onDownload: (docId: string) => void;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentVersionHistoryDialog({
	open,
	onOpenChange,
	documentTitle,
	versions,
	onDownload,
}: DocumentVersionHistoryDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<History className="size-4 text-primary" />
						Revision Lineage
					</DialogTitle>
					<DialogDescription>
						All historical versions of <strong>{documentTitle}</strong>.
					</DialogDescription>
				</DialogHeader>

				<div className="border border-border overflow-hidden bg-card mt-2">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[70px]">Version</TableHead>
								<TableHead>Filename / Size</TableHead>
								<TableHead>Uploader</TableHead>
								<TableHead>Date</TableHead>
								<TableHead className="w-[50px] text-right" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{versions.map((v) => (
								<TableRow key={v.id}>
									<TableCell>
										<Badge
											variant={v.status === "final" ? "default" : "outline"}
											className="font-mono text-[10px]"
										>
											v{v.version}
										</Badge>
									</TableCell>
									<TableCell>
										<p className="text-xs font-medium text-foreground truncate max-w-[140px]">
											{v.fileName}
										</p>
										<p className="text-[10px] text-muted-foreground">
											{formatBytes(v.sizeBytes)}
										</p>
									</TableCell>
									<TableCell className="text-xs text-muted-foreground">
										{v.uploaderName || "—"}
									</TableCell>
									<TableCell className="text-xs text-muted-foreground">
										{v.createdAt ? formatDateDisplay(v.createdAt) : "—"}
									</TableCell>
									<TableCell className="text-right">
										<Button
											variant="ghost"
											size="icon-xs"
											className="size-7"
											onClick={() => onDownload(v.id)}
											title="Download this version"
										>
											<Download className="size-3.5" />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</DialogContent>
		</Dialog>
	);
}
