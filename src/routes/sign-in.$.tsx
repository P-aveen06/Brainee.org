import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";
import { type FormEvent, useState } from "react";
import { loginUser } from "#/api/auth";
import { AuthPageLayout } from "#/components/layout/page-layout";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

export const Route = createFileRoute("/sign-in/$")({
	component: SignInPage,
});

function SignInPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSignIn(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (isLoading) return;
		setIsLoading(true);
		setError(null);
		try {
			const result = await loginUser({ data: { email, password } });
			if (result.error) {
				setError(result.error);
				setIsLoading(false);
				return;
			}
			// Reload authenticated loaders with the newly issued session cookie.
			window.location.assign("/");
		} catch {
			setError("Unable to sign in. Please try again.");
			setIsLoading(false);
		}
	}

	return (
		<AuthPageLayout>
			<Card className="space-y-8 rounded-2xl border-border bg-card p-8 shadow-sm">
				<div className="flex flex-col items-center space-y-3 text-center">
					<img
						src="/brainee-logo.svg"
						alt="Brainee.org"
						className="size-14 object-contain"
					/>
					<div>
						<h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
							Welcome to Brainee.org
						</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							Sign in with your test account to continue.
						</p>
					</div>
				</div>
				<form
					onSubmit={handleSignIn}
					className="space-y-4"
					aria-busy={isLoading}
				>
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							name="email"
							type="email"
							autoComplete="username"
							placeholder="test@example.com"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
							maxLength={254}
							disabled={isLoading}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							name="password"
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							required
							maxLength={256}
							disabled={isLoading}
						/>
					</div>
					{error && (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					)}
					<Button
						type="submit"
						disabled={isLoading}
						size="lg"
						className="h-12 w-full rounded-xl bg-foreground text-base font-extrabold text-background hover:bg-foreground/90"
					>
						<Lock className="size-4" />
						{isLoading ? "Signing in..." : "Sign in"}
						<ArrowRight className="size-4" />
					</Button>
				</form>
			</Card>
		</AuthPageLayout>
	);
}
