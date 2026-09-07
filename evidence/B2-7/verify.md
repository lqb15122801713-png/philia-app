# B2-7 验收证据汇总（修复后 · 2026-09-07）

全程 curl + DB（tsx 直查 server/data/philia.db）+ Edge CDP 截图。编排脚本 `verify.sh`（可重跑，开头自动复位次卡/验收单痕迹）。种子用户一律 `GET /api/auth/dev-seed-users` 动态取 id，无硬编码 ULID。

## ① 无卡客户建单 pass_deduct → 明确报错

路人客户（无卡）`appointment.create paymentMode=pass_deduct` → HTTP 200 错误壳，`v1-no-pass-error.json`：

```json
[{"error":{"json":{"message":"暂无可用次卡：请改选到店支付，或联系门店充次后再预约","data":{"code":"BAD_REQUEST","httpStatus":400},"path":"appointment.create"}}}]
```

## ② 商家充 10 次 → 建单成功 → remain=9 且 log -1

- `pass.topUp {userId: 示例客户, times: 10}` → `v2-topup.json`（`created:true`，`totalTimes:10, remainTimes:10`）；DB 快照 `v2-db-after-topup.txt`。
- 示例客户建单 pass_deduct 成功（`v2-create.json`，单号 X7RBC7）→ DB `v2-db-after-deduct.txt`：`total_times=10, remain_times=9`。
- 流水 `v2-logs.txt`：`delta=+10 appointment_id=null`（充次）+ `delta=-1 appointment_id=该单`（扣次）。

## ③ 取消该单 → remain=10 且 log +1

`appointment.cancel`（明天 10:00，>4h 直消路径）→ `v3-cancel.json`（status=cancelled）；DB `v3-db-after-refund.txt`：`remain_times=10`；`v3-logs.txt`：该单流水 `-1` 与 `+1` 各一条。

## ④ ★红标：扣次后建单失败 → remainTimes 不变（事务回滚证明）

1. 两单 pay_at_store 填满明天 12:00（capacity=2）→ `v4-slot-full.txt`：`booked_count=2/2`。
2. 同店再以 pass_deduct 建单 → `v4-conflict.json`：`CONFLICT 该时段已约满，请换个时间`（409）。
3. 扣次代码在事务内先于占槽执行，占槽抛错 → 整体回滚：DB `v4-db-rollback.txt`：`remain_times=10`（不变）；`v4-logs.txt`：流水仍只有此前的 `+10 / -1 / +1` 三条，**无新增 -1**。

## ⑤ UI 截图（Edge CDP 真机渲染）

- `v5a-confirm-remain9.png`：有卡客户确认页「次卡扣次 剩余 9 次 · 预约确认后扣 1 次」（按钮可选，CDP 断言 `disabled:false`）。
- `v5b-confirm-nopass-grayed.png`：无卡用户「次卡扣次 暂无可用次卡」置灰（CDP 断言 `disabled:true`），覆盖走查 W-6。
- `v5c-member-pass.png`：会员卡页次卡区真实余额「剩余 15 次 / 共 15 次 · 长期有效」（15 = 充 10+5 − 扣 2 + 回补 2，与 `final-logs.txt` 一致）。
- `v5d-merchant-pass-list.png` / `v5d-merchant-pass-topup.png`：商家端「管理 → 次卡管理」列表 + UI 充次 +5 生效（toast「充次成功：剩余 15 次」，行内 10→15）；DB 旁证 `v5d-db-after-topup.txt`、`v5d-logs.txt`（`delta=+5, appointment_id=null`）。

## 回归

- pay_at_store 全链路（`v6-pay-at-store.txt` + v6-reg-*.json）：create → confirm → assign（小美）→ 员工 checkin → `in_service` + 六步初始化，不受影响；该回归单已清理。
- B2-6 改期 × pass_deduct 一致性（`v6-reschedule.txt`）：pass_deduct 单改期 → status 回退 pending、staffId 清空、remain 不变（14，**改期不退次**）；改期后取消 → 正常回补（14→15，流水 -1/+1 齐）。

## 服务端单测

`server/src/routers/__tests__/appointment.smoke.ts`（独立临时库）87 项全绿，含新增：无卡 pass_deduct 拒绝、建单扣次 5→4、取消回补 3→4、流水 -1/+1。
