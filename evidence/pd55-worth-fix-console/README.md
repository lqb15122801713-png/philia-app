# 卷宗 · PD-55 worth-fix-console（控台铬架三项：15卡等权／关停条危险区隔／侧栏IA分离感）

- BRANCH：`feat/pd55-worth-fix-console`｜WORKTREE：`E:\KIMI code\pd55-worth-fix-console`｜基线：main@`f114572`（全 `f114572434578d5301a3c63dfb59cc5312a8a858`）｜模型：K3 MAX
- 令围：只修 CONSOLE-RETAKE（blind-review-round1/2026-10-20）**Worth fixing 项 2–4** 意见轨最小铬架改——
  桌面 1280×800 `:7202/console`（merchant_owner）。不判美大修；不扩 KPI（PD-56）／STEPS（PD-57）；
  **NAV_CHROME_CLIP 已由 PD-54 销，本令不重开**（活动项＋身份常驻可见保持）。
- **迁移号：本窗未动 drizzle／`_journal.json`（纯前端六件），独占号 0096 声明保留未用；未碰 0093／0095／0097／0098。**

## 三项最小改（最小 diff=6 件，+111/−57）

1. **15 卡等权 →「常办／慎办／占位」三层**（CONSOLE-RETAKE §2）：
   - `pages/consolePortsMeta.ts`：单源表加 `tier: 'daily'|'careful'|'pending'`（常办 5=改文案/换素材/画布装修/改会员档/会员营销；
     慎办 8=改提成/改XP/改支付通道/数据订正/参数字典/回收站/门店档案/安心包；占位 2=储值/报表口径）；卡数 15、口序、留痕数据源全不动。
   - `pages/ConsolePage.tsx`：办事首页按 `HOME_TIERS` 三层分区渲染（分区签+注，层内原序原栅格）。
   - `styles/console.css`：慎办层卡 `console-card-careful`=卡其 3px 左条（既有色板 token，零新增字面量）；占位层沿用既有 opacity-60。
   - copy：`cadm.homeTierDaily/DailyNote/Careful/CarefulNote/Pending/PendingNote` 六键。
2. **「支付一键关停」危险区隔外观**（§3）：`KillSwitchStrip` 关停态从小字行+孤立红钮收进既有 **WDanger 危险区容器**
   （赭红题带「危险区 · 支付全局关停」+暖底）；闸／端点／`window.confirm` 双确认行为零改动，**不真触发**；生效中 WAlert 横幅态原样。
   copy 增 `cadm.killDangerTitle` 一键；`data-testid=console-kill-arm` 不动。
3. **侧栏「运营后台端」分离感**（§4）：`MerchantRail` foot 组签下加分区注「独立运营壳 · 与日常经营分栏」（`wnav.footConsoleNote` 一键），
   console 入口加 `shell` 描边胶囊类；`console.css` foot 顶加 1px 分隔线。IA／路由／十五口／角标／激活工艺／PD-54 钉底全不动。

## 自验（本窗栈 server@7255＋双 preview：before=7155（tmp/pd55-dist-baseline 基线产物）／after=7156（本分支产物），VITE_API_BASE 构建期钉 7255，CORS 白名单 7155/7156，独立证据库 tmp/pd55-evidence.db）

- 构建：`npm run build:merchant`（tsc -b ＋ vite build）基线/改后两跑全 ✓。
- 页面实证（Edge headless CDP，1280×800 真档，店主种子会话 dev-login；不抢前台）：
  - `before-01/02/03` vs `after-01/02/03`：
    - ① 15 卡：before=等权三列混沌一片 → after=常办(5)/慎办(8·卡其左条)/占位(2·降透)三层分区签一眼可辨（帧 01/03）。
    - ② 关停条：before=顶区孤立红钮像普通工具钮 → after=WDanger 赭红题带+暖底危险区容器（帧 01）。
    - ③ 侧栏：before=foot 与经营口组无隔 → after=顶分隔线+「独立运营壳」分区注+描边胶囊入口；活动项金左条+身份卡钉底常驻保持（帧 01/03）。
- 回归：高级层参数表折叠区、页底共构注、搜索框原样（帧 03）；`/console` 活动态、身份卡全帧可见。

## 两问闸

1. 是否只碰本缺陷？——是：六件最小 diff；未碰 KPI／STEPS／CLIP／Minor 5–8／端口业务逻辑；未碰 drizzle。
2. 是否涉钱／真写库？——否（只读登录会话＋截图；证据库一次性 tmp 件，测完即清）。

— KimiCode A窗（K3 MAX）· 2026-10-21
