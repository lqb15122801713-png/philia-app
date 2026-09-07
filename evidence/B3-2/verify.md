# B3-2 修复后验证记录（红标门禁证据映射）

修复内容：寄养容量按「晚」占用（boarding_slots：房型 × 本地日界晚），create 事务逐晚占用 /
任一晚满员 CONFLICT 整体回滚；取消统一 releaseBoardingSlots 释放全部晚；W-12 房型卡透出剩余间数。

## ① 同房型同晚先后建单 → 第二单 409 + 事务回滚实证
- 单A：豪华间（room_count=1），入住 2026-09-10 09:00 / 退房 2026-09-12 09:00（晚 9/10、9/11）
  → HTTP 200，id=01M1XXYBZK8KYEV06W5F9BW6W1，priceFen=59800（=29900×2 晚）
  （请求 fix-bodyA.json，响应 fix-createA.json）
- 建单后快照 fix-snapshot-after-A.txt：boarding_slots 晚 9/10、9/11 各 1 行 booked_count=1；
  store_slots 无任何占用（寄养不再占洗护时段槽）。
- 单B：同房型同区间重叠（9/11→9/13，晚 9/11 已满）→ **HTTP 409**，
  error code=-32009「该房型 2026-09-11 晚已订满，请调整入住/退房日期」
  （请求 fix-bodyB.json，响应 fix-createB.json）。
- **回滚实证**：fix-snapshot-after-B-fail.txt 与 fix-snapshot-after-A.txt 完全一致——
  晚 9/12 未产生任何槽位行（无部分占用）、各晚 booked_count 不变、appointments 无第二单记录。

## ② 取消后各晚释放
- 取消单A（>4h 直消）→ HTTP 200 outcome=cancelled（fix-cancelA.json）。
- fix-snapshot-after-cancel.txt：晚 9/10、9/11 booked_count 1→0（行保留，幂等安全）。
- 接口复査 avail-range-after-cancel.json：boardingAvailability(9/10→9/12) 豪华间 remaining 恢复 [1,1]。

## ③ W-12 UI 剩余间数两态（Edge CDP 实拍，脚本 ui-shots.mjs）
- ui-range-selected.png：已选区间（9月8日→9月10日）→ 房型卡显示区间内最小剩余
  （标准间剩余 1 间——同区间已被单C 占 1 间（fix-createC.json）；猫别墅剩余 2 间等）。
- ui-no-date-tonight.png：屏2 切换到「B3-2证据店B（周二休）」（仅开发库临时夹具，
  b3-2-fixture-storeb.mts），入住日周二为休息日 → 日期被清空 → 房型卡改显「今晚剩余 3 间」。
- 接口基线：avail-tonight.json（今晚各房型满额剩余）。

## ④ smoke / 构建
- appointment.smoke.ts 扩展 5c 节（逐晚占用/满晚回滚/多间容量/取消全晚释放/0 晚拒绝），
  全绿输出 smoke-appointment.txt（102 项 ✓，exit=0）。
- tsc / 三端 build 退出码见 build.txt。

## 工具脚本（随证据存档，不入库）
- b3-2-slots.mts：查库快照（store_slots + boarding_slots + 非取消预约）。
- b3-2-fixture-storeb.mts：UI 证据用临时门店夹具。
- ui-shots.mjs：UI 两态截图 CDP 脚本。
