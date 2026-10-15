CREATE TABLE `project_daily_update_items` (
	`id` text PRIMARY KEY NOT NULL,
	`update_id` text NOT NULL,
	`task_id` text NOT NULL,
	`note` text,
	`progress_note` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`update_id`) REFERENCES `project_daily_updates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_update_items_update_idx` ON `project_daily_update_items` (`update_id`);--> statement-breakpoint
CREATE TABLE `project_daily_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`summary` text NOT NULL,
	`blockers` text,
	`hours_spent` real,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_updates_project_date_idx` ON `project_daily_updates` (`project_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `daily_update_unique` ON `project_daily_updates` (`project_id`,`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `project_eod_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`generated_by_id` text,
	`content_draft` text,
	`content_final` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`missing_submitters` text,
	`finalised_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`generated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `eod_report_unique` ON `project_eod_reports` (`project_id`,`date`);--> statement-breakpoint
CREATE TABLE `work_flags` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`flag_code` text NOT NULL,
	`severity` text DEFAULT 'info' NOT NULL,
	`message` text NOT NULL,
	`evidence` text,
	`source` text DEFAULT 'rule' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`raised_for_user_id` text,
	`resolved_by_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`raised_for_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `work_flags_project_status_idx` ON `work_flags` (`project_id`,`status`);