"use client";

import {
	ChevronDown,
	ChevronUp,
	Network,
	Search,
	Users,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserNode, UserRecord } from "@/lib/org-helper";
import { buildOrgTree, searchOrgTree } from "@/lib/org-helper";
import { cn, getInitials } from "@/lib/utils";
import { OrgChartNode } from "./OrgChartNode";

interface OrgChartTreeProps {
	users: UserRecord[];
}

// Helper to recursively gather all parent node IDs
const getAllParentIds = (nodes: UserNode[]): string[] => {
	const ids: string[] = [];
	nodes.forEach((node) => {
		if (node.children.length > 0) {
			ids.push(node.id);
			ids.push(...getAllParentIds(node.children));
		}
	});
	return ids;
};

export function OrgChartTree({ users }: OrgChartTreeProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

	// 1. Build Org Tree and search outputs
	const roots = useMemo(() => buildOrgTree(users), [users]);

	const { matches, mustExpand } = useMemo(() => {
		return searchOrgTree(roots, searchQuery);
	}, [roots, searchQuery]);

	const allParentIds = useMemo(() => getAllParentIds(roots), [roots]);

	// 2. Click handlers
	const toggleCollapse = (id: string) => {
		setCollapsedNodes((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleSelectUser = (name: string) => {
		setSearchQuery(name);
		// Expand everything so the selected user is visible
		setCollapsedNodes(new Set());
	};

	const handleClearSearch = () => {
		setSearchQuery("");
		setCollapsedNodes(new Set());
	};

	// 3. Search filtered list of employees for the directory pane
	const filteredUsers = useMemo(() => {
		if (!searchQuery.trim()) return users;
		const q = searchQuery.toLowerCase();
		return users.filter(
			(u) =>
				u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
		);
	}, [users, searchQuery]);

	return (
		<div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-stretch">
			{/* Left Directory Pane: Lists all employees */}
			<div className="xl:col-span-1 flex flex-col bg-card border border-border/50 rounded-xl overflow-hidden h-[650px]">
				<div className="p-4 border-b border-border/40 bg-muted/10 flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Users className="size-4 text-muted-foreground" />
							<h2 className="font-heading font-semibold text-sm">
								Team Directory
							</h2>
						</div>
						<span className="text-xs bg-muted text-muted-foreground font-mono px-2 py-0.5 rounded-full">
							{users.length} members
						</span>
					</div>

					<div className="relative">
						<Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground opacity-70" />
						<Input
							placeholder="Search directory..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8 pr-7 h-8 text-xs"
						/>
						{searchQuery && (
							<Button
								variant="ghost"
								size="icon"
								type="button"
								className="absolute right-0.5 inset-y-0 my-auto size-7 hover:bg-muted"
								onClick={handleClearSearch}
								aria-label="Clear search"
							>
								<X className="size-3" />
							</Button>
						)}
					</div>
				</div>

				{/* Scrollable employee list */}
				<div className="flex-1 overflow-y-auto p-2 space-y-1">
					{filteredUsers.map((u) => {
						const isSel = searchQuery.toLowerCase() === u.name.toLowerCase();
						const initials = getInitials(u.name);

						return (
							<button
								type="button"
								key={u.id}
								onClick={() => handleSelectUser(u.name)}
								className={cn(
									"w-full text-left p-2.5 rounded-lg flex items-center gap-3 transition-colors text-xs border border-transparent",
									isSel
										? "bg-accent/10 border-accent/20 text-accent font-medium"
										: "hover:bg-muted/70 text-foreground",
								)}
							>
								<Avatar className="size-7 rounded-[var(--avatar-radius,8px)] after:rounded-[var(--avatar-radius,8px)] shrink-0">
									{u.avatar_url && (
										<AvatarImage
											src={u.avatar_url}
											className="rounded-[var(--avatar-radius,8px)]"
										/>
									)}
									<AvatarFallback className="rounded-[var(--avatar-radius,8px)] bg-muted/80 text-muted-foreground text-[10px]">
										{initials}
									</AvatarFallback>
								</Avatar>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium">{u.name}</p>
									<p className="text-[10px] text-muted-foreground truncate capitalize">
										{u.role}
									</p>
								</div>
							</button>
						);
					})}
				</div>
			</div>

			{/* Right Canvas Pane: Horizontal branching flowchart tree view */}
			<div className="xl:col-span-3 flex flex-col bg-card border border-border/50 rounded-xl overflow-hidden h-[650px]">
				{/* Canvas Toolbar Controls */}
				<div className="p-4 border-b border-border/40 bg-muted/10 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Network className="size-4 text-muted-foreground" />
						<h2 className="font-heading font-semibold text-sm">
							Levels Diagram
						</h2>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCollapsedNodes(new Set())}
							className="text-xs h-7 px-2.5"
						>
							<ChevronUp className="size-3.5 mr-1" /> Expand All
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCollapsedNodes(new Set(allParentIds))}
							className="text-xs h-7 px-2.5"
						>
							<ChevronDown className="size-3.5 mr-1" /> Collapse All
						</Button>
					</div>
				</div>

				{/* Scrollable Canvas Area with safe auto margin overflow alignment */}
				<div className="flex-1 overflow-auto p-4 md:p-6 bg-muted/5 flex">
					{searchQuery && matches.size === 0 ? (
						<div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground m-auto">
							<Network className="size-12 text-muted-foreground/30 stroke-[1.5] mb-2" />
							<p className="text-sm font-semibold">No levels found</p>
							<p className="text-xs mt-0.5">
								Try searching another employee or clearing your search.
							</p>
						</div>
					) : (
						<div className="flex flex-row gap-8 items-start min-w-max m-auto py-2 justify-center">
							{roots.map((root) => {
								const isMatch = matches.has(root.id) || searchQuery === "";
								const hasMatchingDescendants = root.children.some((child) => {
									const { matches: childMatches } = searchOrgTree(
										[child],
										searchQuery,
									);
									return childMatches.size > 0;
								});

								if (searchQuery !== "" && !isMatch && !hasMatchingDescendants)
									return null;

								return (
									<OrgChartNode
										key={root.id}
										node={root}
										matches={matches}
										mustExpand={mustExpand}
										collapsedNodes={collapsedNodes}
										toggleCollapse={toggleCollapse}
									/>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
