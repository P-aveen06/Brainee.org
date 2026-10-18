"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
	confirmAiProposedAction,
	rejectAiProposedAction,
} from "@/api/ai-assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProposedActionItem } from "./ProposedActionCard";

export function EditableTaskProposal({
	action,
	onActionResolved,
}: {
	action: ProposedActionItem;
	onActionResolved?: () => void;
}) {
	const [title, setTitle] = useState(String(action.payload.title ?? ""));
	const [description, setDescription] = useState(
		String(action.payload.description ?? ""),
	);
	const [hours, setHours] = useState(
		action.payload.estimateHours == null
			? ""
			: String(action.payload.estimateHours),
	);
	const [status, setStatus] = useState(action.status);
	const [pending, startTransition] = useTransition();
	const estimate = action.payload.adaptationAssumptions
		? (() => {
				try {
					return JSON.parse(String(action.payload.adaptationAssumptions))
						.estimate;
				} catch {
					return undefined;
				}
			})()
		: undefined;
	const confirm = () =>
		startTransition(async () => {
			try {
				const result = await confirmAiProposedAction({
					data: {
						proposalId: action.id,
						edits: {
							title,
							description,
							estimateHours: hours.trim() ? Number(hours) : null,
						},
					},
				});
				if ("error" in result) {
					toast.error(String(result.error));
					return;
				}
				setStatus("confirmed");
				toast.success("Task created with its source reference.");
				onActionResolved?.();
			} catch {
				toast.error(
					"Task could not be created. Check the draft and try again.",
				);
			}
		});
	const reject = () =>
		startTransition(async () => {
			try {
				const result = await rejectAiProposedAction({
					data: { proposalId: action.id },
				});
				if ("error" in result) {
					toast.error(String(result.error));
					return;
				}
				setStatus("rejected");
				onActionResolved?.();
			} catch {
				toast.error("Draft could not be dismissed.");
			}
		});
	const disabled = pending || status !== "pending";
	return (
		<Card className="my-3">
			<CardHeader>
				<CardTitle>Review task draft</CardTitle>
				<p className="text-sm text-muted-foreground">
					{status === "pending"
						? "Edit this task before creating it. Its historical reference is retained."
						: `Draft ${status}.`}
				</p>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="space-y-1">
					<Label htmlFor={`${action.id}-title`}>Title</Label>
					<Input
						id={`${action.id}-title`}
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						disabled={disabled}
					/>
				</div>
				<div className="space-y-1">
					<Label htmlFor={`${action.id}-description`}>
						Scope and assumptions
					</Label>
					<Textarea
						id={`${action.id}-description`}
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						disabled={disabled}
					/>
				</div>
				<div className="space-y-1">
					<Label htmlFor={`${action.id}-hours`}>
						Estimated hours (leave blank if unknown)
					</Label>
					<Input
						id={`${action.id}-hours`}
						type="number"
						min="0"
						step="0.1"
						value={hours}
						onChange={(event) => setHours(event.target.value)}
						disabled={disabled}
					/>
				</div>
				{estimate && (
					<p className="text-sm text-muted-foreground">
						Historical estimate: {estimate.historicalEstimate ?? "unknown"}{" "}
						hours. Recorded actual: {estimate.historicalActual ?? "unknown"}{" "}
						hours. Evidence: {estimate.confidence}.{" "}
						{estimate.missingEvidence?.join(" ")}
					</p>
				)}
				{status === "pending" && (
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={reject} disabled={pending}>
							Dismiss
						</Button>
						<Button
							onClick={confirm}
							disabled={
								pending ||
								!title.trim() ||
								(hours !== "" &&
									(!Number.isFinite(Number(hours)) || Number(hours) < 0))
							}
						>
							Create task
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
