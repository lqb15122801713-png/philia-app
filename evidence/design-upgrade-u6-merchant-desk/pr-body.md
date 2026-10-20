# PD45／CJ-1018-11 · 全端升档 U6 商家桌面（W-00～W-16 定稿做满）

> 窗「全端升档-U6-商家桌面」｜K3 MAX｜基线 main@`dd0417a0`（含 PD-42；1020 基线升档补丁口径）｜**PR 只开不合；A 禁合禁部；合／部＝产品 ROG**｜不写验收通过 · 不判美

## 令围（只销 U6）

对照 figma bro 定稿＋Ready §1.C 全表（`203:14`…`203:4047`，W-01=`199:2`）／§2 VI `193:2`／§3 组件／§4 态规则／§6 禁改；Figma `ot5SBoqhKAw2UIZRVFzhel`。

- **副文 ≥12px 全量抬升**：console.css 32 处／index.css u3 族 9 处／TSX `text-[11px]`×39＋`text-[10px]`×1／skeleton 内联 8.5／ReceiptPage；商家端独占 `caption-xs` 11→12（tailwind.config.js，packages preset 与他两端不动）。实证＝18 帧计算样式巡检**全帧无 <12px 可读文字**。
- **C4–C6 入口分列（只露入口，业务零翻案）**：
  - C4 列表「强制完成」——僵尸行（in_service＞24h 未翻步，同监控 Hub 判定）操作列露 CTA，复用 `forceCompleteStale` 单源＋同一确认句/留痕注；
  - C5 列表「改期」——pending|confirmed 行直开 `RescheduleSheet`（详情页同件同强校验，`listForStore` 行字段自足，零服务端改动）；
  - C6 日结「已冻结」——历史行状态格＋详情字段 硬编码→copy 键 `cashier.closeStatusFrozen`「已冻结」，与 banner／班次徽三处并列。
- **cream 预算收敛（PrimaryCTA ≤1／屏）**：W-06 快速加单＋扫码核销、W-07 现金登记、W-10 CSV 确认导入＋批量保存 → 深棕 CTA（实证各屏 cream=1）。
- **W-00 校形**：登录卡 400→420；角色行 mono 轨。
- **死码禁色清账**（S3 报备另令→本令清）：旧墨 alpha 基底 `rgba(59,46,36→rgba(44,40,34` 全 src 351 处；StatCards/TodoSection/TodayTimeline 旧淡金/深棕/纸白 全令牌化；BoardingStayCard/Detail、PassPage 萤火档色、OpsPage 等 5 页 cream 现值、LedgerPage ink/canvas 收敛。红线复扫=0（旧雾感四色／#F2DFA6／#FAF8F2／#FFFDF6／爪印／v2 小字阶）。

## 验证（全绿）

- 构建：`npm run build -w @philia/merchant` exit=0（tsc+vite）。
- lint：47 错 5 警＝**与 S3 登记基线同数，本批零新增**。
- 实尺实证：`apps/merchant/scripts/u6-merchant-desk-shots.mjs`（CDP headless Edge 1440×900）——真下单/核销/在店寄养/settle/退款双态/**真日结冻结**/**D-29 冻结后新开单**/库直写 25h 僵尸；18 帧 W-00~W-16 全取，**66/66 全绿**（每帧三闸：≥12px／爪印=0／cream≤2）。卷宗 `evidence/design-upgrade-u6-merchant-desk/`（README＋shots×18＋u6-results.json＋gates）。
- 禁区：无真付真退／无提交预约／无开会员真通道／无真加购结账；未触 B7／PD-40／`209:*`／B10／U1～U5／U7／员工 K8／钱权 L2／三本账／pd44-1-logout 树。

## 新 copy 键（3）

`appt.rowReschedule`／`appt.rowForceComplete`／`cashier.closeStatusFrozen`（码内 fallback 即生效；随批注册 copy_overrides 的生成器重跑＝迁移申报，归产品端口批另册）。
