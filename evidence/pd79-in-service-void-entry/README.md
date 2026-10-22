# PD-79 · 服务中撤单／撤核销入口（迁移独占 0120）

- 基线：main@a73f02b（a73f02b2b7cc1fdb2f92398f640946546a7d4ec0）／DEPLOY 20261022184037
- 分支：feat/pd79-in-service-void-entry ｜ 树：E:\KIMI code\pd79-in-service-void-entry
- 依据：排号-产品-1022-PD79-服务中撤单撤核销.md（D:\Philia-shared\ 权威包）
- **迁移号独占声明：0120 本窗实占；0114/0117/0118 他窗（73/77/78）波次未并入本基线，0119 空留；本迁移仅 copy_overrides 8 键，零 schema 变更**

## 令围（只做这些，开挂不扩）

1. 商家／店长端对 `in_service`／已核销未收银单提供「撤单」「撤核销」入口；员工端无此权限
2. 二次确认＋必填原因；全留痕（操作人／时间／原因／前后状态）
3. 联动回冲：提成／XP／积分；已收银／涉钱单另闸（本令不放开）
4. 撤后状态：撤核销→`confirmed`；撤单→`cancelled`（cancelSource=`merchant`）
5. 01M5EQVF：上线后经正规入口撤；禁直改库（本窗零触碰，见下「禁令自查」）
6. 验：敏慧商家正例＋潘婧员工无入口反证；涉钱 mock；不写验收通过

## 口径决策（施工注记）

- **撤核销 = PD-66 `appointment.voidCheckin` 增强**：补必填 reason（zod min1/max100）＋涉钱闸＋payload 增 reason/afterStatus；既有事务语义（回 confirmed＋清 checkedInAt＋删六步腾 uq 索引＋预付 checked_deducted→prepaid_registered）原样保留。
- **撤单 = 新增 `appointment.merchantCancel`**：仅 in_service；复用 reject 取消积木（releaseAppointmentSlots＋refundPassIfDeducted＋flipPrepaidOnCancel，均幂等）；**预付两段回翻**——撤单起点是已核销单，台账挂 checked_deducted，而 flipPrepaidOnCancel 口径只翻 pending/registered，故先按 voidCheckin 逆联动补翻 checked_deducted→prepaid_registered 再统一→refunded（同事务，幂等）。
- **提成／XP／回馈金无需回冲**（读侧计提口径）：提成只从已结收银单计提（commission.loadSettledBills: status='settled' 且未冲正）；XP 完成时才发（checkin 不发）；回馈金收银结算才计提。「已核销未收银」单三者均未发生——涉钱闸把已结算面整体挡在门外。
- **撤单保留六步进度行**：作历史留痕（撤单后不再核销，无 uq_appointment_steps_appt_key 压力；与撤核销「腾索引供再核销」语义不同）。
- **留痕通道 = event_outbox 事件**（事件即轨迹，详情页轨迹卡自动入轨）：payload 带 by（操作人 userId）／reason 原文／beforeStatus／afterStatus（＋撤单 cancelSource）；时间=outbox created_at。撤单另落 cancelReason/cancelSource 列（详情页「取消信息」行透出「商家撤单：原因」）。
- **cancelSource='merchant' 新值**：text 列应用层枚举，零 schema 变更；商家端 CANCEL_SOURCE_LABEL 补「商家撤单」透出。客户端不新增透出（沿用 cancelled 态既有渲染；来源/原因属门店留痕，客户端详情信息卡口径本令不扩）。
- **涉钱闸 assertNoMoneyInvolved**：paidAt 落值（已收银）或 cashier_bill_items 存在本单预约行（已入收银台）→ 400 明文另闸；预付台账（次卡扣次/预付登记）属可逆联动不算涉钱，由事务内回翻处理。
- **员工端无口**：双端点钉 merchantManagerProcedure（owner|manager），staff 角色 server 层 403；员工端 app 零新增代码，天然无入口。

## diff 清单（最小 diff：10 改 + 5 新）

| 文件 | 变更 |
|---|---|
| server/src/routers/appointment.ts | +assertNoMoneyInvolved；voidCheckin 加 reason/涉钱闸/留痕 payload；新增 merchantCancel |
| server/src/db/schema.ts | cancelSource 注释补 merchant 取值（零 schema） |
| server/drizzle/0120_pd79_in_service_void_entry.sql（新） | copy_overrides 8 键（INSERT…WHERE NOT EXISTS 幂等） |
| server/drizzle/meta/_journal.json | 追加 idx 120 |
| server/src/db/copySeedRows.ts | 手补同 8 键（生成件手补先例，不全量重生成） |
| server/src/routers/__tests__/appointment.pd79.smoke.ts（新） | 23 断言（权限/必填/涉钱×2/留痕/撤单全联动/次卡回冲） |
| server/src/routers/__tests__/appointment.voidcheckin.smoke.ts | 调用补 reason（PD-79 必填适配），断言语义不变 |
| server/src/db/pd79EvidenceFixture.ts（新） | 证据夹具（真链路造/撤三单＋专用 groomer，--clean 自清） |
| apps/merchant/src/pages/AppointmentDetailPage.tsx | 操作区双入口＋二次确认弹层（Modal＋必填原因 textarea＋danger 确认钮空因禁用） |
| apps/merchant/src/pages/appointmentDetail.utils.ts | canVoidCheckin 加 paidAt 闸；新增 canMerchantCancel |
| apps/merchant/src/pages/appointmentDetail.utils.test.ts | PD-79 可见性用例（涉钱双隐/他态无口） |
| apps/merchant/src/copy/appointments.ts | 8 个 copy 键（弹层题/正文/原因标签占位/确认钮/toast） |
| apps/merchant/src/components/appointments/appt-utils.ts | CANCEL_SOURCE_LABEL 补 merchant=「商家撤单」 |
| apps/merchant/scripts/pd79-in-service-void-shots.mjs（新） | CDP 实尺截图＋接口实证（零新依赖） |
| evidence/pd79-in-service-void-entry/（新） | 本卷宗＋截图＋api-check.json＋trail-check.json |

员工端 apps/staff：**零改动**（无口反证靠设计＋实证，不加码）。

## RED → GREEN

- RED：基线上 in_service 单商家端无「撤单」入口（仅 PD-66 撤核销且无原因/涉钱闸）；撤核销接口无 reason 入参。冒烟先红：`merchantCancel` 不存在（TS2339/运行时装配失败）。
- GREEN：
  - `server`：`appointment.pd79.smoke.ts` 23/23 ✅（临时库真迁移，跑法 `node node_modules/tsx/dist/cli.mjs src/routers/__tests__/appointment.pd79.smoke.ts`，cwd=server）；
  - 回归：`appointment.voidcheckin.smoke.ts` 14/14 ✅（PD-66 口径不破）；
  - 商家端纯函数：`appointmentDetail.utils.test.ts` 2/2 ✅；
  - 类型闸：server `tsc --noEmit` 仅基线噪音 12 项（全在 pd66EvidenceFixture.ts，本窗零新增）；merchant `tsc -b` 0 错（与基线同绿）。

## 实机自验（本窗 server:7210＋merchant:7111＋staff:7112，dev 库真链路；测完自清）

人设映射：敏慧=种子「菲丽亚店主」（merchant_owner）；潘婧=前台种子「小美」（staff/frontdesk）。
夹具：pd79EvidenceFixture.ts 经 create→checkin 真链路造三单（A=撤核销正例／B=撤单正例／C=涉钱 mock paidAt），专用 groomer 保证派单；取证后 --clean 全清＋dev 库删除。

| # | 断言 | 结果 |
|---|---|---|
| 1 | A 详情双入口可见（撤核销/撤单，in_service） | ✅ detail-A-entries.png |
| 2 | 撤核销二次确认弹层：原因空=确认钮禁用（必填闸） | ✅ detail-A-void-modal-empty.png |
| 3 | 填原因解禁 → 执行 → confirmed＋checkedInAt 清空（可再核销） | ✅ detail-A-voided-confirmed.png |
| 4 | B 撤单弹层（正文口径：转已取消/释放槽位/回冲/留痕） | ✅ detail-B-cancel-modal-filled.png |
| 5 | B 撤单 → cancelled＋cancelSource=merchant＋详情透出「商家撤单：客户爽约，门店主动撤单」 | ✅ detail-B-cancelled.png |
| 6 | C 涉钱（已收银标记）单双入口同隐（操作区仅服务监视） | ✅ detail-C-money-gated.png |
| 7 | 员工端（潘婧）订单视图零撤单/撤核销（testid＋文案双缺席） | ✅ staff-today-no-entry.png |
| 8 | api：缺 reason 400／涉钱 400×2／员工 403×2／重复撤单 400／再核销→接口撤回 200 | ✅ api-check.json |
| 9 | 留痕实存：checkinVoided/cancelled 双频道 payload 带 by/reason/beforeStatus/afterStatus（+cancelSource），时间=outbox created_at | ✅ trail-check.json |

回冲联动（冒烟 [6] 实证）：pass_deduct 撤单同事务次卡回补 remain 4→5；预付台账 checked_deducted→refunded；撤核销台账 checked_deducted→prepaid_registered（PD-66 回归保持）。

## 禁令自查

- 不合/不部：PR 只开不合；零部署动作 ✅
- 不写验收通过：本卷宗仅录事实与自验结果 ✅
- 01M5EQVF 零触碰：夹具/测试全程独立临时库与本窗 dev 库；01M5EQVF（PD-66 历史卡单）未读未写，上线后由正规入口撤 ✅
- 不跨店造种：夹具全部落在本窗 dev 库示例店，测后 --clean＋库删除 ✅
- 不抢前台/不动双屏：只起本窗独立端口（7210/7111/7112），他窗 7200/7101–7103 进程零触碰 ✅
- 不查 USAGE；不插 76–78 波次（基线 a73f02b 不含 76–78）✅
- 测完自清：三夹具单＋夹具 groomer 已删（event_outbox 审计行保留即留痕）；dev 库已删；端口进程已收 ✅
