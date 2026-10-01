CREATE TABLE `deactivation_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`checklist_json` text NOT NULL,
	`impacts_json` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`approver_id` text,
	`decided_at` integer,
	`decide_note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_deactivation_requests_user` ON `deactivation_requests` (`user_id`);--> statement-breakpoint
CREATE TABLE `phone_change_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`old_phone_masked` text NOT NULL,
	`new_phone_masked` text NOT NULL,
	`channel` text NOT NULL,
	`operator_id` text,
	`at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_phone_change_logs_user` ON `phone_change_logs` (`user_id`);--> statement-breakpoint
CREATE TABLE `phone_change_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`request_no` text NOT NULL,
	`user_id` text NOT NULL,
	`old_phone_masked` text NOT NULL,
	`new_phone_masked` text NOT NULL,
	`new_phone` text NOT NULL,
	`photo_urls` text DEFAULT '[]' NOT NULL,
	`note` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`timeline_json` text NOT NULL,
	`approver_id` text,
	`decided_at` integer,
	`decide_note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `phone_change_requests_request_no_unique` ON `phone_change_requests` (`request_no`);--> statement-breakpoint
CREATE INDEX `ix_phone_change_requests_user` ON `phone_change_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `ix_phone_change_requests_status` ON `phone_change_requests` (`status`);--> statement-breakpoint
CREATE TABLE `user_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`label` text,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_devices_user_device` ON `user_devices` (`user_id`,`device_id`);--> statement-breakpoint
CREATE INDEX `ix_user_devices_user` ON `user_devices` (`user_id`);--> statement-breakpoint
CREATE TABLE `verification_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`purpose` text NOT NULL,
	`code_hash` text NOT NULL,
	`expiry` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ix_verification_codes_phone_purpose` ON `verification_codes` (`phone`,`purpose`);--> statement-breakpoint
ALTER TABLE `pets` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `pets` ADD `delete_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `deactivated_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `deactivate_reason` text;