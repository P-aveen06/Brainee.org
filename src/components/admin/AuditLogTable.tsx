"use client";

import { Link } from "@tanstack/react-router";
import { endOfDay, isAfter, isBefore, startOfDay } from "date-fns";
import { ChevronDown, ChevronRight, Filter } from "lucide-react";
import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateTimeDisplay } from "@/lib/date-format";

type AuditLog = {
	id: string;
	created_at: string;
	action: string;
	entity_type: string;
	entity_id: string;
	old_data: JsonValue;
	new_data: JsonValue;
	actor: {
		id: string;
		name: string;
		email: string;
	} | null;
};

type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

import {
	DataTableContainer,
	DataTableFilters,
	DataTableToolbar,
} from "@/components/layout/data-table-layout";

export function AuditLogTable({ logs }: { logs: AuditLog[] }) {
	const [actionFilter, setActionFilter] = useState("all");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
	const actionFilterLabel =
		actionFilter === "create"
			? "Create"
			: actionFilter === "update"
				? "Update"
				: actionFilter === "delete"
					? "Delete"
					: "All Actions";

	const toggleRow = (id: string) => {
		const newSet = new Set(expandedRows);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		setExpandedRows(newSet);
	};

	const filteredLogs = logs.filter((log) => {
		if (actionFilter !== "all" && log.action !== actionFilter) return false;

		const logDate = new Date(log.created_at);
		if (startDate && isBefore(logDate, startOfDay(new Date(startDate))))
			return false;
		if (endDate && isAfter(logDate, endOfDay(new Date(endDate)))) return false;

		return true;
	});

	const getActionColor = (action: string) => {
		switch (action.toLowerCase()) {
			case "create":
				return "bg-pale-green text-accent";
			case "update":
				return "bg-pale-blue text-action-blue";
			case "delete":
				return "bg-status-leave text-destructive";
			default:
				return "bg-secondary text-muted-foreground";
		}
	};

	return (
		<div className="space-y-4">
			<DataTableToolbar>
				<DataTableFilters>
					<div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
						<Filter className="h-4 w-4" />
						<span className="hidden sm:inline">Filters</span>
					</div>

					<Select
						value={actionFilter}
						onValueChange={(val) => {
							if (val) setActionFilter(val);
						}}
					>
						<SelectTrigger className="w-[130px] sm:w-[150px] bg-background">
							<SelectValue placeholder="Action">
								{actionFilterLabel}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Actions</SelectItem>
							<SelectItem value="create">Create</SelectItem>
							<SelectItem value="update">Update</SelectItem>
							<SelectItem value="delete">Delete</SelectItem>
						</SelectContent>
					</Select>

					<div className="flex items-center gap-2">
						<DatePicker
							value={startDate}
							onChange={setStartDate}
							className="w-[120px] sm:w-[140px] bg-background text-sm"
						/>
						<span className="text-muted-foreground text-sm">to</span>
						<DatePicker
							value={endDate}
							onChange={setEndDate}
							className="w-[120px] sm:w-[140px] bg-background text-sm"
						/>
					</div>
				</DataTableFilters>
			</DataTableToolbar>

			<DataTableContainer>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[40px]"></TableHead>
							<TableHead>Timestamp</TableHead>
							<TableHead>Actor</TableHead>
							<TableHead>Action</TableHead>
							<TableHead>Entity</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredLogs.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={5}
									className="text-center py-8 text-muted-foreground"
								>
									No matching logs found.
								</TableCell>
							</TableRow>
						) : (
							filteredLogs.map((log) => {
								const isExpanded = expandedRows.has(log.id);
								return (
									<React.Fragment key={log.id}>
										<TableRow
											className="cursor-pointer hover:bg-secondary transition-colors"
											onClick={() => toggleRow(log.id)}
										>
											<TableCell>
												{isExpanded ? (
													<ChevronDown className="h-4 w-4 text-muted-foreground" />
												) : (
													<ChevronRight className="h-4 w-4 text-muted-foreground" />
												)}
											</TableCell>
											<TableCell className="whitespace-nowrap">
												{formatDateTimeDisplay(log.created_at)}
											</TableCell>
											<TableCell>
												{log.actor ? (
													<div className="flex flex-col">
														<Link
															to="/admin/employees/$id"
															params={{ id: log.actor.id }}
															className="hover:underline hover:text-primary transition-colors"
														>
															<span className="font-medium">
																{log.actor.name}
															</span>
														</Link>
														<span className="text-xs text-muted-foreground">
															{log.actor.email}
														</span>
													</div>
												) : (
													<span className="text-muted-foreground">System</span>
												)}
											</TableCell>
											<TableCell>
												<Badge
													variant="outline"
													className={getActionColor(log.action)}
												>
													{log.action.toUpperCase()}
												</Badge>
											</TableCell>
											<TableCell>
												<div className="flex flex-col">
													<span className="font-medium">{log.entity_type}</span>
													<span
														className="text-xs text-muted-foreground truncate max-w-[150px]"
														title={log.entity_id}
													>
														{log.entity_id}
													</span>
												</div>
											</TableCell>
										</TableRow>
										{isExpanded && (
											<TableRow className="bg-secondary">
												<TableCell colSpan={5} className="p-4">
													<div className="grid grid-cols-2 gap-4">
														<div>
															<div className="font-medium text-xs mb-2 text-muted-foreground">
																Old Data
															</div>
															<pre className="p-4 rounded-md bg-muted text-xs overflow-x-auto border">
																{log.old_data
																	? JSON.stringify(log.old_data, null, 2)
																	: "null"}
															</pre>
														</div>
														<div>
															<div className="font-medium text-xs mb-2 text-muted-foreground">
																New Data
															</div>
															<pre className="p-4 rounded-md bg-muted text-xs overflow-x-auto border">
																{log.new_data
																	? JSON.stringify(log.new_data, null, 2)
																	: "null"}
															</pre>
														</div>
													</div>
												</TableCell>
											</TableRow>
										)}
									</React.Fragment>
								);
							})
						)}
					</TableBody>
				</Table>
			</DataTableContainer>
		</div>
	);
}
