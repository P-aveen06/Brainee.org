import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { checkOnboardingUser, completeOnboarding } from "../api/users";
import { AuthPageLayout } from "../components/layout/page-layout";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { getTodayIsoDate } from "../lib/leave-policy";

export const Route = createFileRoute("/onboarding")({
	beforeLoad: async () => {
		const user = await checkOnboardingUser();
		if (!user) {
			throw redirect({ to: "/sign-in/$" });
		}
		if (user.isOnboarded) {
			throw redirect({ to: "/" });
		}
		return { user };
	},
	component: OnboardingPage,
});

function OnboardingPage() {
	const { user } = Route.useRouteContext();
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [name, setName] = useState(user.name || "");
	const [birthday, setBirthday] = useState("");
	const router = useRouter();

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		startTransition(async () => {
			try {
				const result = await completeOnboarding({
					data: {
						name,
						birthday,
					},
				});

				if (result.error) {
					setError(result.error);
				} else {
					router.navigate({ to: "/" });
				}
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "An unexpected error occurred.";
				setError(message);
			}
		});
	}

	return (
		<AuthPageLayout contentClassName="max-w-2xl">
			<Card className="border-border rounded-2xl shadow-[0_4px_10px_rgba(13,21,48,0.06)] bg-card">
				<CardHeader className="text-center">
					<div className="mx-auto flex size-14 items-center justify-center">
						<img
							src="/brainee-logo.svg"
							alt="Brainee.org"
							className="size-14 object-contain"
						/>
					</div>
					<CardTitle className="text-2xl font-bold tracking-[-0.035em]">
						Complete your profile
					</CardTitle>
					<CardDescription>
						Add the basics we need before you start using Brainee.org.
					</CardDescription>
				</CardHeader>
				<CardContent className="pt-4">
					<form onSubmit={handleSubmit} className="space-y-6">
						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						<div className="space-y-2">
							<Label htmlFor="name">Full Name</Label>
							<Input
								id="name"
								name="name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								placeholder="Jane Doe"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input id="email" value={user.email} readOnly disabled />
						</div>

						<div className="space-y-2">
							<Label htmlFor="birthday">Birthday</Label>
							<Input
								id="birthday"
								type="date"
								name="birthday"
								value={birthday}
								onChange={(event) => setBirthday(event.target.value)}
								max={getTodayIsoDate()}
								required
							/>
							<p className="text-xs text-muted-foreground">
								Use your browser&apos;s year picker to jump quickly.
							</p>
						</div>

						<Button
							type="submit"
							className="h-11 w-full rounded-xl bg-primary text-[15px] font-medium text-primary-foreground hover:bg-deep-panel"
							disabled={isPending}
						>
							{isPending ? "Setting up..." : "Complete Setup"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</AuthPageLayout>
	);
}
