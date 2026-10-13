-- PD-22 监控僵尸 P1（D-47→D-48 · 任务书冻结版 V1.0 · 老板 10-13 签）：5 枚新 copy 键（mon.forceComplete×5 异常待清强制完成动作）
-- 幂等：NOT EXISTS 守卫；键值=生成件 copySeedRows.ts 单源逐字（台账新规：键入码必随迁移）；INSERT 计数断言==5。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mon.forceCompleteCta', 'merchant:monitor', json_object('text', '强制完成'), '商家·在店监控', 'MonitorHubPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mon.forceCompleteCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mon.forceCompleteConfirm', 'merchant:monitor', json_object('text', '确认强制完成该单？留痕=操作人/时刻/前后状态在册可查'), '商家·在店监控', 'MonitorHubPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mon.forceCompleteConfirm' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mon.forceCompleteNote', 'merchant:monitor', json_object('text', '强制完成（异常待清清淤 · PD-22）'), '商家·在店监控', 'MonitorHubPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mon.forceCompleteNote' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mon.forceCompleteToast', 'merchant:monitor', json_object('text', '已强制完成（留痕在册）'), '商家·在店监控', 'MonitorHubPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mon.forceCompleteToast' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mon.forceCompleteFail', 'merchant:monitor', json_object('text', '强制完成失败，请稍后再试'), '商家·在店监控', 'MonitorHubPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mon.forceCompleteFail' AND `active` = 1);
