-- PD-79 服务中撤单／撤核销入口 copy（0120，本窗独占号；键入码必随迁移·台账新规，照 0116 范式）：
--   商家端预约详情操作区新增 8 键：撤核销/撤单共用「原因必填」标签与占位＋两入口确认钮，
--   撤单 CTA/弹层正文/toast/失败语。状态机零 schema 变更（cancelSource='merchant' 为 text 列新值）。
-- 幂等：INSERT … WHERE NOT EXISTS 守卫（0084/0116 范式，重放无害）。
-- 键值=apps/merchant/src/copy/appointments.ts 单源逐字（seed 手补先例：生成件全量重生成会拖入他窗未审键，本窗最小手补 copySeedRows.ts 同 8 键）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appt.voidReasonLabel', 'merchant:appointments', json_object('text', '原因（必填，全留痕）'), '商家·预约详情', 'AppointmentDetailPage 撤核销/撤单弹层原因标签', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appt.voidReasonLabel' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appt.voidReasonPlaceholder', 'merchant:appointments', json_object('text', '请填写原因——操作人／时间／原因／前后状态全留痕'), '商家·预约详情', 'AppointmentDetailPage 撤核销/撤单弹层原因占位', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appt.voidReasonPlaceholder' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appt.voidCheckinConfirmCta', 'merchant:appointments', json_object('text', '确认撤核销'), '商家·预约详情', 'AppointmentDetailPage 撤核销弹层确认钮', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appt.voidCheckinConfirmCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appt.merchantCancelCta', 'merchant:appointments', json_object('text', '撤单'), '商家·预约详情', 'AppointmentDetailPage 操作区撤单钮/弹层题', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appt.merchantCancelCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appt.merchantCancelConfirm', 'merchant:appointments', json_object('text', '确认撤销本单？预约将转为「已取消」，槽位立即释放，次卡／预付台账同步回冲；操作全留痕，不可撤销。'), '商家·预约详情', 'AppointmentDetailPage 撤单弹层正文', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appt.merchantCancelConfirm' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appt.merchantCancelConfirmCta', 'merchant:appointments', json_object('text', '确认撤单'), '商家·预约详情', 'AppointmentDetailPage 撤单弹层确认钮', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appt.merchantCancelConfirmCta' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appt.merchantCancelToast', 'merchant:appointments', json_object('text', '已撤单，预约转为已取消'), '商家·预约详情', 'AppointmentDetailPage 撤单成功 toast', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appt.merchantCancelToast' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'appt.merchantCancelFail', 'merchant:appointments', json_object('text', '撤单失败，请稍后再试'), '商家·预约详情', 'AppointmentDetailPage 撤单失败 toast', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'appt.merchantCancelFail' AND `active` = 1);
