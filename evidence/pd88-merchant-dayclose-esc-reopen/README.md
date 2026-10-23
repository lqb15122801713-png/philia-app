# PD-88 · 商家端日结 Esc 成对关闸＋abort 后重开闸

> 窗名 `PD-88-merchant-dayclose-esc-reopen` · 施工 HIT 卷宗，非验收结论
> WORKTREE `E:\KIMI code\pd88-merchant-dayclose-esc-reopen`
> BRANCH `feat/pd88-merchant-dayclose-esc-reopen`
> 基线 `main@6f9f9a3f042d7030b841c2f62a200afd4234f810` · DEPLOY `20261023181857`

## 更深不更大

- **谁在压力下点**：店长在日结确认层承压操作。
- **点错拦**：无 FILL 直点 `dayclose-submit` 后，原生 `dialog[open][data-testid=dayclose-confirm-layer]` 与确认／取消成对出现。
- **撤**：取消、可信 Esc、合成 Escape、遮罩均实际执行并关闭；可信／合成 Esc 不放宽为二选一。每次撤销后重开均 `dialogCount=1`，零真日结。

## 根因与最小改动

有效 RED 复现与 PD-87 短报同签名：首开及 cancel 成功；重开时账面未齐，`actualValue=""`、`submitDisabled=true`，点击后 `dialogCount=0`；Esc 因 `no-modal-reopen-fail` 被跳过，`escPressed=false`。因此不是缺 Esc 监听，也不是要重做 dialog 壳。

产品代码在基线已有 `dialog.onCancel`＋`window keydown Escape→onClose` 双路，以及账面未就绪时提交钮 disabled。**本窗产品代码零改动**；只把回归验径收紧为每次 abort 后在**同一页面（不 reload）**等待默认同步／`canSubmit=true`，再可信点击，并保留全部严格断言与现网实跑。未改 portal／native 壳、取消钮或遮罩主逻辑。

- RED：`live-probe-red-before-fix.json`、`shots-live-red/`
- GREEN：`live-probe.json`、`shots-live/`
- 回归脚本：`apps/merchant/scripts/pd88-dayclose-esc-reopen-live.mjs`

## 现网 HIT（GREEN）

现网：`http://120.53.102.45:7202`；角色：演示店长 `merchant_manager`（敏慧店长走测人设）；视口 1280×800；全新浏览器档。

| 原缺陷／门槛 | 现网证据 | 状态 |
|---|---|---|
| 商家包须为同源 tip | JS `index-CN4nyHT8.js`；len `1661530`；sha256 `1b427104769c7e6eb1afa15a105649445bb38cdcfef77957b85191b390901ede`；`isTipBundle=true` | 施工 HIT 通过 |
| 无 FILL 首开 | `noFill=true`；实点默认值 `0` 未手改；`submitDisabled=false`；`dialogCount=1`／`rootDialogCount=1`／`nativeOpenCount=1`／`hasModalPair=true` | 施工 HIT 通过 |
| cancel 撤销＋重开 | `acted=true`／`closed=true`／`afterDialogCount=0`／`pendingDayCloseNull=true`；`reopenDialogCount=1` | 施工 HIT 通过 |
| 可信 Esc 撤销＋重开 | `escPressed=true`／`acted=true`／`closed=true`／`afterDialogCount=0`；`reopenDialogCount=1` | 施工 HIT 通过 |
| 合成 Escape 撤销＋重开 | `escPressed=true`／`acted=true`／`closed=true`／`afterDialogCount=0`；`reopenDialogCount=1` | 施工 HIT 通过 |
| 遮罩撤销＋重开 | `acted=true`／`closed=true`／`afterDialogCount=0`／`pendingDayCloseNull=true`；`reopenDialogCount=1` | 施工 HIT 通过 |
| 禁止 reopen 假阴挡 Esc | `abortAllThree=true`／`escBoth=true`／`noReopenFail=true`；四路均实际执行，无 skip | 施工 HIT 通过 |
| 零真提交 | `realDayCloseSubmit=false`；`blockedDayCloseCalls=0`；CDP `Network.requestWillBeSent` 实测 `observedDayCloseRequests=0`／`realDayCloseRequests=[]`；日结单计数 `21→21`；无成功 toast | 施工 HIT 通过 |

GREEN 运行清单：`reopenMode=same-page-no-reload`；每次重开均有独立截图；`cleanup.profileRemoved=true`／`cleanup.errors=[]`。运行 JSON 同时钉 `startedAt`、脚本 sha256 与 HEAD。

桌面内置浏览器独立抽查同一现网包：无 FILL 开闸 → 可信 Esc 后确认层消失 → 同页再点重新出现 → 取消关闭；未点确认。

本窗无产品代码或构建输入变化，PR 仅新增回归脚本与卷宗，因此上述现网 tip 包就是本令行为验证包；不以 localhost preview 充当 PASS。

## 静态与回归验证

| 命令 | 结果 |
|---|---|
| `node --check scripts/pd88-dayclose-esc-reopen-live.mjs` | 通过 |
| `npx eslint scripts/pd88-dayclose-esc-reopen-live.mjs`（cwd `apps/merchant`） | 通过，0 问题 |
| `node ../../server/node_modules/tsx/dist/cli.mjs --test src/pages/appointmentDetail.utils.test.ts src/components/mall-admin/format.test.ts src/components/dashboard/utils.test.ts src/components/cashier/model.test.ts`（cwd `apps/merchant`） | 10/10 通过 |
| `npm run build:merchant` | `tsc -b && vite build` 通过；1957 modules |
| `PD88_GATE_CODE=... node --experimental-websocket apps/merchant/scripts/pd88-dayclose-esc-reopen-live.mjs` | 现网 GREEN，口令不写卷宗 |

全量 `npm run lint -w @philia/merchant` 在未改基线上已有 **47 errors／5 warnings**（含 `MonitorTimeline.tsx`、`RescheduleSheet.tsx`、`DayClosePanels.tsx:272` 等既有项）；本令不扩修。新增脚本定向 lint 为 0 问题。

## 迁移与禁区

- 零 schema、零迁移文件：**0129 故意空留**。
- 未占 `0122–0128`＋`0117`／`0119`，未撞其他已占用号。
- 写类仅 `POST /api/auth/dev-login`；不点日结确认，脚本安全闸阻断 `cashier.dayClose` 写请求。
- 未进 `/console`；未碰夹具 `01M5EQVF`；未跨店造种；未查 USAGE。
- 未扩打印／YKNXD2／导出／SW·PWA；未整销 PD-85／86／87。
- 未合、未部、未直改库；未创建临时业务库。CDP 浏览器及 profile、桌面内置浏览器页签均已清理。

— A窗 KimiCode · 施工卷宗（不写验收通过）
