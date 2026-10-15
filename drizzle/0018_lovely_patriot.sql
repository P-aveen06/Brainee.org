CREATE TABLE `ai_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`model_id` text,
	`tool_rounds` integer DEFAULT 0 NOT NULL,
	`tool_calls` integer DEFAULT 0 NOT NULL,
	`prompt_tokens` integer DEFAULT 0 NOT NULL,
	`completion_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`tool_result_bytes` integer DEFAULT 0 NOT NULL,
	`failure_code` text,
	`started_at` integer DEFAULT (unixepoch()),
	`completed_at` integer,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_turns_conversation_started_idx` ON `ai_turns` (`conversation_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `ai_turns_user_started_idx` ON `ai_turns` (`user_id`,`started_at`);--> statement-breakpoint
ALTER TABLE `ai_messages` ADD `turn_id` text REFERENCES ai_turns(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `ai_messages` ADD `sequence` integer;--> statement-breakpoint
ALTER TABLE `ai_messages` ADD `tool_round` integer;--> statement-breakpoint
ALTER TABLE `ai_tool_invocations` ADD `turn_id` text REFERENCES ai_turns(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `ai_tool_invocations` ADD `tool_round` integer;--> statement-breakpoint
ALTER TABLE `ai_tool_invocations` ADD `result_bytes` integer;--> statement-breakpoint
ALTER TABLE `ai_tool_invocations` ADD `duration_ms` integer;--> statement-breakpoint
ALTER TABLE `ai_tool_invocations` ADD `success` integer;
