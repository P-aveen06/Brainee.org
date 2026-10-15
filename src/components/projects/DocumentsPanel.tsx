"use client";

import { FileText, Plus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteProjectDocument } from "@/api/project-documents";
import {
	DataTableContainer,
	DataTableToolbar,
} from "@/components/layout/data-table-layout";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ProjectAccess } from "@/lib/project-access";
import { DocumentTableRow } from "./DocumentTableRow";
import { DocumentUploadDialog } from "./DocumentUploadDialog";
import {
	type DocumentItemData,
	DocumentVersionHistoryDialog,
} from "./DocumentVersionHistoryDialog";

interface DocumentsPanelProps {
	projectId: string;
	stages: Array<{ key: string; name: string }>;
	documents: DocumentItemData[];
	access: ProjectAccess;
	onSuccess: () => void;
}

export function DocumentsPanel({
	projectId,
	stages,
	documents,
	access,
	onSuccess,
}: DocumentsPanelProps) {
	const [isPending, startTransition] = useTransition();
	const [uploadOpen, setUploadOpen] = useState(false);
	const [supersedeDocId, setSupersedeDocId] = useState<string | null>(null);

	// Version history modal state
	const [historyOpen, setHistoryOpen] = useState(false);
	const [historyDoc, setHistoryDoc] = useState<DocumentItemData | null>(null);

	// Only show latest versions on the main table (status !== 'superseded')
	const activeDocs = useMemo(
		() => documents.filter((d) => d.status !== "superseded"),
		[documents],
	);

	const handleDownload = (docId: string) => {
		const a = document.createElement("a");
		a.href = `/api/documents/${docId}/download`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	};

	const handleDelete = (docId: string) => {
		startTransition(async () => {
			try {
				const res = await deleteProjectDocument({
					data: { documentId: docId },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("Document deleted");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to delete document.");
			}
		});
	};

	const openHistoryFor = (doc: DocumentItemData) => {
		setHistoryDoc(doc);
		setHistoryOpen(true);
	};

	return (
		<div className="space-y-4">
			{/* Standardized Toolbar */}
			<DataTableToolbar>
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted-foreground">
						{activeDocs.length} document{activeDocs.length === 1 ? "" : "s"}
					</span>
				</div>

				<div className="flex items-center gap-2">
					{access.canContribute && (
						<Button
							size="sm"
							onClick={() => {
								setSupersedeDocId(null);
								setUploadOpen(true);
							}}
							className="h-8 text-xs gap-1.5"
						>
							<Plus className="size-3.5" />
							Upload Document
						</Button>
					)}
				</div>
			</DataTableToolbar>

			{/* Documents Table */}
			{activeDocs.length === 0 ? (
				<div className="border border-dashed border-border p-12 text-center space-y-3">
					<FileText className="size-9 text-muted-foreground mx-auto stroke-1" />
					<p className="text-sm font-medium text-foreground">
						No project documents uploaded yet.
					</p>
					<p className="text-xs text-muted-foreground">
						Upload statement of work, architecture specs, or client approvals.
					</p>
				</div>
			) : (
				<DataTableContainer>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="min-w-[220px]">Document</TableHead>
								<TableHead className="w-[120px]">Category</TableHead>
								<TableHead className="w-[80px]">Version</TableHead>
								<TableHead className="w-[90px]">Size</TableHead>
								<TableHead className="w-[140px]">Uploaded By</TableHead>
								<TableHead className="w-[120px]">Date</TableHead>
								<TableHead className="w-[80px] text-right" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{activeDocs.map((doc) => (
								<DocumentTableRow
									key={doc.id}
									doc={doc}
									access={access}
									isPending={isPending}
									onDownload={handleDownload}
									onSupersede={(id) => {
										setSupersedeDocId(id);
										setUploadOpen(true);
									}}
									onHistory={openHistoryFor}
									onDelete={handleDelete}
								/>
							))}
						</TableBody>
					</Table>
				</DataTableContainer>
			)}

			{/* Upload / Supersede Dialog */}
			<DocumentUploadDialog
				open={uploadOpen}
				onOpenChange={setUploadOpen}
				projectId={projectId}
				stages={stages}
				supersedeDocId={supersedeDocId}
				onSuccess={onSuccess}
			/>

			{/* Version History Dialog */}
			{historyDoc && (
				<DocumentVersionHistoryDialog
					open={historyOpen}
					onOpenChange={setHistoryOpen}
					documentTitle={historyDoc.title}
					versions={documents.filter(
						(d) =>
							d.id === historyDoc.id ||
							d.supersedesDocumentId === historyDoc.id ||
							historyDoc.supersedesDocumentId === d.id,
					)}
					onDownload={handleDownload}
				/>
			)}
		</div>
	);
}
