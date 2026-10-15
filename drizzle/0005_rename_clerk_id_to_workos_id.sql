ALTER TABLE `users` RENAME COLUMN `clerk_id` TO `workos_id`;--> statement-breakpoint
DROP INDEX IF EXISTS `users_clerk_id_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_workos_id_unique` ON `users` (`workos_id`);
