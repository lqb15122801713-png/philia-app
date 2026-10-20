# 卷宗 · PD-49 文案修（三角色 L2：L-CTA-MALL＋L-CLOCK-COPY）

- BRANCH：`feat/pd49-copy-fix`｜基线：main@`ea910dc`（全 ea910dc118bdd3b1c22d60f432ef065f9c1de08e，含 PD-47）｜模型：K3 MAX
- 令围：只修两文案——L-CTA-MALL 客壳 mall.hero CTA 与 liveMap 槽文案对齐同一主文案；L-CLOCK-COPY 员工工位寄养照护 CTA 与 Dock「打卡」消歧（防误入寄养）。不扩 O-SLOTKEY／审美／CLIP，不改商城 IA。

## 根因与对齐口径

- **L-CTA-MALL**：现网渲染主文案＝`mall.heroCtaU4`「去逛逛」（MallPage `mall-hero-cta`，PD-39/PD-43 大测既定活文案）；
  而 liveMap 槽 `mall.hero.cta_text` 与旧键 `mall.heroCta` 仍是种子旧值「去看看」（0086 种子）→ 同位两词。
  对齐方向＝既定活文案「去逛逛」（槽侧／旧键侧改，IA 与渲染键不动）。
- **L-CLOCK-COPY**：工位待办寄养照护行 CTA `today.todo.boardingCareCta`＝「去打卡 ›」（0027 种子），
  与 dock 四槽冻结「打卡」（考勤，sk.dockPunch）同词——员工从工位点「去打卡」实落 `/boarding/:id/checkin` 寄养打卡页，易误入。
  消歧＝CTA 改「寄养打卡 ›」（与寄养域既定词 `boarding.title`＝寄养打卡一致）；Dock「打卡」冻结不动，目标路由不变。

## 修复（最小 diff：码内默认 3 处＋seed 单源 3 处＋幂等迁移 1 件）

- `apps/customer/src/copy/mall.ts`：`mall.heroCta` 去看看→去逛逛。
- `server/src/db/slotSeedRows.ts`：`mall.hero.cta_text` 去看看→去逛逛。
- `server/src/db/copySeedRows.ts`：`mall.heroCta` 去看看→去逛逛；`today.todo.boardingCareCta` 去打卡 ›→寄养打卡 ›。
- `apps/staff/src/copy/today.ts`：`today.todo.boardingCareCta` 去打卡 ›→寄养打卡 ›。
- 新增幂等迁移 `server/drizzle/0090_pd49_copy_fix.sql`（UPDATE slot_contents live 行 json_set cta_text＋copy_overrides active 两行；0087/0088 同工艺）＋ `_journal.json` 登记 idx 90。
  **跨窗撞号处置**：并行窗 PD-48（PR#148）先占 0089（0089_pd48_slotkey_repair）→ 本窗让号用 0090，语义顺序不乱。
- 历史迁移 0024/0027/0086 不改（0090 覆盖生效；PD-47 同口径）。

## 自验（本窗栈 server@7241＋customer@7141＋staff@7143，VITE_API_BASE 直连，独立证据库；7200/7101/7102/7201-7203 他窗栈未动）

- server `tsc --noEmit` ✓；customer `tsc -b` ✓；staff `tsc -b` ✓。
- e2e（E2E_PORT=7240 避让）：三跑全量日志（跑2/3/4）均 **1037 ✓ / 8 ✗**；8 项 ✗＝56.1×2／57.1／74.11／76.3／77.2／81.4／98.2，
  与 PD-47 卷宗所载裸基线 e82694c 同红逐条一致（陈旧期望+日期敏感），**本窗零新增红零修复**（开挂不扩）。
  （首跑经管道 tail 截断显示异常计数，以三跑全量日志为准。）
- 页面实证：
  - 图 01（客户 :7141 /mall，示例客户会话）：商城 hero「本周上新·给它囤点好的」CTA＝**去逛逛**；同刻 liveMap 读回 cta_text＝去逛逛（两端同词）。
  - 图 02（员工 127.0.0.1:7143 /today，丽丽会话；headless Edge CDP 独立 profile，不抢前台）：待办行「旺财 · 今日寄养照护」CTA＝**寄养打卡 ›**，
    同帧 Dock 四槽「工位/预约/打卡/我的」与工位「打卡·上下班打卡」原样——两「打卡」语境一眼可分；DOM 探针：「去打卡」零残留、寄养打卡 ×1、Dock 打卡在。
- 03_读回记录：库内直读（0090 后 slot live 行＋copy active 两行）＋ liveMap／activeCopyTexts（客户会话）＋ staffTask.listMy（丽丽会话，boarding 任务 link=/boarding/:id/checkin）＋ e2e 结论。
- 证据夹具：在住寄养 1 条（appointment PD49FIX1＋boarding_stays，mock 不涉钱）使待办行渲染；库为一次性证据库，测完即清。

## 两问闸

1. 是否只碰两文案的 copy／槽种子与对应端口行？——是：码内默认 3 处＋seed 单源 3 处＋幂等迁移 1 件＋journal 1 段；零逻辑改动，未碰商城 IA／Dock 冻结四槽／O-SLOTKEY／审美。
2. 是否涉钱真通道？——否（未碰支付/退款；证据夹具 mock，未真付真退）。

— KimiCode A窗（K3 MAX）· 2026-10-20
