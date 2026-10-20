# PD42 / CJ-1018-08 · U3 我的码卷宗

- 日期：2026-10-19（Asia/Shanghai）
- 分支：`feat/design-upgrade-u3-mine`
- 基线：main@`08f0e36b`（`08f0e36bdfd566be78fe7e7f5656a429550fccf2`）
- 权威对照：Figma `ot5SBoqhKAw2UIZRVFzhel`；我的 `189:104`；会员码 `174:608`；VI `193:2`
- 状态：交付待产品 ROG；未合并、未部署

## 实施面

- `/me`：深色顶码卡、会员码 pill、真实动态 token 条码、回馈金／券／毛孩子三格、四入口与五列表；头像缺失为浅色首字占位，查询未决或失败显示 `—／待换`。
- `/me/card`：深底全屏、关闭钮、白卡内真实 QR 与同一原始 token 的 Code 128B；隐藏人工码和条码复制反馈保留给无障碍与收银核验兜底；390×844 单屏无额外滚动。
- 回馈金展示名统一为「回馈金」族，首列入口为「回馈金明细」。
- 未改会员签发／核验、账本、支付、预约提交、开会员链路；未引用 CLEAN `174:476`／`175:38` 或 `209:*`。

## 实尺证据

| 屏 | 尺寸 | 文件 |
|---|---:|---|
| 我的 | 390×900 | `shots/me-390x900.png` |
| 会员码 | 390×844 | `shots/member-card-390x844.png` |

逐项 DOM 结果：`results-me.json`、`results-card.json`；汇总与命令退出码：`results.json`。

## 本地实证口径

- 测试库：对既有本地库做 `VACUUM INTO` 快照后选已 active 会员；脚本不调用 `membership.openFree`。
- 端口：customer `7173`、API `7243`、CDP `9253`；`CORS_ORIGINS` 仅本地 U3 origin。
- 条码复制断言使用 CDP 坐标级真实点击，避免无用户手势导致 Clipboard 按浏览器规则拒绝。

## 闸门记录

| 命令 | 结果 |
|---|---|
| `npm run build` | exit 0 |
| changed-files ESLint | exit 0 |
| `node scripts/design-upgrade-u3-mine-check.mjs me` | 5/5 PASS |
| `node scripts/design-upgrade-u3-mine-check.mjs card` | 10/10 PASS |
| `me-page-e2e.mjs`（U3 端口） | 15/15 PASS，含设置页退出流 |
| `cd server && npm run typecheck` | exit 0 |
| `npm run lint -w @philia/customer` | exit 1；基线 73 errors / 4 warnings，报告路径不在本 diff |
| `cd server && E2E_PORT=7293 npm run test:e2e` | exit 1；7 项既有数据口径失败（56.1×2、57.1、74.11、76.3、77.2、98.2），server 文件不在本 diff |

## 边界

- 客底栏仍属 U0／U1 另片，本片未改 dock。
- Figma 中示例头像、券数与宠物数为示意；实现读取真实端口／查询，不写死示例值。
- 会员码条码为同一动态 token 的真实 Code 128B 编码；QR 为同一动态 token 的真实 data URL。
