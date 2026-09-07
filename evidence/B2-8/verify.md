# B2-8 修复后自验 + 回归证据

- 修复 commit：`d4c4ca6 fix(v1.1-b2): [B2-8] 商家端 store 频道补发服务进度事件…`
- 本次造单 AID = `01M1X9QCGW49SCA8MYA3MVR6HY`（旺财 · 基础洗护）
- 流程同复现（run-flow.sh fixed 1）：商家 push.subscribe → 挂 store 频道 SSE；客户 subscribe 后在 create 后挂 `watch=<aid>` appointment 频道 SSE；create → confirm → assign → checkin → 六步 → completed，全链路返回成功（fixed-flow.log）

## 验收 a：checkin → 商家 store 流收到 checkedin ✅

fixed-sse-store.txt 第 5-7 行：

```
event: appointment.checkedin
data: {"id":"01M1X9QG8Z6Z1KJ2AQ06NJZGZM","type":"appointment.checkedin","channel":"store:01M1WVC76NH73BZSP1KQ6SXBAC","data":{"appointmentId":"01M1X9QCGW49SCA8MYA3MVR6HY","petName":"旺财","type":"grooming","staffId":"01M1WVC76NT2WWE5KPC6PTXM3H"},"ts":1788763423000}
id: 01M1X9QG8Z6Z1KJ2AQ06NJZGZM
```

## 验收 b：六步走完 → 商家 store 流收到 completed ✅

fixed-sse-store.txt 第 9-11 行：

```
event: appointment.completed
data: {"id":"01M1X9QWN8B7NSFVDRT6AQGNVB","type":"appointment.completed","channel":"store:01M1WVC76NH73BZSP1KQ6SXBAC","data":{"appointmentId":"01M1X9QCGW49SCA8MYA3MVR6HY","petName":"旺财","status":"completed"},"ts":1788763435000}
id: 01M1X9QWN8B7NSFVDRT6AQGNVB
```

## 验收 c：step_updated 不出现在 store 频道 ✅

```
$ grep 'step_updated' fixed-sse-store.txt → 无匹配
```
（六步过程共发射 6 条 step_updated，全部只在 appointment 频道，见下方回归证据。）

## 回归：appointment 频道订阅者仍收到原有全部事件 ✅

客户侧 `watch=<aid>` 流（fixed-sse-appointment.txt）中本单 appointment 频道事件 8 条齐全、顺序不变：

| # | id | type | 备注 |
| --- | --- | --- | --- |
| 1 | 01M1X9QG8YRND8P4CMQXKFCTH2 | appointment.checkedin | checkin 原有频道事件保留 |
| 2-7 | …QKAN…/…QQNC…/…QQFP…/…QQSH…/…QQVM…/…QWN7… | step_updated ×6 | disinfection→confirm 六步全到 |
| 8 | 01M1X9QWN8B7NSFVDRT6AQGNVA | appointment.completed | 末步原有频道事件保留 |

- completed 双频道 id 相邻单调：`…GNVA`（appointment）→ `…GNVB`（store），广播序 = outbox id 序不变。
- store 频道本单事件序列：created → checkedin → completed，无 step_updated。
- 流中另有 confirmed/assigned 等事件经 user:{customerId} 频道送达（含 outboxSweeper 重投的历史未送达事件），与本次改动无关。

## 回归：server typecheck ✅

```
$ npm.cmd run typecheck   （server/）
> tsc --noEmit
exit=0
```

## 改动文件（commit d4c4ca6，3 个文件，+28/-16）

- `server/src/routers/appointment.ts`：checkin 事务内 checkedin 事件增发 `store:{appt.storeId}`（payload 同 appointment 频道，outboxIds 一并 broadcastNow）
- `server/src/routers/serviceStep.ts`：confirmStep 第 6 步三合一事务内 completed 事件增发 `store:{appt.storeId}`（保持 step_updated → completed(appointment) → completed(store) 单调序）
- `server/src/realtime/events.ts`：两行频道注释同步（checkedin/completed → appointment + store）

step_updated 未改（仍仅 appointment 频道）；客户端预约详情事件监听走 appointment 频道，回归无影响；无三端 UI 改动（本项纯服务端事件增发，无新错误码/文案）。
