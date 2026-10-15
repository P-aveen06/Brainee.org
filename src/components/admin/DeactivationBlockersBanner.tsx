"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DeactivationBlockersBannerProps {
	blockers: Array<{ code: string; message: string }>;
	ownedProjects?: Array<{ id: string; code: string; name: string }>;
}

export function DeactivationBlockersBanner({
	blockers,
	ownedProjects,
}: DeactivationBlockersBannerProps) {
	return (
		<>
			{blockers.length > 0 && (
				<Alert variant="destructive">
					<AlertTriangle className="size-4" />
					<AlertDescription>
						<ul className="list-disc space-y-1 pl-4">
							{blockers.map((blocker) => (
								<li key={blocker.code}>{blocker.message}</li>
							))}
						</ul>
					</AlertDescription>
				</Alert>
			)}

			{ownedProjects && ownedProjects.length > 0 && (
				<div className="border border-amber-200 bg-amber-50/50 p-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/20">
					<p className="font-medium text-amber-800 dark:text-amber-300">
						Owned Projects ({ownedProjects.length}):
					</p>
					<ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-700 dark:text-amber-400">
						{ownedProjects.map((prj) => (
							<li key={prj.id}>
								{prj.code} — {prj.name}
							</li>
						))}
					</ul>
					<p className="mt-1.5 text-muted-foreground">
						Reassign project ownership from the project page before
						deactivating.
					</p>
				</div>
			)}
		</>
	);
}
