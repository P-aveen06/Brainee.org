import {
	AlertCircle,
	AlertTriangle,
	ArrowDown,
	ArrowUp,
	CheckCircle2,
	Circle,
	Eye,
	Minus,
	PlayCircle,
	XCircle,
} from "lucide-react";

export const TASK_STATUS_CONFIG = {
	todo: {
		label: "To Do",
		badge: "border-border/60 bg-muted/60 text-muted-foreground",
		cell: "border-border/60 bg-muted/60 text-muted-foreground",
		dot: "bg-muted-foreground",
		border: "border-border",
		icon: Circle,
	},
	in_progress: {
		label: "In Progress",
		badge: "border-primary/30 bg-primary/10 text-primary",
		cell: "border-primary/30 bg-primary/10 text-primary",
		dot: "bg-primary",
		border: "border-primary/40",
		icon: PlayCircle,
	},
	blocked: {
		label: "Blocked",
		badge: "border-destructive/30 bg-destructive/10 text-destructive",
		cell: "border-destructive/30 bg-destructive/10 text-destructive",
		dot: "bg-destructive",
		border: "border-destructive/40",
		icon: AlertCircle,
	},
	in_review: {
		label: "In Review",
		badge:
			"border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400",
		cell: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400",
		dot: "bg-purple-500",
		border: "border-purple-500/40",
		icon: Eye,
	},
	done: {
		label: "Done",
		badge:
			"border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
		cell: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
		dot: "bg-emerald-500",
		border: "border-emerald-500/40",
		icon: CheckCircle2,
	},
	cancelled: {
		label: "Cancelled",
		badge: "border-border bg-muted/30 text-muted-foreground line-through",
		cell: "border-border bg-muted/30 text-muted-foreground",
		dot: "bg-muted-foreground/50",
		border: "border-border",
		icon: XCircle,
	},
} as const;

export type TaskStatusKey = keyof typeof TASK_STATUS_CONFIG;

export const TASK_PRIORITY_CONFIG = {
	low: {
		label: "Low",
		badge: "border-border/60 bg-muted/40 text-muted-foreground",
		icon: ArrowDown,
		color: "text-muted-foreground",
	},
	medium: {
		label: "Medium",
		badge: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
		icon: Minus,
		color: "text-sky-600 dark:text-sky-400",
	},
	high: {
		label: "High",
		badge:
			"border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
		icon: ArrowUp,
		color: "text-amber-600 dark:text-amber-400",
	},
	critical: {
		label: "Critical",
		badge:
			"border-destructive/30 bg-destructive/10 text-destructive font-semibold",
		icon: AlertTriangle,
		color: "text-destructive",
	},
} as const;

export type TaskPriorityKey = keyof typeof TASK_PRIORITY_CONFIG;
