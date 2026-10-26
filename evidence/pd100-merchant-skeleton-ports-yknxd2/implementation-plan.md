# PD-100 Merchant Skeleton, Ports & YKNXD2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在商家端监控、展示素材、界面文案与商城订单中消除整页灰骨架、旧读口脚注和弱禁点视觉，同时保持死单与钱相关功能闸关闭。

**Architecture:** 新增一个只负责可读等待状态的小组件，四个页面复用；监控按已到达数据渲染而非任一查询等待就遮整页。订单与矩阵继续使用现有 copy 访问器，但以新语义键避开生产旧覆盖；不新增 API、数据库字段或写路径。

**Tech Stack:** React 18、TypeScript、TanStack Query、Tailwind、Vite、既有 `node:test + tsx`、`react-dom/server`（无新依赖）。

**Spec:** 本用户 PD-100 过审施工令；`D:\Philia-shared\盲测审美_全端大测_R36_商家端_2026-10-26.md`；`D:\Philia-shared\入池摘录-产品-1026-盲测商R36.md`；`D:\Philia-shared\攒批短报-产品-1026-审美优先-tip42bb0f6.md`。

## Global Constraints

- WT 固定 `E:\KIMI code\pd100-merchant-skeleton-ports-yknxd2`；分支固定 `feat/pd100-merchant-skeleton-ports-yknxd2`；基线固定 `42bb0f67945fe774f2c22d098fed185a0a0929a5`。
- 原 PD-102 并入本窗／同 mig0141／同 PR；**0141 故意空留**；不占 0117／0119／0122–0140／0142／0143／0144，不改 schema 或 journal。
- 候选商 dist 必须同时 ≠ 现网 `index-sf4Mp8sz.js` 与本地基线 `index-Bh5WsuOY.js`；本地预览不冒称现网 PASS。
- 不碰驾舱待收款 78、日结 PARTIAL、关店／发货功能闸、死单功能闸、客端、员端、`01M5EQVF`、跨店或第三店造种；涉钱只 mock。
- 不用 REUSE、换 tip、`hits:[]`、`reuseInodes=0`、邻帧字面维持冒充本债收敛。
- 基线全量 lint 已红 `47 errors / 5 warnings`；不扩修越界错误，候选须无新增问题并如实标全量 lint INC。PR 只开不合，禁部署。

## Review Focus

1. 部分查询已返回、另一查询久等：已到达卡片必须仍可见（Task 1 的监控 SSR 测试）。
2. 首屏全部等待：店主须读到真实等待状态而非灰色假内容（Task 1 的四页 SSR 测试）。
3. 生产旧 copy override 仍含「读口待补／文案端口」：新渲染不得让旧文案复活（Task 2／3 的覆盖注入测试）。
4. 死单原生 disabled 不得被重开：禁点无 `onClick`、无链接箭头、无 `opacity-35` 弱态（Task 2 的 OrderRow SSR 测试）。
5. 空数组与错误响应不得伪成有数据：保留现有诚实空态与错误重试分支（Task 1 测试及 Task 4 浏览器走测）。

## Design Direction

- 色板沿用现有 tokens：canvas `#FAF7F0`、card `#FFFFFF`、sunken `#F3EEE4`、ink `#2C2822`、secondary `#A89779`、brand cream `#F2DC8C`；不新增品牌色或渐变。
- 字体沿用 `font-serif-cn` 页题与现有 sans 正文／`font-number` 数字；不引入字体、全大写 eyebrow 或装饰性编号。
- 布局：保留商家现有窄页头与卡面。等待态为一张有标题、说明与重试的纸面状态卡；部分等待为一条紧凑状态注，已到达内容紧随其下。死单动作留在原列，但去掉 `›`、透明淡化与可点貌。
- 审查：此方案刻意不做新仪表盘、KPI 或卡片墙，避免通用 SaaS 模板感与功能堆叠；只恢复信息明确性和操作安全感。

---

### Task 1: Readable Loading & Partial Monitor Content

**Files:**
- Create: `apps/merchant/src/components/ContentStatus.tsx`
- Create: `apps/merchant/src/pages/pd100Presentation.test.tsx`
- Modify: `apps/merchant/src/pages/MonitorHubPage.tsx`
- Modify: `apps/merchant/src/pages/SlotPortPage.tsx`
- Modify: `apps/merchant/src/pages/CopyConfigPage.tsx`
- Modify: `apps/merchant/src/pages/OrdersPage.tsx`

**Interfaces:**
- Produces: `LoadingPanel({ title, body, onRetry?, testid })` 与 `LoadingNotice({ children, testid })`，只表达等待，不伪造数据。
- Consumes: 现有 `useQuery` 状态、现有 `QuietButton`、现有 copy 访问器与 Philia providers。

- [ ] **Step 1: 写监控部分到达与四页等待的失败 SSR 测试**

使用真实 `MonitorHubPage`、`SlotPortBody`、`CopyConfigBody`、`OrdersPage`，以 `QueryClientProvider + PhiliaClientContext + MerchantEventsProvider + MemoryRouter` 渲染。监控仅预填 `in_service` 与 `stayBoard`，让 `in_boarding` 保持 pending；核心断言：

```tsx
assert.match(monitorHtml, /data-testid="monitor-card-pd100-live"/);
assert.doesNotMatch(monitorHtml, /animate-pulse/);
assert.match(slotHtml, /正在读取展示素材/);
assert.match(copyHtml, /正在读取界面文案/);
assert.match(ordersHtml, /正在读取商城订单/);
```

- [ ] **Step 2: 运行并确认 RED**

Run: `node ../../server/node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.app.json --test src/pages/pd100Presentation.test.tsx`（cwd `apps/merchant`）。
Expected: 监控无已到达卡片、四页无新可读状态而 FAIL；若测试语法错误则先修测试直至按预期失败。

- [ ] **Step 3: 最小实现等待件与页面接线**

`LoadingPanel` 输出 `role="status"`、`aria-busy="true"`、真实标题／说明和可选重试；四页删除对应 `Skeleton` 用法。监控把分支改为：错误优先；有已到达内容时保留卡片并在顶部显示 `LoadingNotice`；全部等待且无内容时显示 `LoadingPanel`；全部返回且为空时保留现有诚实空态。

- [ ] **Step 4: 运行并确认 GREEN**

Run 同 Step 2；Expected: 新增相关测试 PASS，既有四组商家测试保持 10/10。

- [ ] **Step 5: 提交此独立切片**

```bash
git add apps/merchant/src/components/ContentStatus.tsx apps/merchant/src/pages/pd100Presentation.test.tsx apps/merchant/src/pages/MonitorHubPage.tsx apps/merchant/src/pages/SlotPortPage.tsx apps/merchant/src/pages/CopyConfigPage.tsx apps/merchant/src/pages/OrdersPage.tsx evidence/pd100-merchant-skeleton-ports-yknxd2
 git commit -m "fix(merchant): replace skeleton-only loading states"
```

### Task 2: YKNXD2 Dedicated Read-Only Presentation

**Files:**
- Modify: `apps/merchant/src/components/mall-admin/OrderCard.tsx`
- Modify: `apps/merchant/src/pages/OrdersPage.tsx`
- Modify: `apps/merchant/src/pages/pd100Presentation.test.tsx`

**Interfaces:**
- Consumes: 既有 `isDeadOrderReadOnly(order)` 与 `readOnly`；不改函数签名、订单队列或发货／退款端点。

- [ ] **Step 1: 写死单与旧覆盖脚注的失败测试**

```tsx
setCopyOverrides([{ key: 'order.rebatePendingNote', text: '回馈金列读口待补' }]);
assert.doesNotMatch(ordersHtml, /orders-rebate-note|读口待补/);
assert.doesNotMatch(deadRowHtml, /发货 ›|退款 ›|disabled:opacity-35/);
assert.match(deadRowHtml, /disabled:opacity-100/);
assert.match(deadRowHtml, /disabled=""|disabled=/);
```

- [ ] **Step 2: 运行并确认 RED**

Run 同 Task 1 Step 2；Expected: 旧脚注、链接箭头与 `opacity-35` 使命中而 FAIL。

- [ ] **Step 3: 最小实现**

从 `OrdersPage` 删除无条件旧回馈金脚注；`OrderRow` 仅在 `readOnly` 分支把两个原生 disabled 按钮改为不透明、灰底虚线边、删除线和无箭头样式，不加 `onClick`，不改其他订单分支。

- [ ] **Step 4: 运行并确认 GREEN**

Run 同 Task 1 Step 2；Expected: 专项与既有死单测试 PASS，正常订单发货入口测试／构建不回归。

- [ ] **Step 5: 提交此独立切片**

```bash
git add apps/merchant/src/components/mall-admin/OrderCard.tsx apps/merchant/src/pages/OrdersPage.tsx apps/merchant/src/pages/pd100Presentation.test.tsx evidence/pd100-merchant-skeleton-ports-yknxd2
 git commit -m "fix(merchant): clarify dead order read only actions"
```

### Task 3: Human-Facing Port & Matrix Labels

**Files:**
- Modify: `apps/merchant/src/copy/copyPort.ts`
- Modify: `apps/merchant/src/copy/matrix.ts`
- Modify: `apps/merchant/src/pages/SlotPortPage.tsx`
- Modify: `apps/merchant/src/pages/CopyConfigPage.tsx`
- Modify: `apps/merchant/src/pages/MatrixPage.tsx`
- Modify: `apps/merchant/src/pages/pd100Presentation.test.tsx`

**Interfaces:**
- Produces: 新 copy 键 `copyport.managementTitle`、`slotport.managementTitle`、`mtx.colCopyManagement`、`mtx.colSlotManagement`；旧键不删除，避免越界影响目录与其他调用方。

- [ ] **Step 1: 注入旧覆盖并写失败测试**

```tsx
setCopyOverrides([
  { key: 'copyport.pageTitle', text: '文案端口' },
  { key: 'slotport.pageTitle', text: '槽位端口' },
  { key: 'mtx.colCopy', text: '文案端口' },
  { key: 'mtx.colSlots', text: '槽位' },
]);
assert.match(copyPageHtml, />界面文案</);
assert.match(slotPageHtml, />展示素材</);
assert.match(matrixHtml, /界面文案/);
assert.match(matrixHtml, /展示素材/);
assert.doesNotMatch(matrixHtml, /lib\/roles\.ts/);
```

- [ ] **Step 2: 运行并确认 RED**

Run 同 Task 1 Step 2；Expected: 旧键覆盖仍渲染旧标题／列名与源码脚注而 FAIL。

- [ ] **Step 3: 最小实现**

新增四个人话语义键并只在本窗可见标题／矩阵列使用；从 `MatrixPage` 的 `NOTES` 移除 `mtx.noteSource` 渲染，不改权限单元格。无数据库写或迁移。

- [ ] **Step 4: 运行并确认 GREEN**

Run 同 Task 1 Step 2；Expected: 旧覆盖存在时仍显示新人话标签，矩阵不出现 `lib/roles.ts`。

- [ ] **Step 5: 提交此独立切片**

```bash
git add apps/merchant/src/copy/copyPort.ts apps/merchant/src/copy/matrix.ts apps/merchant/src/pages/SlotPortPage.tsx apps/merchant/src/pages/CopyConfigPage.tsx apps/merchant/src/pages/MatrixPage.tsx apps/merchant/src/pages/pd100Presentation.test.tsx evidence/pd100-merchant-skeleton-ports-yknxd2
 git commit -m "fix(merchant): use clear port and matrix labels"
```

### Task 4: Fresh Verification, Negative Control & PR-Only Delivery

**Files:**
- Create/update: `evidence/pd100-merchant-skeleton-ports-yknxd2/*`
- Create: `D:\Philia-shared\回执-A窗-PD100-merchant-skeleton-ports-yknxd2-交付.md`

- [ ] **Step 1: 跑完整原生验证并留日志**

```bash
node ../../server/node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.app.json --test src/pages/pd100Presentation.test.tsx src/pages/appointmentDetail.utils.test.ts src/components/mall-admin/format.test.ts src/components/dashboard/utils.test.ts src/components/cashier/model.test.ts
npm run lint -w @philia/merchant
npm run build:merchant
git diff --check
```

记录退出码、测试数和新 dist；全量 lint 与基线比较，不写全量 lint 绿。对触及文件运行同口径定向 lint，新增文件须 0 error。

- [ ] **Step 2: 用候选真 dist 与隔离 mock 走测**

以 Desktop 内置浏览器访问本窗静态候选与隔离 API mock，采集监控有内容／部分等待、展示素材、界面文案、YKNXD2 专帧、矩阵五组新图与 DOM／禁用状态证据；不写库、不触发发货或退款、不触 `01M5EQVF`。现网只读核对 `index-sf4Mp8sz.js`，不以 localhost 冒称现网 PASS。

- [ ] **Step 3: 关闭前故意见红一次并恢复**

临时把 `LoadingPanel` 标题改回无意义占位或恢复一个灰骨架，运行专项测试确认预期 RED；立即用 `Edit` 恢复原实现，再跑完整专项与既有测试确认 GREEN。保留负控命令输出与恢复后证据，不把故意红藏掉。

- [ ] **Step 4: Web／React／范围终审**

按本次拉取的 Vercel Web Interface Guidelines 审查所有触及文件；检查原生 disabled、可读状态、焦点、无 `transition: all`、无新依赖、无 schema、无他端 diff、无功能闸重开。

- [ ] **Step 5: 提交、推送并只开 PR**

```bash
git status --short
git log --oneline 42bb0f67945fe774f2c22d098fed185a0a0929a5..HEAD
git push -u origin feat/pd100-merchant-skeleton-ports-yknxd2
gh pr create --base main --head feat/pd100-merchant-skeleton-ports-yknxd2 --title "fix(merchant): PD-100 readable monitor ports and dead order states" --body-file evidence/pd100-merchant-skeleton-ports-yknxd2/pr-body.md
```

只开不合；交付回执逐条列原缺陷→新证据→状态、候选／现网 js、四证、未用 REUSE、全量 lint 基线 INC、未跑项与原因。交付 HIT 等产品和异窗监理，不写验收通过。
