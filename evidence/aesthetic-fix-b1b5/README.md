# PD-27／CJ-1016-01 · 拟人审美修调 B1–B5 卷宗

- 分支：`feat/aesthetic-fix-b1b5`
- 基线：`81066d19631da6ba4f46a79e898941c9a9267155`
- 范围：D-56／D-57 → D-58 → D-59（含 O6）→ D-60；未扩其他 O 项
- 模型：已用 K3 MAX
- 约束：零新依赖、零迁移；未触真实支付／真实退款通道；A 窗未合并未部署

## 一、缺陷与处理对照

| 项 | 根因与处理 | 最终实证 |
|---|---|---|
| D-56 | 主 CTA 原本只滚动到条目列；改为 `/philia/magazine/lead` 真实阅读页 | `final-d56-magazine-lead.png`；路径与篇题／正文断言通过 |
| D-57 | 次卡原本是无链展示卡；两张次卡分别进入 `02`／`03` 正文，未知 slug 有说明与返回出口 | `final-d57-magazine-entry.png`、`final-d57-magazine-entry-03.png`、`final-d57-magazine-missing.png` |
| D-58 | snap 横轨首渲染停在末卡；数据到位后在绘制前归零，人员顺序与选择态不变 | 基线 `scrollLeft=350`，最终 `0→0`；小美 `x=16`，首屏可见小美／阿强／丽丽 |
| D-59 | 确认栏使用全透明渐变衬底；改为不透明 `canvas` | 基线 `rgba(0,0,0,0)`，最终 `rgb(250,247,240)`；见 `final-d59-confirm-bar.png` |
| D-59／O6 | 时段区向视口末端对齐时缺少 fixed 确认栏安全边距；增加 `scroll-mb-40` | 基线 6 格被压，最终 22 个完整视口时段被压数 0、可点数 22；见 `final-d59-time-grid.png` |
| D-60 | 当前基线在 390×844 下未复现订单五格被 dock 遮挡；未伪造生产改动 | 微滚与聚焦自动滚动两条路径均为五格完整／无遮／可点 5/5；见 `final-d60-me-orderrow.png`、`final-d60-me-orderrow-focus.png` |

D-60 差异报备产品侧：本仓指定基线的初始屏、微滚、键盘聚焦路径均满足令围，故未增加无效 padding／z-index。若产品侧另有设备尺寸、数据或发布布局，请以其复现参数再裁；本批不擅自改需求。

## 二、红—绿证据

- 杂志基线：`before-results.json`、`before-d56-magazine-lead.png`、`before-d57-magazine-entry.png`，两次点击均 `/philia → /philia`。
- 布局基线：`before-layout-v2-results.json`、`before-layout-v2-*.png`，D-58、D-59、O6 均按预期变红。
- copy 动态覆盖：`gates/magazine-copy-check-before.log` 先证明模块级求值读到旧默认；修复后 `gates/magazine-copy-check.log` 通过。
- 最终：`final-results.json`、`gates/aesthetic-check-final.log`，9/9 通过；非法 scope 拒跑见 `gates/aesthetic-check-invalid-scope.log`。
- 独立评审：发现 copy 覆盖值模块级冻结问题后已销项；复核无 Critical／Important，可开 PR（仅开不合）。

## 三、最终闸门

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 `npm run build` | exit 0 | `gates/build-final.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck-final.log` |
| PD-27 专项（生产 preview） | 9/9 | `gates/aesthetic-check-final.log` |
| 杂志 copy 动态覆盖 | 1/1 | `gates/magazine-copy-check.log` |
| `smoke-routes` | 119/119 | `gates/smoke-routes-final.log` / `.json` |
| 导航闭环 | 127 路由，死胡同 0，弱 0 | `gates/nav-closure-final.log` / `.json` |
| `e2e-nav-check` | 全部通过 | `gates/e2e-nav-check-final.log` |
| `smoke-deploy`（仅本地 Mock） | 全部通过 | `gates/smoke-deploy.log` |
| 本批生产源码 ESLint | exit 0 | `gates/customer-lint-source-final.log`（空日志） |
| diff 红线扫描 | 无 whitespace 错；新增行无 `#FFAAA5`／`text-white`／渐变 | `gates/diff-scan.log` |

回归覆盖：登录、首页、商城结算表面、会员码、回馈金账本均在路由冒烟范围；预约交互与返回状态由导航 e2e 覆盖。所有支付／退款相关冒烟仅使用本地 Mock 数据与通道。

## 四、未触文件的既存问题（不记为本批绿，也不扩批清理）

1. `gates/customer-lint.log`：客户端全量 lint 为 78 problems（74 errors、4 warnings），均位于未触文件；本批生产源码单独 lint exit 0。`apps/customer/scripts/magazine-copy-check.mts` 被现有 ESLint 配置忽略，警告见 `gates/customer-lint-changed.log`，未声称该脚本已受 lint 检查。
2. `gates/server-e2e.log`：服务端全链路 e2e 有 6 条既存断言漂移：copy 种子 `4300` 对旧预期 `4279`（4 条）、槽位 `10` 对旧预期 `6`（1 条）、`wnav.dockMe=我的` 对旧预期“设置”（1 条）。本批未改服务端或这些断言。
3. 构建仍有既有 chunk 大小与第三方注释警告；构建命令 exit 0。

## 五、复跑

```bash
# 390×844、零依赖 CDP、全新浏览器配置；默认 127.0.0.1:7130/7200
CHECK_SCOPE=all EVIDENCE_PREFIX=final node scripts/aesthetic-fix-b1b5-check.mjs

# copy 覆盖层时序
node server/node_modules/tsx/dist/cli.mjs apps/customer/scripts/magazine-copy-check.mts
```

本卷宗是施工方自报证据，不替代产品侧后续八步与 Argus／林晓窄回归。
