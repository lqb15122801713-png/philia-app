-- PD-24 钱域寄养 P1（D-50～D-55 · 任务书冻结版 V1.0 · 老板 10-14 签「立刻开 PD-24」）：copy 键 6 增 1 改
--   D-50 超期 RR 人话：cashier.refundRequestSlaOverdue 改值「超期→超期待批」+ cashier.refundRequestSlaOverdueDays/Hours 增（已超 N 天/小时）+ dash.todoRefundRequestOverdueDays/Hours 增（仪表盘审批区超期注）。
--   D-54 改期审批透出：appt.reschedulePendingTitle/Desc 增（详情页改期待确认横幅）。
-- 幂等：新增=NOT EXISTS 守卫；改值=UPDATE active=1 行（0071/0079 范式）。键值=生成件 copySeedRows.ts 单源逐字（台账新规：键入码必随迁移）。
-- 零真退/零自动批/零支付通道（本批仅文案键+读口透出字段，无 schema 变更）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cashier.refundRequestSlaOverdueDays', 'merchant:cashier', json_object('text', '已超 {n} 天'), '商家·退款单', 'CashierRefundsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cashier.refundRequestSlaOverdueDays' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cashier.refundRequestSlaOverdueHours', 'merchant:cashier', json_object('text', '已超 {n} 小时'), '商家·退款单', 'CashierRefundsPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cashier.refundRequestSlaOverdueHours' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'dash.todoRefundRequestOverdueDays', 'merchant:dashboard', json_object('text', '超期 {n} 天待批'), '商家·驾驶舱首页', 'DashboardPage 审批区行注', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'dash.todoRefundRequestOverdueDays' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'dash.todoRefundRequestOverdueHours', 'merchant:dashboard', json_object('text', '超期 {n} 小时待批'), '商家·驾驶舱首页', 'DashboardPage 审批区行注', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'dash.todoRefundRequestOverdueHours' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appt.reschedulePendingTitle', 'merchant:appointments', json_object('text', '客户改期申请待确认'), '商家·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appt.reschedulePendingTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appt.reschedulePendingDesc', 'merchant:appointments', json_object('text', '客户把本单从 {from} 改到 {to}；点「确认预约」按新时间成行，或用「改期」代客调整'), '商家·预约详情', 'AppointmentDetailPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appt.reschedulePendingDesc' AND `active` = 1);
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '超期待批'), `updated_at` = unixepoch() WHERE `rule_key` = 'cashier.refundRequestSlaOverdue' AND `active` = 1;
