CREATE INDEX `timesheets_user_date_idx` ON `timesheets` (`user_id`, `date`);--> statement-breakpoint
CREATE INDEX `timesheets_date_idx` ON `timesheets` (`date`);--> statement-breakpoint
CREATE INDEX `leave_requests_user_status_idx` ON `leave_requests` (`user_id`, `status`);--> statement-breakpoint
CREATE INDEX `leave_requests_status_idx` ON `leave_requests` (`status`);--> statement-breakpoint
CREATE INDEX `wfh_requests_user_status_idx` ON `wfh_requests` (`user_id`, `status`);--> statement-breakpoint
CREATE INDEX `wfh_requests_status_idx` ON `wfh_requests` (`status`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`user_id`, `is_read`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
DROP TABLE `tasks`;
