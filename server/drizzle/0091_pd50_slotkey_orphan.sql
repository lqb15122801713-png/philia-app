-- PD-50（O-SLOTKEY 续）orphan live 迁并 → home.banner：
-- 0089 只拨正 seedslot_* 塌键种子行；塌键窗内大测经控台 upload/publish 的 orphan 行
-- （id 非 seedslot_*，如 01M5CJ3…）仍挂 slot_key='1'——注册表无此键：
-- liveMap 透出 key='1'、客户端 slotContentOf('home.banner') 读不到 → 首页运营条回落壳默认；
-- 控台 list 另立 '1' 组＝键分裂；upload('1') 此后按注册表纪律 400。
-- 迁并口径：塌键窗内控台唯一可见组即首页横幅运营位（'1' 组=六槽塌键种子合组，
-- 运营操作对象=home.banner），凡残余 slot_key='1' 行一律归并 home.banner：
--   ①版本号续排：orphan 旧 version 系塌键期算术垃圾（'home.banner'+1 文本串等），
--     按 (created_at,id) 序接 home.banner 现有最大整数版本后续排；
--   ②改键 home.banner；
--   ③单 live 收敛（防御）：publish 同槽清扫本保证单 live；若 dual-live 并立，
--     保留版本最高者（=运营最近发布件，②已刷新其 updated_at 兜底并列），余者转 archived 留痕不物理删。
-- 幂等：守卫=slot_key='1'（0089 后注册表永无 '1' 键，残余即塌键窗孤儿）；
-- 新库/已修复库零命中=重放零副作用；③在单 live 常态下亦零命中。
-- 备注：塌键窗那次 publish 连带把六槽种子 live 全扫成 archived；0089 已拨正其键，
-- 本段不回抬其余五槽 live（liveMap 缺行=客户端回落码内默认，与种子 live 值同帧零视觉差；
-- 运营如需可在控台对该槽 revert/publish 恢复）。
UPDATE `slot_contents` AS o
SET `version` = (
    SELECT COALESCE(MAX(CAST(h.`version` AS INTEGER)), 0)
    FROM `slot_contents` AS h
    WHERE h.`slot_key` = 'home.banner'
  ) + 1 + (
    SELECT COUNT(*)
    FROM `slot_contents` AS o2
    WHERE o2.`slot_key` = '1'
      AND (o2.`created_at` < o.`created_at` OR (o2.`created_at` = o.`created_at` AND o2.`id` < o.`id`))
  )
WHERE o.`slot_key` = '1';
--> statement-breakpoint
UPDATE `slot_contents`
SET `slot_key` = 'home.banner', `updated_at` = unixepoch()
WHERE `slot_key` = '1';
--> statement-breakpoint
UPDATE `slot_contents`
SET `status` = 'archived', `updated_at` = unixepoch()
WHERE `slot_key` = 'home.banner'
  AND `status` = 'live'
  AND `id` <> (
    SELECT `id` FROM `slot_contents`
    WHERE `slot_key` = 'home.banner' AND `status` = 'live'
    ORDER BY CAST(`version` AS INTEGER) DESC, `updated_at` DESC, `id` DESC
    LIMIT 1
  );
