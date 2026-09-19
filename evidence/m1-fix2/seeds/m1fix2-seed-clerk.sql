-- ============================================================================
-- 批次 M1-补2 R2 · 演示店员号 seed_clerk 种子（裁定②，同 seed_manager 口径）
-- 归属：K3 施工卷宗 · u4-pipeline/m1fix2-seed-clerk.sql
-- 结构：users + user_roles(merchant_clerk) + staff 行（绑店=staff.store_id 路径，
--       与 seed_manager 一致；storeId 组装走 loadSessionUser 的 staffRow 分支）
-- 门店：01M2SVYE6HYGV7T2ESTNM814M2（菲丽亚宠物·示例店）
-- ULID（固定，卷宗登记）：
--   users      id = 01M2VYN9NPJX4S665BECMRJV4M   (kimi_id=seed_clerk)
--   user_roles id = 01M2VYN9NREGW4WH7AEW9G36BN
--   staff      id = 01M2VYN9NR5Q8QGV3YB4WM1WZG   (role=frontdesk 前台=收银岗)
-- 幂等：三段均 NOT EXISTS 守卫，可重复执行；dev-login 仅 seed_ 前缀（不扩面）。
-- 执行：node u4-pipeline/m1fix2-seed-clerk.mjs（或任意 sqlite 客户端执行本文件）
-- ============================================================================

INSERT INTO users (id, kimi_id, nickname, phone, created_at, updated_at)
SELECT '01M2VYN9NPJX4S665BECMRJV4M', 'seed_clerk', '演示店员', '13900000010',
       strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE kimi_id = 'seed_clerk');

INSERT INTO user_roles (id, user_id, role, created_at, updated_at)
SELECT '01M2VYN9NREGW4WH7AEW9G36BN', '01M2VYN9NPJX4S665BECMRJV4M', 'merchant_clerk',
       strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = '01M2VYN9NPJX4S665BECMRJV4M' AND role = 'merchant_clerk'
);

INSERT INTO staff (id, store_id, user_id, name, role, status, created_at, updated_at)
SELECT '01M2VYN9NR5Q8QGV3YB4WM1WZG', '01M2SVYE6HYGV7T2ESTNM814M2',
       '01M2VYN9NPJX4S665BECMRJV4M', '演示店员', 'frontdesk', 'active',
       strftime('%s','now'), strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM staff WHERE user_id = '01M2VYN9NPJX4S665BECMRJV4M');
