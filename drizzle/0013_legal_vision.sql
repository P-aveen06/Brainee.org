CREATE TABLE `project_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`stage_key` text NOT NULL,
	`template_id` text,
	`title` text NOT NULL,
	`description` text,
	`is_required` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`assigned_to_id` text,
	`due_date` text,
	`completed_by_id` text,
	`completed_at` integer,
	`notes` text,
	`sequence` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`completed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_checklist_project_stage_idx` ON `project_checklist_items` (`project_id`,`stage_key`);--> statement-breakpoint
CREATE TABLE `project_checklist_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_key` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`is_required` integer DEFAULT false NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `project_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`stage_key` text,
	`task_id` text,
	`document_id` text,
	`parent_id` text,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`is_decision` integer DEFAULT false NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`edited_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `project_comments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_comments_project_created_idx` ON `project_comments` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`stage_key` text,
	`title` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'other' NOT NULL,
	`r2_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`supersedes_document_id` text,
	`status` text DEFAULT 'final' NOT NULL,
	`uploaded_by_id` text,
	`checksum` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supersedes_document_id`) REFERENCES `project_documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_documents_r2_key_unique` ON `project_documents` (`r2_key`);--> statement-breakpoint
CREATE INDEX `project_documents_project_idx` ON `project_documents` (`project_id`);