# PD-28／CJ-1016-03 · 审美升修 O 项

已用 K3 MAX。基线：main@`2bb7a2b3`。

## 范围

O1｜O2+O12｜O3｜O4｜O5｜O9｜O11｜O13｜O14（10 ID／9 工单）。O7／O8／O10 不施工；O6／D-56～D-60 未动；零新依赖、零迁移；未触真实支付／真实退款通道。

## 修调

- O1：无记忆不渲染同链入口；记忆态主行动改查看预约进度，服务中 LIVE 卡保留。
- O2+O12：回馈金与金额字阶统一 ≥12px。
- O3：空态正文改深字；O4：管理热区 44×44。
- O5：基线已合格，未改。
- O9：列表与详情规则钩移除，仅购物袋结算侧保留独立 Link；付费真实返显保留。
- O11：入口改「出示或复制」；复制绑定当前 token，换码／过期自动失效。
- O13：免费档／零余额改周期日历；付费非零保留周期百分比。
- O14：仅洗护单屏渲染 dock 且预约选中；确认栏与时段安全区同步避让，未回退 O6。

## 验证

- 主专项 10/10；状态矩阵 8/8。
- 三端 build、server typecheck：exit 0。
- `smoke-routes`：119/119；导航闭环：127 路由零死胡同；`e2e-nav-check` 全绿；`smoke-deploy` 本地 Mock 全绿。
- PD-27 回归 9/9；PD-27.1 D-60 回归 7/7。
- CartPage、MemberCardPage、RebookPanel 定向 lint：exit 0。
- 既有 refs／`Date.now()` lint 命中已单列，未扩批修改。

卷宗：`evidence/aesthetic-fix-o-pd28/README.md` 与前后截图、结果 JSON、闸门日志。

PR 只开不合；A 窗未合并未部署。施工方自报结果不替代产品侧后续八步与 Argus／2.0 窄回归。
