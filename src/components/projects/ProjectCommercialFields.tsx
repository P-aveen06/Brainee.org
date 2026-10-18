"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { CompanyOption } from "./ProjectFormDialog";

interface ProjectCommercialFieldsProps {
	companies: CompanyOption[];
	clientCompanyId: string;
	onClientCompanyIdChange: (v: string) => void;
	clientProjectName: string;
	onClientProjectNameChange: (v: string) => void;
	engagementModel: "fixed_bid" | "time_and_materials" | "retainer" | "internal";
	onEngagementModelChange: (
		v: "fixed_bid" | "time_and_materials" | "retainer" | "internal",
	) => void;
	contractValue: string;
	onContractValueChange: (v: string) => void;
	currency: string;
	onCurrencyChange: (v: string) => void;
}

export function ProjectCommercialFields({
	companies,
	clientCompanyId,
	onClientCompanyIdChange,
	clientProjectName,
	onClientProjectNameChange,
	engagementModel,
	onEngagementModelChange,
	contractValue,
	onContractValueChange,
	currency,
	onCurrencyChange,
}: ProjectCommercialFieldsProps) {
	return (
		<div className="space-y-3.5 pt-2 border-t border-border">
			<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
				Client & Commercial Terms
			</h4>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
				<div className="space-y-1.5">
					<Label htmlFor="clientCompanyId">Client Organization</Label>
					<Select
						value={clientCompanyId}
						onValueChange={(v) => v && onClientCompanyIdChange(v)}
					>
						<SelectTrigger id="clientCompanyId">
							<SelectValue placeholder="Select client company" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">Internal / None</SelectItem>
							{companies.map((c) => (
								<SelectItem key={c.id} value={c.id}>
									{c.name} ({c.code})
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="clientProjectName">Client Project Code / PO #</Label>
					<Input
						id="clientProjectName"
						value={clientProjectName}
						onChange={(e) => onClientProjectNameChange(e.target.value)}
						placeholder="e.g. UL-NA-2026-10"
					/>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
				<div className="space-y-1.5">
					<Label htmlFor="engagementModel">Engagement Model</Label>
					<Select
						value={engagementModel}
						onValueChange={(v) =>
							v && onEngagementModelChange(v as typeof engagementModel)
						}
					>
						<SelectTrigger id="engagementModel">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="time_and_materials">T&M (Hourly)</SelectItem>
							<SelectItem value="fixed_bid">Fixed Price Milestone</SelectItem>
							<SelectItem value="retainer">Monthly Retainer</SelectItem>
							<SelectItem value="internal">Internal Overhead</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="contractValue">Contract Value</Label>
					<Input
						id="contractValue"
						type="number"
						value={contractValue}
						onChange={(e) => onContractValueChange(e.target.value)}
						placeholder="e.g. 50000"
					/>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="currency">Currency</Label>
					<Select
						value={currency}
						onValueChange={(v) => v && onCurrencyChange(v)}
					>
						<SelectTrigger id="currency">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="USD">USD ($)</SelectItem>
							<SelectItem value="EUR">EUR (€)</SelectItem>
							<SelectItem value="GBP">GBP (£)</SelectItem>
							<SelectItem value="INR">INR (₹)</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	);
}
