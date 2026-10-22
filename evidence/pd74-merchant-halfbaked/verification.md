# PD-74 点验记录（非验收）

- 分支：`feat/pd74-merchant-halfbaked`
- 基线：`b401f9eed6334f9f1118e6ad06a4806164b023b9`
- 点验日期：2026-10-22
- 迁移：`0115_pd74_merchant_halfbaked.sql`／`idx=115`

## 静态与自动化

- `npm run build:merchant`：成功；TypeScript 与 Vite 生产构建完成。
- 商家端 node:test：7/7 成功，含 PD-74 跨自然日、显示过滤、PD-69 告警行回归。
- `server/src/__tests__/pd74MerchantHalfbaked.ts`：8 项断言均成功：
  - 22 个 active 文案键在重跑迁移后逐字符合期望；seed 后逐字同源；
  - 临时库始终一家店；
  - 跨日读取不改变 open 班次、不生成日结；
  - mock 退款写入 `executed` 主单与明细，列表及原单退款流水可读；
  - 未登记真实实退；结束未造第二店。
- `git diff --check`：无问题。

执行命令：

```bash
# apps/merchant
node ../../server/node_modules/tsx/dist/cli.mjs --test src/components/cashier/model.test.ts src/components/dashboard/utils.test.ts src/pages/appointmentDetail.utils.test.ts

# server
node node_modules/tsx/dist/cli.mjs src/__tests__/pd74MerchantHalfbaked.ts
```

## 浏览器点验（生产构建预览）

- 收银台可见「客诉 / 工单」；点击到 `/dashboard#dash-todo-tickets`，处理面在空态也保留。
- `/cashier/close` 显示「已跨 3 日未交班」与「店长确认交接班」；只打开确认弹层未提交。只读库核对：班次仍为 `open`、`closed_at=null`、`day_closes=0`。
- mock 退款 `RB-20261022-001` 在退款单列表可读：原单、原因、`待实退登记`、线下原路均可见。
- 临时待收款预约存在时，主 CTA 显示「待收款 1 笔」，点击到 `/cashier?pull=PD74_UNPAID_APPT`。
- 7 张挂单中 1 张 QA 单仅显示层过滤，页面与计数均为 6；`02-cashier-hold-1280x800.png` 为 1280×800 帧，长单号、`收起`、`全部`完整可见。
- 结账运维说明默认折叠，短警示「涉钱仅 Mock · 勿重复提交 · 退款须留痕」常显。
- 可见文案键已无指定规格词；源扫描残余命中为代码注释或内部标识符，不属于可见文本。

关键帧：

- `01-dashboard-cta.png`
- `02-cashier-hold-1280x800.png`
- `03-close-cross-day.png`
- `04-refund-list.png`
- `05-pay-notes-folded.png`
- `06-ticket-deeplink.png`

## 基线既有失败（未扩 scope 修复）

- `npm run lint -w @philia/merchant`：与基线同为 47 errors／5 warnings。
- `npm run typecheck --prefix server`：与基线同为 `src/db/pd66EvidenceFixture.ts` 的 12 个 TS1375 错误。
- 商家端生产构建与本次新增／相关测试均成功，上述既有失败未新增计数。

## 独立复核与清理

- reviewer 首轮指出跨午夜刷新、summary／下划线过滤、迁移断言与隔离问题；修正后复核结论：Critical 无、Important 无。
- 临时 API／预览端口 `7400/7401` 已停止，浏览器页已关闭，`.runtime` 已删除。
- 点验只使用临时单店库和本窗临时记录；未造第二店，未触碰禁夹具，未执行真实支付、真实退款、实退登记或日结。
