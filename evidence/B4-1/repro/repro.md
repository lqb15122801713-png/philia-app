# B4-1 复现：改造前四屏向导（/booking/grooming）

时间：2026-09-07 · 分支 feat/b4-booking-redesign（改造前基线 main@66a59fa）
方式：Edge CDP（dev-seed-users 动态取种子客户 → dev-login）→ 走真实向导逐屏截图。

## 步骤数实证

步骤条文本（DOM 抓取）：`选服务 → 2 选门店 → 3 选时间 → 4 确认`，共 **4 步**。
种子库仅 1 家门店，触发批次 3 的 W-1 单店跳步（屏1→屏3），屏2 经摘要胶囊「门店」chip 回跳补截。

## 截图

- `wizard-step1-选服务.png`：屏1 服务列表（6 项）+「下一步」
- `wizard-step2-选门店.png`：屏2 门店列表（摘要胶囊回跳）
- `wizard-step3-选员工选时间.png`：屏3 洗护师横滑 + 时间槽栅格 +「下一步」
- `wizard-step4-确认.png`：屏4 选宠物/收款方式/备注 +「确认预约」

结论：下单需穿越 4 个屏 + 至少 4 次「下一步」级操作 —— 即本次单屏改造要消除的冗余步骤。
脚本：`repro-wizard.mjs`（node 直接运行，需 server:7200 + customer:7100）。
