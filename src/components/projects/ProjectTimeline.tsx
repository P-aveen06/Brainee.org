import {
	CheckCircle,
	Clock,
	Edit,
	History,
	Plus,
	Shield,
	UserMinus,
	UserPlus,
} from "lucide-react";
import { formatDateTimeDisplay } from "@/lib/date-format";

interface ProjectEventItem {
	id: string;
	eventType: string;
	actorId?: string | null;
	actorName?: string | null;
	entityType?: string | null;
	entityId?: string | null;
	details?: string | null;
	createdAt?: Date | null;
}

interface ProjectTimelineProps {
	events: ProjectEventItem[];
}

function parseJsonDetails(details?: string | null): Record<string, unknown> {
	if (!details) return {};
	try {
		const parsed = JSON.parse(details);
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}

function getEventIcon(eventType: string) {
	switch (eventType) {
		case "created":
			return <Plus className="size-3.5 text-primary" />;
		case "updated":
			return <Edit className="size-3.5 text-sky-500" />;
		case "stage_advanced":
			return <CheckCircle className="size-3.5 text-emerald-500" />;
		case "member_added":
			return <UserPlus className="size-3.5 text-blue-500" />;
		case "member_updated":
			return <Shield className="size-3.5 text-amber-500" />;
		case "member_removed":
			return <UserMinus className="size-3.5 text-rose-500" />;
		case "ownership_transferred":
			return <Shield className="size-3.5 text-amber-500" />;
		default:
			return <Clock className="size-3.5 text-muted-foreground" />;
	}
}

function formatEventDescription(event: ProjectEventItem): string {
	const details = parseJsonDetails(event.details);
	switch (event.eventType) {
		case "created":
			return `Project created with code ${details.code || ""}`;
		case "stage_advanced":
			return `Stage advanced to ${details.newStage || "next stage"}${
				details.notes ? ` — "${details.notes}"` : ""
			}`;
		case "member_added":
			return `Added team member (${details.role || "contributor"})`;
		case "member_updated":
			return `Updated role to ${details.newRole || "new role"}`;
		case "member_removed":
			return `Member removed (${String(details.leaveReason || "rolled off").replace(/_/g, " ")})`;
		case "ownership_transferred":
			return `Ownership transferred to ${details.newOwnerName || "new owner"}`;
		case "updated":
			return "Project attributes updated";
		case "archived":
			return "Project archived";
		default:
			return event.eventType.replace(/_/g, " ");
	}
}

export function ProjectTimeline({ events }: ProjectTimelineProps) {
	if (events.length === 0) {
		return (
			<div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
				<History className="mx-auto size-8 opacity-30 mb-2" />
				<p className="text-sm font-medium">No recorded events yet</p>
				<p className="text-xs mt-1">
					Project activities and stage transitions will appear here.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div>
				<h3 className="font-heading text-sm font-semibold text-foreground">
					Project Event History ({events.length})
				</h3>
				<p className="text-xs text-muted-foreground mt-0.5">
					Append-only audit timeline of all state changes and milestones.
				</p>
			</div>

			<div className="relative pl-6 border-l-2 border-border/80 space-y-6 pt-1">
				{events.map((event) => (
					<div key={event.id} className="relative group">
						{/* Node indicator */}
						<div className="absolute -left-[31px] top-0 flex size-6 items-center justify-center rounded-full bg-card border border-border shadow-xs group-hover:border-primary/50 transition-colors">
							{getEventIcon(event.eventType)}
						</div>

						<div className="space-y-1">
							<div className="flex flex-wrap items-baseline gap-2">
								<span className="text-xs font-semibold text-foreground capitalize">
									{event.eventType.replace(/_/g, " ")}
								</span>
								<span className="text-[11px] text-muted-foreground">
									by{" "}
									<span className="font-medium text-foreground">
										{event.actorName || "System"}
									</span>
								</span>
								<span className="text-[11px] text-muted-foreground">
									•{" "}
									{event.createdAt
										? formatDateTimeDisplay(event.createdAt)
										: "—"}
								</span>
							</div>

							<p className="text-xs text-muted-foreground">
								{formatEventDescription(event)}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
