"use client";

import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { UserNode } from "@/lib/org-helper";
import { cn, getInitials } from "@/lib/utils";

interface OrgChartNodeProps {
	node: UserNode;
	matches: Set<string>;
	mustExpand: Set<string>;
	collapsedNodes: Set<string>;
	toggleCollapse: (id: string) => void;
}

export function OrgChartNode({
	node,
	matches,
	mustExpand,
	collapsedNodes,
	toggleCollapse,
}: OrgChartNodeProps) {
	const hasChildren = node.children.length > 0;
	const isCollapsed = collapsedNodes.has(node.id) && !mustExpand.has(node.id);
	const isHighlighted = matches.has(node.id);

	// Get initials for Avatar Fallback
	const initials = getInitials(node.name);

	return (
		<div className="flex flex-col items-center shrink-0">
			{/* Sleek, Compact Node Card - Reduced width, no stroke just fill */}
			<div
				className={cn(
					"w-44 rounded-xl p-2 flex items-center gap-2.5 transition-all duration-200 relative z-10 border-0",
					isHighlighted
						? "bg-accent/15 ring-2 ring-accent/50 scale-[1.02]"
						: "bg-surface-alt hover:bg-surface-alt/80",
				)}
			>
				{/* Soft rounded corners avatar matching --avatar-radius with no border */}
				<Avatar
					size="default"
					className="size-8 rounded-[var(--avatar-radius,8px)] after:rounded-[var(--avatar-radius,8px)] shrink-0 border-0"
				>
					{node.avatar_url ? (
						<AvatarImage
							src={node.avatar_url}
							alt={node.name}
							className="rounded-[var(--avatar-radius,8px)]"
						/>
					) : null}
					<AvatarFallback className="rounded-[var(--avatar-radius,8px)] bg-muted text-foreground text-xs font-semibold border-0">
						{initials}
					</AvatarFallback>
				</Avatar>

				<div className="min-w-0 flex-1">
					<h3 className="font-heading font-semibold text-xs leading-tight text-foreground truncate">
						{node.name}
					</h3>
					<div className="flex items-center gap-1.5 mt-0.5">
						<RoleBadge role={node.role} className="text-[10px] py-0 px-1.5" />
					</div>
				</div>
			</div>

			{/* Children branches with mathematically exact CSS tree connectors */}
			{hasChildren && (
				<div className="flex flex-col items-center w-full">
					{/* Vertical line segment going down from parent card with floating collapse button */}
					<div
						className="relative w-[2px] h-4 bg-border/60 flex items-center justify-center"
						aria-hidden="true"
					>
						<button
							type="button"
							onClick={() => toggleCollapse(node.id)}
							className={cn(
								"absolute z-20 h-4 px-1 rounded-full border-0 bg-surface-alt flex items-center gap-0.5 cursor-pointer transition-all scale-100 hover:scale-110 active:scale-95 shadow-xs text-[10px]",
								isCollapsed
									? "text-muted-foreground hover:bg-muted"
									: "text-accent hover:bg-accent/15",
							)}
							aria-label={
								isCollapsed
									? "Expand direct reports"
									: "Collapse direct reports"
							}
							aria-expanded={!isCollapsed}
						>
							<Users className="size-2.5 shrink-0" />
							{isCollapsed ? (
								<ChevronDown className="size-2 shrink-0" />
							) : (
								<ChevronUp className="size-2 shrink-0" />
							)}
						</button>
					</div>

					{!isCollapsed && (
						<div className="flex relative justify-center">
							{node.children.map((child, idx) => {
								const isFirst = idx === 0;
								const isLast = idx === node.children.length - 1;
								const isOnly = node.children.length === 1;

								return (
									<div
										key={child.id}
										className={cn(
											"relative flex flex-col items-center px-2",
											// Horizontal connector segments meeting seamlessly at 50% center
											!isOnly &&
												!isFirst &&
												"before:content-[''] before:absolute before:top-0 before:left-0 before:w-1/2 before:h-[2px] before:bg-border/60",
											!isOnly &&
												!isLast &&
												"after:content-[''] after:absolute after:top-0 after:right-0 after:w-1/2 after:h-[2px] after:bg-border/60",
										)}
									>
										{/* Vertical connector line segment dropping into child card */}
										<div
											className="w-[2px] h-4 bg-border/60"
											aria-hidden="true"
										/>

										{/* Recursively render direct report child */}
										<OrgChartNode
											node={child}
											matches={matches}
											mustExpand={mustExpand}
											collapsedNodes={collapsedNodes}
											toggleCollapse={toggleCollapse}
										/>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
