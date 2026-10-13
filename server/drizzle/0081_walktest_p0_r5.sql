-- PD-21 走测修批 P0×4（D-45→D-46→D-44→D-43 · 任务书冻结版 V1.0 · 老板 10-13 签）：10 枚新 copy 键（mall.orderDetail×6 订单详情页 + mon.zombie×4 监控 24h 僵尸出列）
-- 幂等：NOT EXISTS 守卫；键值=生成件 copySeedRows.ts 单源逐字（台账新规：键入码必随迁移）；INSERT 计数断言==10。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.orderDetailTitle', 'mall', json_object('text', '订单详情'), NULL, '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.orderDetailTitle' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.orderDetailNotFound', 'mall', json_object('text', '订单不存在或已删除'), NULL, '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.orderDetailNotFound' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.orderDetailBack', 'mall', json_object('text', '返回订单列表'), NULL, '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.orderDetailBack' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.orderDetailItems', 'mall', json_object('text', '商品明细'), NULL, '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.orderDetailItems' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.orderDetailInfo', 'mall', json_object('text', '订单信息'), NULL, '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.orderDetailInfo' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mall.orderDetailRefund', 'mall', json_object('text', '退款/售后 ›'), NULL, '未在页面调用点命中（mall 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mall.orderDetailRefund' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mon.zombieChip', 'merchant:monitor', json_object('text', '异常待清 {n}'), '商家·在店监控', 'MonitorHubPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mon.zombieChip' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mon.zombieAlertLine', 'merchant:monitor', json_object('text', '异常待清 {n} 单：服务中超 24 小时未翻步，点我定位排障'), '商家·在店监控', 'MonitorHubPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mon.zombieAlertLine' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mon.zombieSectionNote', 'merchant:monitor', json_object('text', '异常待清：以下服务单超 24 小时未翻步，已从默认「服务中」分离——请到店核实后翻步、完成或联系店长处理'), '商家·在店监控', 'MonitorHubPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mon.zombieSectionNote' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mon.zombieBadge', 'merchant:monitor', json_object('text', '异常待清'), '商家·在店监控', 'MonitorHubPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mon.zombieBadge' AND `active` = 1);
