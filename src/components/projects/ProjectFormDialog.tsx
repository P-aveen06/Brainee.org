"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createProject, updateProject } from "@/api/projects";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ProjectCommercialFields } from "./ProjectCommercialFields";
import { ProjectScheduleFields } from "./ProjectScheduleFields";
import { ProjectScopeFields } from "./ProjectScopeFields";

export interface CompanyOption {
	id: string;
	name: string;
	code: string;
}

export interface ProjectToEdit {
	id: string;
	name: string;
	description?: string | null;
	projectType: string;
	clientCompanyId?: string | null;
	clientProjectName?: string | null;
	engagementModel?: string | null;
	contractValue?: number | null;
	currency?: string | null;
	priority: string;
	healthOverride?: string | null;
	startDate?: string | null;
	targetEndDate?: string | null;
}

interface ProjectFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectToEdit?: ProjectToEdit | null;
	companies: CompanyOption[];
	today: string;
	onSuccess: () => void;
}

export function ProjectFormDialog({
	open,
	onOpenChange,
	projectToEdit,
	companies,
	today,
	onSuccess,
}: ProjectFormDialogProps) {
	const [isPending, startTransition] = useTransition();

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [projectType, setProjectType] = useState<
		"client" | "internal" | "poc" | "retainer"
	>("client");
	const [priority, setPriority] = useState<
		"low" | "medium" | "high" | "critical"
	>("medium");
	const [healthOverride, setHealthOverride] = useState<
		"none" | "on_track" | "at_risk" | "off_track"
	>("none");

	// Commercial fields
	const [clientCompanyId, setClientCompanyId] = useState<string>("none");
	const [clientProjectName, setClientProjectName] = useState("");
	const [engagementModel, setEngagementModel] = useState<
		"fixed_bid" | "time_and_materials" | "retainer" | "internal"
	>("time_and_materials");
	const [contractValue, setContractValue] = useState("");
	const [currency, setCurrency] = useState("USD");

	// Schedule
	const [startDate, setStartDate] = useState(today);
	const [targetEndDate, setTargetEndDate] = useState("");

	useEffect(() => {
		if (projectToEdit) {
			setName(projectToEdit.name);
			setDescription(projectToEdit.description || "");
			setProjectType(
				(projectToEdit.projectType as
					| "client"
					| "internal"
					| "poc"
					| "retainer") || "client",
			);
			setPriority(
				(projectToEdit.priority as "low" | "medium" | "high" | "critical") ||
					"medium",
			);
			setHealthOverride(
				(projectToEdit.healthOverride as
					| "none"
					| "on_track"
					| "at_risk"
					| "off_track") || "none",
			);
			setClientCompanyId(projectToEdit.clientCompanyId || "none");
			setClientProjectName(projectToEdit.clientProjectName || "");
			setEngagementModel(
				(projectToEdit.engagementModel as
					| "fixed_bid"
					| "time_and_materials"
					| "retainer"
					| "internal") || "time_and_materials",
			);
			setContractValue(
				projectToEdit.contractValue ? String(projectToEdit.contractValue) : "",
			);
			setCurrency(projectToEdit.currency || "USD");
			setStartDate(projectToEdit.startDate || today);
			setTargetEndDate(projectToEdit.targetEndDate || "");
		} else {
			setName("");
			setDescription("");
			setProjectType("client");
			setPriority("medium");
			setHealthOverride("none");
			setClientCompanyId(companies[0]?.id || "none");
			setClientProjectName("");
			setEngagementModel("time_and_materials");
			setContractValue("");
			setCurrency("USD");
			setStartDate(today);
			setTargetEndDate("");
		}
	}, [projectToEdit, companies, today]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		startTransition(async () => {
			try {
				const payload = {
					name: name.trim(),
					description: description.trim() || undefined,
					projectType,
					priority,
					healthOverride: healthOverride === "none" ? null : healthOverride,
					clientCompanyId: clientCompanyId === "none" ? null : clientCompanyId,
					clientProjectName: clientProjectName.trim() || undefined,
					engagementModel,
					contractValue: contractValue ? Number(contractValue) : null,
					currency,
					startDate: startDate || undefined,
					targetEndDate: targetEndDate || null,
				};

				if (projectToEdit) {
					const res = await updateProject({
						data: {
							projectId: projectToEdit.id,
							...payload,
						},
					});

					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success("Project updated successfully");
						onOpenChange(false);
						onSuccess();
					}
				} else {
					const res = await createProject({
						data: payload,
					});

					if ("error" in res && res.error) {
						toast.error(res.error);
					} else {
						toast.success("Project created successfully");
						onOpenChange(false);
						onSuccess();
					}
				}
			} catch (_err) {
				toast.error("An unexpected error occurred while saving the project.");
			}
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
				<form onSubmit={handleSubmit} className="space-y-4">
					<DialogHeader>
						<DialogTitle>
							{projectToEdit ? "Edit Project Details" : "Create New Project"}
						</DialogTitle>
						<DialogDescription>
							Core scope, commercial terms, and delivery milestones.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-1">
						{/* Basic Scope Subcomponent */}
						<ProjectScopeFields
							name={name}
							onNameChange={setName}
							description={description}
							onDescriptionChange={setDescription}
							projectType={projectType}
							onProjectTypeChange={setProjectType}
							priority={priority}
							onPriorityChange={setPriority}
							healthOverride={healthOverride}
							onHealthOverrideChange={setHealthOverride}
						/>

						{/* Commercial Fields Subcomponent */}
						<ProjectCommercialFields
							companies={companies}
							clientCompanyId={clientCompanyId}
							onClientCompanyIdChange={setClientCompanyId}
							clientProjectName={clientProjectName}
							onClientProjectNameChange={setClientProjectName}
							engagementModel={engagementModel}
							onEngagementModelChange={setEngagementModel}
							contractValue={contractValue}
							onContractValueChange={setContractValue}
							currency={currency}
							onCurrencyChange={setCurrency}
						/>

						{/* Schedule Fields Subcomponent */}
						<ProjectScheduleFields
							startDate={startDate}
							onStartDateChange={setStartDate}
							targetEndDate={targetEndDate}
							onTargetEndDateChange={setTargetEndDate}
						/>
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
						<Button type="submit" disabled={isPending || !name.trim()}>
							{isPending
								? "Saving..."
								: projectToEdit
									? "Save Changes"
									: "Create Project"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
