# B4-5 首页复购提醒卡 · 证据包

> 任务：首页推荐服务模块上方插入条件卡——存在 completed 洗护单且最近完成 ≥14 天 →
> 显示「{宠物名}该洗澡啦 ▸ 一键预约」（点击带预填进新单屏）；不满足条件不渲染。
> 数据源复用 `appointment.listMine`，不新增接口；服务端/商家端/员工端零改动。
> 分支 `feat/b4-booking-redesign`，基线 commit 6f1057a（B4-2）。

## 改动文件（仅 apps/customer，2 个）

- `apps/customer/src/components/home/GroomingReminder.tsx`（新增）：条件卡组件 +
  纯函数 `resolveGroomingReminder`（completed 组内取完成时点最近的洗护单，距今 ≥14 天触发）。
- `apps/customer/src/pages/HomePage.tsx`（修改）：import + 在「附近好店」与「推荐服务」
  之间插入 `<GroomingReminder />` + 头注释一行。

## 14 天口径取径

- **completedAt 优先**（服务真实完成时间，语义即「上次洗护完成」）；
- completedAt 为 NULL 的历史 completed 单**退回 scheduledEnd**（预约结束时间，仍代表
  那次洗护的完成时点），避免老数据漏提醒；
- 阈值：`now - 完成时点 ≥ 14×24×3600×1000`（≥ 含边界，正好 14 天即触发）；
- 「最近完成」锚定全量 completed 洗护单中完成时点最近的一单（任务书字面口径），
  提醒对象 = 该单宠物；点击预填 = 该单 serviceId+storeId+petId。

## 证据清单

| 文件 | 内容 |
|---|---|
| `repro-before.png` / `repro-before.txt` | 复现：改造前首页无提醒卡（DOM 无「该洗澡啦」），reseed 初始态 |
| `state1-no-completed.png` / `state1-no-completed.txt` | 不满足条件①：新代码 + 无 completed 洗护单（appointments=0）→ 不渲染；**该截图与 repro-before.png 逐字节一致**（首页其余模块零影响的最强证明） |
| `seed-completed-grooming.mts` | 造数脚本（tsx 直接写库 completedAt；note='B4-5-EVIDENCE' 标记行幂等 upsert；用法见文件头） |
| `state2-card-present.png` / `state2-card-present.txt` | 满足条件：完成 20 天前 → 卡出现「距上次洗护已 20 天 旺财该洗澡啦 ▸ 一键预约」，链接含三参 |
| `state2-prefill.png` / `state2-prefill.txt` | 点卡 → 落 /booking/grooming 且 URL 三参齐全；确认条仅剩「请选择时间」（=宠物/门店/服务已预填）；宠物卡显示旺财 |
| `state3-under-14d.png` / `state3-under-14d.txt` | 不满足条件②：同一标记行拨到完成 5 天前 → 不渲染（DOM 断言） |
| `flow-booking.mp4` | 录屏（8.8s ≤30s）：首页 → 点提醒卡 → 单屏三参预填 → 选 09:00 时段 → 确认预约 · ¥88 → 成功页（核销码 9ZKETJ） |
| `build.txt` | customer `npm run build`（tsc -b && vite build）exit 0 + appointment.smoke「全部冒烟验证通过 ✅」exit 0 |
| `cdp-home-check.mjs` / `driver-b4-5.mjs` | 断言/截图与录屏驱动脚本（CDP 直连，无新增依赖） |

## 造数与口径备注

- 造数对象：种子客户（kimiId=seed_kimi_customer）× 宠物旺财 × 首个在架洗护服务
  （基础洗护（小型犬）× 菲丽亚宠物·示例店）；completedAt 由脚本直接写库。
- 验证结束后库内保留：1 条 completed 标记单（20 天前）+ 录屏产生的 1 条 pending 单
  （9 月 9 日 09:00）。如需回到 appointments=0 初始态：`cd server && npm run db:seed`（reseed）。
- 未登录：组件 `enabled: !!user` 守门（同 TabBar 口径），不打受保护接口、不渲染。
- 查询中/失败：同样不渲染（条件卡无三态占位，避免闪烁）。
