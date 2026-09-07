CREATE TABLE `member_pass` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`store_id` text NOT NULL,
	`total_times` integer DEFAULT 0 NOT NULL,
	`remain_times` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_member_pass_user_store` ON `member_pass` (`user_id`,`store_id`);--> statement-breakpoint
CREATE TABLE `pass_deduct_log` (
	`id` text PRIMARY KEY NOT NULL,
	`pass_id` text NOT NULL,
	`appointment_id` text,
	`delta` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`pass_id`) REFERENCES `member_pass`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_pass_deduct_log_pass` ON `pass_deduct_log` (`pass_id`);--> statement-breakpoint
CREATE INDEX `ix_pass_deduct_log_appointment` ON `pass_deduct_log` (`appointment_id`);