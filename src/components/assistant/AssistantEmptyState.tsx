"use client";

import { useRouteContext } from "@tanstack/react-router";
import { callerTitle } from "@/lib/ai/persona-context";
import { AssistantSuggestions } from "./AssistantSuggestions";

export function AssistantEmptyState() {
	const { user } = useRouteContext({ from: "/_authenticated" });
	return (
		<div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-6 px-4 py-12 text-center sm:px-8 sm:py-16">
			<img
				src="/brainee-logo.svg"
				alt="Brainee.org"
				className="size-9 object-contain"
			/>
			<div className="space-y-2">
				<h3 className="font-heading text-xl font-semibold tracking-tight text-foreground">
					What needs your attention, {user.name.split(" ")[0]}?
				</h3>
				<p className="text-sm text-muted-foreground">
					Company Brain for your work as {callerTitle(user)}. Start with a
					briefing or ask a question about your team and work.
				</p>
			</div>
			<AssistantSuggestions welcome />
		</div>
	);
}
