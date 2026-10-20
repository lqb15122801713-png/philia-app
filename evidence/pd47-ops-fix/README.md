# 卷宗 · PD-47 商家ops修（修 PD-46 开挂 M1＋L1）

- BRANCH：`feat/pd47-ops-fix`｜基线：main@`e82694c`（全 e82694cf8c59dc396964bbb821f132d93ee799fb，含 PD-46 U7）｜模型：K3 MAX
- 令围：只修 M1 `/ops` PDCA → GET /trpc/pdca.list 403「数据加载失败」＋ L1 驾驶舱连锁视图泄漏读口串「读口=store.chainDashboard」。不扩 O1–O4。

## 根因

- **M1**：`server/src/routers/taskCollab.ts` 的 `pdca.list` 用 `staffProcedure`（须 staffId）。
  商家端 /ops 页（OpsPage，owner|manager 身份、无 staffId）调它 → FORBIDDEN 403 → 卡面「数据加载失败」。
  同页其余块（pdca.summary / selfCheck.listPending / report.listMetricAppeals / stock2.approvalListPending /
  membership.cancelRequestPending）本就走 merchantManager 档，未受牵连。
- **L1**：`dash.m3ChainNote` 三层同值泄漏——码内默认（apps/merchant/src/copy/dashboard.ts）、
  seed 单源（server/src/db/copySeedRows.ts）、端口覆盖行（0052_chain2_keys.sql 改值的 copy_overrides active 行）
  均为「合计+分栏并列（读口=store.chainDashboard 三店真值）」。覆盖层端口值优先 → 店主 /dashboard 连锁视图明文见读口调试串。

## 修复（最小 diff，M1 三处＋L1 三层）

- M1：`server/src/routers/taskCollab.ts` 新增 `pdca.listForOps`（merchantManagerProcedure，与 list 同店域同形状；
  旧 `pdca.list` staff 档原样不动——员工端 PdcaPage 零回归）；`apps/merchant/src/lib/taskCollabPort.ts` 契约桥换钉
  `listForOps`；`apps/merchant/src/pages/OpsPage.tsx` 区 1 查询改调 `collab.pdca.listForOps`。
- L1：码内默认＋copySeedRows 改「合计+分栏并列（三店真值）」；新增幂等迁移
  `server/drizzle/0088_pd47_ops_fix.sql`（UPDATE active=1 行对齐；0087 同款工艺）＋ `_journal.json` 登记 idx 88。

## 自验（本窗栈 server@7221＋merchant@7121，VITE_API_BASE 直连；7200/7101/7102 他窗栈未动）

- server `tsc --noEmit` ✓；merchant `tsc -b` ✓。
- e2e（E2E_PORT=7220 避让）：新增 **60.7 ✓**——listForOps 店主/店长 200 含本店已闭环问题、staff 越界仍 403；
  全量 1037 ✓ / 8 ✗，8 项 ✗ 与裸基线 e82694c 逐条同红（56.1×2／57.1／74.11／76.3／77.2／81.4／98.2，陈旧期望+日期敏感），
  本窗零新增红零修复（开挂不扩）。
- 页面实证（后台浏览器页签，未抢前台）：
  - 图 01：店主 /ops 问题闭环加载出「美容室地板水渍 待复检 卫生」行＋复检按钮（非「数据加载失败」）；
    自检/汇总/申诉/库存/退会各块均正常空态，全页无「数据加载失败」。
  - 图 02：店主 /dashboard 连锁视图 M3 卡正常可读，注记＝「合计+分栏并列（三店真值）」；
    DOM 全文无「读口=store.chainDashboard」、无「读口=」同类串（absent 断言 count=0）。
- 03_读回记录：店主 listForOps=200／旧 list=403／未登录 listForOps=401；0088 后 active 行读回＝「合计+分栏并列（三店真值）」。

## 两问闸

1. 是否只碰 ops PDCA 权限/查询与驾驶舱文案泄漏？——是：server 1 个新增只读端点＋前端 2 处换调＋文案 2 处＋幂等迁移 1 句。
2. 是否涉钱真通道？——否（未碰支付/退款；未真付真退）。

— KimiCode A窗（K3 MAX）· 2026-10-20
