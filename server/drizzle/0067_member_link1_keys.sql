-- 会员链路修正小批 片 1（收银台三件 · 任务书冻结版 V1.0）：cashier.memberNonMember+cashier.memberServiceEntry 键注册（撤牌两键=读路径缺口文案随修撤除，宇宙只增不改仓行留档不写 DELETE）
-- 幂等：rule_key active 行 NOT EXISTS 守卫（INSERT=2 逐句）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cashier.memberNonMember', 'merchant:/cashier', json_object('text', '非会员 · 售卡即开通'), '/cashier', 'MembershipPanel 客户块（非会员态注记）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cashier.memberNonMember' AND `active` = 1);
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cashier.memberServiceEntry', 'merchant:/cashier', json_object('text', '会员服务 ›'), '/cashier', 'MemberSearch 已识别会员常驻入口（会员链路小批片 1）', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cashier.memberServiceEntry' AND `active` = 1);
