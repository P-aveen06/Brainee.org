PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_tag` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`asset_type` text DEFAULT 'capital_asset' NOT NULL,
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
INSERT INTO `__new_assets`("id", "asset_tag", "name", "category", "asset_type", "owner_company_id", "serial_number", "model", "specs", "purchase_date", "purchase_cost", "warranty_expiry", "account_expiry", "renewal_date", "status", "defect_reason", "disposal_reason", "disposal_date", "replaced_by_asset_id", "notes", "created_at", "updated_at") SELECT "id", "asset_tag", "name", "category", "asset_type", "owner_company_id", "serial_number", "model", "specs", "purchase_date", "purchase_cost", "warranty_expiry", "account_expiry", "renewal_date", "status", "defect_reason", "disposal_reason", "disposal_date", "replaced_by_asset_id", "notes", "created_at", "updated_at" FROM `assets`;--> statement-breakpoint
DROP TABLE `assets`;--> statement-breakpoint
ALTER TABLE `__new_assets` RENAME TO `assets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `assets_asset_tag_unique` ON `assets` (`asset_tag`);--> statement-breakpoint
CREATE INDEX `assets_status_idx` ON `assets` (`status`);--> statement-breakpoint
CREATE INDEX `assets_category_idx` ON `assets` (`category`);--> statement-breakpoint
CREATE INDEX `assets_owner_company_idx` ON `assets` (`owner_company_id`);--> statement-breakpoint
CREATE INDEX `assets_account_expiry_idx` ON `assets` (`account_expiry`);--> statement-breakpoint
ALTER TABLE `asset_assignments` ADD `acknowledged_at` integer;--> statement-breakpoint
ALTER TABLE `asset_assignments` ADD `issue_reported_at` integer;--> statement-breakpoint
ALTER TABLE `asset_assignments` ADD `issue_description` text;--> statement-breakpoint
ALTER TABLE `asset_assignments` ADD `issue_status` text;