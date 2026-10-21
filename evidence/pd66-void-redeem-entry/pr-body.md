# fix(merchant): PD-66 商家端撤核销入口——in_service 单可撤回至 confirmed 可再核销

## 缺陷（NO-VOID-ENTRY-ON-MERCHANT-UI）

预约已核销进 in_service 后，商家控台／监控无撤核销或作废入口，夹具无法从 UI 撤出服务中（唯一既有出口是 ≥24h 僵尸单的 forceCompleteStale）；客端取消入口亦随 in_service 锁定消失。

## 修法（最小 diff）

- **server `appointment.voidCheckin`**（owner|manager 钉店主／有权角色）：in_service 单撤回至 confirmed（checkin 逆操作，可再核销约定态——非作废毁单，槽位从未因核销释放故预约仍占槽）。事务＝回 confirmed＋清 checkedInAt（条件 where 防并发双击）＋删六步初始化行及步骤照片（腾 `uq_appointment_steps_appt_key`，再核销重新初始化）＋预付台账逆联动 checked_deducted→prepaid_registered。幂等（confirmed 无核销记录→idempotent=true 零写库）；`appointment.checkinVoided` 双频道留痕（by/beforeStatus/原 checkedInAt）。
- **merchant 详情页**：in_service 动作区新增「撤核销」QuietButton（testid `detail-void-checkin`）＋ `window.confirm` 二次闸；文案经 copy 表（`appt.voidCheckin*`）；可见性纯函数 `canVoidCheckin`。
- 事件类型 `AppointmentCheckinVoided` server／shared 双端同步。

## 测试

- `appointment.voidcheckin.smoke.ts`（新，14 断言）：构造 in_service 夹具（create→checkin 真链路）；权限矩阵（customer/clerk/他店 403，owner/manager 放行）；执行后状态离开 in_service（confirmed＋checkedInAt 清空＋六步删行＋预付回翻＋槽位不动＋双频道事件）；重复撤幂等；撤回后可再核销闭环。
- `appointmentDetail.utils.test.ts`（新）：入口可见性 in_service 夹具 true／其余六态 false。
- RED→GREEN 与 before/after 截图、api-check 见 `evidence/pd66-void-redeem-entry/README.md`。

## 声明

- 未动 drizzle／`_journal.json`（独占迁移号 0107 声明保留未用；零 schema 变更）。
- 基线 `appointment.smoke.ts` 自片 2 医疗授权闸后陈旧（3 处基线断言开工实测已红，与本 PR 无关），PD-66 测试独立成文未触碰该文件。
- in_boarding 寄养单撤核销另案（与 forceCompleteStale 同口径）；异常桶强制完成大改属非目标。

🤖 Generated with KimiCode A 窗（K3 MAX）
