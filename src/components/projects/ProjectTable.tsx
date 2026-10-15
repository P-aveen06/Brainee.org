"use client";

import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, FolderKanban, Grid2X2, List, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
	DataTableActions,
	DataTableContainer,
	DataTableFilters,
	DataTableToolbar,
} from "@/components/layout/data-table-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PillToggle } from "@/components/ui/pill-toggle";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatDateDisplay } from "@/lib/date-format";
import { ProjectHealthBadge } from "./ProjectHealthBadge";
import { ProjectStatusBadge } from "./ProjectStatusBadge";

export interface ProjectListItem {
	id: string;
	code: string;
	name: string;
	description?: string | null;
	projectType: string;
	status: string;
	priority: string;
	healthOverride?: string | null;
	currentStageKey?: string | null;
	startDate?: string | null;
	targetEndDate?: string | null;
	ownerId: string;
	ownerName?: string | null;
	ownerEmail?: string | null;
	clientCompanyId?: string | null;
	clientCompanyName?: string | null;
	contractValue?: number | null;
	currency?: string | null;
	createdAt?: Date | null;
}

interface ProjectTableProps {
	projects: ProjectListItem[];
}

export function ProjectTable({ projects }: ProjectTableProps) {
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [view, setView] = useState<"table" | "cards">("cards");

	const filteredProjects = useMemo(() => {
		if (!search.trim()) return projects;
		const q = search.toLowerCase().trim();
		return projects.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				p.code.toLowerCase().includes(q) ||
				p.clientCompanyName?.toLowerCase().includes(q) ||
				p.ownerName?.toLowerCase().includes(q) ||
				p.currentStageKey?.toLowerCase().includes(q),
		);
	}, [projects, search]);

	return (
		<div className="space-y-4">
			<DataTableToolbar>
				<DataTableFilters>
					<div className="relative w-full max-w-sm">
						<Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
						<Input
							placeholder="Search by code, name, client or owner..."
							className="pl-9 h-9"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
				</DataTableFilters>
				<DataTableActions>
					<PillToggle
						items={[
							{
								value: "table",
								label: (
									<span className="flex items-center gap-1.5">
										<List className="size-3.5" />
										Table
									</span>
								),
							},
							{
								value: "cards",
								label: (
									<span className="flex items-center gap-1.5">
										<Grid2X2 className="size-3.5" />
										Cards
									</span>
								),
							},
						]}
						value={view}
						onChange={(value) => setView(value as "table" | "cards")}
						ariaLabel="Project view"
					/>
				</DataTableActions>
			</DataTableToolbar>

			{view === "table" ? (
				<DataTableContainer>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[120px]">Code</TableHead>
								<TableHead className="min-w-[200px]">Project Name</TableHead>
								<TableHead>Client</TableHead>
								<TableHead>Stage</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Health</TableHead>
								<TableHead>Owner</TableHead>
								<TableHead>Target End</TableHead>
								<TableHead className="w-[60px] text-right" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredProjects.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={9}
										className="h-32 text-center text-muted-foreground"
									>
										<div className="flex flex-col items-center justify-center gap-2">
											<FolderKanban className="size-8 opacity-30" />
											<p>No projects found matching your criteria.</p>
										</div>
									</TableCell>
								</TableRow>
							) : (
								filteredProjects.map((project) => (
									<TableRow
										key={project.id}
										className="cursor-pointer hover:bg-muted/50"
										onClick={() =>
											navigate({
												to: "/projects/$id",
												params: { id: project.id },
											})
										}
									>
										<TableCell className="font-mono text-xs font-semibold text-primary">
											{project.code}
										</TableCell>
										<TableCell>
											<div className="min-w-0">
												<p className="font-medium text-foreground truncate">
													{project.name}
												</p>
												{project.description && (
													<p className="text-xs text-muted-foreground truncate max-w-md">
														{project.description}
													</p>
												)}
											</div>
										</TableCell>
										<TableCell className="text-sm text-muted-foreground">
											{project.clientCompanyName ||
												(project.projectType === "internal" ? "Internal" : "—")}
										</TableCell>
										<TableCell>
											<span className="inline-flex items-center rounded-md bg-surface-alt px-2 py-0.5 text-xs font-medium capitalize text-foreground">
												{project.currentStageKey || "planning"}
											</span>
										</TableCell>
										<TableCell>
											<ProjectStatusBadge status={project.status} />
										</TableCell>
										<TableCell>
											<ProjectHealthBadge
												health={project.healthOverride || "green"}
											/>
										</TableCell>
										<TableCell className="text-sm">
											{project.ownerName || "Unassigned"}
										</TableCell>
										<TableCell className="text-xs text-muted-foreground">
											{project.targetEndDate
												? formatDateDisplay(project.targetEndDate)
												: "—"}
										</TableCell>
										<TableCell
											className="text-right"
											onClick={(e) => e.stopPropagation()}
										>
											<Button
												variant="ghost"
												size="icon-xs"
												onClick={() =>
													navigate({
														to: "/projects/$id",
														params: { id: project.id },
													})
												}
											>
												<ArrowRight className="size-4 text-muted-foreground" />
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</DataTableContainer>
			) : filteredProjects.length === 0 ? (
				<Card className="flex min-h-40 flex-col items-center justify-center gap-2 border-dashed p-8 text-center text-muted-foreground">
					<FolderKanban className="size-8 opacity-30" />
					<p className="text-sm">No projects found matching your criteria.</p>
				</Card>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{filteredProjects.map((project) => (
						<Card
							key={project.id}
							className="cursor-pointer p-4 transition-colors hover:border-primary/35 hover:bg-surface/40"
							role="link"
							tabIndex={0}
							onClick={() =>
								navigate({ to: "/projects/$id", params: { id: project.id } })
							}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									navigate({ to: "/projects/$id", params: { id: project.id } });
								}
							}}
						>
							<div className="flex items-start justify-between gap-3">
								<span className="font-mono text-xs font-semibold text-primary">
									{project.code}
								</span>
								<ProjectStatusBadge status={project.status} />
							</div>
							<h3 className="mt-3 line-clamp-2 font-heading text-base font-semibold text-foreground">
								{project.name}
							</h3>
							<p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
								{project.description || "No project description."}
							</p>
							<div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-xs">
								<div>
									<span className="block text-muted-foreground">Client</span>
									<span className="mt-0.5 block truncate font-medium">
										{project.clientCompanyName ||
											(project.projectType === "internal" ? "Internal" : "—")}
									</span>
								</div>
								<div>
									<span className="block text-muted-foreground">Owner</span>
									<span className="mt-0.5 block truncate font-medium">
										{project.ownerName || "Unassigned"}
									</span>
								</div>
								<div>
									<span className="block text-muted-foreground">Stage</span>
									<span className="mt-0.5 block capitalize font-medium">
										{project.currentStageKey || "planning"}
									</span>
								</div>
								<div>
									<span className="block text-muted-foreground">Target</span>
									<span className="mt-0.5 block font-medium">
										{project.targetEndDate
											? formatDateDisplay(project.targetEndDate)
											: "—"}
									</span>
								</div>
							</div>
							<div className="mt-3 flex justify-end">
								<ProjectHealthBadge
									health={project.healthOverride || "green"}
								/>
							</div>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
