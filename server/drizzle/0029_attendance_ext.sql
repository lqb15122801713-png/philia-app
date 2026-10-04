-- 员工端骨架整建批 片 2：attendance_records 扩列（考勤 7 件承载）
-- source=offline_relay 断网补传标记 / client_ts=设备端打卡时刻 / bssid=WiFi 打卡命中 /
-- photo_url=外勤拍照 / confirmed_by+confirmed_at=工时·考勤结果员工确认链（证据链锁定）
-- 幂等=journal 守卫（仅跑一次）；存量行新列=NULL（诚实空）。
ALTER TABLE `attendance_records` ADD `source` text;
--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `client_ts` integer;
--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `bssid` text;
--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `photo_url` text;
--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `confirmed_by` text REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action;
--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `confirmed_at` integer;
