# 片4-运营商城 VI 对齐（A1→A5 · 产品-1015 换皮 · 任务书冻结版 V1.0 · 头子已准 10-16）

> **PR 只开不合**：合＋部署＝产品经理走 ROG；A 窗禁合禁部。
> 基线＝生产 main@`be3293eaa58f52e4ce8fd7a1825d21f8fdca1869`（片3合部后 tip）｜ 卷宗＝`evidence/design-s4-member-mine`（README＋gates＋shots 廿四帧＋shots-baseline 廿四帧＋本件）｜ 模型＝已用 K3 MAX｜ 会话＝弃脏重建 · 换路A续跑

## 令围落点（A1→A5 同片序）

- **A1 · W-09~W-11 商城订单/商品/会员·次卡**：旧墨 alpha 基底换代 `rgba(59,46,36,x)→rgba(44,40,34,x)`（52 处）+ mall-admin/ui、staff-admin/ui 两套基件令牌收敛（danger/Switch/Modal/Empty/表单 focus 族）；扣次深墨点归 body；档色点/档色谱保留（档色即身份报备）；业务链路/回馈金抵扣列/CSV 导入/批量网格零触。
- **A2 · W-12~W-14 员工/报表/权限矩阵**：StaffPage 14 处+头像底归 sunken；三弹层换代；ReportPage 45 处换代（含 SVG 图柱）；MatrixPage/FinancePage 核档零改；权限规则 PIN 零触。
- **A3 · W-15/W-16 门店设置/运营后台端**：ConsolePage/ConsoleSearch+直嵌内核十件共 175 处换代（选中态深棕→bg-ink/text-canvas、纸面空态→bg-card、旧淡金注→brand-primary-light）；**展示名「运营后台端」零触不回退**；15 口/角色闸门/owner 硬闸零触。
- **A4 · 客户端商城/PHILIA/回馈金表面**：
  - PHILIA 换面＝**PGC 杂志**（READY 187:2；**批C** `philia.magazine.lead/.02/.03` 三槽内容端口+mag.* 壳键；**非开放 Feed**；旧 F-01 陪伴页退役，注册表行/copy 键保留报备）。
  - 商城：**批D** `mall.hero` 促销横幅槽（A5 槽流，D-42 三行）+ 新品角标（`mall.badgeNew`，createdAt 14 天视窗×每屏帽 2 签守 violet≤10%，**不含真券**）+ 类目 chip 展示名端口（查询值写死）+ 快加购 brand-cta 令牌。
  - 链路 CTA 令牌化（PDP/Cart/Checkout 5 处）、渐出底归 canvas、价字归 ink；我的=山姆骨架 hero 渐变归 VI brand 族+档签兜底 `me.tagGuest`+白 qrrow；回馈金表面（账本/规则/开通页）令牌换代，**机制口径零触**（**「可抵」未建=现网无抵扣通道诚实现状，通道=钱权另闸**）。
- **A5 · S-05~S-12 员工余屏表面**：S-10 寄养打卡六件+S-05/S-06 两弹层令牌换代；S-07/S-08/S-09/S-11/S-12 核档零改；**提成/XP 规则 PIN 零触**。

## 端口轻批（令围写死边界）

- 迁移 **0086**（本片唯一新迁移，幂等双跑实证；键入码必随迁移；已部署迁移永不重写）：slot 4 增（mall.hero+杂志三槽，url=NULL 渐变占位+D-42 三行默认）＋ copy 21 增（magazine 10／mall.hero 回退 3／badgeNew 1／类目 chip 6／me.tagGuest 1）。
- `slotSeedRows.ts`/`seed.ts`（D-42 三行随种子同帧）＋ `copySeedRows.ts`（生成件重跑，未归屏率 3.5%<10% 军规）。
- 回馈金 hint=既有键本片只核不增（口径不扩）；W-15/W-16 端口已有零新键。

## 闸门（全绿才交付 · 卷宗 gates/ 实证）

| 闸门 | 结果 |
|---|---|
| 根 build（三端 tsc+vite） | ✅ exit=0 |
| server typecheck | ✅ exit=0 |
| server e2e（API 全链路；0086 随临时库实跑） | ✅ 断言全绿；1 项=收尾清理 EPERM（Windows libsql 句柄滞后环境件，卷宗 §五.8 报备） |
| smoke-routes（117 路由） | ✅ 117/117（双表申报 +7 锚） |
| check-nav-closure（126 路由） | ✅ 死胡同 0 · 弱 0 · 豁免 6 |
| e2e-nav-check（真点击） | ✅ 全绿 |
| 实尺截图（三端三脚本，可复跑） | ✅ 廿四帧全绿（基线廿四帧同机位对照） |
| lint ×3（自查） | ⚠️ 存量 160 旗标全片外；**片内新增 0**（机器交叉核对 @be3293ea） |

## 非目标守界

钱权/L2-②/回馈比例深改／开放 Feed／提成·XP 规则 PIN／判美／IA 重做／icon 库全量／真图终摄／片0·1·2·3 范围／选品系统任何目录＝**零触**；A 窗禁合禁部，PR 只开不合。

## 边界报备（卷宗 §五 全十三条，不擅自扩）

Figma 帧不可直读（对照=READY＋已合工艺，出入听裁）／PHILIA 旧 F-01 退役（注册表行+f1 键保留，清册另批）／「可抵」未建（通道另闸）／新品角标=既有全列 createdAt 零服务端改动／mall.hero 未入画布块（壳写死内容槽流）／member-v2.css 变量收敛仅色值／S-11 实证=非店长引导卡诚实态／e2e 清理 EPERM 环境件／merchant·customer 片外旧色存量留账另批／档色谱保留听裁／smoke 双表申报 +7／等宽轨 JetBrains Mono 既有／lint 存量不自作主张修。
