-- 补缺修复小批 P1-3（数据修正迁移，任务卡红线豁免件）：免费档存量行 expires_at 置远端 2099-12-31
-- （CJ-0925-10④ 微光=永久普通会员；读侧「永久有效」文案与数据层同帧；PR-4 件 1 懒冻结豁免兼容）。
-- 口径：免费档=member_plans value_json.free 真值（非硬编码档键，端口换档安全）；
--   只动 active/frozen 在册行——cancelled 历史行保留原到期日（历史真值不改）。
-- 幂等：expires_at<>4102444799 守卫，重放零副作用（updated_at 不被二刷）；
--   4102444799 = 2099-12-31T23:59:59Z（与 server routers/membership.ts FREE_PLAN_EXPIRES_AT 同值）。
UPDATE `memberships` SET `expires_at`=4102444799, `updated_at`=unixepoch()
WHERE `status` IN ('active','frozen') AND `expires_at`<>4102444799 AND `plan_key` IN (
  SELECT `rule_key` FROM `member_plans` WHERE `active`=1 AND json_extract(`value_json`,'$.free')=1
);
