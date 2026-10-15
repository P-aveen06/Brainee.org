"use client";

import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface TaskStageAssigneeFieldsProps {
	stageKey: string;
	onStageKeyChange: (val: string) => void;
	stages: Array<{ key: string; name: string }>;
	assigneeId: string;
	onAssigneeIdChange: (val: string) => void;
	members: Array<{ userId: string; userName?: string | null }>;
}

export function TaskStageAssigneeFields({
	stageKey,
	onStageKeyChange,
	stages,
	assigneeId,
	onAssigneeIdChange,
	members,
}: TaskStageAssigneeFieldsProps) {
	return (
		<>
			<div className="space-y-1.5">
				<Label htmlFor="stage">Lifecycle Stage</Label>
				<Select
					value={stageKey}
					onValueChange={(v) => {
						if (v) onStageKeyChange(v);
					}}
				>
					<SelectTrigger id="stage">
						<SelectValue placeholder="Select stage" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">General / Unassigned</SelectItem>
						{stages.map((s) => (
							<SelectItem key={s.key} value={s.key}>
								{s.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="sm:col-span-2 space-y-1.5">
				<Label htmlFor="assignee">Assignee</Label>
				<Select
					value={assigneeId}
					onValueChange={(v) => {
						if (v) onAssigneeIdChange(v);
					}}
				>
					<SelectTrigger id="assignee">
						<SelectValue placeholder="Unassigned" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">Unassigned</SelectItem>
						{members.map((m) => (
							<SelectItem key={m.userId} value={m.userId}>
								{m.userName || "Team Member"}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</>
	);
}
