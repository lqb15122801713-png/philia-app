# B2-3 复现记录（修复前）

## 缺陷
已完成预约详情页只有评价区，无「再次预约/一键复购」入口；再买一次需回首页重走四步。

## 复现步骤
1. 造数：`node evidence/B2-3/setup-data.mjs`（接口级状态机）——
   - 洗护完成单 `01M1X07YDKEMGQ5GSRZDHVGF1G`（复用 B2-2 回归单 C：create→confirm→assign→checkin→六步→completed）
   - 寄养完成单 `01M1X1AVHS6535VF9V0EEVBZAG`（create→confirm→assign→checkin→checkinStay→checkout→completed）
2. `node evidence/B2-3/shots-before.mjs`：示例客户 dev-login → 分别打开两个完成单详情页。

## 现象（before-dom.json / 截图）
- 洗护详情页 `before-detail-grooming.png`：状态「已完成」，区块只有 预约信息 / 门店 / 服务评价，按钮列表 = ["高德导航","腾讯地图","提交评价",TabBar]，**无任何「再次预约」入口**。
- 寄养详情页 `before-detail-boarding.png`：同上，无复购入口。

## 根因（文件 + 行号）
- `apps/customer/src/pages/AppointmentDetailPage.tsx:381-413`：`appt.status === 'completed'` 分支仅渲染「服务评价」区块，全页无任何跳转预约向导的入口。
- 预填能力不足（修复需顺带补齐）：
  - `apps/customer/src/pages/BookingGroomingPage.tsx:39`：`petId` 初始值硬编码 `null`，未读取 `?petId=`（serviceId 已于批次 1 P0-6 支持，第 36 行）。
  - `apps/customer/src/pages/BookingBoardingPage.tsx:57`：同上。

## 环境
- customer :7100 / server :7200；DB 为 server/data/philia.db（嵌入式 SQLite）。
