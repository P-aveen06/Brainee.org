"use client";

import { Check, Copy, FileCheck2, Mail, RefreshCw, Save } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
	finaliseEodReport,
	generateEodReport,
	saveEodReport,
} from "@/api/project-eod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectAccess } from "@/lib/project-access";

export interface ProjectEodReportData {
	id: string;
	projectId: string;
	date: string;
	generatedById: string | null;
	generatorName: string | null;
	contentDraft: string | null;
	contentFinal: string | null;
	status: string;
	missingSubmitters: string | null;
	finalisedAt: Date | null;
	createdAt: Date | null;
	updatedAt: Date | null;
}

interface EodReportEditorProps {
	projectId: string;
	date: string;
	report: ProjectEodReportData;
	access: ProjectAccess;
	onSuccess: () => void;
}

export function EodReportEditor({
	projectId,
	date,
	report,
	access,
	onSuccess,
}: EodReportEditorProps) {
	const [content, setContent] = useState(
		report.contentFinal || report.contentDraft || "",
	);
	const [copied, setCopied] = useState(false);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		setContent(report.contentFinal || report.contentDraft || "");
	}, [report]);

	const isFinalised = report.status === "finalised";

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(content);
			setCopied(true);
			toast.success("EOD report copied to clipboard!");
			setTimeout(() => setCopied(false), 2000);
		} catch (_err) {
			toast.error("Failed to copy report to clipboard.");
		}
	};

	const handleEmailPoc = () => {
		let subject = `[EOD Update] Project Update | ${date}`;
		let body = content;

		// If the report begins with "Subject:\n...", parse subject line cleanly
		const subjectMatch = content.match(/^Subject:\s*([^\n]+)/i);
		if (subjectMatch) {
			subject = subjectMatch[1].trim();
			// Remove the Subject prefix and email format header if present
			body = content
				.replace(/^Subject:\s*[^\n]+\n*/i, "")
				.replace(/^Email Format:\s*\n*/i, "")
				.trim();
		}

		const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
		window.open(mailtoUrl, "_blank");
	};

	const handleSave = () => {
		startTransition(async () => {
			try {
				const res = await saveEodReport({
					data: {
						reportId: report.id,
						contentFinal: content,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("EOD report changes saved.");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to save report.");
			}
		});
	};

	const handleRegenerate = () => {
		startTransition(async () => {
			try {
				const res = await generateEodReport({
					data: { projectId, date },
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("EOD report re-assembled from latest updates!");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to re-generate report.");
			}
		});
	};

	const handleFinalise = () => {
		startTransition(async () => {
			try {
				const res = await finaliseEodReport({
					data: {
						reportId: report.id,
						contentFinal: content,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success("EOD report finalised!");
					onSuccess();
				}
			} catch (_err) {
				toast.error("Failed to finalise report.");
			}
		});
	};

	return (
		<div className="border border-border bg-card p-4 space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
				<div>
					<div className="flex items-center gap-2">
						<h4 className="font-heading text-sm font-semibold text-foreground">
							EOD Report ({date})
						</h4>
						<Badge
							variant={isFinalised ? "default" : "outline"}
							className={`text-[10px] uppercase tracking-wider ${
								isFinalised ? "bg-emerald-600" : ""
							}`}
						>
							{report.status}
						</Badge>
					</div>
					<p className="text-xs text-muted-foreground mt-0.5">
						Assembled by {report.generatorName || "System"}. Editable text ready
						to copy and share with stakeholders.
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleCopy}
						className="h-8 text-xs"
					>
						{copied ? (
							<Check className="mr-1.5 size-3.5 text-emerald-600" />
						) : (
							<Copy className="mr-1.5 size-3.5" />
						)}
						{copied ? "Copied!" : "Copy Report"}
					</Button>

					<Button
						variant="outline"
						size="sm"
						onClick={handleEmailPoc}
						className="h-8 text-xs text-primary"
						title="Open pre-filled email in your email client"
					>
						<Mail className="mr-1.5 size-3.5" />
						Email POC
					</Button>

					{access.canContribute && !isFinalised && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleRegenerate}
							disabled={isPending}
							className="h-8 text-xs"
						>
							<RefreshCw
								className={`mr-1.5 size-3.5 ${isPending ? "animate-spin" : ""}`}
							/>
							Regenerate
						</Button>
					)}

					{access.canContribute && !isFinalised && (
						<Button
							variant="secondary"
							size="sm"
							onClick={handleSave}
							disabled={isPending}
							className="h-8 text-xs"
						>
							<Save className="mr-1.5 size-3.5" />
							Save Edits
						</Button>
					)}

					{access.canManage && !isFinalised && (
						<Button
							size="sm"
							onClick={handleFinalise}
							disabled={isPending}
							className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
						>
							<FileCheck2 className="mr-1.5 size-3.5" />
							Finalise Report
						</Button>
					)}
				</div>
			</div>

			<Textarea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				disabled={isFinalised}
				rows={16}
				className="font-mono text-xs leading-relaxed bg-background"
			/>
		</div>
	);
}
