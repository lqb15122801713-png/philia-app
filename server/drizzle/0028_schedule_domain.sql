-- 员工端骨架整建批 片 2（排班 10+考勤 7）：排班域建表（幂等+申报）
-- shift_templates（班次模板+规律轮班）/shift_assignments（按日排班实例）/shift_swaps（换班申请审批）/
-- staff_availability（自主可用时间/偏好）/leave_requests（请假/调休申请）/
-- comp_off_ledger（调休余额台账）/staff_skills（技能标签指派）/attendance_wifi_bssids（WiFi 打卡白名单）
-- 命名注：按日实例表=shift_assignments（schema.shifts 已被收银交接班域占用，不撞名）；
-- 幂等=journal 守卫（仅跑一次）；created_by 引用 users.id（迁移期 FK=OFF 惯例见 migrate.ts 头注）。
CREATE TABLE `shift_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`name` text NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`weekdays` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_shift_templates_store` ON `shift_templates` (`store_id`,`active`);--> statement-breakpoint
CREATE TABLE `shift_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`date` text NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`template_id` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`note` text,
	`published_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `shift_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_shift_assignments_staff_date_start` ON `shift_assignments` (`staff_id`,`date`,`start_min`) WHERE `status`='active';--> statement-breakpoint
CREATE INDEX `ix_shift_assignments_store_date` ON `shift_assignments` (`store_id`,`date`,`status`);--> statement-breakpoint
CREATE TABLE `shift_swaps` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`assignment_id` text NOT NULL,
	`from_staff_id` text NOT NULL,
	`to_staff_id` text,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_by` text,
	`decided_at` integer,
	`decide_note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignment_id`) REFERENCES `shift_assignments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_shift_swaps_store_status` ON `shift_swaps` (`store_id`,`status`);--> statement-breakpoint
CREATE TABLE `staff_availability` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`start_min` integer NOT NULL,
	`end_min` integer NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_staff_availability` ON `staff_availability` (`staff_id`,`weekday`,`start_min`);--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`kind` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_by` text,
	`decided_at` integer,
	`decide_note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_leave_requests_store_status` ON `leave_requests` (`store_id`,`status`);--> statement-breakpoint
CREATE INDEX `ix_leave_requests_staff_range` ON `leave_requests` (`staff_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `comp_off_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`delta_minutes` integer NOT NULL,
	`reason` text NOT NULL,
	`source_id` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ix_comp_off_staff` ON `comp_off_ledger` (`staff_id`);--> statement-breakpoint
CREATE TABLE `staff_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`staff_id` text NOT NULL,
	`tag` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_staff_skills` ON `staff_skills` (`staff_id`,`tag`);--> statement-breakpoint
CREATE TABLE `attendance_wifi_bssids` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`bssid` text NOT NULL,
	`label` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_wifi_bssids` ON `attendance_wifi_bssids` (`store_id`,`bssid`);
--> statement-breakpoint
-- 考勤/技能参数入配置端口（service 域同族，端口可调；NOT EXISTS 幂等守卫，created_by='system'）
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_att_offline_stale_hours', 1, 'attendance_offline_stale_hours',
  '断网打卡暂存兜底时限（小时）：本地暂存超 N 小时未补传=自动挂考勤异常申诉链（不无声丢卡）',
  '{"hours":24}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='attendance_offline_stale_hours' AND `active`=1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_staff_skill_tags', 1, 'staff_skill_tags',
  '员工技能标签集（排班技能匹配用；店长在配置端口维护标签集）',
  '{"tags":["洗护","寄养","美容","造型","前台"]}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key`='staff_skill_tags' AND `active`=1);
