"use client";

import { useRouter } from "@tanstack/react-router";
import { Edit2, Plus, Trash } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteLeaveType } from "#/api/admin";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/date-format";
import { LeaveTypeSheet } from "./LeaveTypeSheet";

type LeaveTypeRow = {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	default_days: number;
	accrual_per_year?: number;
	created_at: string;
	apply_before_days?: number;
	apply_before_days_extended?: number;
	extended_limit_trigger?: number;
};

type EmployeeOption = {
	id: string;
	name: string;
	email: string;
	birthday?: string | null;
};

export function LeaveTypeManager({
	initialTypes,
	employees,
}: {
	initialTypes: LeaveTypeRow[];
	employees: EmployeeOption[];
}) {
	const router = useRouter();
	const [types, setTypes] = useState<LeaveTypeRow[]>(initialTypes);
	const [isPending, startTransition] = useTransition();
	const [isOpen, setIsOpen] = useState(false);
	const [selectedType, setSelectedType] = useState<LeaveTypeRow | null>(null);

	const handleOpenSheet = () => {
		setSelectedType(null);
		setIsOpen(true);
	};

	const handleEdit = (type: LeaveTypeRow) => {
		setSelectedType(type);
		setIsOpen(true);
	};

	const handleSave = (saved: LeaveTypeRow) => {
		if (selectedType) {
			setTypes(types.map((t) => (t.id === saved.id ? saved : t)));
		} else {
			setTypes([...types, saved]);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure? This cannot be undone.")) return;

		startTransition(async () => {
			const result = await deleteLeaveType({ data: id });

			if ("error" in result && result.error) {
				toast.error("Delete failed", { description: result.error });
				return;
			}

			toast.success("Leave type deleted");
			router.invalidate();
			setTypes(types.filter((t) => t.id !== id));
		});
	};

	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<h2 className="font-heading text-base font-semibold tracking-tight">
					Leave Types
				</h2>
				<Button
					type="button"
					className="rounded-full"
					onClick={handleOpenSheet}
				>
					<Plus className="h-4 w-4 mr-2" />
					New Leave Type
				</Button>
			</div>

			<div className="rounded-lg border border-border bg-card">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Default Days</TableHead>
							<TableHead>Advance Rules</TableHead>
							<TableHead>Created</TableHead>
							<TableHead className="w-[120px]"></TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{types.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={5}
									className="text-center py-8 text-muted-foreground"
								>
									No leave types defined.
								</TableCell>
							</TableRow>
						) : (
							types.map((type) => (
								<TableRow key={type.id}>
									<TableCell className="font-medium">{type.name}</TableCell>
									<TableCell>{type.default_days}</TableCell>
									<TableCell className="text-xs">
										{type.apply_before_days ? (
											<span>
												{type.apply_before_days}d
												{type.extended_limit_trigger ? (
													<span className="text-muted-foreground ml-1">
														/ {type.apply_before_days_extended}d (if ≥{" "}
														{type.extended_limit_trigger}d)
													</span>
												) : (
													""
												)}
											</span>
										) : (
											<span className="text-muted-foreground">None</span>
										)}
									</TableCell>
									<TableCell>
										{formatDateDisplay(new Date(type.created_at))}
									</TableCell>
									<TableCell className="text-right">
										<Button
											variant="ghost"
											size="icon"
											onClick={() => handleEdit(type)}
											disabled={isPending}
											className="text-muted-foreground hover:text-foreground"
										>
											<Edit2 className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => handleDelete(type.id)}
											disabled={isPending}
											className="text-muted-foreground hover:text-destructive"
										>
											<Trash className="h-4 w-4" />
										</Button>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{isOpen && (
				<LeaveTypeSheet
					open={isOpen}
					onOpenChange={setIsOpen}
					selectedType={selectedType}
					employees={employees}
					onSave={handleSave}
				/>
			)}
		</div>
	);
}
