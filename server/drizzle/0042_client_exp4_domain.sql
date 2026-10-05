-- 客户端体验大批 片 4（服务过程 7+软性体验 6+通知触达 2+品牌 1 + 触达配套 3）：域建表与扩列（幂等+申报）
-- pets 扩 chip_no/coat_color（档案字段补全）；stores 扩 phone（电话客服公示）；
-- users 扩 active_pet_id（多宠物全局切换；与 pets.owner_id 环形 FK，可空后补）；
-- support_tickets 扩 escalated_at/escalated_by/escalate_note（店长介入仲裁升级语义，状态机扩 escalated）；
-- pet_health_records（疫苗/驱虫/用药/就医四类记录型档案+到期扫描锚 next_due_date）/
-- pet_weight_logs（体重时序真值表，最新值同事务回写 pets.weight_kg 快照）/
-- boarding_unseal_logs（寄养用品拆封留痕+主人即时通知，只增不改）/
-- service_incidents（受伤/应激/就医异常即时通报域：落行同事务双通知主人+门店，
--   15 分钟未处置升级扫描锚 escalated_at，处置只增不改）；
-- service_rules 幂等种子 4 键（早晚推送刻点/4h 照护提醒间隔/异常升级时限/到期提醒提前量，
--   配置端口 domain='service' 改值即新）。
-- 幂等=journal 守卫（仅跑一次）+种子段 WHERE NOT EXISTS；列定义全先于 FOREIGN KEY 表约束；
-- created_by='system'（迁移期 FK=OFF，惯例见 migrate.ts 头注）。
ALTER TABLE `pets` ADD `chip_no` text;
--> statement-breakpoint
ALTER TABLE `pets` ADD `coat_color` text;
--> statement-breakpoint
ALTER TABLE `stores` ADD `phone` text;
--> statement-breakpoint
ALTER TABLE `users` ADD `active_pet_id` text REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action;
--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `escalated_at` integer;
--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `escalated_by` text REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action;
--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `escalate_note` text;
--> statement-breakpoint
CREATE TABLE `pet_health_records` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`record_date` text NOT NULL,
	`next_due_date` text,
	`note` text,
	`created_by` text NOT NULL,
	`created_via` text DEFAULT 'customer' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_pet_health_records_pet_date` ON `pet_health_records` (`pet_id`,`record_date`);
--> statement-breakpoint
CREATE INDEX `ix_pet_health_records_due` ON `pet_health_records` (`next_due_date`);
--> statement-breakpoint
CREATE TABLE `pet_weight_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`pet_id` text NOT NULL,
	`weight_kg` real NOT NULL,
	`measured_at` text NOT NULL,
	`note` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_pet_weight_logs_pet_date` ON `pet_weight_logs` (`pet_id`,`measured_at`);
--> statement-breakpoint
CREATE TABLE `boarding_unseal_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`stay_id` text NOT NULL,
	`item_name` text NOT NULL,
	`note` text,
	`opened_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`stay_id`) REFERENCES `boarding_stays`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opened_by`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_boarding_unseal_stay` ON `boarding_unseal_logs` (`stay_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `service_incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`store_id` text NOT NULL,
	`pet_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`reported_by` text NOT NULL,
	`handled_at` integer,
	`handled_note` text,
	`handled_by` text,
	`escalated_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pet_id`) REFERENCES `pets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reported_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_service_incidents_appt` ON `service_incidents` (`appointment_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `ix_service_incidents_store` ON `service_incidents` (`store_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `ix_service_incidents_customer` ON `service_incidents` (`customer_id`,`created_at`);
--> statement-breakpoint
-- 幂等配置种子（同 0018 口径：active 行已存在则跳过；客户端体验大批片 4 定时器四参数端口）
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_boarding_daynight_push', 1, 'boarding_daynight_push',
  '寄养早晚定时推送刻点（门店时区 HH:MM；窗口 30 分钟内扫到即推，当日当槽幂等）',
  '{"morning":"08:30","evening":"20:30"}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='boarding_daynight_push' AND `active`=1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_care_log_remind_hours', 1, 'care_log_remind_hours',
  '照护打卡提醒间隔（小时）：在住寄养单距上次打卡超 N 小时→提醒本店员工打卡',
  '{"hours":4}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='care_log_remind_hours' AND `active`=1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_incident_escalate_minutes', 1, 'incident_escalate_minutes',
  '异常通报升级时限（分钟）：通报落行超 N 分钟未处置→升级再通知门店与主人一轮',
  '{"minutes":15}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='incident_escalate_minutes' AND `active`=1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_pet_due_remind_days', 1, 'pet_due_remind_days',
  '宠物疫苗/驱虫到期提前提醒天数：到期日前 N 天内→通知主人（当日当项幂等）',
  '{"days":7}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='pet_due_remind_days' AND `active`=1);
