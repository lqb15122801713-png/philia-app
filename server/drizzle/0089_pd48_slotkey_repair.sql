-- PD-48（O-SLOTKEY／SLOTKEY_MISMATCH）校正：0025 种子段 SELECT 列序错位
-- （INSERT 列单 id,slot_key,version,… 但 SELECT 给出 id,1,s.slot_key,…），
-- 致六槽 slot_key 全塌成 '1'、真键文本错入 version 列（SQLite 动态类型未拦；
-- id 段 'seedslot_'||key 本就正确）。症状链：客户端 slotContentOf('home.banner')
-- 与 liveMap key 对不上、upload home.banner→400「未知槽位键」、控台只见 '1'。
-- 拨正：slot_key←version 列内真键、version 回 1。
-- 幂等三重守卫：slot_key='1' + version 命中六键白名单 + id='seedslot_'||version
-- ——只认 0025 塌键种子行；新库 0025 已更正（同步改源文件），本段零命中=重放零副作用。
UPDATE `slot_contents`
SET `slot_key` = `version`, `version` = 1, `updated_at` = unixepoch()
WHERE `slot_key` = '1'
  AND `version` IN ('home.banner', 'login.hero.staff', 'pets.emptyIllustration', 'member.famCard', 'member.cardFace', 'product.placeholder')
  AND `id` = 'seedslot_' || `version`;
