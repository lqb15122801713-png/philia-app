-- 走查修复批（D-29~D-34 · 任务书冻结版 V1.0 · 老板 10-12 签）：10 枚新 copy 键（打卡放宽注记/日结已结明示/落端明示卡）+ service_rules 端口键 attendance_allow_insecure_http（D-31 留口：真机收紧=改参不改码）
-- 幂等：全部 NOT EXISTS 守卫；copy 键值=生成件 copySeedRows.ts 单源逐字（台账新规：键入码必随迁移）；INSERT 计数断言==11（copy 10+service_rules 1）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'attendance.geo.noGeoNote', 'staff:attendance', json_object('text', '当前环境无法获取定位，本次打卡将以「未取到定位」留痕提交'), '员工·打卡', 'AttendancePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'attendance.geo.noGeoNote' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'attendance.source.nogeo', 'staff:attendance', json_object('text', '未取到定位'), '员工·打卡', 'AttendancePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'attendance.source.nogeo' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cashier.dayFrozenBannerTitle', 'merchant:cashier', json_object('text', '今日已日结冻结'), '商家·日结·交接班', 'CashierClosePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cashier.dayFrozenBannerTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cashier.dayFrozenBannerBody', 'merchant:cashier', json_object('text', '账面=冻结快照停涨（账面 ¥{book} · 实点 ¥{actual}）；现在起新开的单自动计入次日班次'), '商家·日结·交接班', 'CashierClosePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cashier.dayFrozenBannerBody' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'devlogin.endStaffTitle', 'devlogin', json_object('text', '该账号是员工账号'), '客户·开发登录', 'DevLoginPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'devlogin.endStaffTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'devlogin.endStaffBody', 'devlogin', json_object('text', '客户端（宠友壳）没有员工工作台，请前往员工端登录使用；当前会话已登录，点下方链接直达。'), '客户·开发登录', 'DevLoginPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'devlogin.endStaffBody' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'devlogin.endMerchantTitle', 'devlogin', json_object('text', '该账号是商家账号'), '客户·开发登录', 'DevLoginPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'devlogin.endMerchantTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'devlogin.endMerchantBody', 'devlogin', json_object('text', '客户端（宠友壳）没有商家后台，请前往商家端登录使用；当前会话已登录，点下方链接直达。'), '客户·开发登录', 'DevLoginPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'devlogin.endMerchantBody' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'devlogin.endLinkStaff', 'devlogin', json_object('text', '前往员工端 ›'), '客户·开发登录', 'DevLoginPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'devlogin.endLinkStaff' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'devlogin.endLinkMerchant', 'devlogin', json_object('text', '前往商家端 ›'), '客户·开发登录', 'DevLoginPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'devlogin.endLinkMerchant' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `service_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`store_id`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedrule_' || lower(hex(randomblob(8))), 1, 'attendance_allow_insecure_http', '打卡定位不可用放行（内测期限定；true=无坐标也允许打卡并标「未取到定位」留痕；真机收紧=改 false）', json_object('enabled', true), NULL, unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `service_rules` WHERE `rule_key` = 'attendance_allow_insecure_http' AND `active` = 1);
