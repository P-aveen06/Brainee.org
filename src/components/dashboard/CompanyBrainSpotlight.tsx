import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSidebar } from "@/components/ui/sidebar";

const topics = ["Projects", "People", "Tasks", "Equipment"];

export function CompanyBrainSpotlight() {
	const { isMobile, setOpen, setOpenMobile } = useSidebar();

	return (
		<Card
			variant="elevated"
			className="relative isolate overflow-hidden bg-pale-purple"
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-ai-cyan/15 blur-3xl"
			/>
			<div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
				<div className="flex min-w-0 items-start gap-3.5">
					<div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card shadow-sm">
						<img
							src="/brainee-logo.svg"
							alt=""
							className="size-7 object-contain"
						/>
					</div>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
								Company Brain
							</p>
							<Badge variant="ai" className="h-5 gap-1 px-2 text-[10px]">
								<Sparkles aria-hidden="true" />
								Connected team context
							</Badge>
						</div>
						<h2 className="mt-1 font-heading text-lg font-bold tracking-[-0.035em] text-foreground">
							Your work, with the full picture
						</h2>
						<p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
							Ask one question across projects, people, tasks, and equipment to
							get answers grounded in your company’s context.
						</p>
						<ul
							aria-label="Company Brain topics"
							className="mt-3 flex flex-wrap gap-1.5"
						>
							{topics.map((topic) => (
								<li
									key={topic}
									className="rounded-full border border-border/70 bg-card/80 px-2.5 py-1 text-[11px] font-medium text-foreground/80"
								>
									{topic}
								</li>
							))}
						</ul>
					</div>
				</div>
				<Button
					render={<Link to="/assistant" />}
					nativeButton={false}
					size="lg"
					onClick={() => {
						if (isMobile) setOpenMobile(false);
						else setOpen(false);
					}}
					className="w-full shrink-0 sm:w-auto"
				>
					Ask Company Brain
					<ArrowRight aria-hidden="true" />
				</Button>
			</div>
		</Card>
	);
}
