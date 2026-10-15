"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface AdvancePolicyFormProps {
	enablePolicy: boolean;
	setEnablePolicy: (val: boolean) => void;
	applyBeforeDays: string;
	setApplyBeforeDays: (val: string) => void;
	extendedLimitTrigger: string;
	setExtendedLimitTrigger: (val: string) => void;
	applyBeforeDaysExtended: string;
	setApplyBeforeDaysExtended: (val: string) => void;
	isPending: boolean;
}

export function AdvancePolicyForm({
	enablePolicy,
	setEnablePolicy,
	applyBeforeDays,
	setApplyBeforeDays,
	extendedLimitTrigger,
	setExtendedLimitTrigger,
	applyBeforeDaysExtended,
	setApplyBeforeDaysExtended,
	isPending,
}: AdvancePolicyFormProps) {
	return (
		<div className="space-y-4 border-t border-border pt-4">
			<label
				htmlFor="require-advance-notice"
				className="flex cursor-pointer items-center gap-2 select-none"
			>
				<Checkbox
					id="require-advance-notice"
					checked={enablePolicy}
					onCheckedChange={(checked) => {
						const isChecked = Boolean(checked);
						setEnablePolicy(isChecked);
						if (!isChecked) {
							setApplyBeforeDays("0");
							setApplyBeforeDaysExtended("0");
							setExtendedLimitTrigger("0");
						}
					}}
					disabled={isPending}
				/>
				<span className="text-sm font-semibold">Require advance notice</span>
			</label>

			{enablePolicy && (
				<div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
					<div className="grid gap-3">
						<div className="flex flex-wrap items-center gap-2">
							<span className="min-w-24 flex-1 text-sm font-medium text-foreground">
								Any leave
							</span>
							<Input
								type="number"
								min="0"
								className="h-9 w-20 text-center"
								value={applyBeforeDays}
								onChange={(e) => setApplyBeforeDays(e.target.value)}
								disabled={isPending}
							/>
							<span className="text-sm text-muted-foreground">days before</span>
						</div>

						<div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
							<span className="min-w-24 flex-1 text-sm font-medium text-foreground">
								If duration is
							</span>
							<Input
								type="number"
								min="0"
								className="h-9 w-20 text-center"
								value={extendedLimitTrigger}
								onChange={(e) => setExtendedLimitTrigger(e.target.value)}
								disabled={isPending}
							/>
							<span className="text-sm text-muted-foreground">+ days</span>
							<Input
								type="number"
								min="0"
								className="h-9 w-20 text-center"
								value={applyBeforeDaysExtended}
								onChange={(e) => setApplyBeforeDaysExtended(e.target.value)}
								disabled={isPending}
							/>
							<span className="text-sm text-muted-foreground">days before</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
