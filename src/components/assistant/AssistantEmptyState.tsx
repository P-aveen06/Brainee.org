"use client";

import { useRouteContext } from "@tanstack/react-router";
import { callerTitle } from "@/lib/ai/persona-context";
import { AssistantSuggestions } from "./AssistantSuggestions";
import { BrainRippleBackground } from "./BrainRippleBackground";

export function AssistantEmptyState() {
	const { user } = useRouteContext({ from: "/_authenticated" });
	return (
		<div className="relative isolate flex min-h-[calc(100dvh-10rem)] w-full flex-1 flex-col items-center justify-center overflow-hidden px-4 py-8 text-center sm:px-8">
			{/* Concentric Wave Ripple Background (Inspired by Kore.ai) */}
			<BrainRippleBackground />

			{/* Foreground Content */}
			<div className="relative z-10 flex w-full max-w-xl flex-col items-center justify-center gap-6">
				{/* Epicenter Logo Orb */}
				<div className="relative flex items-center justify-center group">
					<div className="absolute -inset-2.5 rounded-full bg-gradient-to-tr from-blue-400/35 via-sky-300/25 to-indigo-400/35 blur-xl animate-pulse" />
					<div className="relative flex size-12 items-center justify-center rounded-2xl border border-blue-200/80 bg-white/85 dark:border-blue-500/30 dark:bg-card/85 backdrop-blur-md shadow-lg shadow-blue-500/10 transition-transform duration-300 group-hover:scale-105">
						<img
							src="/brainee-logo.svg"
							alt="Brainee.org"
							className="size-7 object-contain drop-shadow-2xs"
						/>
					</div>
				</div>

				{/* Welcome Typography */}
				<div className="space-y-2">
					<h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
						What needs your attention, {user.name.split(" ")[0]}?
					</h2>
					<p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
						Company Brain for your work as {callerTitle(user)}. Start with a
						briefing or ask a question about your team and work.
					</p>
				</div>

				{/* Quick Action Prompts */}
				<AssistantSuggestions welcome />
			</div>
		</div>
	);
}
