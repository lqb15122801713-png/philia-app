# 卷宗 · PD-44.1 登出登录文案（修 PD-44 S-00／M1）

- BRANCH：`feat/pd44-1-logout-copy`｜基线：main@`dd0417a0`（含 PD-42）｜模型：K3 MAX
- 令围：只修登出后「手机号一键登录」壳污染；期望登出后仍为「选择员工账号登录」（与冷进一致）。

## 根因（代码＋运行双实证）

`copy_overrides` 表 `staff:login` 域 `login.primaryCta` active 行文本＝「手机号一键登录」
（0027 迁移＋`server/src/db/copySeedRows.ts` 双源残留，客户壳旧文案；PD-44 只改了码内默认未同步端口行）。

渲染链：`CopyOverridesLoader` 经 `activeCopyTexts`（注意：`publicProcedure`＝须登录会话）整表拉取 →
模块级 `overrideMap`（写入不触发重渲染，设计如此）→ `withCopyOverrides` 代理端口值优先。

- **匿名冷进**：无会话 → 读口 401 → 覆盖图空 → 码内默认「选择员工账号登录」（＝林晓 001 PASS）。
- **登录后**：读口成功 → 覆盖图静默写入旧值「手机号一键登录」。
- **点退出登录**：会话失效 → 读口 401 → 覆盖图**保留**旧值；`invalidateQueries`+useMe refetch 触发重渲染 →
  主钮被染回「手机号一键登录」（＝林晓 008 FAIL，复现×2）。
- **冷 navigate**：整页重载清模块图 → 匿名 401 → 恢复正确。

## 修复（最小 diff，三处）

1. `server/src/db/copySeedRows.ts`：staff:login `login.primaryCta` 文本→「选择员工账号登录」（1 行）。
2. `server/drizzle/0087_pd44_1_logout_cta.sql`：幂等 UPDATE active=1 行对齐（既有库；客户 `devlogin.primaryCta` 不动）。
3. `server/drizzle/meta/_journal.json`：登记 idx 87。

## 自测矩阵（本窗栈 server@7212＋staff@7112，真链路登录阿强→退出登录）

| 图 | 状态 | DB 态 | 主钮 | 对应 |
|----|------|-------|------|------|
| 00 | 冷进（带旧会话，旧栈 7102/7200） | 修前 | 手机号一键登录 ❌ | 污染佐证 |
| 01 | 登出后（旧栈） | 修前 | 手机号一键登录 ❌ | 污染佐证 |
| 02 | 冷进匿名（本窗栈） | 修前 | 选择员工账号登录 ✅ | ＝林晓 001 |
| 03 | 登录→登出后（本窗栈） | 修前 | 手机号一键登录 ❌ | ＝林晓 008 复现 |
| 04 | 冷进（本窗栈） | 修后 | 选择员工账号登录 ✅ | G1 |
| 05 | 登录→登出后（本窗栈） | 修后 | 选择员工账号登录 ✅ | G2 |

- 06_G3_staff-login域active行读回.txt：修后 staff:login 21 行全量读回，`login.primaryCta`＝「选择员工账号登录」，无客户壳残留；客户 `devlogin.primaryCta` 不受影响。
- 因果隔离：同一栈同一码，仅翻转该 DB 行文本 ↔ 症状开/关（02/03 vs 04/05）。
- server `tsc --noEmit` 通过；迁移 0087 在本地库实际应用成功。

## 两问闸

1. diff 只触及登出／登录壳文案串键最小路径？——是：seed 1 行＋幂等迁移 1 句＋journal 登记；零应用码改动。
2. 自测覆盖冷进＋登出回登录两态？——是：04／05 两态主钮均正确（另有 02/03 修前对照）。

— KimiCode A窗（K3 MAX）· 2026-10-20
