# B3-1 复现记录（A-P0-9 死局 · 修复前）

## 复现根因

- 文件：`server/src/routers/serviceStep.ts`
- 行号：**537-542**（批次 1 止血守卫）

```ts
// v1.1 A-P0-9 死局止血：completed/cancelled 预约禁止打标重拍——
if (appt.status === 'completed') {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: '预约已完成，不可打标重拍；如需处理请联系门店线下协商',
  });
}
```

## 死局机理

批次 1 止血前的原始死局：completed 预约的六步全部 `done`、无 active 步；若对最新 done 步打标，
(b) 路径会把该步拉回 `active`，但 `confirmStep` 末步分支要求预约 `status='in_service'`
（serviceStep.ts 449-454），而 completed 预约永远无法回到 in_service —— 员工重拍后无法再次
confirm，预约永久卡死在「有 active 步但不可完成」状态。批次 1 用前置拒绝堵住了入口，
但商家「完成后发现照片问题要求重拍」的合理诉求被一并堵死（只能线下协商）。

## 复现步骤（修复前代码，HEAD = 823a729）

1. 客户建单 → 商家确认/派单 → 员工核销 → 六步走满 → 预约 `completed`
   （驱动脚本一次性执行，预约 ID `01M1XSQM5NQXE6S4QERMX49VFN`，库快照见 `snap-00-before-flag.json`）。
2. 商家调 `serviceStep.flagForRedo {appointmentId, stepKey:'confirm'}`：

   原始 curl 输出见 `repro-curl-before-fix.txt`，响应：

   ```json
   [{"error":{"json":{"message":"预约已完成，不可打标重拍；如需处理请联系门店线下协商","code":-32600,"data":{"code":"BAD_REQUEST","httpStatus":400,"path":"serviceStep.flagForRedo"}}}}]
   ```

3. 拒绝后查库快照 `snap-01-after-rejected-flag.json` 与打标前 `snap-00-before-flag.json`
   逐项对比（`compare-snaps.py` 输出）：appointment / steps / photos / outbox 四项全部一致，
   守卫为纯前置拒绝、无任何写库副作用。

## 修复方向（任务书模块 4 · B3-1）

completed 放行打标，但**同一事务**内完成：预约打回 `in_service` + 清 `completedAt` +
目标步 reactivate（沿用现有 (b) 路径逻辑）+ outbox 写 `appointment.reopened`
（appointment / store / user 三频道，payload 含 appointmentId/stepKey/by）；
移除批次 1 的 completed 拒绝守卫；cancelled / pending / confirmed 维持拒绝。
