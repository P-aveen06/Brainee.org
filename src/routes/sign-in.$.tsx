import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { type FormEvent, useState } from "react";
import { loginUser } from "#/api/auth";
import { AuthPageLayout } from "#/components/layout/page-layout";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	type DemoPersona,
	demoPeople,
	demoPersonaLabels,
} from "../../shared/demo-startup";

export const Route = createFileRoute("/sign-in/$")({ component: SignInPage });
const scopes: Record<DemoPersona, string> = {
	ceo: "Review all ten projects, delivery risks, staffing, and company operations.",
	hr: "Review people, reporting lines, availability, and your own attendance.",
	lead: "Manage your assigned projects, team priorities, and direct-report approvals.",
	architect:
		"Review architecture, dependencies, and technical risks across all ten projects.",
	employee:
		"Work on your assigned projects, tasks, daily updates, and personal requests.",
};
function SignInPage() {
	const [persona, setPersona] = useState<DemoPersona>("ceo");
	const [employeeId, setEmployeeId] = useState("sample-admin");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const people = demoPeople.filter((person) => person.persona === persona);
	const selected = people.find((person) => person.id === employeeId);
	async function handleSignIn(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (isLoading || !selected) return;
		setIsLoading(true);
		setError(null);
		try {
			const result = await loginUser({ data: { employeeId } });
			if (result.error) {
				setError(result.error);
				setIsLoading(false);
				return;
			}
			window.location.assign("/assistant");
		} catch {
			setError("Unable to sign in. Please try again.");
			setIsLoading(false);
		}
	}
	return (
		<AuthPageLayout>
			<Card className="space-y-6 rounded-2xl border-border bg-card p-6 shadow-sm sm:p-8">
				<div className="space-y-3">
					<img
						src="/brainee-logo.svg"
						alt="Brainee.org"
						className="size-11 object-contain"
					/>
					<div>
						<p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
							Northstar Studio · Startup demo
						</p>
						<h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-foreground">
							One company. Every perspective.
						</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							Choose a teammate and explore the workspace through their role.
						</p>
					</div>
				</div>
				<form
					onSubmit={handleSignIn}
					className="space-y-4"
					aria-busy={isLoading}
				>
					<div className="space-y-2">
						<Label htmlFor="persona">Role</Label>
						<Select
							value={persona}
							disabled={isLoading}
							onValueChange={(value) => {
								if (!value) return;
								const next = value as DemoPersona;
								setPersona(next);
								setEmployeeId(
									demoPeople.find((person) => person.persona === next)?.id ??
										"",
								);
								setError(null);
							}}
						>
							<SelectTrigger id="persona" className="h-10 w-full">
								<SelectValue>{demoPersonaLabels[persona]}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{Object.entries(demoPersonaLabels).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label} ·{" "}
										{
											demoPeople.filter((person) => person.persona === value)
												.length
										}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="employee">Teammate</Label>
						<Select
							value={employeeId}
							disabled={isLoading}
							onValueChange={(value) => {
								if (value) {
									setEmployeeId(value);
									setError(null);
								}
							}}
						>
							<SelectTrigger id="employee" className="h-10 w-full">
								<SelectValue>{selected?.name}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{people.map((person) => (
									<SelectItem key={person.id} value={person.id}>
										{person.name} · {person.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="rounded-xl border border-border bg-surface-alt p-3">
						<p className="text-sm font-semibold">{selected?.title}</p>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
							{scopes[persona]}
						</p>
					</div>
					{error && (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					)}
					<Button
						type="submit"
						disabled={isLoading || !selected}
						size="lg"
						className="w-full bg-foreground font-extrabold text-background hover:bg-foreground/90"
					>
						{isLoading
							? "Opening workspace..."
							: `Continue as ${selected?.name.split(" ")[0] ?? "teammate"}`}
						<ArrowRight className="size-4" />
					</Button>
				</form>
				<div className="rounded-xl bg-pale-purple p-4 text-left">
					<p className="flex items-center gap-2 text-sm font-semibold">
						<Sparkles className="size-4 text-ai-pink" />
						Company Brain
					</p>
					<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
						Start with a briefing for your role. Get answers grounded in the
						projects, people, and work you can access.
					</p>
				</div>
				<p className="text-center font-mono text-[10px] text-muted-foreground">
					14 teammates · 10 projects · 6 clients · Local demo
				</p>
			</Card>
		</AuthPageLayout>
	);
}
