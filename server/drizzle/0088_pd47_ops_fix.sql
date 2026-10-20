-- PD-47 L1（修 PD-46 开挂）：驾驶舱连锁视图注记去「读口=store.chainDashboard」调试串。
-- 0052_chain2_keys 把 dash.m3ChainNote 端口行改值成「合计+分栏并列（读口=store.chainDashboard 三店真值）」，
-- activeCopyTexts 全量透出 active 行、覆盖层端口值优先 → 店主 /dashboard 连锁视图明文泄漏读口串。
-- 幂等：UPDATE active=1 行对齐 PD-47 码内默认（去读口串，注记语义保留）；seed 单源 copySeedRows.ts 同步更正。
UPDATE `copy_overrides` SET `value_json` = json_object('text', '合计+分栏并列（三店真值）'), `updated_at` = unixepoch() WHERE `rule_key` = 'dash.m3ChainNote' AND `active` = 1;
