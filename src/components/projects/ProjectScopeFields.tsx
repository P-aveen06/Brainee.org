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
import { Textarea } from "@/components/ui/textarea";

interface ProjectScopeFieldsProps {
	name: string;
	onNameChange: (v: string) => void;
	description: string;
	onDescriptionChange: (v: string) => void;
	projectType: "client" | "internal" | "poc" | "retainer";
	onProjectTypeChange: (v: "client" | "internal" | "poc" | "retainer") => void;
	priority: "low" | "medium" | "high" | "critical";
	onPriorityChange: (v: "low" | "medium" | "high" | "critical") => void;
	healthOverride: "none" | "on_track" | "at_risk" | "off_track";
	onHealthOverrideChange: (
		v: "none" | "on_track" | "at_risk" | "off_track",
	) => void;
}

export function ProjectScopeFields({
	name,
	onNameChange,
	description,
	onDescriptionChange,
	projectType,
	onProjectTypeChange,
	priority,
	onPriorityChange,
	healthOverride,
	onHealthOverrideChange,
}: ProjectScopeFieldsProps) {
	return (
		<>
			<div className="space-y-1.5">
				<Label htmlFor="projectName">
					Project Name <span className="text-destructive">*</span>
				</Label>
				<Input
					id="projectName"
					value={name}
					onChange={(e) => onNameChange(e.target.value)}
					placeholder="e.g. Trade Promotion Management"
					required
					autoFocus
				/>
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="projectDescription">Scope / Description</Label>
				<Textarea
					id="projectDescription"
					value={description}
					onChange={(e) => onDescriptionChange(e.target.value)}
					placeholder="Brief summary of project goals and scope..."
					rows={2}
				/>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
				<div className="space-y-1.5">
					<Label htmlFor="projectType">Project Type</Label>
					<Select
						value={projectType}
						onValueChange={(v) =>
							v && onProjectTypeChange(v as typeof projectType)
						}
					>
						<SelectTrigger id="projectType">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="client">Client Delivery</SelectItem>
							<SelectItem value="internal">Internal Project</SelectItem>
							<SelectItem value="poc">Proof of Concept</SelectItem>
							<SelectItem value="retainer">Managed Retainer</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="priority">Initial Priority</Label>
					<Select
						value={priority}
						onValueChange={(v) => v && onPriorityChange(v as typeof priority)}
					>
						<SelectTrigger id="priority">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="low">Low</SelectItem>
							<SelectItem value="medium">Medium</SelectItem>
							<SelectItem value="high">High</SelectItem>
							<SelectItem value="critical">Critical</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="health">Health Override</Label>
					<Select
						value={healthOverride}
						onValueChange={(v) =>
							v && onHealthOverrideChange(v as typeof healthOverride)
						}
					>
						<SelectTrigger id="health">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">Automatic (Calculated)</SelectItem>
							<SelectItem value="on_track">On Track</SelectItem>
							<SelectItem value="at_risk">At Risk</SelectItem>
							<SelectItem value="off_track">Off Track</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>
		</>
	);
}
