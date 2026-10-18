"use client";

import { ThreadPrimitive, useAuiState } from "@assistant-ui/react";
import { useRouteContext } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	getFollowUpSuggestions,
	getStarterPrompts,
} from "./assistant-suggestions";

export function AssistantSuggestions({
	welcome = false,
}: {
	welcome?: boolean;
}) {
	const { user } = useRouteContext({ from: "/_authenticated" });
	const messages = useAuiState((state) => state.thread.messages);
	const isRunning = useAuiState((state) => state.thread.isRunning);
	if (isRunning || (welcome ? messages.length > 0 : messages.length === 0))
		return null;
	const prompts = welcome
		? getStarterPrompts(user)
		: getFollowUpSuggestions(messages, user).map((prompt) => ({
				title: prompt,
				label: "",
				prompt,
			}));
	if (!prompts.length) return null;

	return (
		<section
			aria-label={welcome ? "Suggested prompts" : "Suggested follow-ups"}
			className={welcome ? "w-full text-left" : "pl-8"}
		>
			{!welcome && (
				<p className="mb-2 text-xs text-muted-foreground">
					Explore your workspace
				</p>
			)}
			<div
				className={
					welcome
						? "grid grid-cols-1 gap-2 sm:grid-cols-2"
						: "flex flex-wrap gap-2"
				}
			>
				{prompts.map((item) => (
					<ThreadPrimitive.Suggestion
						key={item.prompt}
						prompt={item.prompt}
						send={false}
						clearComposer
						asChild
					>
						<Button
							variant={welcome ? "outline" : "ghost"}
							className={
								welcome
									? "group relative h-auto justify-between gap-3 whitespace-normal rounded-xl border border-border/80 bg-card/75 dark:bg-card/50 backdrop-blur-md p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:bg-card/95 hover:shadow-lg hover:shadow-blue-500/5 cursor-pointer"
									: "h-auto max-w-full gap-1.5 whitespace-normal rounded-full border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
							}
						>
							<span className="min-w-0 flex-1">
								<span
									className={
										welcome
											? "block text-xs sm:text-sm font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
											: ""
									}
								>
									{item.title}
								</span>
								{item.label && (
									<span
										className={
											welcome
												? "mt-1 block text-[11px] sm:text-xs font-normal text-muted-foreground line-clamp-1"
												: "mt-1 block text-xs font-normal text-muted-foreground"
										}
									>
										{item.label}
									</span>
								)}
							</span>
							<div
								className={
									welcome
										? "flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-alt/80 dark:bg-surface-alt/40 text-muted-foreground transition-all duration-200 group-hover:bg-blue-500/10 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
										: "shrink-0"
								}
							>
								<ArrowUpRight className="size-3.5" />
							</div>
						</Button>
					</ThreadPrimitive.Suggestion>
				))}
			</div>
		</section>
	);
}
