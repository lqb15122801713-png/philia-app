# 卷宗 · PD-83 staff-boarding-write-gate

> 员工端寄养超期写闸一眼停＋去幂等工程腔 · 基线 `main@dcec051`（`dcec051a7de2812fea1bb73a397617f2646c8eb2`）· DEPLOY 20261022235225
> 分支 `feat/pd83-staff-boarding-write-gate` · WT `E:\KIMI code\pd83-staff-boarding-write-gate` · 零 schema（**0124 故意空留**）· 不写验收通过

## 缺陷 → 修法（最小 diff，两文件）

| 缺陷 | 根因 | 修法 |
|---|---|---|
| BOARDING-WRITE-OPEN-OVERDUE（超期页仍露 修改／＋拍照／提交今日打卡／办理退房） | `BoardingCheckinPage` 已算 `overdue` 却只用于横幅；四处写口只闸 `completed/editingStay` | 四处写口加 `overdue` 闸：`onEdit` 超期不传（入住卡纯只读）、编辑表单超期不渲染、`DailyLogForm` 超期不渲染、退房钮超期不渲染；超期横幅（已指引「提醒商家安排退房」）＋历史打卡只读保留＝等价只读收口 |
| BOARDING-IDEMPOTENT-JARGON-VISIBLE（正文露「同日重复提交=更新当日记录（幂等）」） | `DailyLogForm` 吸底主钮 `sub` 直出工程腔 | `sub` 改人话「当天再次提交，会更新今天的打卡记录」；码注同步 |

- 改动码：`apps/staff/src/pages/BoardingCheckinPage.tsx`、`apps/staff/src/components/boarding/DailyLogForm.tsx`（全 diff 见 `pd83.diff`，82 行）
- 走测工具（新增，零产品码影响）：`server/scripts/pd83-overdue-fixture.ts`（夹具：超期单＋在住对照单，可复跑即弃）、`apps/staff/scripts/pd83-boarding-write-gate-shots.mjs`（CDP 实机帧＋DOM 断言）

## 验证（潘婧员工走测正例 · 涉钱零动作）

- 窗口隔离：API 7283／staff preview 7183／CDP 9283；独立窗口库（PHILIA_DB_URL 临时文件），migrate+seed 后造夹具，测完夹具行删除＋库文件删除。
- 渲染对象＝本窗分支构建产物（`VITE_API_BASE` 构建期指向 7283）。
- `build:staff`（tsc -b＋vite build）0 错；server `tsc --noEmit` 仅存基线旧错 `pd66EvidenceFixture`×8（dcec051 原样，本窗未碰）。
- 走测断言 14/14 绿（明细 `assertions.json`）：
  - 超期页：超期横幅在；「修改／打卡表单／＋拍照／提交钮／办理退房」全缺席；历史打卡 1 行只读保留；正文零「幂等／同日重复提交」。
  - 对照页（正常在住）：无超期横幅（不误标）；「修改／打卡表单／＋拍照／提交钮／办理退房」全在（不误伤写口）；副行新人话在、工程腔清零。
- 禁真提交／禁真退房：全程零点击写钮；零支付动作（夹具 pay_at_store 仅字段值）。

## 帧

- `shots/01-overdue-readonly.png` — 超期详情页：已超期签＋赭红横幅＋入住卡纯只读（无「修改」）＋历史打卡只读行；全页无写 CTA。
- `shots/02-control-writable.png` — 对照在住页：状态正常签；「修改／＋拍照／提交今日打卡（新副行）／办理退房」全在。
- `assertions.json` — 14 条 DOM 断言真值（探针原始返回＋判定）。

## 纪律回执

不合／不部；不写验收通过／已修；不直改生产库；未碰夹具 01M5EQVF；未跨店造种（全种子首店）；未抢前台／未动双屏；未查 USAGE；夹具与窗口库测完已自清。
