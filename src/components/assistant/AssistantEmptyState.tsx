"use client";

import { ThreadPrimitive } from "@assistant-ui/react";
import { CheckSquare, FolderKanban, Palmtree, Users } from "lucide-react";

interface ActionPrompt {
	icon: React.ReactNode;
	title: string;
	prompt: string;
}

const STARTER_PROMPTS: ActionPrompt[] = [
	{
		icon: <FolderKanban className="size-3.5 text-accent" />,
		title: "Overdue tasks & blockers",
		prompt:
			"What tasks are overdue, blocked, or need immediate attention across projects?",
	},
	{
		icon: <CheckSquare className="size-3.5 text-emerald-600" />,
		title: "Draft today's standup",
		prompt:
			"Review my active tasks and logged hours today, and draft a concise standup update.",
	},
	{
		icon: <Palmtree className="size-3.5 text-amber-600" />,
		title: "My leave & WFH balances",
		prompt:
			"What are my remaining leave balances and WFH allowance for this cycle?",
	},
	{
		icon: <Users className="size-3.5 text-blue-600" />,
		title: "Team schedule & OOO",
		prompt: "Who is on leave or working remotely this week?",
	},
];

export function AssistantEmptyState() {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col items-center justify-center py-6 px-3 text-center space-y-4">
			<div className="size-9 shrink-0 flex items-center justify-center">
				<img
					src="/brainee-logo.svg"
					alt="Brainee.org"
					className="size-8 object-contain"
				/>
			</div>

			<div className="space-y-0.5">
				<h3 className="font-heading font-semibold text-sm text-foreground">
					Brainee.org Brain
				</h3>
				<p className="text-xs text-muted-foreground">
					Ask about tasks, projects, team schedules, or hardware.
				</p>
			</div>

			<div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-left">
				{STARTER_PROMPTS.map((item) => (
					<ThreadPrimitive.Suggestion
						key={item.title}
						prompt={item.prompt}
						method="replace"
						className="group flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 transition-all hover:border-accent/50 hover:bg-surface-alt cursor-pointer shadow-2xs"
					>
						<span className="shrink-0">{item.icon}</span>
						<span className="text-xs font-medium text-foreground truncate group-hover:text-accent">
							{item.title}
						</span>
					</ThreadPrimitive.Suggestion>
				))}
			</div>
		</div>
	);
}
