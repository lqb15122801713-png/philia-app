# B2-5 复现记录（修复前）

## 缺陷
寄养预约屏 1「选日期」：两个同尺寸日期网格（入住 / 退房）纵向堆叠；选定入住日后入住网格不收起、仍可点，选退房阶段误触上网格即改掉入住日。

## 复现步骤
`node evidence/B2-5/shots-before.mjs`（Edge CDP，示例客户已登录，进入 /booking/boarding）：
1. 点入住网格第 3 个可点日 → 选中「周三 9月9日」。
2. 点退房网格第 3 个可点日 → 选中「周六 9月12日」，页面显示「共 3 晚」。
3. 模拟误触：点入住网格第 5 个可点日「周五 9月11日」。

## 现象（before-dom.json / 三步截图）
- step0：入住网格 14 天常驻，退房网格未选入住前不渲染（`before-1-checkin-picked.png`）。
- step1/step2：选定入住后**入住网格仍完整可见**（`checkinGridStillVisible: true`），与退房网格同尺寸堆叠（`before-2-checkout-picked.png`）。
- step3（误触）：入住日被从 9月9日 改为 9月11日，晚数从「共 3 晚」变为「共 1 晚」（`before-3-mistouch.png`，activeDays=["周五9月11日","周六9月12日"]）。

## 根因（文件 + 行号）
- `apps/customer/src/pages/BookingBoardingPage.tsx:254-270`：屏 1 中「入住日期」网格无条件常驻渲染（`checkinDays.map(...)` 无收起分支），`pickCheckin`（112-115 行）全程可用；选定入住日后无任何防误触机制，两个网格在视口内堆叠。

## 环境
- customer :7100 / server :7200；种子门店一周七天均营业（网格 14 天全部可点）。
