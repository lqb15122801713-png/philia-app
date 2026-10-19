# PD-40／CJ-1018-06 · 全端升档 B7 服务过程时间轴卷宗

- 分支：`feat/design-upgrade-b7-service-timeline`
- 基线：main@`08f0e36b`（`08f0e36bdfd566be78fe7e7f5656a429550fccf2`）
- 模型：已用 K3 MAX
- 权威：Figma `ot5SBoqhKAw2UIZRVFzhel`；五态 `209:2／209:33／209:64／209:95／209:126`；入口 `174:428`；VI `193:2`
- 范围：只销 B7＋C3 入口脸面；未塞 U1／U2～U7／C4–C6／B8／B10；未合并未部署
- 约束：零新依赖、零服务端迁移；未提交预约、未真付真退、未开会员、未真加购结账

## 一、实现

- 复用 `/appointments/:id/live`：内部六步聚合为「已下单→已到店→洗护中→美容造型→待接回→已完成」，不出现旧 8 步。
- 五态齐全：未开始、进行中、展开有图、步骤空态、已完成；按订单与步骤状态切换。
- 预约成功页新增「查看服务过程」入口，默认未开始；不改成功页其他脸面。
- 页内浅浮岛五栏（首页·预约·PHILIA·商城·我的），不改全局 AppDock，不使用爪印或深棕黄爪。
- cream 仅摘要 chip＋active 环，最多 2 处；完成态为 0；副文不小于 12px。
- 真图未齐使用浅色「待换」；展开首屏最多三格并以 +N 表示余量，完整照片仍可打开。
- 保留寄养、SSE、异常通报、评价、联系门店、PhotoViewer 与 apptLive 发布布局。
- 显式 `b7State` 预览强制隔离真实预约缓存并跳过 push.subscribe/SSE；不写真实预约。

## 二、红绿过程

- 初版浏览器检查为 **0/6**：入口缺失，五个预览 URL 均仍显示旧内部六步。
- 首轮独立审查后补修照片回退、预览缓存隔离、真实照片契约、错误态、safe-area、InstallBanner 与画布兼容。
- 最终独立复核：Critical 0、Important 0，Ready=Yes；详见 `review.md`。

## 三、最终实证

`gates/browser-check.log` 与 `shots/browser-results.json` 为 **11/11**：

| 项 | 结果 |
|---|---|
| C3 入口存在、首屏可见并落 `/appointments/:id/live` | 通过 |
| 未开始／进行中／展开／步骤空态／已完成 | 五态结构、六节点、cream、五栏、小字扫描均通过 |
| 34px safe-area 完成报告 CTA | `ctaBottom=736 < dockTop=740`，无重叠 |
| beforeinstallprompt | live 不叠加安装条 |
| 当前步展开／收起 | 通过 |
| 空态「稍后再看」 | 通过 |

截图：`shots/b7-not-started.png`、`b7-in-progress.png`、`b7-expanded.png`、`b7-step-empty.png`、`b7-completed.png`、`b7-completed-safe-area.png`、`b7-success-entry.png`，均为 390×844。

## 四、固定闸门

| 闸门 | 结果 | 证据 |
|---|---|---|
| 三端 `npm run build` | exit 0 | `gates/build-all.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck.log` |
| 模型／预览／UI／页面测试 | **27/27** | `gates/unit-tests.log` |
| 浏览器专项 | **11/11** | `gates/browser-check.log` / `shots/browser-results.json` |
| 导航闭环 | **127 路由，死胡同 0，弱 0** | `gates/nav-closure.log` / `gates/nav-results.json` |
| B7 定向 ESLint | exit 0 | `gates/customer-lint-b7.log` |

全量客户端 lint 另有仓库既有 78 项问题，记录于 `gates/customer-lint.log`。其中本片文件仅 `AppointmentLivePage.tsx` 原有 `setSseDown` effect 一项；本片未借题改写。定向 lint 仅关闭该既有规则，其余规则均启用并通过。

交易型 e2e／smoke-deploy 未执行，遵守本片不提交预约、不真付真退、不开会员的限制。

## 五、复跑

```bash
node --test scripts/b7-service-timeline-model.test.mjs scripts/b7-service-timeline-preview.test.mjs
TSX_TSCONFIG_PATH=apps/customer/tsconfig.app.json node server/node_modules/tsx/dist/cli.mjs --test scripts/b7-service-timeline-ui.test.tsx scripts/b7-service-timeline-page.test.tsx
node scripts/b7-service-timeline-check.mjs
```

浏览器专项默认客户端 `127.0.0.1:7110`、API `127.0.0.1:7210`，可用 `CUSTOMER_URL`／`API_BASE` 覆盖。预览均为只读合成夹具，不创建真实预约。

本卷宗是施工方自报证据，不替代产品侧后续复核。
