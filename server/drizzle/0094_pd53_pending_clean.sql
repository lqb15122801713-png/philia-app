-- PD-53（O-SLOTKEY 销项观察挂②）home.banner 遗留 pending×3 清理：
-- 现场（线上运营_修后点验_PD50_O-SLOTKEY_2026-10-21.md §6）：home.banner 槽挂三条
-- 从未 publish 的 pending 行（live 未污染）——
--   ① 01M5CJ1VSGY044WYZAQM6J3V6B（v4，大测「运营轨」遗留）
--   ② 01M5CW2HP3F4ASD64R03GQ1ZFF（v2，PD48 探测稿）
--   ③ 01M5CW2J26H0C69EV8X9ZPP1GB（v3，PD48 探测稿，alt=PD48点验探测-勿上线）
-- 探测/遗留稿滞留控台「待审」队列=误点 publish 即上线探测件的隐患。
-- 处置口径=归档留痕（本表纪律：版本行只增不改、不物理删、无删除端点）：
--   三行 status: pending → archived，updated_at 刷新；行体/content_json 原文在册可查。
-- 幂等：守卫=白名单三 id + slot_key='home.banner' + status='pending'，
--   重放/新库（仅种子 v1 live）零命中=零副作用。
-- 禁区：不碰 live 行（01M5CJ3ETDFNGNETQJM6DVV0J0 保持 live 不变）；不代运营
--   publish 任何稿件；不动其余槽位；不修 banner 待换图源（→PD-52）／CLIP（→PD-54）。
UPDATE `slot_contents`
SET `status` = 'archived', `updated_at` = unixepoch()
WHERE `slot_key` = 'home.banner'
  AND `status` = 'pending'
  AND `id` IN (
    '01M5CJ1VSGY044WYZAQM6J3V6B',
    '01M5CW2HP3F4ASD64R03GQ1ZFF',
    '01M5CW2J26H0C69EV8X9ZPP1GB'
  );
