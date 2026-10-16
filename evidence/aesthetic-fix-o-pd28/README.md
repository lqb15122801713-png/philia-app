# PD-28／CJ-1016-03 · 审美升修 O 项卷宗

- 分支：`feat/aesthetic-fix-o-pd28`
- 基线：`2bb7a2b3298123823769f60de1622876e46e380b`
- 范围：O1｜O2+O12｜O3｜O4｜O5｜O9｜O11｜O13｜O14（10 ID／9 工单）
- 不施工：O7／O8／O10；O6／D-56～D-60 未动
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未触真实支付／真实退款通道；未合并未部署
- 分拣文件说明：`UXUI-O1-O14分拣_方案A_2026-10-16.md` 未在共享区或本机落盘，施工以冻结任务书九工单为准。

## 一、基线与修后

基线 `gates/aesthetic-check-before.log` 为 2/10，只有 O5 与 O6 通过。修后 `gates/aesthetic-check-final.log` 为 10/10，另有状态矩阵 `gates/aesthetic-state-final.log` 为 8/8。

| 工单 | 处理 | 实证 |
|---|---|---|
| O1 | 无记忆不渲染同链入口；记忆态主行动改进度，不再直接建单；服务中 LIVE 卡保留 | 主入口可见 1；记忆态预约数 0→0；`home-live-card=true` |
| O2+O12 | 会员条与我的标签字阶统一 ≥12px | home 12.5/12.5px；me 12/17px |
| O3 | 空态说明改深字 | 对比 2.46 → 12.67 |
| O4 | 管理热区扩到 44×44 | 29×15 → 44×44 |
| O5 | 基线已合格，未改 | 对比 6.44，锁因「请先建立宠物档案」 |
| O9 | 列表与详情规则钩移除，仅购物袋结算侧保留独立 Link；真实返显保留 | mall=0、pdp=0、cart=1；空车禁用结算时钩仍独立到 `/member/open`；付费返显无重复 |
| O11 | 入口改「出示或复制」；复制绑定当前 token，换码/过期自动失效，剪贴板原文一致 | `已复制`；换码后旧状态隐藏 |
| O13 | 免费档/零余额改周期日历；付费非零保留周期百分比 | 免费/非会员无 `%`；付费非零显示 71% |
| O14 | 仅洗护单屏渲染 dock 且预约选中；确认栏让位、时段安全区加大 | `current=page`；确认栏与 dock 不相交；O6 的 22 格均无压 |

## 二、固定闸门

- 三端 `npm run build`：exit 0（`gates/build-final.log`）。
- server `npm run typecheck`：exit 0（`gates/server-typecheck-final.log`）。
- `smoke-routes`：119/119（`gates/smoke-routes-final.log` / `.json`）。
- 导航闭环：127 路由、死胡同 0、弱 0（`gates/nav-closure-final.log` / `.json`）。
- `e2e-nav-check`：全部通过（`gates/e2e-nav-check-final.log`）。
- `smoke-deploy`：本地 Mock 全部通过（`gates/smoke-deploy-final.log`）。
- PD-27 回归：9/9；PD-27.1 D-60：7/7（`gates/regression-b1b5.log`、`gates/regression-d60.log`）。
- CartPage、MemberCardPage、RebookPanel 定向 lint：exit 0（`gates/customer-lint-critical-final.log`）。
- 其他 lint 命中为既有 refs／`Date.now()` 规则（`gates/customer-lint-changed.log`），未扩批清理。

独立评审指出的 Cart 嵌套交互、token 换码状态、场景覆盖不足均已处理；复核后补了默认稿以外的实际交互与状态矩阵。

## 三、复跑

```bash
EVIDENCE_PREFIX=final node scripts/aesthetic-fix-o-pd28-check.mjs
EVIDENCE_PREFIX=state-final node scripts/aesthetic-fix-o-pd28-state-check.mjs
```

本卷宗是施工方自报证据，不替代产品侧后续八步与 Argus／2.0 窄回归。
