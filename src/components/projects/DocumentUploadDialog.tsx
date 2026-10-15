"use client";

import { FileUp, UploadCloud } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	supersedeDocument,
	uploadProjectDocument,
} from "@/api/project-documents";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MAX_SIZE_MB = 25;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;

const CATEGORIES = [
	{ value: "sow", label: "Statement of Work (SOW)" },
	{ value: "contract", label: "Master Contract / MSA" },
	{ value: "proposal", label: "Proposal / Pitch" },
	{ value: "design", label: "Design / Architecture" },
	{ value: "report", label: "Status Report / Deliverable" },
	{ value: "minutes", label: "Meeting Minutes" },
	{ value: "other", label: "Other Project Asset" },
] as const;

interface DocumentUploadDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	stages: Array<{ key: string; name: string }>;
	supersedeDocId?: string | null;
	defaultStageKey?: string;
	onSuccess: () => void;
}

export function DocumentUploadDialog({
	open,
	onOpenChange,
	projectId,
	stages,
	supersedeDocId,
	defaultStageKey,
	onSuccess,
}: DocumentUploadDialogProps) {
	const [isPending, startTransition] = useTransition();

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [category, setCategory] = useState<
		"proposal" | "sow" | "contract" | "design" | "report" | "minutes" | "other"
	>("sow");
	const [stageKey, setStageKey] = useState(defaultStageKey || "none");
	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	useEffect(() => {
		if (open) {
			setSelectedFile(null);
			setTitle("");
			setDescription("");
			setCategory("sow");
			setStageKey(defaultStageKey || "none");
		}
	}, [open, defaultStageKey]);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (file.size > MAX_BYTES) {
			toast.error(`File size exceeds maximum allowed ${MAX_SIZE_MB} MB limit.`);
			return;
		}

		setSelectedFile(file);
		if (!title) {
			// Auto-fill title from filename without extension
			const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
			setTitle(nameWithoutExt);
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedFile || !title.trim()) return;

		startTransition(async () => {
			try {
				if (supersedeDocId) {
					const formData = new FormData();
					formData.set("documentId", supersedeDocId);
					formData.set("title", title.trim());
					formData.set("description", description.trim());
					formData.set("category", category);
					formData.set("file", selectedFile);

					const res = await supersedeDocument({ data: formData });

					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success("New version uploaded successfully");
						onOpenChange(false);
						onSuccess();
					}
				} else {
					const formData = new FormData();
					formData.set("projectId", projectId);
					formData.set("stageKey", stageKey === "none" ? "" : stageKey);
					formData.set("title", title.trim());
					formData.set("description", description.trim());
					formData.set("category", category);
					formData.set("file", selectedFile);

					const res = await uploadProjectDocument({ data: formData });

					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success("Document uploaded successfully");
						onOpenChange(false);
						onSuccess();
					}
				}
			} catch (_err) {
				toast.error("Upload failed.");
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={handleSubmit} className="space-y-4">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<FileUp className="size-4" />
							{supersedeDocId ? "Upload New Version" : "Upload Document"}
						</DialogTitle>
						<DialogDescription>
							Files are encrypted and stored in private R2 object storage.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3.5 py-1">
						{/* File Input */}
						<div className="space-y-1.5">
							<Label htmlFor="docFile">
								Select File <span className="text-destructive">*</span>
							</Label>
							<div className="border border-dashed border-border p-4 text-center hover:bg-muted/20 transition-colors">
								<UploadCloud className="size-6 text-muted-foreground mx-auto mb-1.5" />
								<Input
									id="docFile"
									type="file"
									onChange={handleFileChange}
									className="cursor-pointer text-xs"
									required
								/>
								<p className="text-[11px] text-muted-foreground mt-1">
									PDF, DOCX, XLSX, PPTX, PNG, JPG, or ZIP up to 25 MB.
								</p>
							</div>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="docTitle">
								Document Title <span className="text-destructive">*</span>
							</Label>
							<Input
								id="docTitle"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="e.g. Master Services Agreement v2.1"
								required
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label htmlFor="docCat">Category</Label>
								<Select
									value={category}
									onValueChange={(v) => v && setCategory(v as typeof category)}
								>
									<SelectTrigger id="docCat">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{CATEGORIES.map((c) => (
											<SelectItem key={c.value} value={c.value}>
												{c.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{!supersedeDocId && (
								<div className="space-y-1.5">
									<Label htmlFor="docStage">Stage Tag (Optional)</Label>
									<Select
										value={stageKey}
										onValueChange={(v) => v && setStageKey(v)}
									>
										<SelectTrigger id="docStage">
											<SelectValue placeholder="No Stage" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">General / None</SelectItem>
											{stages.map((s) => (
												<SelectItem key={s.key} value={s.key}>
													{s.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							)}
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="docDesc">Description / Changelog</Label>
							<Textarea
								id="docDesc"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Summary of document purpose or changes in this revision..."
								rows={2}
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isPending || !selectedFile || !title.trim()}
						>
							{isPending ? "Uploading..." : "Upload Document"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
