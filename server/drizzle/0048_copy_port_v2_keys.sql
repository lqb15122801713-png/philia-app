-- 端口 V2 修正批：copyport 域新键注册（屏分组 UI 文案 5 键；含 screen/position 列值——生成件同帧）
-- 幂等：rule_key active 行 NOT EXISTS 守卫；created_by='system'（FK=OFF 惯例见 migrate.ts 头注）。
-- 生成件=scripts/gen-copy-overrides-seed.mts 重跑产物（server/src/db/copySeedRows.ts 同帧）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'copyport.positionLabel', 'merchant:copyPort', json_object('text', '位置注'), '商家·文案端口', 'CopyConfigPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'copyport.positionLabel' AND `active` = 1)
--> statement-breakpoint
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'copyport.positionPlaceholder', 'merchant:copyPort', json_object('text', '一句人话：这文案在这屏的什么位置'), '商家·文案端口', 'CopyConfigPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'copyport.positionPlaceholder' AND `active` = 1)
--> statement-breakpoint
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'copyport.screenFilterAll', 'merchant:copyPort', json_object('text', '全部屏'), '商家·文案端口', 'CopyConfigPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'copyport.screenFilterAll' AND `active` = 1)
--> statement-breakpoint
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'copyport.unscreenedGroup', 'merchant:copyPort', json_object('text', '未归屏'), '商家·文案端口', 'CopyConfigPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'copyport.unscreenedGroup' AND `active` = 1)
--> statement-breakpoint
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'copyport.unscreenedNote', 'merchant:copyPort', json_object('text', '以下键的调用页未被屏名字典覆盖（诚实兜底组）——位置注可人工改，复核后挂屏'), '商家·文案端口', 'CopyConfigPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'copyport.unscreenedNote' AND `active` = 1)
