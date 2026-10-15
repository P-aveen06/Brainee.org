ALTER TABLE `system_leave_types` ADD `accrual_per_year` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Preserve existing behaviour: Personal Leave was hardcoded as 12 base + 1 day
-- per completed year of service. Encode that as data so it survives renames.
UPDATE `system_leave_types` SET `accrual_per_year` = 1, `default_days` = 12 WHERE `slug` = 'personal-leave';