import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { LogOut, ShieldOff } from "lucide-react";
import { useState } from "react";
import { logoutUser } from "#/api/auth";
import { AuthPageLayout } from "#/components/layout/page-layout";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { getCurrentUserWithState } from "#/lib/current-user.server";

/**
 * Terminal state for a deactivated employee. Anonymous visitors and still-active
 * employees are bounced away so this page can't be used to probe account status.
 */
const getAccessState = createServerFn({ method: "GET" }).handler(async () => {
	return (await getCurrentUserWithState()).state;
});

export const Route = createFileRoute("/access-ended")({
	beforeLoad: async () => {
		const state = await getAccessState();
		if (state === "anonymous") {
			throw redirect({ to: "/sign-in/$" });
		}
		if (state === "active") {
			throw redirect({ to: "/" });
		}
	},
	component: AccessEndedPage,
});

function AccessEndedPage() {
	const [isLoading, setIsLoading] = useState(false);

	const handleSignOut = async () => {
		try {
			setIsLoading(true);
			await logoutUser();
		} catch (_err) {
			// logoutUser redirects by throwing; nothing to recover from here.
			setIsLoading(false);
		}
	};

	return (
		<AuthPageLayout>
			<Card className="space-y-8 border-border/60 bg-card p-8">
				<div className="flex flex-col items-center space-y-3 text-center">
					<div className="flex size-12 items-center justify-center bg-muted text-muted-foreground">
						<ShieldOff className="size-6" />
					</div>
					<div>
						<h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
							Your access has ended
						</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							This Brainee.org account is no longer active. Your records have been
							retained, but you can no longer sign in.
						</p>
						<p className="mt-3 text-sm text-muted-foreground">
							If you believe this is a mistake, please contact your manager or
							the Brainee.org operations team.
						</p>
					</div>
				</div>

				<Button
					onClick={handleSignOut}
					disabled={isLoading}
					variant="outline"
					size="lg"
					className="h-12 w-full text-base font-semibold"
				>
					<span className="flex items-center justify-center gap-2">
						<LogOut className="size-4" />
						<span>{isLoading ? "Signing out..." : "Sign out"}</span>
					</span>
				</Button>
			</Card>
		</AuthPageLayout>
	);
}
