# PD-27.1／CJ-1016-02 · D-60 续修卷宗

- 分支：`feat/aesthetic-fix-d60`
- 基线：`e7d48f2bfb919d2b35581c37a08ff538d7aad2c6`
- 范围：只销 D-60；D-56～D-59 未动，其他 O 项未扩
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未触真实支付／真实退款通道；未合并未部署

## 一、基线复现

主专项 `gates/aesthetic-check-before.log` 为 4/7：

1. 390×844 零滚五格完整无遮；390×700 零滚五格全部被 dock 覆盖。
2. 待到店／服务中／待评价三个预约入口可达。
3. 退款售后仍是无链 disabled span。
4. 全部订单只到 `/appointments?tab=history`，不是全部订单。

商家默认编辑稿 `gates/canvas-check-before.log` 为 0/1：`me.entries → me.orderrow` 的旧顺序会被重新发布到 live。

基线截图：`before-d60-zero-844.png`、`before-d60-zero-700.png`、`canvas-before-merchant-default-order.png`。

## 二、处理

1. `packages/shared/src/meLayout.ts` 统一客户页与商家默认编辑稿的块序：`me.orderrow` 前移到 `me.entries` 前；published／draft 的显式顺序仍优先，其他 pageKey 仍走原 `sortOrder`。
2. 退款售后接既有 `/refunds`，不再以 disabled 占位冒充入口；失效 slot CSS 删除。
3. 预约列表新增 `all` 真筛选（全部状态桶各取一次），“全部订单”改落 `/appointments?tab=all`；`appointments.tabAll` 明确为零迁移静态 fallback。
4. 未改订单状态机、真实退款流程、D-56～D-59 或任何 O 项。

## 三、最终实证

### 主专项：7/7（`gates/aesthetic-check-final.log`）

- 390×844、390×700 零滚：五格完整、被遮 0、中心点可命中 5/5。
- 五个入口均用 CDP 坐标点击：待到店→confirmed、服务中→serving、待评价→history、退款售后→/refunds、全部订单→all。
- 四个预约签均等待目标签激活；退款页等待「退款/售后」锚点。
- `all` 的接口状态桶并集与渲染卡片 ID 集合一致、无重复；当前记录为接口 5、渲染 5、去重 5。

截图：`final-d60-zero-844.png`、`final-d60-zero-700.png`。

### 商家画布：3/3（`gates/canvas-check-final.log`）

- 默认编辑稿：`me.orderrow → me.entries`，与 shared 顺序一致。
- 实际 `saveLayout + publishLayout` 后，`liveLayout` 块序一致。
- 发布后客户端 390×700 零滚五格完整、被遮 0。
- 脚本先断言 `editing === null`，防止把既有 published 误当默认稿；本次测试发布的布局已在验证后清理。

截图：`canvas-final-merchant-default-order.png`、`canvas-final-published-zero-700.png`。

## 四、固定闸门

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 `npm run build` | exit 0 | `gates/build-final.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck-final.log` |
| `smoke-routes` | 119/119 | `gates/smoke-routes-final.log` / `.json` |
| 导航闭环 | 127 路由，死胡同 0，弱 0 | `gates/nav-closure-final.log` / `.json` |
| `e2e-nav-check` | 全部通过 | `gates/e2e-nav-check-final.log` |
| `smoke-deploy`（仅本地 Mock） | 全部通过 | `gates/smoke-deploy-final.log` |
| 商家 CanvasPortBody lint | exit 0（空日志） | `gates/merchant-lint-canvas-final.log` |
| AppointmentsPage／copy lint | exit 0（空日志） | `gates/customer-lint-appointments-final.log` |

`gates/customer-lint-final.log` 仍只有 `MePage.tsx` 续费倒计时处的既有 `Date.now()` 纯度错误，该段不在本批 diff，未借 D-60 扩改。

独立评审的两项 Important（商家默认稿旧序、证据不足）均已销项；后续又补默认稿环境污染防护与 `liveLayout` 断言。评审结论为可开 PR（仅开不合）。

## 五、复跑

```bash
EVIDENCE_PREFIX=final node scripts/aesthetic-fix-d60-check.mjs
CANVAS_PUBLISH=1 EVIDENCE_PREFIX=canvas-final node scripts/aesthetic-fix-d60-canvas-check.mjs
```

本卷宗是施工方自报证据，不替代产品侧后续八步与 Argus／林晓窄回归。
