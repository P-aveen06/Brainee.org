import { ThreadPrimitive } from "@assistant-ui/react";
import { LoaderCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AssistantLoading() {
	return (
		<ThreadPrimitive.If running>
			<output
				aria-live="polite"
				className="block rounded-xl border border-border bg-card p-4 space-y-3"
			>
				<div className="flex items-center gap-2 text-sm font-medium text-accent">
					<LoaderCircle
						className="size-4 animate-spin motion-reduce:animate-none"
						aria-hidden="true"
					/>
					Generating your response…
				</div>
				<p className="text-xs text-muted-foreground">
					You can open another chat or page. This conversation will keep
					running.
				</p>
				<div className="space-y-2" aria-hidden="true">
					<Skeleton className="h-3 w-4/5" />
					<Skeleton className="h-3 w-3/5" />
					<Skeleton className="h-3 w-2/5" />
				</div>
			</output>
		</ThreadPrimitive.If>
	);
}
