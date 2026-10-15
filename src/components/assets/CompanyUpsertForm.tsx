"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CompanyUpsertFormProps {
	isEditing: boolean;
	name: string;
	onNameChange: (val: string) => void;
	code: string;
	onCodeChange: (val: string) => void;
	contactEmail: string;
	onContactEmailChange: (val: string) => void;
	notes: string;
	onNotesChange: (val: string) => void;
	onSubmit: (e: React.FormEvent) => void;
	onCancel: () => void;
	isPending: boolean;
}

export function CompanyUpsertForm({
	isEditing,
	name,
	onNameChange,
	code,
	onCodeChange,
	contactEmail,
	onContactEmailChange,
	notes,
	onNotesChange,
	onSubmit,
	onCancel,
	isPending,
}: CompanyUpsertFormProps) {
	return (
		<Card className="border border-border">
			<CardHeader className="py-3 px-4">
				<CardTitle className="text-sm font-semibold">
					{isEditing ? "Edit Client / Organization" : "New Client Organization"}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-4 pb-4 pt-0">
				<form onSubmit={onSubmit} className="space-y-3">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="compName">
								Company Name <span className="text-destructive">*</span>
							</Label>
							<Input
								id="compName"
								value={name}
								onChange={(e) => onNameChange(e.target.value)}
								placeholder="e.g. Cummins India"
								required
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="compCode">
								Identifier Code <span className="text-destructive">*</span>
							</Label>
							<Input
								id="compCode"
								value={code}
								onChange={(e) => onCodeChange(e.target.value)}
								placeholder="e.g. CUMMINS"
								className="uppercase font-mono"
								required
								disabled={isEditing}
							/>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="compEmail">Contact / IT Admin Email</Label>
						<Input
							id="compEmail"
							type="email"
							value={contactEmail}
							onChange={(e) => onContactEmailChange(e.target.value)}
							placeholder="it-support@clientcompany.com"
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="compNotes">Notes / Contract Details</Label>
						<Textarea
							id="compNotes"
							rows={2}
							value={notes}
							onChange={(e) => onNotesChange(e.target.value)}
							placeholder="MSA reference, engagement terms, equipment policy..."
						/>
					</div>

					<div className="flex items-center justify-end gap-2 pt-2">
						<Button type="button" variant="ghost" size="sm" onClick={onCancel}>
							Cancel
						</Button>
						<Button type="submit" size="sm" disabled={isPending}>
							{isPending
								? "Saving..."
								: isEditing
									? "Update Company"
									: "Add Company"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
