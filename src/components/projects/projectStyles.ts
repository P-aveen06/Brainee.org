import {
	AlertCircle,
	AlertTriangle,
	Archive,
	CheckCircle2,
	Clock,
	PauseCircle,
	PlayCircle,
	Shield,
	User,
	UserCheck,
	Users,
} from "lucide-react";

export const PROJECT_STATUS_CONFIG = {
	draft: {
		label: "Draft",
		cell: "border-border/60 bg-muted/60 text-muted-foreground",
		dot: "bg-muted-foreground",
		icon: Clock,
	},
	active: {
		label: "Active",
		cell: "border-primary/30 bg-primary/10 text-primary",
		dot: "bg-primary",
		icon: PlayCircle,
	},
	on_hold: {
		label: "On Hold",
		cell: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
		dot: "bg-amber-500",
		icon: PauseCircle,
	},
	completed: {
		label: "Completed",
		cell: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
		dot: "bg-emerald-500",
		icon: CheckCircle2,
	},
	cancelled: {
		label: "Cancelled",
		cell: "border-destructive/30 bg-destructive/10 text-destructive",
		dot: "bg-destructive",
		icon: AlertCircle,
	},
	archived: {
		label: "Archived",
		cell: "border-border bg-muted text-muted-foreground",
		dot: "bg-muted-foreground",
		icon: Archive,
	},
} as const;

export type ProjectStatusKey = keyof typeof PROJECT_STATUS_CONFIG;

export const PROJECT_HEALTH_CONFIG = {
	green: {
		label: "On Track",
		badge:
			"border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
		dot: "bg-emerald-500",
		icon: CheckCircle2,
	},
	amber: {
		label: "At Risk",
		badge:
			"border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
		dot: "bg-amber-500",
		icon: AlertTriangle,
	},
	red: {
		label: "Critical",
		badge: "border-destructive/30 bg-destructive/10 text-destructive",
		dot: "bg-destructive",
		icon: AlertCircle,
	},
} as const;

export type ProjectHealthKey = keyof typeof PROJECT_HEALTH_CONFIG;

export const MEMBER_ROLE_CONFIG = {
	owner: {
		label: "Owner",
		badge: "border-primary/30 bg-primary/10 text-primary font-medium",
		icon: Shield,
	},
	manager: {
		label: "Manager",
		badge:
			"border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400 font-medium",
		icon: UserCheck,
	},
	contributor: {
		label: "Contributor",
		badge: "border-border bg-secondary/80 text-secondary-foreground",
		icon: Users,
	},
	viewer: {
		label: "Viewer",
		badge: "border-border/60 bg-muted/40 text-muted-foreground",
		icon: User,
	},
} as const;

export type MemberRoleKey = keyof typeof MEMBER_ROLE_CONFIG;
