-- 商家端大批片 5（会员营销+报表+找回两件）：copy 键注册 257 枚（mk.* 营销域 130+rpt.d9top/weekly 13+cadm.portMarketing+trf/inv 排序位移行排除后真新增；生成件同帧=copySeedRows 3601 行）
-- 幂等：rule_key active 行 NOT EXISTS 守卫；created_by='system'（FK=OFF 惯例见 migrate.ts 头注）。
-- 工艺：本文件=脚本生成（多句 INSERT 全前缀+计数断言=257，立规矩照办）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cadm.portMarketing', 'merchant:consoleAdmin', json_object('text', '会员营销'), '商家·开发者管理端', 'ConsolePage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cadm.portMarketing' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.aside', 'merchant:marketing', json_object('text', '台账+通知落行 · 不造假发'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.grantOwner', 'merchant:marketing', json_object('text', '会员生日礼'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.grantOwner' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.grantPet', 'merchant:marketing', json_object('text', '宠物生日礼'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.grantPet' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.grantsEmpty', 'merchant:marketing', json_object('text', '暂无生日权益发放记录'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.grantsEmpty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.grantsTitle', 'merchant:marketing', json_object('text', '生日权益发放台账'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.grantsTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.kindMember', 'merchant:marketing', json_object('text', '会员'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.kindMember' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.kindPet', 'merchant:marketing', json_object('text', '宠物'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.kindPet' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.tierAmount', 'merchant:marketing', json_object('text', '面额'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.tierAmount' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.tierDays', 'merchant:marketing', json_object('text', '有效天数'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.tierDays' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.tierEmpty', 'merchant:marketing', json_object('text', '端口未配置，走缺省档位'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.tierEmpty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.tierThreshold', 'merchant:marketing', json_object('text', '门槛'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.tierThreshold' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.tierTitle', 'merchant:marketing', json_object('text', '生日权益档位（端口 birthday_perk_tier）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.tierTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.title', 'merchant:marketing', json_object('text', '生日营销'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.upcomingEmpty', 'merchant:marketing', json_object('text', '近 30 天无会员/宠物生日'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.upcomingEmpty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.bday.upcomingTitle', 'merchant:marketing', json_object('text', '近 30 天生日提醒'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.bday.upcomingTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.aside', 'merchant:marketing', json_object('text', '台账留痕 · 同人同券不重复发'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.colCoupon', 'merchant:marketing', json_object('text', '券'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.colCoupon' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.colGranted', 'merchant:marketing', json_object('text', '已发'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.colGranted' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.colNote', 'merchant:marketing', json_object('text', '备注'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.colNote' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.colTarget', 'merchant:marketing', json_object('text', '目标'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.colTarget' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.colTime', 'merchant:marketing', json_object('text', '时间'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.colTime' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.colTitle', 'merchant:marketing', json_object('text', '标题'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.colTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.done', 'merchant:marketing', json_object('text', '已发放：匹配 {m} 人，实发 {g} 份'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.done' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.empty', 'merchant:marketing', json_object('text', '暂无发放记录'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.fCoupon', 'merchant:marketing', json_object('text', '选券'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.fCoupon' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.fNote', 'merchant:marketing', json_object('text', '备注（可选）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.fNote' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.fTargetKind', 'merchant:marketing', json_object('text', '目标标签类（留空=全量）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.fTargetKind' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.fTargetValue', 'merchant:marketing', json_object('text', '目标标签值'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.fTargetValue' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.fTitle', 'merchant:marketing', json_object('text', '发放标题'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.fTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.grantCta', 'merchant:marketing', json_object('text', '＋ 发放'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.grantCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.grantedUnit', 'merchant:marketing', json_object('text', '{n} 份'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.grantedUnit' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.invalid', 'merchant:marketing', json_object('text', '须选券并填标题；选目标类后须填目标值'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.invalid' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.modalTitle', 'merchant:marketing', json_object('text', '定向发放'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.modalTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.noCoupon', 'merchant:marketing', json_object('text', '暂无在架券——请先在券矩阵新建'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.noCoupon' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.targetAll', 'merchant:marketing', json_object('text', '本店全量会员'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.targetAll' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.campaign.title', 'merchant:marketing', json_object('text', '定向发放'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.campaign.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.common.cancel', 'merchant:marketing', json_object('text', '取消'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.common.cancel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.common.loadFail', 'merchant:marketing', json_object('text', '加载失败，请检查网络后重试'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.common.loadFail' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.common.retry', 'merchant:marketing', json_object('text', '重新加载'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.common.retry' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.common.submit', 'merchant:marketing', json_object('text', '确认提交'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.common.submit' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.common.submitting', 'merchant:marketing', json_object('text', '提交中…'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.common.submitting' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.aside', 'merchant:marketing', json_object('text', '六类模板 · 登记制不接真抵扣'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.colAmount', 'merchant:marketing', json_object('text', '面额'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.colAmount' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.colDays', 'merchant:marketing', json_object('text', '有效天数'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.colDays' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.colQuota', 'merchant:marketing', json_object('text', '配额'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.colQuota' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.colStatus', 'merchant:marketing', json_object('text', '状态'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.colStatus' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.colThreshold', 'merchant:marketing', json_object('text', '门槛'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.colThreshold' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.colTitle', 'merchant:marketing', json_object('text', '标题'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.colTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.colType', 'merchant:marketing', json_object('text', '类型'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.colType' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.createCta', 'merchant:marketing', json_object('text', '＋ 新建券'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.createCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.done', 'merchant:marketing', json_object('text', '券模板已创建'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.done' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.empty', 'merchant:marketing', json_object('text', '暂无券模板——先建一张注册券或充值券'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.fAmount', 'merchant:marketing', json_object('text', '面额（元）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.fAmount' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.fDays', 'merchant:marketing', json_object('text', '有效天数'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.fDays' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.fQuota', 'merchant:marketing', json_object('text', '总配额（留空=不限）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.fQuota' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.fThreshold', 'merchant:marketing', json_object('text', '门槛（元，0=无门槛）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.fThreshold' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.fTitle', 'merchant:marketing', json_object('text', '标题'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.fTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.fType', 'merchant:marketing', json_object('text', '券类型'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.fType' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.invalid', 'merchant:marketing', json_object('text', '标题必填，面额须为正数，有效天数 1-3650'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.invalid' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.modalTitle', 'merchant:marketing', json_object('text', '新建券模板'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.modalTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.quotaNone', 'merchant:marketing', json_object('text', '不限'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.quotaNone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.statusOff', 'merchant:marketing', json_object('text', '停用'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.statusOff' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.statusOn', 'merchant:marketing', json_object('text', '在架'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.statusOn' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.thresholdNone', 'merchant:marketing', json_object('text', '无门槛'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.thresholdNone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.title', 'merchant:marketing', json_object('text', '券矩阵'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.typeBirthday', 'merchant:marketing', json_object('text', '生日券'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.typeBirthday' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.typeConsume', 'merchant:marketing', json_object('text', '消费券'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.typeConsume' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.typeFestival', 'merchant:marketing', json_object('text', '节日券'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.typeFestival' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.typeRecharge', 'merchant:marketing', json_object('text', '充值券'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.typeRecharge' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.typeRegister', 'merchant:marketing', json_object('text', '注册券'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.typeRegister' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.coupon.typeWakeup', 'merchant:marketing', json_object('text', '唤醒券'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.coupon.typeWakeup' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.advanced', 'merchant:marketing', json_object('text', '状态已推进'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.advanced' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.aside', 'merchant:marketing', json_object('text', '申请→确认→了结 · 留痕不碰真钱'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.colDiff', 'merchant:marketing', json_object('text', '差价'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.colDiff' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.colNew', 'merchant:marketing', json_object('text', '换新'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.colNew' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.colNote', 'merchant:marketing', json_object('text', '备注'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.colNote' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.colOperator', 'merchant:marketing', json_object('text', '经办'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.colOperator' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.colOps', 'merchant:marketing', json_object('text', '操作'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.colOps' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.colOrig', 'merchant:marketing', json_object('text', '原商品'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.colOrig' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.colStatus', 'merchant:marketing', json_object('text', '状态'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.colStatus' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.confirmCta', 'merchant:marketing', json_object('text', '确认'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.confirmCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.createCta', 'merchant:marketing', json_object('text', '＋ 登记换货'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.createCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.diffMinus', 'merchant:marketing', json_object('text', '退差 {v}'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.diffMinus' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.diffPlus', 'merchant:marketing', json_object('text', '补收 {v}'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.diffPlus' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.diffZero', 'merchant:marketing', json_object('text', '无差价'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.diffZero' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.done', 'merchant:marketing', json_object('text', '换货已登记'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.done' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.empty', 'merchant:marketing', json_object('text', '暂无换货记录'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.fDiff', 'merchant:marketing', json_object('text', '差价（元，正=补收 负=退差）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.fDiff' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.fNew', 'merchant:marketing', json_object('text', '换新商品名'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.fNew' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.fNote', 'merchant:marketing', json_object('text', '备注（可选）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.fNote' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.fOrig', 'merchant:marketing', json_object('text', '原商品名'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.fOrig' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.invalid', 'merchant:marketing', json_object('text', '原商品名/换新名必填，差价须为数字'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.invalid' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.modalTitle', 'merchant:marketing', json_object('text', '登记换货'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.modalTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.settleCta', 'merchant:marketing', json_object('text', '了结'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.settleCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.stApplied', 'merchant:marketing', json_object('text', '已申请'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.stApplied' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.stConfirmed', 'merchant:marketing', json_object('text', '已确认'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.stConfirmed' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.stSettled', 'merchant:marketing', json_object('text', '已了结'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.stSettled' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exch.title', 'merchant:marketing', json_object('text', '换货差价补退'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exch.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.aside', 'merchant:marketing', json_object('text', '手工台账 · 不接发票流'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.colAmount', 'merchant:marketing', json_object('text', '金额'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.colAmount' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.colMonth', 'merchant:marketing', json_object('text', '归属月份'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.colMonth' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.colNote', 'merchant:marketing', json_object('text', '备注'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.colNote' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.colOperator', 'merchant:marketing', json_object('text', '记账人'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.colOperator' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.colOps', 'merchant:marketing', json_object('text', '操作'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.colOps' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.colType', 'merchant:marketing', json_object('text', '类型'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.colType' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.createCta', 'merchant:marketing', json_object('text', '＋ 记一笔'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.createCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.deleteCta', 'merchant:marketing', json_object('text', '删除'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.deleteCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.deleted', 'merchant:marketing', json_object('text', '台账行已删除'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.deleted' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.done', 'merchant:marketing', json_object('text', '支出已记账'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.done' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.empty', 'merchant:marketing', json_object('text', '暂无支出记录'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.fAmount', 'merchant:marketing', json_object('text', '金额（元）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.fAmount' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.fMonth', 'merchant:marketing', json_object('text', '归属月份'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.fMonth' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.fNote', 'merchant:marketing', json_object('text', '备注（可选）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.fNote' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.fType', 'merchant:marketing', json_object('text', '类型'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.fType' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.invalid', 'merchant:marketing', json_object('text', '金额须为正数，月份必选'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.invalid' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.modalTitle', 'merchant:marketing', json_object('text', '记一笔支出'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.modalTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.monthAll', 'merchant:marketing', json_object('text', '全部月份'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.monthAll' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.monthLabel', 'merchant:marketing', json_object('text', '月份'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.monthLabel' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.summaryTotal', 'merchant:marketing', json_object('text', '合计'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.summaryTotal' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.title', 'merchant:marketing', json_object('text', '支出台账'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.typeOther', 'merchant:marketing', json_object('text', '其他'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.typeOther' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.typeRent', 'merchant:marketing', json_object('text', '房租'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.typeRent' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.typeSalary', 'merchant:marketing', json_object('text', '工资'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.typeSalary' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.exp.typeUtility', 'merchant:marketing', json_object('text', '水电'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.exp.typeUtility' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.guide.hint', 'merchant:marketing', json_object('text', '标签/券/活动配置属管理层视界（server 硬闸门兜底）；请切换店长或店主账号。'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.guide.hint' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.guide.title', 'merchant:marketing', json_object('text', '会员营销由店长或店主管理'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.guide.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.aside', 'merchant:marketing', json_object('text', '待检=台账标记层 · 不合格触发报损'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.colOperator', 'merchant:marketing', json_object('text', '经办'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.colOperator' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.colOps', 'merchant:marketing', json_object('text', '操作'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.colOps' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.colProduct', 'merchant:marketing', json_object('text', '商品'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.colProduct' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.colQcNote', 'merchant:marketing', json_object('text', '质检备注'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.colQcNote' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.colQty', 'merchant:marketing', json_object('text', '数量'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.colQty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.colStatus', 'merchant:marketing', json_object('text', '状态'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.colStatus' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.colTime', 'merchant:marketing', json_object('text', '时间'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.colTime' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.createCta', 'merchant:marketing', json_object('text', '＋ 登记待检'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.createCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.done', 'merchant:marketing', json_object('text', '待检已登记'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.done' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.empty', 'merchant:marketing', json_object('text', '暂无待检记录'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.fNote', 'merchant:marketing', json_object('text', '备注（可选）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.fNote' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.fProduct', 'merchant:marketing', json_object('text', '商品'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.fProduct' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.fQcNote', 'merchant:marketing', json_object('text', '质检备注'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.fQcNote' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.fQty', 'merchant:marketing', json_object('text', '数量'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.fQty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.failCta', 'merchant:marketing', json_object('text', '不合格'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.failCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.invalid', 'merchant:marketing', json_object('text', '须选商品，数量须为正整数'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.invalid' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.modalTitle', 'merchant:marketing', json_object('text', '登记退货待检'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.modalTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.passCta', 'merchant:marketing', json_object('text', '合格'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.passCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.reviewTitle', 'merchant:marketing', json_object('text', '质检结论'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.reviewTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.reviewed', 'merchant:marketing', json_object('text', '质检已落痕'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.reviewed' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.stFailed', 'merchant:marketing', json_object('text', '不合格'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.stFailed' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.stPassed', 'merchant:marketing', json_object('text', '合格'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.stPassed' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.stPending', 'merchant:marketing', json_object('text', '待检'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.stPending' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.insp.title', 'merchant:marketing', json_object('text', '退货待检'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.insp.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.ledger.backMarketing', 'merchant:marketing', json_object('text', '← 会员营销'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.ledger.backMarketing' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.ledger.pageSub', 'merchant:marketing', json_object('text', '支出 · 换货 · 退货待检 · 报表快照'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.ledger.pageSub' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.ledger.pageTitle', 'merchant:marketing', json_object('text', '营销台账'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.ledger.pageTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.page.sub', 'merchant:marketing', json_object('text', '会员标签 · 券矩阵 · 定向发放 · 生日营销 · 活动配置'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.page.sub' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.page.title', 'merchant:marketing', json_object('text', '会员营销'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.page.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.page.toLedger', 'merchant:marketing', json_object('text', '营销台账 →'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.page.toLedger' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.aside', 'merchant:marketing', json_object('text', '排期状态机留痕 · 不接真结算'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.colName', 'merchant:marketing', json_object('text', '名称'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.colName' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.colOps', 'merchant:marketing', json_object('text', '操作'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.colOps' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.colRange', 'merchant:marketing', json_object('text', '排期'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.colRange' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.colRules', 'merchant:marketing', json_object('text', '规则'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.colRules' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.colStatus', 'merchant:marketing', json_object('text', '状态'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.colStatus' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.colType', 'merchant:marketing', json_object('text', '类型'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.colType' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.createCta', 'merchant:marketing', json_object('text', '＋ 新建活动'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.createCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.done', 'merchant:marketing', json_object('text', '活动已保存'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.done' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.editCta', 'merchant:marketing', json_object('text', '编辑'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.editCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.empty', 'merchant:marketing', json_object('text', '暂无活动配置'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.fEndsAt', 'merchant:marketing', json_object('text', '排期结束（可选）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.fEndsAt' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.fName', 'merchant:marketing', json_object('text', '活动名称'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.fName' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.fStartsAt', 'merchant:marketing', json_object('text', '排期开始（可选）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.fStartsAt' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.fStatus', 'merchant:marketing', json_object('text', '状态'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.fStatus' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.fStatusDraft', 'merchant:marketing', json_object('text', '草稿（不上线）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.fStatusDraft' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.fStatusScheduled', 'merchant:marketing', json_object('text', '排期（按起止上下线）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.fStatusScheduled' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.fType', 'merchant:marketing', json_object('text', '活动类型'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.fType' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.invalid', 'merchant:marketing', json_object('text', '名称必填；规则字段不合法，请检查'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.invalid' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.modalCreate', 'merchant:marketing', json_object('text', '新建活动'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.modalCreate' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.modalEdit', 'merchant:marketing', json_object('text', '编辑活动'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.modalEdit' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.rangeNone', 'merchant:marketing', json_object('text', '未排期'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.rangeNone' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.ruleDailyEnd', 'merchant:marketing', json_object('text', '每日结束（HH:mm）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.ruleDailyEnd' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.ruleDailyStart', 'merchant:marketing', json_object('text', '每日开始（HH:mm）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.ruleDailyStart' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.ruleGift', 'merchant:marketing', json_object('text', '赠品说明'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.ruleGift' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.ruleMinus', 'merchant:marketing', json_object('text', '减（元）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.ruleMinus' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.ruleRate', 'merchant:marketing', json_object('text', '折数（0-1，如 0.85）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.ruleRate' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.ruleThreshold', 'merchant:marketing', json_object('text', '门槛（元）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.ruleThreshold' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.stActive', 'merchant:marketing', json_object('text', '进行中'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.stActive' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.stDraft', 'merchant:marketing', json_object('text', '草稿'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.stDraft' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.stEnded', 'merchant:marketing', json_object('text', '已结束'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.stEnded' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.stScheduled', 'merchant:marketing', json_object('text', '待上线'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.stScheduled' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.title', 'merchant:marketing', json_object('text', '活动配置'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.typeDiscount', 'merchant:marketing', json_object('text', '折扣'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.typeDiscount' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.typeExchangeGift', 'merchant:marketing', json_object('text', '换购'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.typeExchangeGift' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.typeFullMinus', 'merchant:marketing', json_object('text', '满减'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.typeFullMinus' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.typeSecondPiece', 'merchant:marketing', json_object('text', '第二件'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.typeSecondPiece' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.promo.typeTimePromo', 'merchant:marketing', json_object('text', '时段促销'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.promo.typeTimePromo' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.aside', 'merchant:marketing', json_object('text', '月快照永久留存 · 仅店主生成'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.colCreator', 'merchant:marketing', json_object('text', '生成人'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.colCreator' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.colKind', 'merchant:marketing', json_object('text', '类型'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.colKind' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.colMonth', 'merchant:marketing', json_object('text', '月份'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.colMonth' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.colTime', 'merchant:marketing', json_object('text', '时间'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.colTime' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.createCta', 'merchant:marketing', json_object('text', '＋ 生成快照'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.createCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.done', 'merchant:marketing', json_object('text', '快照已生成'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.done' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.empty', 'merchant:marketing', json_object('text', '暂无快照——店主可生成月快照留档'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.fKind', 'merchant:marketing', json_object('text', '快照类型'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.fKind' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.fMonth', 'merchant:marketing', json_object('text', '月份'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.fMonth' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.hint', 'merchant:marketing', json_object('text', 'payload 现取对应读口同帧数据（D1=营收月报 / member=会员月报）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.hint' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.kindD1', 'merchant:marketing', json_object('text', 'D1 营收月报'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.kindD1' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.kindMember', 'merchant:marketing', json_object('text', '会员月报（D3）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.kindMember' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.modalTitle', 'merchant:marketing', json_object('text', '生成报表快照'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.modalTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.monthAll', 'merchant:marketing', json_object('text', '全部月份'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.monthAll' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.title', 'merchant:marketing', json_object('text', '报表快照'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.snap.working', 'merchant:marketing', json_object('text', '正在取数并生成…'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.snap.working' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.stack.campaignCoupon', 'merchant:marketing', json_object('text', '活动 × 券'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.stack.campaignCoupon' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.stack.campaignMember', 'merchant:marketing', json_object('text', '活动 × 会员折扣'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.stack.campaignMember' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.stack.couponStack', 'merchant:marketing', json_object('text', '券叠加规则'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.stack.couponStack' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.stack.multiCampaign', 'merchant:marketing', json_object('text', '多活动叠加'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.stack.multiCampaign' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.stack.note', 'merchant:marketing', json_object('text', '当前值=端口公示（端口可改：config.save，门店覆盖优先于总部下发）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.stack.note' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.stack.title', 'merchant:marketing', json_object('text', '促销互斥 · 叠加规则（逐项开关公示）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.stack.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.aside', 'merchant:marketing', json_object('text', '近 500 条 · 更新倒序'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.aside' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.colKind', 'merchant:marketing', json_object('text', '类'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.colKind' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.colMember', 'merchant:marketing', json_object('text', '会员'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.colMember' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.colTime', 'merchant:marketing', json_object('text', '更新'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.colTime' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.colValue', 'merchant:marketing', json_object('text', '值'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.colValue' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.done', 'merchant:marketing', json_object('text', '已打标'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.done' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.empty', 'merchant:marketing', json_object('text', '暂无标签——给会员打上猫狗/体型/偏好标，定向发放才能瞄得准'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.empty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.filterAll', 'merchant:marketing', json_object('text', '全部'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.filterAll' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.invalid', 'merchant:marketing', json_object('text', '会员 userId 与标签值必填'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.invalid' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.kind', 'merchant:marketing', json_object('text', '标签类'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.kind' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.kindPref', 'merchant:marketing', json_object('text', '偏好'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.kindPref' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.kindSize', 'merchant:marketing', json_object('text', '体型'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.kindSize' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.kindSpecies', 'merchant:marketing', json_object('text', '猫狗'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.kindSpecies' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.modalTitle', 'merchant:marketing', json_object('text', '打标（同员同类覆盖写）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.modalTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.prefHint', 'merchant:marketing', json_object('text', '偏好自由短文（≤16 字）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.prefHint' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.setCta', 'merchant:marketing', json_object('text', '＋ 打标'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.setCta' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.sizeLarge', 'merchant:marketing', json_object('text', '大型（large）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.sizeLarge' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.sizeMedium', 'merchant:marketing', json_object('text', '中型（medium）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.sizeMedium' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.sizeSmall', 'merchant:marketing', json_object('text', '小型（small）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.sizeSmall' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.speciesCat', 'merchant:marketing', json_object('text', '猫（cat）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.speciesCat' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.speciesDog', 'merchant:marketing', json_object('text', '狗（dog）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.speciesDog' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.title', 'merchant:marketing', json_object('text', '会员标签'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.userId', 'merchant:marketing', json_object('text', '会员 userId'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.userId' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.userIdHint', 'merchant:marketing', json_object('text', '用户主键（次卡/会员页可见）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.userIdHint' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.value', 'merchant:marketing', json_object('text', '标签值'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.value' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'mk.tag.valueFilterPh', 'merchant:marketing', json_object('text', '按标签值滤（如 dog）'), NULL, '未在页面调用点命中（merchant:marketing 域键表，端口运营复核挂载屏）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'mk.tag.valueFilterPh' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.d9top.rankEmpty', 'merchant:report', json_object('text', '本月暂无成交商品'), '商家·经营报表', 'ReportPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.d9top.rankEmpty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.d9top.rankTitle', 'merchant:report', json_object('text', '销量排行 TOP20'), '商家·经营报表', 'ReportPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.d9top.rankTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.d9top.slowEmpty', 'merchant:report', json_object('text', '无滞销商品（本月全动销或无在库）'), '商家·经营报表', 'ReportPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.d9top.slowEmpty' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.d9top.slowTitle', 'merchant:report', json_object('text', '滞销（月零销 + 在库）'), '商家·经营报表', 'ReportPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.d9top.slowTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.weekly.byDayTitle', 'merchant:report', json_object('text', '本周逐日'), '商家·经营报表', 'ReportPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.weekly.byDayTitle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.weekly.count', 'merchant:report', json_object('text', '成交 {n} 单'), '商家·经营报表', 'ReportPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.weekly.count' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.weekly.curCard', 'merchant:report', json_object('text', '本周营收'), '商家·经营报表', 'ReportPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.weekly.curCard' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.weekly.prevCard', 'merchant:report', json_object('text', '上周营收'), '商家·经营报表', 'ReportPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.weekly.prevCard' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.weekly.serviceShop', 'merchant:report', json_object('text', '服务 {sv} · 商城 {sp}'), '商家·经营报表', 'ReportPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.weekly.serviceShop' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.weekly.title', 'merchant:report', json_object('text', '周报环比（周一起算）'), '商家·经营报表', 'ReportPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.weekly.title' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.weekly.toggle', 'merchant:report', json_object('text', '周报'), '商家·经营报表', 'ReportPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.weekly.toggle' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'rpt.weekly.wowLabel', 'merchant:report', json_object('text', '环比'), '商家·经营报表', 'ReportPage 页面内文案', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'rpt.weekly.wowLabel' AND `active` = 1)
