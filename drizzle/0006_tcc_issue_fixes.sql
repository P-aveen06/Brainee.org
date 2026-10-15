CREATE TABLE `wfh_policy` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`annual_allowance` real DEFAULT 12 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	CONSTRAINT "wfh_policy_singleton_check" CHECK("wfh_policy"."id" = 1),
	CONSTRAINT "wfh_policy_allowance_check" CHECK("wfh_policy"."annual_allowance" >= 0.5 AND "wfh_policy"."annual_allowance" <= 365 AND "wfh_policy"."annual_allowance" * 2 = CAST("wfh_policy"."annual_allowance" * 2 AS INTEGER))
);
--> statement-breakpoint
INSERT INTO `wfh_policy` (`id`, `annual_allowance`) VALUES (1, 12);--> statement-breakpoint
ALTER TABLE `notifications` ADD `action_url` text;
