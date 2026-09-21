CREATE TABLE `overwork_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`date` text NOT NULL,
	`approved_by` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_overwork_approvals_staff_date` ON `overwork_approvals` (`staff_id`,`date`);--> statement-breakpoint
CREATE INDEX `ix_overwork_approvals_store_date` ON `overwork_approvals` (`store_id`,`date`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reception_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text,
	`appointment_id` text,
	`old_receptionist_id` text,
	`new_receptionist_id` text NOT NULL,
	`changed_by` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bill_id`) REFERENCES `cashier_bills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`old_receptionist_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`new_receptionist_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_reception_logs`("id", "bill_id", "appointment_id", "old_receptionist_id", "new_receptionist_id", "changed_by", "note", "created_at", "updated_at") SELECT "id", "bill_id", NULL, "old_receptionist_id", "new_receptionist_id", "changed_by", "note", "created_at", "updated_at" FROM `reception_logs`;--> statement-breakpoint
DROP TABLE `reception_logs`;--> statement-breakpoint
ALTER TABLE `__new_reception_logs` RENAME TO `reception_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `ix_reception_logs_bill` ON `reception_logs` (`bill_id`);--> statement-breakpoint
CREATE INDEX `ix_reception_logs_appointment` ON `reception_logs` (`appointment_id`);--> statement-breakpoint
ALTER TABLE `appointments` ADD `receptionist_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `staff` ADD `probation` integer DEFAULT false NOT NULL;