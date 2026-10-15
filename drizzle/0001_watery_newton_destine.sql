CREATE TABLE `leave_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`leave_type` text NOT NULL,
	`total_limit` real NOT NULL,
	`used` real DEFAULT 0 NOT NULL,
	`cycle_start` text NOT NULL,
	`cycle_end` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `system_leave_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`default_days` integer NOT NULL,
	`apply_before_days` integer DEFAULT 0 NOT NULL,
	`apply_before_days_extended` integer DEFAULT 0 NOT NULL,
	`extended_limit_trigger` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_leave_types_slug_unique` ON `system_leave_types` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`clerk_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`birthday` text,
	`role` text DEFAULT 'user' NOT NULL,
	`standard_hours` integer DEFAULT 8 NOT NULL,
	`join_date` text,
	`peer_lead_id` text,
	`avatar_url` text,
	`is_onboarded` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`peer_lead_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_clerk_id_unique` ON `users` (`clerk_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);