CREATE TABLE `boarding_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`service_id` text NOT NULL,
	`night_date` text NOT NULL,
	`capacity` integer NOT NULL,
	`booked_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_boarding_slots_store_service_night` ON `boarding_slots` (`store_id`,`service_id`,`night_date`);--> statement-breakpoint
ALTER TABLE `services` ADD `room_count` integer;