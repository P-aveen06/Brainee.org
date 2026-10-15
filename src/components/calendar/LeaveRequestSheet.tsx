"use client";

import type { ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetBody,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { LeaveRequestForm } from "./LeaveRequestForm";

type LeaveRequestSheetProps = {
	trigger?: ReactElement;
	initialDate?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export function LeaveRequestSheet({
	trigger,
	initialDate,
	open,
	onOpenChange,
}: LeaveRequestSheetProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			{trigger !== undefined ? (
				<SheetTrigger render={trigger}>Apply for Leave</SheetTrigger>
			) : !open && onOpenChange === undefined ? (
				<SheetTrigger render={<Button type="button" variant="default" />}>
					Apply for Leave
				</SheetTrigger>
			) : null}
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Apply for Leave</SheetTitle>
				</SheetHeader>
				<SheetBody>
					<LeaveRequestForm initialDate={initialDate} className="space-y-4" />
				</SheetBody>
			</SheetContent>
		</Sheet>
	);
}
