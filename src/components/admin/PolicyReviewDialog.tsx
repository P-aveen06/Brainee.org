import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	archiveCompanyPolicyDocument,
	type getCompanyPolicyDocuments,
	publishCompanyPolicyDocument,
} from "@/api/company-policy-documents";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type PolicyDocument = Awaited<
	ReturnType<typeof getCompanyPolicyDocuments>
>[number];

function formatDate(value: Date | null) {
	return value
		? new Date(value).toLocaleDateString("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
				timeZone: "Asia/Kolkata",
			})
		: "—";
}

function formatDateTime(value: Date | null) {
	return value
		? new Date(value).toLocaleString("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				timeZone: "Asia/Kolkata",
			})
		: "—";
}

export function PolicyReviewDialog({
	document,
	onClose,
	onSuccess,
}: {
	document: PolicyDocument;
	onClose: () => void;
	onSuccess: () => Promise<void>;
}) {
	const [effectiveDate, setEffectiveDate] = useState("");
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState("");
	const [confirmArchive, setConfirmArchive] = useState(false);

	async function publish() {
		if (!effectiveDate || isPending) return;
		setIsPending(true);
		setError("");
		try {
			const result = await publishCompanyPolicyDocument({
				data: { documentId: document.id, effectiveDate },
			});
			if ("error" in result) {
				setError(result.error);
				return;
			}
			toast.success("Policy document published");
			await onSuccess();
			onClose();
		} catch {
			setError("Could not publish this document. Refresh and try again.");
		} finally {
			setIsPending(false);
		}
	}

	async function archive() {
		if (isPending) return;
		setIsPending(true);
		setError("");
		try {
			const result = await archiveCompanyPolicyDocument({
				data: { documentId: document.id },
			});
			if ("error" in result) {
				setError(result.error);
				return;
			}
			toast.success("Policy document archived");
			await onSuccess();
			onClose();
		} catch {
			setError("Could not archive this document. Refresh and try again.");
		} finally {
			setIsPending(false);
		}
	}

	const size =
		document.sizeBytes >= 1024 * 1024
			? `${(document.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
			: `${Math.max(1, Math.ceil(document.sizeBytes / 1024))} KB`;

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !isPending) onClose();
			}}
		>
			<DialogContent className="sm:max-w-lg" showCloseButton={!isPending}>
				<DialogHeader>
					<DialogTitle>Review policy document</DialogTitle>
					<DialogDescription>
						Check the uploaded original and document details before changing its
						publication status.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1">
						<h3 className="font-semibold">{document.title}</h3>
						{document.description && (
							<p className="text-sm text-muted-foreground">
								{document.description}
							</p>
						)}
					</div>
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
						<dt className="text-muted-foreground">Original file</dt>
						<dd className="break-all">
							{document.fileName} ({size})
						</dd>
						<dt className="text-muted-foreground">Uploaded by</dt>
						<dd>{document.uploaderName || "Unknown administrator"}</dd>
						<dt className="text-muted-foreground">Uploaded</dt>
						<dd>{formatDateTime(document.createdAt)}</dd>
						<dt className="text-muted-foreground">Version</dt>
						<dd>
							v{document.version}
							{document.revisionOfId && (
								<span className="text-muted-foreground">
									{" "}
									(revision of {document.revisionOfId})
								</span>
							)}
						</dd>
						{document.status === "published" && (
							<>
								<dt className="text-muted-foreground">Published by</dt>
								<dd>
									{document.publisherName || document.publishedById || "—"}
								</dd>
								<dt className="text-muted-foreground">Published</dt>
								<dd>{formatDateTime(document.publishedAt)}</dd>
								<dt className="text-muted-foreground">Effective date</dt>
								<dd>{formatDate(document.effectiveDate)}</dd>
							</>
						)}
						{document.status === "archived" && (
							<>
								<dt className="text-muted-foreground">Archived by</dt>
								<dd>{document.archiverName || document.archivedById || "—"}</dd>
								<dt className="text-muted-foreground">Archived</dt>
								<dd>{formatDateTime(document.archivedAt)}</dd>
							</>
						)}
					</dl>
					<a
						href={`/api/company-policies/${document.id}/download`}
						download
						className={cn(
							buttonVariants({ variant: "outline", size: "sm" }),
							"w-fit",
						)}
					>
						<Download className="size-3.5" />
						Download original
					</a>
					{document.status === "draft" && (
						<div className="space-y-1.5">
							<Label htmlFor="policy-effective-date">Effective date</Label>
							<Input
								id="policy-effective-date"
								type="date"
								value={effectiveDate}
								onChange={(event) => setEffectiveDate(event.target.value)}
								required
								disabled={isPending}
							/>
							<p className="text-xs text-muted-foreground">
								Publishing records you as the administrator and saves this date.
							</p>
						</div>
					)}
					{document.status === "published" && (
						<p className="text-sm text-muted-foreground">
							Publishing does not change who can access this document.
						</p>
					)}
					{confirmArchive && (
						<p className="text-sm text-muted-foreground">
							Archive this document? Archived documents cannot be published
							again.
						</p>
					)}
					{error && (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					)}
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={onClose}
						disabled={isPending}
					>
						Close
					</Button>
					{document.status !== "archived" && !confirmArchive && (
						<Button
							type="button"
							variant="destructive"
							onClick={() => setConfirmArchive(true)}
							disabled={isPending}
						>
							Archive
						</Button>
					)}
					{document.status !== "archived" && confirmArchive && (
						<Button
							type="button"
							variant="destructive"
							onClick={archive}
							disabled={isPending}
						>
							{isPending ? "Archiving…" : "Confirm archive"}
						</Button>
					)}
					{document.status === "draft" && (
						<Button
							type="button"
							onClick={publish}
							disabled={!effectiveDate || isPending}
						>
							{isPending ? "Publishing…" : "Publish document"}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
