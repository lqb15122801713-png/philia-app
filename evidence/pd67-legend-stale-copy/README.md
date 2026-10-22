# PD-67 · 客端时段旧图例串残留清理

- 基线：`fd99fb921b871c74b6fc1fc699dce805148672fa`
- 分支：`feat/pd67-legend-stale-copy`
- 范围：旧预约向导／改期共用 `SlotPicker` 的残留图例；不涉及 PD-68／PD-69、跨店造种或数据迁移。
- 迁移：未改 drizzle／`_journal.json`，未消耗独占号 0108。

## 根因与最小修复

PD-64 已更新新单屏 `TimeGridBlock` 的图例，但旧向导与改期共用的 `SlotPicker` 仍渲染上一版长文案，导致构建产物同时存在两种口径。

本分支仅删除 `SlotPicker.tsx` 中残留的一个 `<p>` 行；现行短图例仍只由 `TimeGridBlock.tsx` 渲染。生产代码 diff 为 1 行删除。

## 可检索断言（RED → GREEN）

新增 `apps/customer/src/components/booking/legendCopy.test.ts`，用 `renderToStaticMarkup` 实际渲染旧向导与新单屏组件，断言：

1. 旧长图例出现 0 次；
2. 现行短图例合计恰好 1 次。

测试中的两段文案分开组装，避免测试文件自身成为精确字符串检索残留。

RED（修复前，按预期失败）：

```sh
node server/node_modules/tsx/dist/cli.mjs --tsconfig apps/customer/tsconfig.app.json --test apps/customer/src/components/booking/legendCopy.test.ts
```

结果为 `true !== false`，失败信息为「旧向导不得渲染残留旧图例」。

GREEN（修复后，同一命令）：1 个测试通过，0 失败。

全量既有测试与新增测试（同一 tsx runner 下 8 个测试文件）：**32 个测试通过，0 失败**。

## 构建与精确检索

- `npm run build:customer`：TypeScript 与 Vite/PWA 构建成功；产物为 `apps/customer/dist`。
- `apps/customer/src`：旧长图例 0 次；现行短图例 1 次，位于 `single/TimeGridBlock.tsx`。
- `apps/customer/dist`：旧长图例 0 次；现行短图例 1 次，位于 `assets/index-B8hCKDI1.js`。
- `git diff --check`：通过。
- 新增测试单文件 ESLint：通过。

## 基线限制与安装备注

- `npm run lint -w @philia/customer` 仍报告全仓既存的 64 errors／4 warnings；其中 `SlotPicker` 的报告位于本次未触碰的 `Date.now` 与 effect 行。本令不扩修这些项；新增测试单文件 lint 已通过。
- 根 `npm ci` 的依赖下载完成，但既有 Windows `postinstall` 调用失败；随后按 server 独立锁文件执行 `npm --prefix server ci --no-audit --no-fund` 完成自测依赖安装。未改安装脚本或任何锁文件。
