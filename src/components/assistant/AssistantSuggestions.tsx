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
		: getFollowUpSuggestions(messages).map((prompt) => ({
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
				<p className="mb-2 text-xs text-muted-foreground">Continue exploring</p>
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
									? "h-auto justify-between gap-3 whitespace-normal p-3 text-left"
									: "h-auto max-w-full gap-1.5 whitespace-normal rounded-full border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
							}
						>
							<span className="min-w-0">
								<span className={welcome ? "block text-sm font-semibold" : ""}>
									{item.title}
								</span>
								{item.label && (
									<span className="mt-1 block text-xs font-normal text-muted-foreground">
										{item.label}
									</span>
								)}
							</span>
							<ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
						</Button>
					</ThreadPrimitive.Suggestion>
				))}
			</div>
		</section>
	);
}
