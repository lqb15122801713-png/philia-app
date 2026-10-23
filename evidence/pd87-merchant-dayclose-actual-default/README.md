# PD-87 卷宗｜商家端日结 actualInput 默认同步账面（无 FILL 可开闸）

> 基线 `main@8b43e85`（`8b43e85d819898958170d3249a3d8cf6e3f2f3b0`）／对照 DEPLOY `20261023164125`
> 一令一树一分支 · **PR 只开不合** · 不写验收通过 · **零 schema（迁移预分 0128 故意空留**，不占文件；0122–0127＋0117／0119 空留禁撞）
> 只做：推荐 A——账面预览就绪后实点现金默认同步账面；dialog 壳（PD-86 原生 dialog）一行未动；打印／YKNXD2／导出／SW·PWA 不扩

## 更深不更大答卷
谁在压力下点＝店长日结；点错拦＝确认 dialog（未确认不得落日结）；撤＝取消／Esc／遮罩三路径；空初值点不了＝默认同步账面。

## 根因与修法（最小 diff：`DayClosePanels.tsx` +13/−4）

- **根因**（根因短报-产品-1023-PD86）：`actualInput` 初值 `''` → `yuanToFen('')=null` → `actualFen=null` → `canSubmit=false` → 无 FILL 时点 `dayclose-submit` 永不置 `pendingDayClose` → dialog 不挂 → dialogCount=0（敏慧复测-R 签名）。PD-85／86 只改了 modal 挂上之后的壳，开闸前置未动。
- **修法（推荐 A，仅此）**：`DayCloseForm` 的 `actualInput` 改为「`null`=未手输」可空态——未手输时实点框**直显账面现金元串**（账面 `0`→字面 `'0'`；非 0→`fenToYuanInput(book)`，复用 `mall-admin/format.ts` 既有导出），`actualFen` 由显示值推导 → 诚实「实点＝账面」日默认 `canSubmit=true`；placeholder「0.00」不再伪装已填。
- **不冲手输**：一旦手输或清空（`actualInput` 落串）即保持用户值，账面后变不冲；提交成功清零（clearSignal）仍落 `''`＝维持既有「成功后保持空」语义。
- **盲交互斥**：盲交遮罩期不同步不透账面（显示空、实点先行手输）；关盲交即回账面默认（证据 `api-check.json` 盲交条）。

## 证据清单

| 文件 | 内容 |
|---|---|
| `pd87.diff` | 全量 diff（产品码 +13/−4＋本实证脚本） |
| `api-check-red-before-fix.json` | **修前红**（基线 8b43e85 同脚本）：实点框 `''`／钮 disabled／无 FILL 点 `dayclose-submit` → `{"dialog":false}`／5 项红——缺陷复现 |
| `api-check.json` | **修后绿 12/12**（生产保真 build+preview 腿）：默认同步 `'0'` enabled→无 FILL 直点出真 dialog（`layerTag=DIALOG`／`nativeOpenCount=1`／dialogCount 双域=1／遮罩成对）＋三撤零提交＋盲交互斥＋确认才真冻结（calls=1 frozen×1） |
| `equiv-probe.json` | **等价现网腿（交付 HIT）14/14**：server 静态托管同源链（`SERVE_STATIC=1`，`Host: m.localhost`→merchant dist＝:7202 现网同工艺，**非 vite preview**）；实载 js＝`index-ku-VXgnB.js`（len 1676099／sha256 `c36cecfa…2b4a54`＝本窗新构建，合部后即新 tip 包）；无 FILL 全链绿＋三撤＋确认真冻结（临时库） |
| `live-probe.json` | **现网 :7202 活钉腿**：全新档实读＝tip 钉包 **`index-DZBFUYia.js`**（len 1661486／sha256 `2805a72e…e089fe39` 与登记钉档一致）；无 FILL 直点 → 实点框空／钮 disabled／dialogCount=0＝**缺陷在 tip 现网实锤复现**（与敏慧签名一致）；零写（closes 21→21，未点确认） |
| `shots/` | 生产保真腿截图 01–06（默认同步态／开闸 dialog／Esc／遮罩／取消／确认真冻结） |
| `shots-equiv/` | 等价现网腿截图 eq-01–06（同口径，testid 成对可见） |
| `shots-live/` | 现网腿截图 live-01（空框 disabled）／live-02（无 FILL 点后无 dialog） |

## 复跑

```
node --experimental-websocket apps/merchant/scripts/pd87-dayclose-actual-default-shots.mjs
```

## 边界
零 schema／零迁移（0128 故意空留）；dialog 壳／portal／aria 未再动；打印／导出／YKNXD2／SW·PWA 未碰；临时库测完已删；现网零写（仅 dev-login＋无 FILL 点开闸探测，未点确认禁真日结）；夹具 `01M5EQVF` 未碰；未造第二店；USAGE 未查。
