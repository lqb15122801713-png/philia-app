# 卷宗 · PD-51 L-CLOCK-COPY 续修（O-OVERRIDE-WINS／寄养打卡文案真落地）

- BRANCH：`feat/pd51-clock-copy`｜WORKTREE：`E:\KIMI code\pd51-clock-copy`｜基线：main@`fdac5a54`（全 fdac5a54be2b5dbd3595a991228ff3eaa8e3f644，含 PD-48＋PD-49）｜模型：K3 MAX
- 令围：只修一缺陷——工位寄养照护 CTA 仍「去打卡 ›」；dist／0090 目标「寄养打卡 ›」被 activeCopyTexts／live copy_overrides 旧覆盖压住。不扩 O-SLOTKEY／审美；不改路由；禁真打卡写库／真付。

## 根因与落地口径

- 渲染链：`TodayPage` 待办行 CTA＝`TODAY_COPY['today.todo.boardingCareCta']`，经 `withCopyOverrides` 代理——
  读取顺序＝端口值（copy_overrides active 行，activeCopyTexts 透出）→ 码内默认（`apps/staff/src/copy/today.ts`）。
- PD-49（0090）已把码内默认与 seed 单源对齐「寄养打卡 ›」，但合部后生产库 live `copy_overrides` active 旧行
  仍持「去打卡 ›」（0090 未在该库生效／只改 dist 被压）→ 端口值优先，工位 CTA 照旧词，窄点 FAIL。
- 落地工艺：新增幂等迁移 **`server/drizzle/0092_pd51_clock_copy.sql`**——`rule_key='today.todo.boardingCareCta' AND active=1`
  的行一律重写为「寄养打卡 ›」（清旧覆盖＝改写为新值：键保留、行数不变，端口页与 76.3 行数口径不动）＋ `_journal.json` 登记 idx 91。
  0088/0090 同工艺；已对齐库零变化＝重放零副作用。码内默认/seed PD-49 已正，本窗零改动。

## 自验（本窗栈 server@7241＋staff preview@7143，VITE_API_BASE 构建期钉 7241，CORS_ORIGINS 白名单 7143；独立证据库）

- server `tsc --noEmit` ✓；staff `tsc -b` ✓；staff `vite build` ✓。
- **0092 真落地实证**（03_读回记录 A/B 段）：证据库初态 0092 落「寄养打卡 ›」→ 模拟现网旧覆盖
  （回写「去打卡 ›」＋抹 __drizzle_migrations 0092 记录）→ 重跑 `db:migrate` 仅重放 0092 → 直读归正「寄养打卡 ›」。
- **端口读回**（丽丽会话）：`activeCopyTexts` active 4300 行，`boardingCareCta=寄养打卡 ›`，全表「去打卡」×0；
  `staffTask.listMy` boarding 任务 link=`/boarding/:id/checkin` 不变。
- **页面实证**（preview 产物 + headless Edge CDP 独立 profile 不抢前台，390×844，丽丽会话 /today）：
  - 图 01：待办行「旺财 · 今日寄养照护」CTA＝**寄养打卡 ›**；同帧 Dock 四槽「工位/预约/打卡/我的」与工位「打卡·上下班打卡」原样——两「打卡」语境可分。
    DOM 探针：「寄养打卡」×1、「去打卡」×0、Dock「打卡」→`/attendance`（考勤）不变、CTA→`/boarding/:id/checkin` 不变。
  - 图 02：CTA 只读落页＝寄养打卡页（返回条「‹ 寄养打卡」）；未打卡、未写库。
- e2e（E2E_PORT=7240 避让；04_全量日志）：**1037 ✓ / 8 ✗**；8 项 ✗＝56.1×2／57.1／74.11／76.3／77.2／81.4／98.2，
  与 PD-48/PD-49 卷宗所载裸基线同红逐条一致（陈旧期望 4279 vs 现 4300＋日期敏感），**本窗零新增红零修复**（开挂不扩）。
- 证据夹具：在住寄养 1 条（appointment PD51FIX1＋boarding_stays，db 直插不走 create 闸，mock 不涉钱不打卡写库）；
  库为一次性证据库，测完即清（tmp/ 已清）。

## 两问闸

1. 是否只碰本缺陷的覆盖落地？——是：幂等迁移 1 件＋journal 1 段＋卷宗；零逻辑/零码内文案改动，未碰 O-SLOTKEY／审美／Dock 冻结四槽／路由。
2. 是否涉钱真通道／真打卡写库？——否（未碰支付/退款/打卡写入；证据夹具 mock，CTA 落页只读导航）。

— KimiCode A窗（K3 MAX）· 2026-10-20
