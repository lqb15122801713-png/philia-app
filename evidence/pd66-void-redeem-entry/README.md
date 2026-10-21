# PD-66 · 商家端无撤核销／作废入口（NO-VOID-ENTRY-ON-MERCHANT-UI）卷宗

> BRANCH `feat/pd66-void-redeem-entry` ｜ WORKTREE `E:\KIMI code\pd66-void-redeem-entry` ｜ 基线 main@`923b4b382d40a50a8d3a1b07a6035454b857be61` ｜ 模型 K3 MAX ｜ 2026-10-21

## 令围

只修一缺陷：预约已核销进 in_service 后，商家控台／监控无撤核销或作废入口，夹具（如 01M5EQVF）无法从 UI 撤出服务中；客端取消入口亦随之消失。
期望三点：①商家端对 in_service／已核销未收银单提供明确「撤核销」入口（权限钉店主／有权角色）②点击后状态回到可再核销／已取消的约定态，有确认二次闸 ③最小 diff＋一条测试（构造 in_service 夹具断言入口可见；执行后状态离开 in_service）。

约定态取「回 confirmed 可再核销」（撤核销=checkin 逆操作；非作废毁单——槽位从未因核销释放，预约仍占槽有效；客端取消入口随状态回 confirmed 自然恢复，零客端改动）。in_boarding 寄养单另案（与 forceCompleteStale 同口径），不在本窗。

## 迁移号声明

**独占号 0107 声明保留未用**：本窗未动 drizzle／`_journal.json`（status/cancelSource 均为 text 列无约束，回退 confirmed 零 schema 变更）。tip journal last＝0094 未触碰；未占用 0093／0095–0104；未撞 0105（PD-64）／0106（PD-65）。

## 缺陷实尺（before）

| 项 | 实尺 |
|---|---|
| in_service 详情页动作区 | 仅「服务监视」一个按钮，`[data-testid="detail-void-checkin"]` 缺席（`before/pd66-before-gate.log.json`） |
| 全仓撤核销接口 | `unredeem|voidRedeem|撤核销|unCheckin|voidCheckin` 零命中；in_service 唯一既有出口=forceCompleteStale（≥24h 僵尸闸） |
| 截图 | `before/detail-1280x800.png`（操作区单钮） |

## 最小 diff 清单（6 码文件 + 2 测试 + 1 截图脚本 + 本卷宗）

| 文件 | 改动 |
|---|---|
| `server/src/routers/appointment.ts` | 新增 `voidCheckin`（merchantManagerProcedure=owner\|manager）：状态闸仅 in_service；事务=回 confirmed＋清 checkedInAt（条件 where 防并发）＋删六步初始化行及步骤照片（腾 uq_appointment_steps_appt_key 供再核销）＋预付台账逆联动 checked_deducted→prepaid_registered；幂等（confirmed 无 checkedInAt→idempotent=true 零写库）；`appointment.checkinVoided` 双频道留痕（by/beforeStatus/原 checkedInAt） |
| `server/src/realtime/events.ts` ＋ `packages/shared/src/constants/events.ts` | EventType.AppointmentCheckinVoided 双端同步（纪律：server 改 EventType 必同步 shared） |
| `apps/merchant/src/pages/appointmentDetail.utils.ts`（新） | 可见性纯函数 `canVoidCheckin(status)`：仅 in_service 可见（权限服务端兜底，UI 照详情页惯例不按角色分支） |
| `apps/merchant/src/pages/AppointmentDetailPage.tsx` | 动作区 in_service 分支 QuietButton `detail-void-checkin`＋mutation；`window.confirm` 二次闸；toast/invalidate 照 reviewCancel 同构；头注同步 |
| `apps/merchant/src/copy/appointments.ts` | `appt.voidCheckinCta/Confirm/Toast/Fail` 四键（经营文案经表取值纪律） |
| `server/src/routers/__tests__/appointment.voidcheckin.smoke.ts`（新） | 14 断言：in_service 夹具（create→checkin 真链路）／权限矩阵（customer·clerk·他店 403；owner·manager 放行）／confirmed 幂等·cancelled 400／执行后离开 in_service＋六步删行＋预付回翻＋槽位不动＋双频道／重复撤幂等／再核销闭环 |
| `apps/merchant/src/pages/appointmentDetail.utils.test.ts`（新） | 入口可见性：in_service 夹具可见，其余六态不可见（令包「一条测试」的 UI 侧） |
| `apps/merchant/scripts/pd66-void-checkin-shots.mjs`（新） | before/after 截图＋接口实证脚本（CDP headless，零新依赖，学 u6 范式） |

## 测试 RED → GREEN

- RED（实现缺席）：`No procedure found on path "voidCheckin"`（in_service 夹具就绪断言 ✓ 后接口未捕获失败）；UI 测试import 缺席。
- GREEN：
  - `node server/node_modules/tsx/dist/cli.mjs src/routers/__tests__/appointment.voidcheckin.smoke.ts` → **14/14 ✓**（cwd=server）
  - `node server/node_modules/tsx/dist/cli.mjs --test apps/merchant/src/pages/appointmentDetail.utils.test.ts` → **pass 1 / fail 0**（cwd=repo 根）
  - `npx tsc --noEmit`（server）✓ ｜ `npx tsc -b`（apps/merchant）✓

## 基线 smoke 失修声明（非本窗引入，未扩大改动）

基线 `appointment.smoke.ts` 自「片 2 医疗授权闸」后陈旧：boarding 段夹具未随闸补 `medicalAuth`，开工实测 3 处基线断言已红（ boarding 核销 staff_id 口径／非本人评价／寄养档期重叠），与 PD-66 无关。本窗不背修无关段的扩围责任，PD-66 测试**独立成文**（`appointment.voidcheckin.smoke.ts`，隔离/夹具风格对齐）以免被无关段阻塞；`appointment.smoke.ts` 保持基线原样未触碰。

## 自验（本窗栈 server:7200 ＋ merchant vite:7101；dev 库 server/data/philia.db 测后自清）

| 证据 | 内容 |
|---|---|
| `after/detail-1280x800-entry.png` | in_service 详情「撤核销」入口可见（操作区双钮） |
| `after/detail-1280x800-voided.png` | 真点入口→confirm 二次闸→toast「已撤回核销，预约回到已确认」；状态流回「核销·待到店核销」；核销码重新显示；入口消失 |
| `api-check.json` | 再核销→`appointment.voidCheckin`→confirmed（httpStatus/请求响应/前后状态留痕） |
| `before|after/pd66-*-gate.log.json` | 截图断言闸日志 |
| 夹具 | `server/src/db/pd66EvidenceFixture.ts`（create→checkin 真链路造 in_service；appointmentId=01M5F37SZF3PR97XZ5Z5GCHTZM） |

## 纪律

一令一树一分支；PR 只开不合；不写验收通过；未选品／片*；未抢前台／动双屏；测完自清（dev 库与临时 profile 已清）。
