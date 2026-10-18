import { useRouter } from "@tanstack/react-router";
import { Download, FileText, Plus, Search } from "lucide-react";
import { useState } from "react";
import type { getCompanyPolicyDocuments } from "@/api/company-policy-documents";
import {
	DataTableContainer,
	DataTableToolbar,
} from "@/components/layout/data-table-layout";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PolicyReviewDialog } from "./PolicyReviewDialog";
import { PolicyUploadDialog } from "./PolicyUploadDialog";

type PolicyDocument = Awaited<
	ReturnType<typeof getCompanyPolicyDocuments>
>[number];

export function CompanyPoliciesPanel({
	documents,
}: {
	documents: PolicyDocument[];
}) {
	const router = useRouter();
	const [uploadOpen, setUploadOpen] = useState(false);
	const [revisionOf, setRevisionOf] = useState<PolicyDocument | null>(null);
	const [reviewing, setReviewing] = useState<PolicyDocument | null>(null);
	const [search, setSearch] = useState("");
	const query = search.trim().toLowerCase();
	const filtered = documents.filter((doc) =>
		[doc.title, doc.description, doc.fileName].some((value) =>
			value?.toLowerCase().includes(query),
		),
	);
	const openUpload = (base?: PolicyDocument) => {
		setRevisionOf(base ?? null);
		setUploadOpen(true);
	};
	const closeUpload = () => {
		setUploadOpen(false);
		setRevisionOf(null);
	};

	return (
		<section className="space-y-4" aria-label="Company policy documents">
			<div className="space-y-1">
				<h2 className="text-base font-semibold tracking-tight">
					Company policies
				</h2>
				<p className="text-sm text-muted-foreground">
					Keep company policies and handbooks in one place. Documents are
					currently available to admins only.
				</p>
			</div>
			<DataTableToolbar>
				<div className="relative w-full sm:max-w-xs">
					<Search
						className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
						aria-hidden="true"
					/>
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search policy documents…"
						aria-label="Search policy documents"
						className="pl-9"
					/>
				</div>
				<Button size="sm" onClick={() => openUpload()}>
					<Plus className="size-3.5" aria-hidden="true" />
					Upload document
				</Button>
			</DataTableToolbar>
			{filtered.length === 0 ? (
				<div className="space-y-3 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
					<FileText
						className="mx-auto size-9 stroke-1 text-muted-foreground"
						aria-hidden="true"
					/>
					<p className="text-sm font-medium">
						{documents.length
							? "No matching policies"
							: "No policy documents yet"}
					</p>
					<p className="text-xs text-muted-foreground">
						{documents.length
							? "Try a different title, description, or file name."
							: "Upload your employee handbook, leave policy, or other company guidelines."}
					</p>
					{!documents.length && (
						<Button variant="outline" size="sm" onClick={() => openUpload()}>
							Upload your first document
						</Button>
					)}
				</div>
			) : (
				<DataTableContainer>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Document</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Version</TableHead>
								<TableHead>Size</TableHead>
								<TableHead>Uploaded by</TableHead>
								<TableHead>Date</TableHead>
								<TableHead>
									<span className="sr-only">Actions</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filtered.map((doc) => (
								<TableRow key={doc.id}>
									<TableCell className="min-w-56 max-w-sm whitespace-normal">
										<div className="flex gap-3">
											<FileText
												className="mt-0.5 size-4 shrink-0 text-muted-foreground"
												aria-hidden="true"
											/>
											<div className="min-w-0 space-y-1">
												<p className="break-words font-medium">{doc.title}</p>
												{doc.description && (
													<p className="break-words text-xs text-muted-foreground">
														{doc.description}
													</p>
												)}
												<p className="break-all text-xs text-muted-foreground">
													{doc.fileName}
												</p>
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Badge
											variant={
												doc.status === "published"
													? "success"
													: doc.status === "archived"
														? "outline"
														: "warning"
											}
										>
											{doc.status}
										</Badge>
									</TableCell>
									<TableCell className="text-xs">v{doc.version}</TableCell>
									<TableCell className="text-xs text-muted-foreground">
										{doc.sizeBytes >= 1024 * 1024
											? `${(doc.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
											: `${Math.max(1, Math.ceil(doc.sizeBytes / 1024))} KB`}
									</TableCell>
									<TableCell className="text-xs">
										{doc.uploaderName || "—"}
									</TableCell>
									<TableCell className="text-xs text-muted-foreground">
										{new Date(doc.createdAt).toLocaleDateString("en-GB", {
											day: "2-digit",
											month: "short",
											year: "numeric",
											timeZone: "Asia/Kolkata",
										})}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-1">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setReviewing(doc)}
											>
												Review
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => openUpload(doc)}
											>
												New revision
											</Button>
											<a
												href={`/api/company-policies/${doc.id}/download`}
												download
												aria-label={`Download ${doc.title}`}
												title={`Download ${doc.title}`}
												className={cn(
													buttonVariants({
														variant: "ghost",
														size: "icon-sm",
													}),
												)}
											>
												<Download className="size-4" />
												<span className="sr-only">Download {doc.title}</span>
											</a>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</DataTableContainer>
			)}
			<p className="text-xs text-muted-foreground">
				{filtered.length} of {documents.length} document
				{documents.length === 1 ? "" : "s"}
			</p>
			{uploadOpen && (
				<PolicyUploadDialog
					revisionOf={
						revisionOf
							? {
									id: revisionOf.id,
									title: revisionOf.title,
									description: revisionOf.description,
								}
							: undefined
					}
					onClose={closeUpload}
					onSuccess={async () => {
						await router.invalidate();
					}}
				/>
			)}
			{reviewing && (
				<PolicyReviewDialog
					document={reviewing}
					onClose={() => setReviewing(null)}
					onSuccess={async () => {
						await router.invalidate();
					}}
				/>
			)}
		</section>
	);
}
