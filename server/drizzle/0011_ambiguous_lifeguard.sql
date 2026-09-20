CREATE TABLE `attendance_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`applicant_user_id` text NOT NULL,
	`type` text NOT NULL,
	`record_id` text,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`requested_ts` integer,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewer_id` text,
	`reviewed_at` integer,
	`review_note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`applicant_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`record_id`) REFERENCES `attendance_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_attendance_approvals_store_status` ON `attendance_approvals` (`store_id`,`status`);--> statement-breakpoint
CREATE INDEX `ix_attendance_approvals_staff_date` ON `attendance_approvals` (`staff_id`,`date`);--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`ts` integer NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`distance_m` integer NOT NULL,
	`status` text DEFAULT 'normal' NOT NULL,
	`makeup` integer DEFAULT false NOT NULL,
	`device_id` text NOT NULL,
	`flagged` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_attendance_records_store_date` ON `attendance_records` (`store_id`,`date`);--> statement-breakpoint
CREATE INDEX `ix_attendance_records_staff_date` ON `attendance_records` (`staff_id`,`date`);--> statement-breakpoint
CREATE INDEX `ix_attendance_records_device_date` ON `attendance_records` (`device_id`,`date`);--> statement-breakpoint
CREATE TABLE `commission_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`rule_key` text NOT NULL,
	`label` text NOT NULL,
	`value_json` text NOT NULL,
	`effective_from` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_commission_rules_key_active` ON `commission_rules` (`rule_key`,`active`);--> statement-breakpoint
CREATE TABLE `commission_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`period` text NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`total_fen` integer NOT NULL,
	`rule_version` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_commission_snapshots_staff_period_kind` ON `commission_snapshots` (`staff_id`,`period`,`kind`);--> statement-breakpoint
CREATE INDEX `ix_commission_snapshots_store_period` ON `commission_snapshots` (`store_id`,`period`);--> statement-breakpoint
CREATE TABLE `deduction_records` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`month` text NOT NULL,
	`amount_fen` integer NOT NULL,
	`reason` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_deduction_records_staff_month` ON `deduction_records` (`staff_id`,`month`);--> statement-breakpoint
CREATE INDEX `ix_deduction_records_store_month` ON `deduction_records` (`store_id`,`month`);--> statement-breakpoint
CREATE TABLE `inventory_count_items` (
	`id` text PRIMARY KEY NOT NULL,
	`count_id` text NOT NULL,
	`product_id` text NOT NULL,
	`system_stock` integer NOT NULL,
	`actual_stock` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`count_id`) REFERENCES `inventory_counts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_inventory_count_items_count` ON `inventory_count_items` (`count_id`);--> statement-breakpoint
CREATE TABLE `inventory_counts` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`confirmed_by` text,
	`confirmed_at` integer,
	`posted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_inventory_counts_store_status` ON `inventory_counts` (`store_id`,`status`);--> statement-breakpoint
CREATE TABLE `performance_grades` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`quarter` text NOT NULL,
	`grade` text NOT NULL,
	`grader_id` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grader_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_performance_grades_staff_quarter` ON `performance_grades` (`staff_id`,`quarter`);--> statement-breakpoint
CREATE INDEX `ix_performance_grades_store_quarter` ON `performance_grades` (`store_id`,`quarter`);--> statement-breakpoint
CREATE TABLE `reception_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`old_receptionist_id` text,
	`new_receptionist_id` text NOT NULL,
	`changed_by` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `cashier_bills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`old_receptionist_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`new_receptionist_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_reception_logs_bill` ON `reception_logs` (`bill_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`store_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`rating` integer NOT NULL,
	`text` text,
	`anonymous` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reviews_appointment` ON `reviews` (`appointment_id`);--> statement-breakpoint
CREATE INDEX `ix_reviews_staff_created` ON `reviews` (`staff_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_reviews_store_created` ON `reviews` (`store_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_reviews_customer_staff_created` ON `reviews` (`customer_id`,`staff_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rule_config_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`domain` text NOT NULL,
	`version` integer NOT NULL,
	`changed_by` text NOT NULL,
	`changes_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_rule_config_versions_domain` ON `rule_config_versions` (`domain`,`version`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`product_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text,
	`delta` integer NOT NULL,
	`before_stock` integer NOT NULL,
	`after_stock` integer NOT NULL,
	`operator_id` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_stock_movements_product` ON `stock_movements` (`product_id`);--> statement-breakpoint
CREATE INDEX `ix_stock_movements_store_created` ON `stock_movements` (`store_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_stock_movements_source` ON `stock_movements` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `xp_events` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`source_id` text NOT NULL,
	`points` integer NOT NULL,
	`channel` text NOT NULL,
	`rule_version` integer NOT NULL,
	`dropped` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_xp_events_staff_created` ON `xp_events` (`staff_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_xp_events_store_created` ON `xp_events` (`store_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `ix_xp_events_source` ON `xp_events` (`source`,`source_id`);--> statement-breakpoint
CREATE TABLE `xp_levels` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`month` text NOT NULL,
	`start_xp` integer NOT NULL,
	`gained_xp` integer NOT NULL,
	`end_xp` integer NOT NULL,
	`level_before` integer NOT NULL,
	`level_after` integer NOT NULL,
	`retained` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_xp_levels_staff_month` ON `xp_levels` (`staff_id`,`month`);--> statement-breakpoint
CREATE INDEX `ix_xp_levels_store_month` ON `xp_levels` (`store_id`,`month`);--> statement-breakpoint
CREATE TABLE `xp_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`rule_key` text NOT NULL,
	`label` text NOT NULL,
	`value_json` text NOT NULL,
	`effective_from` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_xp_rules_key_active` ON `xp_rules` (`rule_key`,`active`);--> statement-breakpoint
ALTER TABLE `cashier_bills` ADD `receptionist_id` text REFERENCES users(id);--> statement-breakpoint
-- staff-2 R9-C：接待人默认=开单人（设计稿 §一.6）——可空列无需 DEFAULT 窗，
-- 迁移期 FK 已关（见 migrate.ts），回填口径同 0009 operator_id 先例。
UPDATE `cashier_bills` SET `receptionist_id` = `operator_id`;--> statement-breakpoint
ALTER TABLE `products` ADD `expires_at` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `is_disinfection_supply` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `staff` ADD `grade` text;