CREATE TABLE `cashier_bill_items` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`name_snapshot` text NOT NULL,
	`spec_snapshot` text,
	`qty` integer DEFAULT 1 NOT NULL,
	`unit_price_fen` integer NOT NULL,
	`adjusted_price_fen` integer,
	`paid_by_pass` integer DEFAULT false NOT NULL,
	`stock_short` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `cashier_bills`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_cashier_bill_items_bill` ON `cashier_bill_items` (`bill_id`);--> statement-breakpoint
CREATE TABLE `cashier_bills` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_no` text NOT NULL,
	`store_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`customer_id` text,
	`discount_type` text DEFAULT 'none' NOT NULL,
	`discount_value` integer DEFAULT 0 NOT NULL,
	`subtotal_fen` integer DEFAULT 0 NOT NULL,
	`discount_fen` integer DEFAULT 0 NOT NULL,
	`payable_fen` integer DEFAULT 0 NOT NULL,
	`paid_fen` integer DEFAULT 0 NOT NULL,
	`note` text,
	`created_by` text NOT NULL,
	`held_at` integer,
	`settled_at` integer,
	`voided_at` integer,
	`void_reason` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cashier_bills_bill_no_unique` ON `cashier_bills` (`bill_no`);--> statement-breakpoint
CREATE INDEX `ix_cashier_bills_store_status` ON `cashier_bills` (`store_id`,`status`);--> statement-breakpoint
CREATE INDEX `ix_cashier_bills_store_created` ON `cashier_bills` (`store_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `cashier_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`method` text NOT NULL,
	`amount_fen` integer NOT NULL,
	`pass_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `cashier_bills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pass_id`) REFERENCES `member_pass`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_cashier_payments_bill` ON `cashier_payments` (`bill_id`);--> statement-breakpoint
ALTER TABLE `pass_deduct_log` ADD `note` text;