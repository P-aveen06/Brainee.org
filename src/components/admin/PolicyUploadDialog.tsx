import { UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { uploadCompanyPolicyDocument } from "@/api/company-policy-documents";
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
import { Textarea } from "@/components/ui/textarea";
import {
	POLICY_FILE_ACCEPT,
	validatePolicyFile,
} from "@/lib/company-policy-documents";

interface PolicyUploadDialogProps {
	revisionOf?: { id: string; title: string; description: string | null };
	onClose: () => void;
	onSuccess: () => Promise<void>;
}

export function PolicyUploadDialog({
	revisionOf,
	onClose,
	onSuccess,
}: PolicyUploadDialogProps) {
	const [title, setTitle] = useState(revisionOf?.title ?? "");
	const [description, setDescription] = useState(revisionOf?.description ?? "");
	const [file, setFile] = useState<File | null>(null);
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState("");

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!file || !title.trim() || isPending) return;
		setIsPending(true);
		setError("");
		try {
			const data = new FormData();
			data.set("file", file);
			data.set("title", title.trim());
			data.set("description", description.trim());
			if (revisionOf) data.set("revisionOfId", revisionOf.id);
			const result = await uploadCompanyPolicyDocument({ data });
			if ("error" in result) {
				setError(result.error);
				return;
			}
			toast.success(
				revisionOf
					? "New policy revision uploaded as Draft"
					: "Policy document uploaded as Draft",
			);
			await onSuccess();
			onClose();
		} catch {
			setError("Could not upload the document. Please try again.");
		} finally {
			setIsPending(false);
		}
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !isPending) onClose();
			}}
		>
			<DialogContent className="sm:max-w-md" showCloseButton={!isPending}>
				<form onSubmit={handleSubmit} className="space-y-4">
					<DialogHeader>
						<DialogTitle>
							{revisionOf ? "Upload policy revision" : "Upload policy document"}
						</DialogTitle>
						<DialogDescription>
							{revisionOf
								? `This will create a new Draft revision of ${revisionOf.title}. The existing document stays unchanged.`
								: "Add a company policy to your admin document library. New uploads start as Draft and require review before publication."}
						</DialogDescription>
					</DialogHeader>
					<fieldset disabled={isPending} className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="policy-file">Document</Label>
							<div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/20 p-4">
								<UploadCloud
									className="mx-auto size-6 text-muted-foreground"
									aria-hidden="true"
								/>
								<Input
									id="policy-file"
									type="file"
									accept={POLICY_FILE_ACCEPT}
									required
									aria-describedby="policy-file-help"
									onChange={(event) => {
										setFile(null);
										setError("");
										const selected = event.target.files?.[0];
										if (!selected) return;
										try {
											validatePolicyFile(selected);
											setFile(selected);
											if (!title)
												setTitle(
													selected.name.replace(/\.[^.]+$/, "").slice(0, 200),
												);
										} catch (error) {
											setError(
												error instanceof Error
													? error.message
													: "Choose a supported document.",
											);
											event.target.value = "";
										}
									}}
								/>
								<p
									id="policy-file-help"
									className="text-xs text-muted-foreground"
								>
									PDF, DOC, DOCX, or TXT. Up to 25 MB per document.
								</p>
							</div>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="policy-title">Policy title</Label>
							<Input
								id="policy-title"
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								placeholder="e.g. Employee handbook"
								maxLength={200}
								required
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="policy-description">Description (optional)</Label>
							<Textarea
								id="policy-description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								placeholder="What does this policy cover?"
								maxLength={2000}
								rows={3}
							/>
						</div>
					</fieldset>
					{error && (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					)}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!file || !title.trim() || isPending}
						>
							{isPending ? "Uploading…" : "Upload document"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
