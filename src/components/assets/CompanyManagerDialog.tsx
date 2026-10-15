import { Building2, Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCompany, updateCompany } from "@/api/deployments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
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
import { CompanyUpsertForm } from "./CompanyUpsertForm";

interface CompanyItem {
	id: string;
	name: string;
	code: string;
	isInternal: boolean;
	contactEmail: string | null;
	notes: string | null;
	assetCount?: number;
	activeDeploymentsCount?: number;
}

interface CompanyManagerDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	companies: CompanyItem[];
	onSuccess: () => void;
}

export function CompanyManagerDialog({
	open,
	onOpenChange,
	companies,
	onSuccess,
}: CompanyManagerDialogProps) {
	const [isPending, startTransition] = useTransition();

	const [isAdding, setIsAdding] = useState(false);
	const [editingCompany, setEditingCompany] = useState<CompanyItem | null>(
		null,
	);

	const [name, setName] = useState("");
	const [code, setCode] = useState("");
	const [isInternal, setIsInternal] = useState(false);
	const [contactEmail, setContactEmail] = useState("");
	const [notes, setNotes] = useState("");

	const resetForm = () => {
		setName("");
		setCode("");
		setIsInternal(false);
		setContactEmail("");
		setNotes("");
		setEditingCompany(null);
		setIsAdding(false);
	};

	const startEdit = (c: CompanyItem) => {
		setEditingCompany(c);
		setName(c.name);
		setCode(c.code);
		setIsInternal(c.isInternal);
		setContactEmail(c.contactEmail || "");
		setNotes(c.notes || "");
		setIsAdding(true);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!name.trim() || !code.trim()) {
			toast.error("Please enter company name and code.");
			return;
		}

		startTransition(async () => {
			try {
				if (editingCompany) {
					const res = await updateCompany({
						data: {
							id: editingCompany.id,
							name: name.trim(),
							code: code.trim().toUpperCase(),
							isInternal,
							contactEmail: contactEmail.trim() || null,
							notes: notes.trim() || null,
						},
					});
					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success("Company updated successfully");
						resetForm();
						onSuccess();
					}
				} else {
					const res = await createCompany({
						data: {
							name: name.trim(),
							code: code.trim().toUpperCase(),
							isInternal,
							contactEmail: contactEmail.trim() || null,
							notes: notes.trim() || null,
						},
					});
					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success("Client company added");
						resetForm();
						onSuccess();
					}
				}
			} catch (_err) {
				toast.error("Failed to save company");
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
				<DialogHeader className="pr-6">
					<DialogTitle className="flex items-center gap-2">
						<Building2 className="size-5 text-muted-foreground" /> Companies &
						Client Directory
					</DialogTitle>
					<DialogDescription>
						Manage Brainee.org and client organizations (Company B, Company C) for
						hardware ownership and employee deployments.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-1">
					{/* Add / Edit Form */}
					{isAdding ? (
						<CompanyUpsertForm
							isEditing={Boolean(editingCompany)}
							name={name}
							onNameChange={setName}
							code={code}
							onCodeChange={(c) => setCode(c.toUpperCase())}
							contactEmail={contactEmail}
							onContactEmailChange={setContactEmail}
							notes={notes}
							onNotesChange={setNotes}
							onSubmit={handleSubmit}
							onCancel={resetForm}
							isPending={isPending}
						/>
					) : (
						<div className="flex justify-end">
							<Button
								onClick={() => {
									resetForm();
									setIsAdding(true);
								}}
								size="sm"
								className="gap-1.5"
							>
								<Plus className="size-4" /> Add Client Company
							</Button>
						</div>
					)}

					{/* Companies Table */}
					<div className="rounded-lg border border-border overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Company Name</TableHead>
									<TableHead>Code</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Contact</TableHead>
									<TableHead className="text-right">Action</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{companies.map((c) => (
									<TableRow key={c.id}>
										<TableCell className="font-medium">
											<div className="space-y-0.5">
												<span className="text-foreground">{c.name}</span>
												{c.notes && (
													<span className="text-xs text-muted-foreground block truncate max-w-[200px]">
														{c.notes}
													</span>
												)}
											</div>
										</TableCell>
										<TableCell className="font-mono text-xs">
											{c.code}
										</TableCell>
										<TableCell>
											<Badge
												variant={c.isInternal ? "default" : "secondary"}
												className="text-[11px] inline-flex items-center gap-1"
											>
												<Building2 className="size-3" />
												<span>
													{c.isInternal ? "Internal (Brainee.org)" : "Client Partner"}
												</span>
											</Badge>
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{c.contactEmail || "-"}
										</TableCell>
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="sm"
												className="size-7 p-0"
												onClick={() => startEdit(c)}
											>
												<Pencil className="size-3.5" />
											</Button>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
