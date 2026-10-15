-- PD-25 运营后台改名纯 copy（D-56 · 任务书冻结版 V1.0 · CJ-1014-01 老板 10-14 批「先批展示改名小批，不堵 PD-24」）：copy 键 0 增 7 改
--   A1 wnav.footConsole「开发者管理端→运营后台端」；A2 cadm.pageTitle 同名 + pageSub 写死「内容与脸面 · 店主 · 钱权另闸」；
--   A4 cadm.ownerOnlyTitle 换名（不放权）；C3 killArm×3 支付语义加强（明示支付+非 Banner；闸/端点/行为零改动）。
-- 幂等：UPDATE active=1 行（0071/0079/0083 范式）。键值=生成件 copySeedRows.ts 单源逐字（台账新规：键入码必随迁移）。
-- 零权限变更/零路由变更/零 schema 变更；roles.ts 店员引导句为码内文案（非键）随码改。
UPDATE `copy_overrides` SET `value_json` = json_object('text', '运营后台端'), `updated_at` = unixepoch() WHERE `rule_key` = 'wnav.footConsole' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '运营后台端'), `updated_at` = unixepoch() WHERE `rule_key` = 'cadm.pageTitle' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '内容与脸面 · 店主 · 钱权另闸'), `updated_at` = unixepoch() WHERE `rule_key` = 'cadm.pageSub' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '运营后台端仅店主可用'), `updated_at` = unixepoch() WHERE `rule_key` = 'cadm.ownerOnlyTitle' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '支付一键关停（非 Banner）：线上支付通道等可关参数瞬时回落安全值（全局）。'), `updated_at` = unixepoch() WHERE `rule_key` = 'cadm.killArmNote' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '支付一键关停'), `updated_at` = unixepoch() WHERE `rule_key` = 'cadm.killArm' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '确认支付一键关停？线上支付通道等可关参数将瞬时回落安全值（与 Banner 槽位下线无关）。'), `updated_at` = unixepoch() WHERE `rule_key` = 'cadm.killArmConfirm' AND `active` = 1;
