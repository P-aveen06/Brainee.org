CREATE TABLE `asset_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`user_id` text NOT NULL,
	`client_deployment_id` text,
	`assigned_date` text NOT NULL,
	`returned_date` text,
	`condition_out` text DEFAULT 'good' NOT NULL,
	`condition_in` text,
	`return_destination` text,
	`return_notes` text,
	`assigned_by_user_id` text,
	`received_by_user_id` text,
	`is_current` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`client_deployment_id`) REFERENCES `client_deployments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `asset_assignments_asset_is_current_idx` ON `asset_assignments` (`asset_id`,`is_current`);--> statement-breakpoint
CREATE INDEX `asset_assignments_user_is_current_idx` ON `asset_assignments` (`user_id`,`is_current`);--> statement-breakpoint
CREATE TABLE `asset_history` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_id` text,
	`target_user_id` text,
	`details` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `asset_history_asset_id_idx` ON `asset_history` (`asset_id`);--> statement-breakpoint
CREATE INDEX `asset_history_created_at_idx` ON `asset_history` (`created_at`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_tag` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`asset_type` text DEFAULT 'physical' NOT NULL,
	`owner_company_id` text NOT NULL,
	`serial_number` text,
	`model` text,
	`specs` text,
	`purchase_date` text,
	`purchase_cost` real,
	`warranty_expiry` text,
	`account_expiry` text,
	`renewal_date` text,
	`status` text DEFAULT 'in_inventory' NOT NULL,
	`defect_reason` text,
	`disposal_reason` text,
	`disposal_date` text,
	`replaced_by_asset_id` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`owner_company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`replaced_by_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_asset_tag_unique` ON `assets` (`asset_tag`);--> statement-breakpoint
CREATE INDEX `assets_status_idx` ON `assets` (`status`);--> statement-breakpoint
CREATE INDEX `assets_category_idx` ON `assets` (`category`);--> statement-breakpoint
CREATE INDEX `assets_owner_company_idx` ON `assets` (`owner_company_id`);--> statement-breakpoint
CREATE INDEX `assets_account_expiry_idx` ON `assets` (`account_expiry`);--> statement-breakpoint
CREATE TABLE `client_deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`primary_client_id` text NOT NULL,
	`end_client_id` text,
	`role_title` text,
	`start_date` text NOT NULL,
	`end_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`primary_client_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`end_client_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `client_deployments_user_status_idx` ON `client_deployments` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `client_deployments_primary_client_idx` ON `client_deployments` (`primary_client_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`is_internal` integer DEFAULT false NOT NULL,
	`contact_email` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_code_unique` ON `companies` (`code`);