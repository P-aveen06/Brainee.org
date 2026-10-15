"use client";

import { useRouter } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateWfhPolicy } from "#/api/wfh-policy";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WfhPolicyForm({
	initialAllowance,
}: {
	initialAllowance: number;
}) {
	const router = useRouter();
	const [allowance, setAllowance] = useState(String(initialAllowance));
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const handleSubmit = () => {
		setError(null);
		const annualAllowance = Number(allowance);
		startTransition(async () => {
			const result = await updateWfhPolicy({ data: { annualAllowance } });
			if ("error" in result && typeof result.error === "string") {
				setError(result.error);
				toast.error("WFH policy update failed", { description: result.error });
				return;
			}

			setAllowance(String(result.annualAllowance));
			toast.success("WFH allowance updated");
			router.invalidate();
		});
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>WFH Allowance</CardTitle>
				<CardDescription>
					Global annual allowance for each employee’s birthday-month cycle.
					Pending and approved requests both reserve this allowance.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="wfh_annual_allowance">
							WFH days per employee (each cycle)
						</Label>
						<Input
							id="wfh_annual_allowance"
							type="number"
							min="0.5"
							max="365"
							step="0.5"
							value={allowance}
							onChange={(event) => setAllowance(event.target.value)}
							required
						/>
					</div>

					{error ? <p className="text-sm text-destructive">{error}</p> : null}

					<Button
						type="submit"
						disabled={isPending}
						className="w-full sm:w-auto"
					>
						{isPending ? "Saving..." : "Save WFH Allowance"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
