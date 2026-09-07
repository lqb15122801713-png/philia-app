# B2-2 复现记录：客户端「已完成」Tab 混入已取消单（走查 W-8）

## 复现步骤

1. 启动 server(7200) 与 customer(7100)。
2. 造数（脚本 `setup-data.mjs` + `setup-b.mjs`，输出见 `setup-output.txt` / `setup-b-output.txt`）：
   - 单 A `01M1WZ4AGPAHCGNGH86BSJ07PB`：明天 13:00 洗护，走完整状态机（confirm → assign → checkin → 六步）→ `completed`。
   - 单 B `01M1WZ7NJ94RBDRJ3C5PGZSXR5`：明天 14:00 洗护，创建后客户取消（>4h 直接 `cancelled`，outcome=cancelled）。
   - 另有 1 单 pending（B2-1 验收单 `01M1WYH9QB9Z5PPH6N1S7FZMFM`）。
   - 服务端 `appointment.listMine` 分组（`data.json`）：completed=1、cancelled=1、pending=1 —— **服务端分组本身是对的**。
3. Edge CDP 以客户账号登录（dev-seed-users 动态取 id + dev-login），打开 `/appointments`，逐 Tab 点击记录计数与卡片徽标（`shots.mjs`，输出 `before-tabs.json` / `shots-before-output.txt`，截图 `before-tab-已完成.png`）。

## 现象（修复前）

- 页面只有 4 个 Tab：「待确认1 / 已确认 / 服务中 / 已完成2」，**没有「已取消」Tab**。
- 「已完成」Tab 计数 = 2，列表混入单 B：卡片徽标为「已取消」却出现在「已完成」Tab（`before-tab-已完成.png`）。
- 即：「已完成」Tab 把 cancelled 单计入计数并展示，与缺陷描述一致。

## 根因（文件 + 行号）

`apps/customer/src/pages/AppointmentsPage.tsx` 第 32 行：

```ts
{ key: 'history', label: '已完成', statuses: ['completed', 'cancelled'] },
```

「已完成」Tab 的 statuses 显式合并了 `completed + cancelled`；页面计数 `countOf`（第 84 行）与列表 `items`（第 82 行）均按该 statuses 汇总，因此计数与列表同错。TABS 数组（第 28–33 行）中也**不存在「已取消」Tab**，导致 cancelled 单无处正确归属。文件头注释（第 3–4 行）同样写着「已完成(completed + cancelled 合并展示)」。

其余 Tab 过滤：`pending` / `confirmed + cancel_requested` / `in_service + in_boarding`，三者互斥且不与 cancelled 交叉，唯一缺陷点即第 32 行。

## 修复方案（最小集）

仅改 `AppointmentsPage.tsx`：

- 第 32 行「已完成」Tab statuses 改为 `['completed']`；
- TABS 末尾新增 `{ key: 'cancelled', label: '已取消', statuses: ['cancelled'] }`（countOf/items/空态文案均为通用逻辑，自动同口径）；
- 同步更新文件头分组注释。
