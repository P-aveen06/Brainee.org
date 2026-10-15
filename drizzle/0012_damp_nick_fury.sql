CREATE TABLE `project_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`stage_key` text,
	`parent_task_id` text,
	`task_number` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`assignee_id` text,
	`created_by_id` text,
	`start_date` text,
	`due_date` text,
	`completed_at` integer,
	`estimate_hours` real,
	`actual_hours` real,
	`blocked_reason` text,
	`sequence` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_task_id`) REFERENCES `project_tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_tasks_project_status_idx` ON `project_tasks` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `project_tasks_assignee_status_idx` ON `project_tasks` (`assignee_id`,`status`);--> statement-breakpoint
CREATE INDEX `project_tasks_due_idx` ON `project_tasks` (`due_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_tasks_project_task_num_unique` ON `project_tasks` (`project_id`,`task_number`);