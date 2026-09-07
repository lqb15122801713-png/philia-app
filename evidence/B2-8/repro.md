# B2-8 复现记录：商家端 store 频道收不到服务进度事件

## 复现环境
- server :7200（`npm.cmd --prefix server run dev`），分支 `fix/v1.1-batch2` @ a36eb55（修复前）
- 账号一律 `GET /api/auth/dev-seed-users` 动态取（见 repro-seeds.json），未硬编码 ULID
- 本次造单 AID = `01M1X9EAZTEK0JYB1MYNRH3W0W`（旺财 · 基础洗护，pay_at_store）

## 复现步骤（evidence/B2-8/run-flow.sh repro 0）
1. 商家登录 → `trpc/push.subscribe` 登记 client_id（appType=merchant）
2. 商家挂 `GET /api/events?client_id=…`（SSE；商家角色自动订阅 `store:{storeId}`，`--max-time 60` 收割 → repro-sse-store.txt）
3. 客户 create → 商家 confirm → 商家 assign（staffId=员工表主键）→ 员工 checkin {code}
4. 员工 serviceStep.addPhotos + confirmStep 走满六步（disinfection 1 张 / precheck 2 / grooming 3 / detail 2 / before_after 1before+1after / confirm 0）
5. 全链路 tRPC 返回均成功（repro-flow.log：checkin 后 status=in_service，第 6 步 confirm 返回 `appointmentCompleted:true`）

## 复现现象
商家 store 频道 SSE 全程（60s，覆盖 checkin 与六步完成）只收到本单的 `appointment.created`：

```
$ grep -c '01M1X9EAZTEK0JYB1MYNRH3W0W' repro-sse-store.txt   → 1（仅 created）
$ grep -E 'checkedin|completed|step_updated' repro-sse-store.txt → 无匹配
事件类型统计：appointment.created×10、appointment.cancelled×8、appointment.rescheduled×1
（旧事件为 outboxSweeper 重投的历史未送达事件，证明 store 频道链路本身工作正常）
```

→ `checkedin` / `completed` 未出现在 store 频道，缺陷复现成立。

## 根因（文件 + 行号，修复前）
- `server/src/routers/appointment.ts:1080-1087`：`appointment.checkin` 只在事务内
  `emitEvent(tx, 'appointment:{aid}', EventType.AppointmentCheckedIn, …)`，无 `store:{storeId}` 频道发射。
- `server/src/routers/serviceStep.ts:491-497`：`serviceStep.confirmStep` 第 6 步三合一事务里
  `AppointmentCompleted` 只发 `appointment:{aid}` 频道，无 `store:{storeId}` 频道发射。
- 商家 SSE 连接按角色自动订阅 `store:{storeId}`（`server/src/routes/events.ts:44-51` channelsForUser），
  但上述两个事件从未写入该频道 → 商家不打开详情页（watch appointment 频道）就感知不到服务进展。
- `step_updated`（serviceStep.ts:477-489）按任务要求维持仅 appointment 频道，不改。
