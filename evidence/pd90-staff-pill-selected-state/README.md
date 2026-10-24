# 卷宗 · PD-90 员工端排班 pill 选中态（点验件，非验收）

- 窗口：`PD-90-staff-pill-selected-state` ｜ 模型：K3 MAX（pill＝K3 · Max）
- 基线：`main@6eb5bf0`（`6eb5bf0241d5d5ba7249af87d9353a120f01519e`）｜ DEPLOY 对照 `20261023220749`
- 分支：`feat/pd90-staff-pill-selected-state` ｜ WT：`E:\KIMI code\pd90-staff-pill-selected-state`
- 范围：`PILL_NO_STATE／AE-STAFF-R54-01／R54-07`
- 迁移：零 schema、零 migration、未动 journal；**`0131` 故意空留**；`0117／0119／0122–0130` 未占。
- daypill：**未轻挂**。`SchedulePage.tsx` 与 `SkChips` 零改动，不写 AE-STAFF-R54-03 清项。
- AE-04：零触碰；寄养／退出／协议等已盖面零重开。

## 更深不更大

小美切上周／本周／下周，压力是怕看错周漏班；拦＝N/A（导航）；撤＝可再点回本周。改动只把真实周区间与唯一选中 pill 绑定，并用深底反白让选中态可辨，不扩大功能面。

## 根因与最小产品 diff

基线 `MySchedulePage` 的三个周按钮恒为 `sk-btn-ghost`，`weekStart` 只驱动查询和区间正文，没有选中 class 或 ARIA 状态；PD-80 的区间正文变化不构成 pill 选中态。

- `apps/staff/src/pages/MySchedulePage.tsx`：以同一 `thisWeekStart／weekStart` 推导 `prev／this／next` 唯一 `weekChoice`；按钮据此获得 `on` 与 `aria-pressed`，本周回切也复用同一 `thisWeekStart`。上周／下周的相对导航行为不变；超出这三周时不伪造选中 pill。
- `apps/staff/src/styles/skeleton.css`：新增一条 `.sk-btn-ghost.on`，复用既有 `--ink` 深底、米白字与同色描边。
- 产品代码仅 2 文件、10 insertions／5 deletions；另增本卷宗与可复跑像素闸门 `apps/staff/scripts/pd90-week-pill-shots.mjs`。

## 基线复现（RED）

512×844、deviceScaleFactor=1，真实 `/my-schedule` React 页面；仅 mock 只读 tRPC 查询，pill DOM／CSS／点击导航全走产品代码，零 mutation、零数据库、零金额操作。strip 裁片只含三个周按钮，**不含日期区间正文**；每个 pill 另有独立裁片。

`baseline-pixel-report.json`：真实页面与七日卡加载完成，非加载壳；预期缺陷断言失败 16 项，其中：

- 三组 strip 两两 raw-pixel MD5 全为 `ccaf9d79c6044556ced4663941587478`，meanAbs 全为 `0`，changedPixels 全为 `0/10208`。
- 三个 pill 的选中／未选中裁片 MD5 各自相同、meanAbs 全为 `0`；computed background 全为 `rgba(0, 0, 0, 0)`，border 全为 `rgba(44, 40, 34, 0.14)`。
- 五态均无唯一 `on`／`aria-pressed=true`；两次点回本周的区间恢复断言通过。

代表帧：`shots/baseline-this-strip.png`、`shots/baseline-previous-strip.png`、`shots/baseline-next-strip.png`、`shots/baseline-this-pill-this.png`。

## 修复后双像素证据（GREEN）

`fixed-pixel-report.json`：**29/29 断言绿、0 失败**。五态均有且仅有一个正确 `on` 与 `aria-pressed=true`；所有帧 `rangeOutsideStrip=true`，未以 20c／410 正文差或 DOM 文本差充当状态证据。

### strip 整体差分

| 对照 | meanAbs | changedPixels | raw-pixel MD5 | 路径 |
|---|---:|---:|---|---|
| 本周 ↔ 上周 | 101.134404 | 5308/10208 | 不同 | `shots/fixed-this-strip.png` ↔ `shots/fixed-previous-strip.png` |
| 本周 ↔ 下周 | 100.092705 | 5264/10208 | 不同 | `shots/fixed-this-strip.png` ↔ `shots/fixed-next-strip.png` |
| 上周 ↔ 下周 | 108.165197 | 5660/10208 | 不同 | `shots/fixed-previous-strip.png` ↔ `shots/fixed-next-strip.png` |

### 同一 pill 选中／未选中填色、描边差分

选中态 computed `background/border=rgb(44, 40, 34)`；未选中为透明底＋`rgba(44, 40, 34, 0.14)` 描边。下列比较均为同一按钮、同一文字、固定裁片尺寸，不依赖正文变化。

| pill | meanAbs | changedPixels | raw-pixel MD5 | 选中帧 ↔ 未选中帧 |
|---|---:|---:|---|---|
| 上周 | 168.906667 | 2852/3300 | 不同 | `shots/fixed-previous-pill-previous.png` ↔ `shots/fixed-this-pill-previous.png` |
| 本周 | 163.563361 | 2456/2904 | 不同 | `shots/fixed-this-pill-this.png` ↔ `shots/fixed-previous-pill-this.png` |
| 下周 | 165.684343 | 2808/3300 | 不同 | `shots/fixed-next-pill-next.png` ↔ `shots/fixed-this-pill-next.png` |

### 可撤／可回

- 上周 → 本周：`shots/fixed-returned-from-previous-strip.png` 与初始本周 strip MD5 相同、meanAbs=0，真实区间也恢复。
- 下周 → 本周：`shots/fixed-returned-from-next-strip.png` 与初始本周 strip MD5 相同、meanAbs=0，真实区间也恢复。
- Desktop 内置浏览器后台页签另以键盘完成 上周 → 本周 → 下周 → 本周；逐次核对区间 `10月12日–10月18日` → `10月19日–10月25日` → `10月26日–11月1日` → `10月19日–10月25日`，上周／下周深底反白随焦点和选中区间切换。

## 构建与检查

- `npm run build`：customer／merchant／staff 三端 EXIT 0。
- `npx eslint src/pages/MySchedulePage.tsx`（cwd `apps/staff`）：EXIT 0。
- `node --check apps/staff/scripts/pd90-week-pill-shots.mjs`：EXIT 0。
- `PHASE=baseline node apps/staff/scripts/pd90-week-pill-shots.mjs`：按预期 RED 16 项（缺陷复现）；`PHASE=fixed ...`：29/29 GREEN。
- 员工全量 `npm run lint -w @philia/staff`：修复前后同为 **25 errors／1 warning** 的基线债，本单未新增计数；不作全量 lint 绿色声明。
- `cd server && npm run typecheck`：基线既有 `src/db/pd66EvidenceFixture.ts` 顶层 await／TS1375 错误，本单 server 零改动；不作 server typecheck 绿色声明。
- Windows 根 `npm ci` 的 postinstall 在本机递归失败；改为先 `npm --prefix server ci` 再 `npm ci --ignore-scripts` 安装同一 lockfile 依赖，未改安装脚本或依赖版本。
- 采集后 `7190／7192／9290` 监听数为 0；临时页签、浏览器与 mock preview 已清理。

## 交付 HIT（现网与候选严格分开）

| 原缺陷／门槛 | 证据 | 状态 |
|---|---|---|
| 三周无选中态 | 基线 RED＋修复后 29/29 GREEN；strip＋pill 双像素证据见上 | 本分支点验绿 |
| 禁 MD5／meanAbs≡0 | 三组 strip 与三组 pill 对照均 MD5 不同、meanAbs>0 | 本分支点验绿 |
| 禁正文差冒充 | 所有 strip 裁片排除区间正文；pill 同文字独立裁片；无 20c／410 正文差充证 | 已遵守 |
| 点回本周可撤可回 | 两条回切路径 strip MD5 与初始本周一致、区间一致 | 本分支点验绿 |
| daypill 可轻挂 | 未轻挂、零产品 diff、无清项声明 | 不在本单交付 |
| 现网员工包 | 2026-10-24 只读 `http://120.53.102.45:7203/my-schedule` 的 index 仍引用 **`index-W3JjVPYl.js`**，SHA-256 `d4b310c5e7d3fde6416b91f943699cca7c19186b7dc17d562f8e9d1dcf78d472` | 合部前现网基线 |
| 新 js 文件名／hash 须异于 W3JjVPYl | 本分支最终 `apps/staff/dist/index.html` 引用 **`index-DC9fXU42.js`**，SHA-256 `d7a31727f7843fb61e20638bb908e9dc1ce507982f54d083f04ba9f065c459d5`；不同于现网名与 hash | **本地候选，非 tip 包** |
| 合部同源 tip 现网 HIT | 本窗只开 PR、未合未部；localhost／mock preview 不计现网 HIT | **待合部部署后执行，不在本卷冒认** |
