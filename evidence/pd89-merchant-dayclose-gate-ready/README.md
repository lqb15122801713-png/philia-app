# PD-89 · 商家端日结开闸就绪闸 · 卷宗

> 窗名 `PD-89-merchant-dayclose-gate-ready` · 基线 `main@7a273b3`（全 `7a273b3c825646cdd40f58bfe4d153d1072f52f7` · DEPLOY `20261023204431`）
> 施工交付，非验收结论 · 不写验收通过 · 迁移 **0130 故意空留**（零 schema，不占文件）

## 根因（HIT≠复测差分）

PD-88 零产品代码 → 现网 tip 包仍 `index-CN4nyHT8.js`。产品面竞态未修：
账面预览（`store.todayTenderStats`）未就绪 → `tender=undefined → book=null → actualShown='' → canSubmit=false`
→ `dayclose-submit` disabled、点击不置 `pendingDayClose` → `dialogCount=0`（静默无 modal）。
PD-88 HIT 绿＝脚本先等账面同步再点绕开竞态；敏慧复测-R 无 FILL 直点首点 `actual=""→dialogCount=0`
（`DAYCLOSE_INLINE_GATE_NO_MODAL`），Esc 因 `REOPEN_FAIL_before_esc` 未按（非 Esc 结论）。

## 最小产品修（本批唯一产品 diff）

`apps/merchant/src/pages/CashierClosePage.tsx`：**开闸就绪闸**——账面预览 `isPending` 期间
不挂 `DayCloseForm`（骨架面板 `dayclose-form-loading` 占位；`dayclose-submit` 不挂＝点击无处落、
零副作用、竞态结构性消除）；表单一出现即账面已齐（`actualInput=null`→实点默认同步账面→
`canSubmit=true`），无 FILL 直点必出原生确认 dialog；abort 仅 `setPendingDayClose(null)`，
tender 已缓存不回退，同页再点必重开（产品态保证，不靠测脚本 wait）。
查询失败／restricted 回落既有表单（手输路径保留）；Esc 双路（原生 cancel＋window keydown
兜底）、遮罩／取消主交互、portal 壳一行未动。`DayClosePanels.tsx` 仅头注记（契约不变）。

## 证据清单

| 文件 | 内容 |
|---|---|
| `live-probe.json` | 现网 :7202 活钉腿：包=`index-CN4nyHT8.js`（len 1661530 · sha256 `1b427104…0901ede`，curl 实读＝登记钉档一致）；竞态窗（1500ms 延迟仿真）直点 `actual=""`／disabled → `dialogCount=0`（NO_MODAL 实锤复现）；对照就绪后同包出 dialog＋取消关；closes 21→21 零写 |
| `equiv-probe.json` | 等价现网腿（SERVE_STATIC=1 · Host `m.localhost`→merchant dist · 非 vite preview）：新包 `index-B2Y5Z7e4.js`（len 1677008 · sha256 `4823ff0f…b1d1e365` ≠ CN4nyHT8）；Fetch 拦阻钉死未就绪→骨架在场＋submit 不挂＋dialogCount=0；就绪首绘 `actual="0"`＋enabled；无 FILL 短等 150ms 直点→真 dialog 双域≥1；取消/可信 Esc/合成 Esc/遮罩四撤 acted+closed＋每撤后同页即点重开 dialogCount≥1；dayClose 调用=0（realDayCloseSubmit=false） |
| `shots-live/`（2 png） | 现网：竞态直点无 modal／就绪后出 dialog |
| `shots-equiv/`（11 png） | 等价现网：骨架闸／首绘就绪／无 FILL 开闸／四撤＋四重开 |
| `pd89.diff` | 产品 diff 全文（2 文件 +46/−13 含注释；脚本与卷宗另列） |

随包实证脚本（可复跑）：`apps/merchant/scripts/pd89-dayclose-gate-ready-live.mjs`（现网腿）／
`pd89-dayclose-gate-ready-equiv.mjs`（等价现网腿）。

## 静态与回归

- `npm run build:merchant`（tsc -b && vite build）通过；dist 商家 `index-B2Y5Z7e4.js`。
- 商家既有测试 `npx tsx --test`：10/10 通过。
- 定向 eslint：两产品文件仅 2 条基线既有 `react-hooks/set-state-in-effect`（零新增）；两新脚本 0 问题。

## 禁区自清

未合／未部；未直改库（临时 sqlite 随探针删除，`.runtime` 已清）；夹具 `01M5EQVF` 未碰；
未跨店造种（仅临时库店长夹具随库自删）；未进 `/console`；未抢前台／动双屏；USAGE 未查；
打印／YKNXD2／导出／SW·PWA 未扩；muts 仅 `POST /api/auth/dev-login`（口令门）；
测试子进程全收、端口（7489/9489/9589）已释放。
