import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";

export function NotFound() {
	return (
		<div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
			<p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
				404
			</p>
			<h1 className="font-heading text-lg font-semibold tracking-[-0.025em]">
				Page not found
			</h1>
			<p className="text-sm text-muted-foreground">
				The page you're looking for doesn't exist or has moved.
			</p>
			<Button render={<Link to="/" />} nativeButton={false}>
				Back to dashboard
			</Button>
		</div>
	);
}
