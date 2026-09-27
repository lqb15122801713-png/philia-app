-- 0016 幂等配置种子（复走修复包 PR-1 · 迁移豁免件 Y6，零 DDL 纯种子行）
-- ① refund_rules.refund_over_threshold_to_draft：超阈值留口开关（PD-02 件 6 ·
--    CJ-0923-20①），默认 enabled=false=维持硬拒；on=超阈值（非涉储值）落 draft
--    申请行（零联动纯留痕，批准=店主重新执行）。
-- ② member_plans.default_plan_key：注册默认档端口化（PD-05 件 2 · CJ-0925-10②），
--    读侧随修复包 PR-4 启用（openFree 硬编码 plan_weiguang 改读本键）。
-- 幂等：active 行已存在则跳过。created_by='system'（迁移期 users 表可为空；
-- 迁移执行器 PRAGMA foreign_keys=OFF，惯例见 migrate.ts 头注）。

INSERT INTO `refund_rules` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_refund_over_threshold_to_draft', 1, 'refund_over_threshold_to_draft',
  '退款超阈值落 draft 待批（默认关=维持硬拒；开=落申请行，店主重新执行）',
  '{"enabled":false}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `refund_rules` WHERE `rule_key`='refund_over_threshold_to_draft' AND `active`=1);
--> statement-breakpoint
INSERT INTO `member_plans` (`id`,`version`,`rule_key`,`label`,`value_json`,`effective_from`,`active`,`created_by`,`created_at`,`updated_at`)
SELECT 'seedcfg_default_plan_key', 1, 'default_plan_key',
  '注册默认会员档（自助开档落档键；端口可改）',
  '{"value":"plan_weiguang"}', unixepoch(), 1, 'system', unixepoch(), unixepoch()
WHERE NOT EXISTS (SELECT 1 FROM `member_plans` WHERE `rule_key`='default_plan_key' AND `active`=1);
