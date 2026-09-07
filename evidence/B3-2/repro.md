# B3-2 复现记录（修复前 · commit b36ac54）

## 缺陷
寄养预约只在 `store_slots` 按 `scheduledStart` 占 1 格（30min 时段槽），住宿区间的其余晚完全不占容量 → 同一房型同一晚可被重复预订，无任何满员拦截。

## 环境
- server :7200（`npm --prefix server run dev`，分支 fix/v1.1-batch3 @ b36ac54）
- 用户/门店/服务 ID 均动态取自 `GET /api/auth/dev-seed-users` 与 `store.getWithServices`（见 seed-users.json / store-detail.json / pets.json）

## 步骤
1. 客户「示例客户」dev-login（cookies.txt）。
2. 同一房型「标准间寄养（犬）」（svc=01M1WVC76P8P19PCAKJHBDM985）、同一住宿区间
   （入住 2026-09-09 09:00 本地 / 退房 2026-09-11 09:00 本地，共 2 晚：9/9、9/10），
   先后用两只宠物下两单（body1.json / body2.json）：
   - 单1（旺财）→ HTTP 200，id=01M1XW2ZNP805B8EHMVSBWKX9C，pending，priceFen=39800（=19900×2 晚）
   - 单2（咪咪）→ HTTP 200，id=01M1XW2ZPTJSPMCTZQAZ5MT4MG，pending，priceFen=39800
   （原始响应：repro-create1.json / repro-create2.json）
3. 查库快照（repro-dbsnapshot.txt，`tsx scripts/b3-2-slots.mts <storeId>`）：
   - 两单均 pending、同 svc、同区间，**同时成立**（同房型同晚重复预订实证）；
   - `store_slots` 仅 `slot_start=2026-09-09T01:00Z`（入住时刻槽）一行 booked_count=2，
     **9/10 晚无任何占用记录**——住宿期间其余晚不占容量的直接证据。

## 根因（文件+行号）
- `server/src/routers/appointment.ts` create 事务（约 L502-528）：不分 type，一律只
  UPSERT `(store_id, slot_start=scheduledStart)` 一行槽位；boarding 的 scheduledEnd
  住宿区间不参与占用。
- 取消路径 `releaseSlot`（L255-267）与 cancel（L748）/ reviewCancel（L802）同理只回减
  入住时刻 1 格。
- 槽位粒度：`store_slots(store_id, slot_start)` 30min 粒度、门店级（无房型维度），
  容量字段 `capacity` / 已约字段 `booked_count`（schema.ts L303-321）。

## 结论
同房型同晚可无限重复预订（除非恰好入住时刻 30min 槽打满），需按「晚」为粒度、
按房型维度占用容量。
