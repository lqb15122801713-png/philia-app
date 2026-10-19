# PD41 / CJ-1018-07 · U2 预约升档卷宗

- 分支：`feat/design-upgrade-u2-booking`
- 基线：`main@08f0e36b`（`08f0e36bdfd566be78fe7e7f5656a429550fccf2`）
- 权威：figma bro 定稿／Figma `ot5SBoqhKAw2UIZRVFzhel`；nodes `174:38`、`174:138`、`174:346`、`174:428`；VI `193:2`
- 范围：预约 Default／已选／Half 选人／成功页；2-tap＋Half；副文≥12px
- 边界：未施工 B7／PD-40／`209:*`；成功页仅保留 `/appointments/:id/live` 入口锚；未真付、未真退、未开会员、未提交预约、未真加购结账

## 施工口径

- 主画布改为预填 chips（门店／宠物／服务／美容师）＋日期横条＋四列时段栅格＋底部确认条。
- Half 选人使用原生 `<dialog>` modal，蒙层不可点穿，Esc／蒙层关闭，打开期间锁定底层页面滚动；hero 与作品槽在真图未齐前使用浅色「待换」占位，无爪印占位。
- 成功页对齐摘要卡＋「查看服务过程」＋返回出口；不渲染预约码、日历或额外出口。
- 预填状态改为 URL／用户选择／上次记忆／默认值的派生态；无 effect 内同步置态。
- 定稿无收款方式选择器，本片固定 `pay_at_store`；不读取次卡余额、不静默扣次。

## 闸门记录

| 阶段 | 命令 | 结果 |
|---|---|---|
| 先红 | `EVIDENCE_PREFIX=before node scripts/design-upgrade-u2-booking-check.mjs` | 0/10；缺 chips、Half、四列、成功页锚，最小副文 9px |
| 中红 | `EVIDENCE_PREFIX=half-red node scripts/design-upgrade-u2-booking-check.mjs` | 9/10；捕到 Half 主钮首屏不可见 |
| 审查红 | `EVIDENCE_PREFIX=review-red node scripts/design-upgrade-u2-booking-check.mjs` | 12/13；捕到 Half 打开后 body 未锁滚动 |
| 后绿 | `CUSTOMER_URL=http://localhost:7103 API_BASE=http://localhost:7200 EVIDENCE_PREFIX=after node scripts/design-upgrade-u2-booking-check.mjs` | 13/13；含 Esc、真实输入开层、滚动锁、全程无提交预约／支付请求硬证据；本次 7100 被 PD-40 工作树占用，故用 7103 |
| 交付前复核 | 同后绿命令，`EVIDENCE_PREFIX=final` | 13/13 |
| scoped lint | `npx eslint src/App.tsx src/components/booking/single/{BottomSheet,ConfirmBar,DateStripBlock,TimeGridBlock,StaffHalfSheet}.tsx src/copy/booking.ts src/pages/{BookingSuccessPage,GroomingSinglePage}.tsx`（cwd=`apps/customer`） | 通过 |
| 全量 customer lint | `npm run lint -w @philia/customer` | 仍红：71 项（67 errors／4 warnings），日志 `full-lint.log`；本片 modified files scoped lint 已通过 |
| 三端构建 | `npm run build` | 通过；仅既有 bundle 体积与 zod 注释警告 |
| server 类型 | `cd server && npm run typecheck` | 通过 |
| server e2e | `cd server && E2E_PORT=7210 npm run test:e2e` | 仍红：7 项（56.1×2、57.1、74.11、76.3、77.2＋Windows 临时库清理 EPERM）；本片无 server diff，日志 `server-e2e.log` |

## 证据文件

- Figma 对照：`figma-174-38-174-138.png`、`figma-174-346-174-428.png`、`figma-vi-193-2.png`
- 先红：`before-*.png`、`before-results.json`
- 中红：`half-red-*.png`、`half-red-results.json`
- 审查红：`review-red-*.png`、`review-red-results.json`
- 后绿：`after-default.png`、`after-half.png`、`after-selected.png`、`after-success.png`、`after-results.json`
- 交付前复核：`final-*.png`、`final-results.json`
- 全量 lint 现场：`full-lint.log`
- server e2e 现场：`server-e2e.log`

## 诚实注记

- Half 的评分／从业／好评与作品图当前无真实端口，页面显示「待换」或按现有 staff 字段降级，不虚构数据。
- 成功态闸门使用 `appointment.get` 网络 mock，未创建预约、未调用提交链路。
- `/appointments` 当前种子的列表空态与历史数据归属问题未在本片处理，属片外功能账。
- 画布端旧 `bookingGrooming.petCard/serviceChips/storeLine/staffRail/extras` 注册键需服务端另片迁移到本片四键；本片前端固定定稿四块序，只消费既有 `visible`。
