import { AlertCircle } from "lucide-react";

interface RequestViolationAlertProps {
	note: string | null | undefined;
}

export function RequestViolationAlert({ note }: RequestViolationAlertProps) {
	if (!note) return null;
	return (
		<div
			className="mt-2 flex items-start gap-2 rounded-md border border-coral/30 bg-coral/10 p-2.5 text-xs text-coral"
			role="alert"
		>
			<AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
			<div>
				<span className="font-semibold">Advance-notice policy:</span> {note}
			</div>
		</div>
	);
}
