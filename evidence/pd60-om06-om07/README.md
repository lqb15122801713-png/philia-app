# 卷宗 · PD-60 敏慧 O-M07 拒访文案＋O-M06 槽位明文（限可验项）

- BRANCH：`feat/pd60-om06-om07`｜WORKTREE：`E:\KIMI code\pd60-om06-om07`｜基线：main@`43ce81c`（全 43ce81c3d01b894efd8762766dc6999c60c309fb）｜模型：K3 MAX
- 令围：只修一缺陷——O-M07 商家端拒访文案「…店长 / 店员使用」与闸口径略拧（staff 小美仍被拦）；O-M06 console 槽位卡 live url／alt 未明文露出（限可验，超最小 diff 即退）。不扩闸逻辑／槽位编辑／PD-58／PD-59／L-1／L-2；禁真付真退。
- 令包：`D:\Philia-shared\大测-产品-1021-下批令包字段-PD60-om06-om07-43ce81c.md`

## 修复（最小 diff：3 文件 15+/4-，零迁移零闸动）

- **O-M07（主修）** `apps/merchant/src/components/RequireMerchant.tsx`
  - 拒访文案：「商家端仅供门店店主 / 店长 / 店员使用，请改用商家账号登录。」→「商家端仅供门店店主 / 店长使用；店员请使用员工端 :7203。」
  - 头注释随行对齐（roles 判定含 merchant_clerk 的既有口径写准；引导语补店员去向）。闸逻辑 `isMerchant`（owner/manager/clerk 放行）**零改动**。
- **O-M06（可验，未退）** `apps/merchant/src/pages/SlotPortPage.tsx`
  - SlotCard 在 alt 中文名下新增**只读明文行**（有 live 才出）：`live 图：{live.contentJson.url ?? '—'} · alt={live.contentJson.alt}`，`data-testid="slotport-live-src-<slotKey>"`；数据结构零改动（list 读口既有 live.contentJson.url/alt 字段直用）。
- `apps/merchant/src/copy/copyPort.ts`：新增 `'slotport.liveSrcLabel': 'live 图'` 一一键（码内默认表，withCopyOverrides 代理同族）。
- **迁移未动**：未碰 drizzle／`_journal.json`，独占号 0101 未使用（本令无需动库）。

## 自验（本窗栈 server@7241＋merchant preview@7144，VITE_API_BASE 构建期钉 7241，CORS_ORIGINS 白名单 7144；独立证据库 tmp/pd60-evidence.db）

- merchant `tsc -b` ✓（0 error）；`vite build` ✓（PWA 产物正常）。
- e2e（E2E_PORT=7240 避让；04/04b 双跑全量日志）：复跑 **1037 ✓ / 8 ✗**；8 项 ✗＝56.1×2／57.1／74.11／76.3／77.2／81.4／98.2，
  与 PD-48～PD-57 卷宗所载裸基线同红逐条一致（陈旧期望 4279 vs 现 4300／六槽 vs 现十槽＋日期敏感），**本窗零新增红零修复**（开挂不扩）。
  首跑曾多计 1 项＝D-43 清理脚本子进程退出码 3221225477（Windows libsql 原生崩溃偶发，计为「未捕获异常」），复跑即消＝环境性非本窗引入。
- 页面实证（无头 Edge 独立 profile 不抢前台；登录走 dev-login 种子真链路，philia_session cookie）：
  - 图 01（staff 小美会话访 :7144/dashboard）：拒访页新文案「商家端仅供门店店主 / 店长使用；店员请使用员工端 :7203。」——小美仍被拦（闸口径不变），文案与闸一致。
  - 图 02（owner 菲丽亚店主会话 :7144/settings/slots）：home.banner 卡明文行「live 图：/brand/banner-home-1200.png · alt=首页品牌横幅」；login.hero.staff 卡同工艺透出。
- 接口证（03_件，owner 会话 curl slotPort.list）：home.banner live v1 contentJson={url:/brand/banner-home-1200.png, alt:首页品牌横幅}，与令包期望逐字一致。
- 05_读回记录：A/B/C/D 四段（拒访画面原文／明文探针／接口证／无 live 槽位行为）。
- 证据夹具：种子库直用（小美=staff 角色、店主=owner），零插库零 mock 涉钱；库为一次性证据库，测完即清。

## 两问闸

1. 是否只碰本缺陷文案与只读明文？——是：3 文件 15+/4-；零闸逻辑／零数据结构／零迁移；未碰 PD-58／59／L-1／L-2／选品／片*。
2. 是否涉钱真通道？——否（未碰支付/退款；登录为 dev 种子链路；库一次性）。

— KimiCode A窗（K3 MAX）· 2026-10-21
