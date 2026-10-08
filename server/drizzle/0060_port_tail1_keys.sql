-- 端口批收尾片 1（件 7 逐参数帮助）：cfghelp.* 参数帮助注 copy 键注册 8 枚（server composeHelpText 覆盖源；生成件同帧=copySeedRows 3670 行）
-- 幂等：rule_key active 行 NOT EXISTS 守卫；created_by='system'（FK=OFF 惯例见 migrate.ts 头注）。
-- 工艺：本文件=脚本生成（多句 INSERT 全前缀+计数断言=8，0052/0053 断链事故后立规矩）。
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cfghelp.pay_timeout_minutes', 'merchant:/settings/rules', json_object('text', '支付超时关单时长：paying 单超 N 分钟未支付自动关单（在途单按创建时快照不回溯）'), '/settings/rules', '参数字典·帮助注', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cfghelp.pay_timeout_minutes' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cfghelp.pay_channel_enabled', 'merchant:/settings/rules', json_object('text', '线上支付通道开关：关=客户端 createOrder 拒单（内测 mock 通道；kill switch 开时本键被强制回落为关）'), '/settings/rules', '参数字典·帮助注', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cfghelp.pay_channel_enabled' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cfghelp.plan_yinghuo', 'merchant:/settings/rules', json_object('text', '萤火档会员价费配置：年费/回馈金比例/服务折扣/含宠数（涉钱参数，二级审批生效）'), '/settings/rules', '参数字典·帮助注', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cfghelp.plan_yinghuo' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cfghelp.refund_threshold_fen', 'merchant:/settings/rules', json_object('text', '退款店长阈值（分）：超阈值退款单须店主审批（涉钱参数）'), '/settings/rules', '参数字典·帮助注', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cfghelp.refund_threshold_fen' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cfghelp.commission_grooming_rate', 'merchant:/settings/rules', json_object('text', '美容服务提成率（万分比）：新单按生效时版本计提（涉钱参数）'), '/settings/rules', '参数字典·帮助注', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cfghelp.commission_grooming_rate' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cfghelp.xp_daily_cap', 'merchant:/settings/rules', json_object('text', 'XP 日上限：单员工单日 XP 封顶（防刷口径）'), '/settings/rules', '参数字典·帮助注', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cfghelp.xp_daily_cap' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cfghelp.duration_base_min', 'merchant:/settings/rules', json_object('text', '时长基础分钟：服务时长基准值（时长系数域单源）'), '/settings/rules', '参数字典·帮助注', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cfghelp.duration_base_min' AND `active` = 1)
--> statement-breakpoint
INSERT INTO `copy_overrides` (`id`,`version`,`rule_key`,`label`,`value_json`,`screen`,`position`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcopy_' || lower(hex(randomblob(8))), 1, 'cfghelp.config_kill_switch', 'merchant:/settings/rules', json_object('text', '全局一键开关：开=可关参数瞬时回落安全值（当前=线上支付通道关）；页面显著红态'), '/settings/rules', '参数字典·帮助注', unixepoch(), 1, 'system', unixepoch(), unixepoch() WHERE NOT EXISTS (SELECT 1 FROM `copy_overrides` WHERE `rule_key` = 'cfghelp.config_kill_switch' AND `active` = 1)
