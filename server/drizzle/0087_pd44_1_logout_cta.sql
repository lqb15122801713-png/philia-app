-- PD-44.1（修 PD-44 S-00/M1）：员工端 /dev-login 主钮端口覆盖行去客户壳串键。
-- 0027 种子把 staff:login 域 login.primaryCta 写成「手机号一键登录」（客户壳旧文案）；
-- PD-44 码内默认已改「选择员工账号登录」但端口行未同步——activeCopyTexts 全量透出 active 行、
-- staff 覆盖层端口值优先，登出后 invalidateQueries+useMe refetch 触发重渲染，旧端口值染回主钮
-- （冷进首帧码内默认＋覆盖到达不重渲染=设计行为，竞态未染；冷 navigate 整页重载即恢复）。
-- 幂等：UPDATE active=1 行对齐 PD-44 码内默认；seed 单源 copySeedRows.ts 同步更正（客户 devlogin.primaryCta 不动）。
UPDATE `copy_overrides` SET `value_json` = json_object('text', '选择员工账号登录'), `updated_at` = unixepoch() WHERE `rule_key` = 'login.primaryCta' AND `label` = 'staff:login' AND `active` = 1;
