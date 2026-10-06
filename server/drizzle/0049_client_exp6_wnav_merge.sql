-- 客户端体验大批 片 6（转正归并）：wnav.* 归并注册（UX-08 归并稿 V1.0 · 老板 10-06 两拍转正）
-- ① 改键值不改键名：wnav.ops「审批中心」→「运营 · 审批中心」（/ops 双入口消歧一口）；
--    wnav.dockMe「我的」→「设置」（dock 第五槽转正，指向 /settings 不变）。
-- ② 删键 5 枚：批次扩口组撤（wnav.groupBatch / wnav.batchNote / wnav.opsBatch /
--    wnav.opsBatchNote）+ dock 注记键（wnav.dockMeNote）随批撤除。
-- 幂等：UPDATE/DELETE 天然幂等（重放零副作用）；端口值优先口径下存量库必须落本迁移
-- （码内默认仅 fallback）。生成件同帧=server/src/db/copySeedRows.ts（生成器重跑 3133 行）。
UPDATE `copy_overrides` SET `value_json` = json_object('text', '运营 · 审批中心'), `updated_at` = unixepoch() WHERE `rule_key` = 'wnav.ops' AND `active` = 1;
--> statement-breakpoint
UPDATE `copy_overrides` SET `value_json` = json_object('text', '设置'), `updated_at` = unixepoch() WHERE `rule_key` = 'wnav.dockMe' AND `active` = 1;
--> statement-breakpoint
DELETE FROM `copy_overrides` WHERE `rule_key` IN ('wnav.groupBatch', 'wnav.batchNote', 'wnav.opsBatch', 'wnav.opsBatchNote', 'wnav.dockMeNote');
