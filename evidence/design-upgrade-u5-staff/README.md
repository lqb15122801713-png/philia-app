# PD-44 · U5 员工脸定稿升档 · 卷宗

- 档号：PD44｜令号：CJ-1018-10｜分支：`feat/pd44-u5-staff`｜基线：main@`f778d4bc`
- 模型：K3 MAX｜窗：「全端升档-U5-员工脸」
- 权威对照：figma bro 定稿＋Ready `READY-FOR-DEV-20261015` §1.B（S-00~S-12＋StaffDock）／§2 Token／§3 组件／§4 态规则／§6 禁改；Figma `ot5SBoqhKAw2UIZRVFzhel`（nodes `203:883／198:15／202:2／202:137／202:272／198:244／198:296` 等）
- 本卷宗只证「施工完成并对照自查」；**不写验收通过**、不判美；验收归产品 ROG／头子点验。

## 一、施工面（只销 U5）

| 屏 | node | 落点 | 状态 |
|---|---|---|---|
| S-00 登录 | `203:883` | `pages/DevLoginPage.tsx`＋`copy/login.ts` | 主视觉/wordmark/serif 宣言 cream 刷底/cream 主钮/账号区齐；主钮文案对齐真实行为（「选择员工账号登录」，不再冒充手机号一键登录）；小字全抬 ≥12px；`#F2DC8C` 字面量归 `var(--gold-pale)` |
| S-01 工位台 | `198:15` | `pages/TodayPage.tsx` | Workcard 深棕英雄卡＋六步 stepgrid＋cream 主钮原已骨架化；六步改**短标**（消毒/预检/洗护/精修/交付/完成，Ready §3 Stepdots6 短标口径，全展仍用 SERVICE_STEPS 全称）；今日任务区小字抬齐；死码（FrontdeskDesk/GroomerDesk/deck 时间轴四件/HistoryPage/PetHeader/PageHeader）摘除，`STEP_NAME` 迁入 `deck/deckUtils.ts` |
| S-02 官方三态 | `202:2／202:137／202:272` | `pages/SchedulePage.tsx`＋`SkApptCard` | 三态状态机原已落地（全薄/半展=dock 默认/全展=六步只读；待接「开始」互斥灰态；已完成/待接恒薄行）；G1 日期片改**同一行**（昨/今/明＋日历 chip，原生 date input 收进 chip 行尾）；旧 `198:104` 未施工 |
| S-12 切日 | `203:5821` | 同上 | 切过去=全薄行＋班结行（/history 重定向唯一入口不变） |
| S-03 打卡 | `198:244` | `pages/staff2/AttendancePage.tsx` | PunchCard 大钟＋围栏＋cream 主钮；补卡申请区旧裸控件→`SkPanel`＋`sk-label/sk-input/sk-select/sk-textarea`＋SkBtnInk；文案收 `copy/attendance.ts` 25 键 |
| S-04 我的 | `198:296` | `pages/MePage.tsx` | SkIdCard＋分组 SkRows；副注/展开区长文全抬 ≥12px；通知权限长句收 `copy/me.ts` |
| S-05 提成 | `203:4787` | `pages/staff2/PayPage.tsx` | 「sk 壳＋内联芯」拆尽：cardSt/monoSm/chipSt/SecTitle→SkPanel/SkSec/SkRows/SkRow/SkModal（申诉弹层）；小字全抬 12（原 9/9.5/10/11）；规则/数字/查询零改动 |
| S-06 XP | `203:4852` | `pages/staff2/XpPage.tsx` | 同上工艺；「申报积分」=本屏唯一 cream；徽章门槛 8.5px→12；本人榜高亮归 cream 同值族；XP 规则零翻案（拉新源置灰照旧） |
| S-07 评价 | `203:4917` | `pages/staff2/MyReviewsPage.tsx` | 摘要 trio/评价卡→SkPanel；申诉行内卡工艺与 Pay 对齐（ghost 取消＋SkBtnInk 提交） |
| S-08/S-09 盘点 | `203:5611／203:5663` | `pages/staff2/InventoryPage.tsx`／`InventoryCountPage.tsx` | 卡面旧脸（左色条卡/内联 chip）→SkRows/SkPanel＋token；表单件 sk 化；状态签 token 化 |
| S-10 寄养打卡 | `203:5720` | `pages/BoardingCheckinPage.tsx`＋`components/boarding/*` | **PawPrint 爪印占位摘除**→bg-sunken＋serif 名首字＋mono「待换」（真图未齐口径）；cream 预算收敛：今日打卡提交=唯一 cream，入住登记/退房确认→SkBtnInk/ghost；隐藏 file input 原样未动 |
| S-11 补卡审批 | `203:5776` | `pages/staff2/ManagerPage.tsx` | **window.prompt×3＋window.confirm×1 全换 SkModal 真弹层**（行为/文案/mutation 不变）；小字（含 8.5px 盘点签/退款 10px 区）全抬 12；cream 钮清零→SkBtnInk |
| StaffDock | Ready §3 | `components/skeleton/*`（SkDock） | 四槽冻结「工位/预约/打卡/我的」；激活=cream 顶短划 22×3（实测 `rgb(242,220,140)`）；无爪印；签 10.5→12px |
| 执行页/扫码/协作五页 | — | `ExecutePage`＋`execute/*`＋`scan/*`＋staff2 五页 | PageHeader→SkBackBar；QrScanner/ManualCodeInput 硬编码 hex 全清（`#F2DFA6`→cream 正值 `#F2DC8C`）；协作五页 `rgba(59,46,36,*)`/`#FAF8F2` 全清、提交钮 SkBtnInk |
| 底座 | — | `styles/skeleton.css`＋`components/skeleton/index.tsx` | **可读文字全量 ≥12px**（dock 签/步名/note/状态签/mono 注原 7.5–11px 全抬）；新增 `.sk-input/.sk-select/.sk-textarea/.sk-label/.sk-panel/.sk-sec/.sk-btn-ink` 与 `SkBtnInk/SkPanel/SkSec/SkModal`（蒙层+滚锁+Esc）；SkChips 支持行尾追加（日历 chip） |

## 二、缺口吞表销项对照

- A 员工各屏半成品脸：见上表（全屏进 sk/VI 体系，硬编码色/小字清库）。
- B9 官方三态：S-02 三态实测在跑（见验证 8–11 条）。
- 员工 Dock：四槽＋cream 短划实测（验证 5 条）。
- 补2 员工改期 K8＝入口分列：`/today` 待办行「改期回退 N 单待确认」既有入口保留并对齐新脸（业务链=商家端审批，另裁，本片不翻）。
- 前台「全店预约」口径（潘婧 K1）：空态文案按接口实口径改「现在没有要你接待的预约」（原「今天全店无预约」冒充全店视界）；接口视界未动（业务不翻案）。

## 三、验证（截图／Argus 级实测）

- 脚本：`scripts/design-upgrade-u5-staff-check.mjs`（CDP 无头 Edge，390×844 移动视口）；夹具 `server/scripts/u5-demo-appointments.ts`（本地 dev 库直写，code 前缀 `U5D%` 幂等；**不走预约提交流程**）。
- 运行：`node --experimental-websocket scripts/design-upgrade-u5-staff-check.mjs`（前置：server dev 7200＋staff vite 7102；node 20 需该 flag 启用全局 WebSocket）。
- 结果：**63/63 通过**（`u5-results.json`）。覆盖：S-00 结构＋主钮文案、S-01 Workcard 六步（done=2/now=1）＋cream 主钮、StaffDock 四槽＋cream 短划、S-02 G1 同行/半展默认/互斥 pill 停用/薄行/全展六步、S-12 切日、S-03/S-04 结构、S-05~S-08 脸面、执行页六步＋隐藏 file input 在、S-10 脸面、前台核销大卡＋待核销分组、S-11 分区；每屏三闸（可读文字全量 ≥12px／爪印=0／cream 主钮 ≤2）；全程无提交预约／支付请求。
- 截图：`u5-s00-login / s01-today / s01-frontdesk / s02-half / s02-full / s03-punch / s04-me / s05-pay / s06-xp / s07-reviews / s08-inventory / s10-boarding / s11-manager / s12-past / execute.png`。
- 构建闸：`npm run build -w @philia/staff`（tsc -b＋vite build）绿；eslint 较基线 −3 错（基线 28 错属模板旧账，本 PR 不新增）。

## 四、禁区遵守

未做：提成/XP 规则翻案；旧 `198:104`；B7／PD-40／`209:*`；C4–C6；U1～U4/U6～U7；B8/B10；六步拍照隐藏 input 行为改动；真付真退／提交预约／开会员／真加购；选品；A 合部；验收通过字样；判美。真图未齐处=浅色占位＋「待换」，无爪印冒充。

— KimiCode A 窗 · 2026-10-20 · K3 MAX
