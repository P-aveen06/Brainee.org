"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import {
	DataTableActions,
	DataTableContainer,
	DataTableToolbar,
} from "@/components/layout/data-table-layout";
import { Badge } from "@/components/ui/badge";
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
import { HolidayDialog } from "./HolidayDialog";

type HolidayRow = {
	id: string;
	date: string;
	name: string;
	description: string | null;
	year: number;
};

type HolidayListProps = {
	holidays: HolidayRow[];
	year: number;
};

export function HolidayList({ holidays, year }: HolidayListProps) {
	const [selectedHoliday, setSelectedHoliday] = useState<HolidayRow | null>(
		null,
	);
	const [dialogOpen, setDialogOpen] = useState(false);

	const handleEditClick = (holiday: HolidayRow) => {
		setSelectedHoliday(holiday);
		setDialogOpen(true);
	};

	const handleAddClick = () => {
		setSelectedHoliday(null);
		setDialogOpen(true);
	};

	return (
		<div className="space-y-4">
			<DataTableToolbar>
				<div className="text-sm text-muted-foreground">
					Showing holidays for {year}
				</div>
				<DataTableActions>
					<Button onClick={handleAddClick} className="rounded-full">
						<Plus className="mr-2 h-4 w-4" /> Add Holiday
					</Button>
				</DataTableActions>
			</DataTableToolbar>

			<DataTableContainer>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[150px]">Date</TableHead>
							<TableHead className="w-[200px]">Name</TableHead>
							<TableHead>Description</TableHead>
							<TableHead className="w-[100px] text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{holidays.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={4}
									className="text-center h-24 text-muted-foreground"
								>
									No holidays found for {year}.
								</TableCell>
							</TableRow>
						) : (
							holidays.map((holiday) => (
								<TableRow key={holiday.id}>
									<TableCell className="font-medium">
										<div className="flex items-center gap-2">
											{formatDateDisplay(holiday.date)}
											{holiday.year === 0 && (
												<Badge
													variant="outline"
													className="border-status-holiday-foreground/30 text-status-holiday-foreground bg-status-holiday px-2 py-0.5 rounded-full text-[10px]"
												>
													Every Year
												</Badge>
											)}
										</div>
									</TableCell>
									<TableCell>{holiday.name}</TableCell>
									<TableCell className="text-muted-foreground truncate max-w-[300px]">
										{holiday.description || "-"}
									</TableCell>
									<TableCell className="text-right">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleEditClick(holiday)}
										>
											Edit
										</Button>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</DataTableContainer>

			<HolidayDialog
				key={
					dialogOpen ? (selectedHoliday ? selectedHoliday.id : "new") : "closed"
				}
				holiday={selectedHoliday}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				year={year}
			/>
		</div>
	);
}
