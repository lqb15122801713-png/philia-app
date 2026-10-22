# PD-80 卷宗 · 员工端 pill 绑区间＋退出确认＋寄养收写

- 基线：main@8ec880e（全 8ec880ee425f9ea3beaf79a391bd6d0001bec55b）
- 分支：feat/pd80-staff-pill-exit-boarding · WT：E:\KIMI code\pd80-staff-pill-exit-boarding
- 迁移：0121（drizzle/0121_pd80_staff_pill_exit_boarding.sql，纯数据行改写，零 schema；未撞 0114–0120；0117/0119 未占）
- 走测环境：本窗 dev 库（server/data/philia.db，一次性）＋ vite 7182（CORS_ORIGINS 显式放行）＋ server 7200
- 走测账号：丽丽（员工）/小美（前台）种子号；夹具 `01M5J02G0FX3Y9S8612QJBB8T6`（pd80EvidenceFixture 经 router 真链路造，已 `--clean` 自清，库零残留）；打卡页两条补卡审批行走测后已自清
- 涉钱：寄养单 pay_at_store，未碰收银；零真钱

## 截图清单
| 文件 | 证明 |
|---|---|
| 01_agreements_page.png | /agreements 真页（未登录可访，《员工内测协议》?doc=staff 直开全文 5 条） |
| 02_login_agreement_links.png | 登录页协议小字两链可点（下划线真链） |
| 03_me_logout_confirm.png | /me 退出登录一击展开二次确认（确认退出？/再想想/确认退出），未退出 |
| 04_attendance_makeup_zh_inputs.png | 补卡日期/时间=文本框（2026-10-21／09:00），无 10/22/2026／09:00 AM 美式外露 |
| 05_boarding_checkin_saved.png | 寄养「收」：入住登记落库（房间 A-03／称重 28.6kg，信息卡已入住） |
| 06_boarding_dailylog_written.png | 寄养「写」：每日打卡落库（2 餐＋照片 1 张＋备注；历史行第 1 晚·今天） |
| 07_pill_this_week.png | /my-schedule 本周 pill＝「10月19日–10月25日 · 待发布」 |
| 08_pill_next_week.png | 下周 pill＝「10月26日–11月1日 · 待发布」 |
| pill_thisweek/nextweek/diff.png | pill 区域裁片＋像素差分图（886/6000 像素变，差分≠0，PIL 手算非 runner 自报） |

## 关键落库/接口凭证（走测当时刻）
- boarding_stays：room_no=A-03, checkin_weight_kg=28.6（checkinStay，前台小美 UI 提交）
- boarding_daily_logs：log_date=2026-10-22, meals×2, walks=0, note+签名图 URL（dailyLog，小美 UI 提交）
- attendance：UI 文本输入提交补卡 2026-10-21 上班卡→审批行出现「待审批」（修前 native date/time 在 en-US 环境渲染 10/22/2026＋09:00 AM）
- 退出二次确认：一击展开不退出（URL 仍在 /me），确认退出→落 /login；登录页已登录态同双确认（login-logout → login-logout-do）
- 去 SSE：me.settings.sync 端口旧值（SSE 长连接…）经迁移 0121 幂等改写人话；/me 设置展开实测新文案

## 排障注记（非缺陷项）
- 丽丽（groomer）提交 checkinStay 得 403「核销需前台账号操作」＝server 设计口径（boarding.ts assertFrontdeskStaff），非本窗回归；收=前台岗，写=照护岗可用。
- 走测中两次页面「当前不可打卡」瞬态＝本机 tsx watch 因新增夹具文件重启 dev server 所致，与代码无关。
- server tsc 基线既有错：pd66EvidenceFixture.ts 顶层 await（基线 8ec880e 原样，本窗未碰）。

## R40-01～07 登记（超范围不修）
盲测 R40 源卷不在 D:\Philia-shared（全盘整表检索仅分拣池一行提及「R40-01～07 新H」，无逐条题面）。按令：仅员工端且本树可最小修者已纳入＝令中明示三项主修（pill/退出+协议/寄养+AM+SSE）。R40-01～07 逐条内容缺源卷，登记候补：请产品补 R40 题面入共享盘后再裁。MySchedulePage 可用时间/请假的 4 个原生 date/time 输入同属美式 locale 外露类（本令 PUNCH 名件只点名打卡页），登记同类候裁。
