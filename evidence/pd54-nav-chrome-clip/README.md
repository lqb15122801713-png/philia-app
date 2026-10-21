# 卷宗 · PD-54 NAV_CHROME_CLIP（控台左栏裁切 · 运营后台端活动项＋店主身份常驻）

- BRANCH：`feat/pd54-nav-chrome-clip`｜WORKTREE：`E:\KIMI code\pd54-nav-chrome-clip`｜基线：main@`4313b1c`（全 `4313b1c323841137972f2c0c4c7e4f5e45c53c78`）｜模型：K3 MAX
- 令围：只修一缺陷——`:7202/console` 桌面 **1280×800** 下，左栏主导航把当前「运营后台端」活动项与店主身份裁到视口外。
  不扩 worth fixing（15卡等权／关停条／侧栏IA大改 → 候 PD-55）；不修 banner／pending。
- **迁移号：本窗未动 drizzle／`_journal.json`（纯前端两件），0095 声明保留未用；未碰 0093／0094。**

## 根因与落地口径

- 根因：`MerchantRail`（`.wrail`，236px 深棕轨，≥xl 常驻）整轨 `overflow-y: auto` 单列滚动——
  口组内容（PHILIA 牌＋经营6／商城3／管理6＝15 口×44px＋组签）≈790px＋foot（运营后台端入口＋店主身份卡）≈145px，
  合计 ≈974px > 800px 视口高 → foot 整体被裁出首屏，进 /console 默认不见「我在哪／我是谁」。
- 落地（最小 diff，2 件）：
  1. `apps/merchant/src/components/MerchantRail.tsx`：口组区包一层 `.wrail-body` 滚动容器（foot 移出滚动区）；
     组／口结构、testid、角标、激活态、`groupsFor` 分流全不动。
  2. `apps/merchant/src/styles/console.css`：`.wrail` 改 `overflow: hidden`；新增
     `.wrail .wrail-body { flex:1; min-height:0; overflow-y:auto; margin:0 -12px; padding:0 12px; }`
     （滚动条仍贴轨右缘）；`.wrail .ft` 加 `flex: none` 钉住轨底。
- 效果：foot（「运营后台端」活动项＋店主身份卡）任何视口高常驻可见；口组区可滚动，十五口全达；
  断点互斥（<xl dock／≥xl rail）、44px 触件、激活工艺、15 卡办事首页逻辑零改动——仍真控台壳。

## 自验（本窗栈 server@7245＋merchant preview@7145，VITE_API_BASE 构建期钉 7245，CORS_ORIGINS 白名单 7145，独立证据库 tmp/pd54-evidence.db）

- 构建：`npm run build:merchant`（tsc -b ＋ vite build）✓（本窗首跑修复：server 工作区依赖不在根 workspaces，需 server/ 自装，属环境非码改）。
- 页面实证（preview 产物＋Kimi Desktop 内置浏览器后台标签不抢前台，desktop-1280＝1280×800 真档，店主种子会话）：
  - 图 01（/console 进页默认帧）：左栏底部「运营后台端」活动项（金左条＋浅金底高亮）＋身份卡
    「菲丽亚宠物·示例店／店主 · 菲丽亚店主」同框常驻可见；办事首页 15 卡、关停条、搜索原样。
  - 图 02（轨体滚动 400px 后）：口组区上滚（日结/退款置顶、门店档案·设置可达），
    foot「运营后台端」活动项＋身份卡钉底不动——可滚动但关键铬不裁没。
  - 图 03（/dashboard 同壳回归）：总览·驾驶舱激活正常，foot 常驻，主区数据件原样。
  - 图 04（/console 1440×900 高视口回归）：全轨＋foot 常态可见，无布局回退。
- DOM 探针：进页后 `rail-console.on`（活动态）与 `rail-foot` 身份卡均在视口内（图 01 直读）。

## 两问闸

1. 是否只碰本缺陷？——是：MerchantRail.tsx 一处结构包装＋console.css 三行规则；未碰 15 卡／关停条／侧栏 IA／banner／pending；未碰 drizzle。
2. 是否涉钱／真写库？——否（只读登录会话＋页面截图；证据库一次性，测完即清）。

— KimiCode A窗（K3 MAX）· 2026-10-21
