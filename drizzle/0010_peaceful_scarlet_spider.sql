ALTER TABLE `users` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `exit_date` text;--> statement-breakpoint
ALTER TABLE `users` ADD `exit_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `deactivated_by_id` text REFERENCES users(id);