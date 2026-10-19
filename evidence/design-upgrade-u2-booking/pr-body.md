# PD41 / CJ-1018-07 · 全端升档 U2 预约

> 按规则：PR 只开不合；合／部走产品 ROG。本片不写验收结论、不作审美判定。

## 范围

- 对照 Figma `ot5SBoqhKAw2UIZRVFzhel`：`174:38`／`174:138`／`174:346`／`174:428`；VI `193:2`
- 客户端预约 Default／已选／Half／成功四态
- 守 2-tap＋Half；Half 为原生 modal＋蒙层，支持 Esc／蒙层关闭，底层滚动锁定
- 成功页保留「查看服务过程」入口锚至既有 `/appointments/:id/live`

## 明确未做

- 未施工 B7／PD-40／`209:*`
- 未触及 U1／U3～U7、C4–C6、B8／B10
- 未真付、未真退、未开会员、未提交预约、未真加购结账
- 真图未齐处以浅色「待换」占位，未用爪印冒充

## 主要改动

- `GroomingSinglePage` 改为预填 chips＋日期横条＋四列时段＋底部确认条
- `BottomSheet` 改原生 `<dialog>`；新增 `StaffHalfSheet`
- `BookingSuccessPage` 对齐定稿摘要与双出口
- `/booking/success` 纳入客户端 dock
- 因定稿无收款选择器，预约提交固定 `pay_at_store`，不读取次卡余额、不静默扣次
- 新增 `scripts/design-upgrade-u2-booking-check.mjs` 与卷宗 `evidence/design-upgrade-u2-booking/`

## 验证

- U2 浏览器闸门：先红 0/10 → 中红 9/10 → 审查红 12/13 → 后绿 13/13；交付前复核 13/13
- 闸门含真实输入、Esc、蒙层、滚动锁、副文≥12px、四列、成功页锚，以及全程无 `appointment.create`／支付请求
- modified files scoped ESLint：通过
- `npm run build`：三端通过（仅既有 bundle 体积／zod 注释警告）
- `cd server && npm run typecheck`：通过
- `npm run lint -w @philia/customer`：仍红 71 项存量问题；本片 modified files scoped lint 已通过，日志见卷宗
- `cd server && E2E_PORT=7210 npm run test:e2e`：仍红 7 项存量（56.1×2、57.1、74.11、76.3、77.2＋Windows 临时库清理 EPERM）；本片无 server diff，日志见卷宗

## 片外跟踪

- server 画布注册表仍含旧 `bookingGrooming.petCard/serviceChips/storeLine/staffRail/extras` 键；需另片迁移到本片四键，避免画布编辑器显示失效块。
- `/appointments` 当前种子的列表空态与历史数据归属问题未在本片处理。

卷宗：`evidence/design-upgrade-u2-booking/README.md`
