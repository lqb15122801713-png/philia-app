-- 0017 补缺大批片 5（站内信分类 + 订阅退订）：
-- ① user_notify_prefs 新表（user × category 订阅开关，唯一索引 (user_id, category)）；
-- ② notifications 加列 category（not null default 'service'）；
-- ③ 存量回填：按 type 前缀映射四类（UPDATE 幂等，重复执行同值）。
-- 口径：appointment.paid/order.*/cashier.*/refund.*/refundRequest.*/invoice.* → trade；
-- appointment.*/step.*/step_*/boarding.*/certificate.*/report.* → service；
-- membership.*/auth.*/account.*/phone.*/deactivation.* → account；marketing.* → marketing；
-- 其余兜底 service（列默认值即 service，回填与 bus.ts categoryOf 同帧）。
CREATE TABLE `user_notify_prefs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_notify_prefs_user_category` ON `user_notify_prefs` (`user_id`,`category`);--> statement-breakpoint
ALTER TABLE `notifications` ADD `category` text DEFAULT 'service' NOT NULL;
--> statement-breakpoint
-- 回填顺序固定 service → trade → account → marketing（trade 的 appointment.paid 精确值盖过 appointment.* 的 service）
UPDATE `notifications` SET `category`='service' WHERE `type` LIKE 'appointment.%' OR `type` LIKE 'step.%' OR `type` LIKE 'step\_%' ESCAPE '\' OR `type` LIKE 'boarding.%' OR `type` LIKE 'certificate.%' OR `type` LIKE 'report.%';
--> statement-breakpoint
UPDATE `notifications` SET `category`='trade' WHERE `type`='appointment.paid' OR `type` LIKE 'order.%' OR `type` LIKE 'cashier.%' OR `type` LIKE 'refund.%' OR `type` LIKE 'refundrequest.%' OR `type` LIKE 'invoice.%';
--> statement-breakpoint
UPDATE `notifications` SET `category`='account' WHERE `type` LIKE 'membership.%' OR `type` LIKE 'auth.%' OR `type` LIKE 'account.%' OR `type` LIKE 'phone.%' OR `type` LIKE 'deactivation.%';
--> statement-breakpoint
UPDATE `notifications` SET `category`='marketing' WHERE `type` LIKE 'marketing.%';