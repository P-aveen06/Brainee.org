CREATE TABLE `dashboard_layouts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`layout` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
