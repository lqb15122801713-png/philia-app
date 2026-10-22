# PD-71 · 总部台立壳（同仓独立壳＋关店/再开/克隆主写口）

- 分支：`feat/pd71-hq-console-shell`
- 基线：main@`b2558760b48dfdbf7c3b0e341c7e9e8a41a82a49`（短 `b255876`，与 PD-70/72 同一 tip）
- 迁移：**零 migration**——未动 drizzle schema／`server/drizzle/meta/_journal.json`（独占号 **0112 声明未占用**；tip journal last＝0094）
- 范围：商家端同仓立壳 `/hq`（另路由＋墨轨另导航名「总部台」）＋ 关店/再开最小写口（`store.closeStore`/`store.reopenStore`）＋ 克隆写口迁移（总部台为主写口，门店档案改只读说明）

## 形裁定（令包「如 apps/hq 或约定路由前缀」钉后者）

同仓立壳落法＝**商家端内独立路由前缀 `/hq`＋墨轨管理组 owner-only 口「总部台」**：
独立入口、独立页面壳、导航名与「运营后台端 /console」（调参/画布/口令闸）零混淆；
非门店档案页内嵌块（档案页克隆写钮已撤，改「请至总部台」只读说明——钉「改说明」一种，无双主写口并存）。

## 改动清单（最小 diff：8 文件 +153/−68＋新页 1）

| 文件 | 改 |
|---|---|
| `server/src/routers/store.ts` | 新增 `closeStore`/`reopenStore`（merchantOwnerProcedure；越域 NOT_FOUND 同 cloneStore 防探测口径；`storeType=hq` 硬拒「总部门店记录不可关闭」；仅写 `status`+`updatedAt`，零物理删/零级联；重复关/开 BAD_REQUEST） |
| `server/src/routers/__tests__/domain.smoke.ts` | 新增第 6 节：软关/再开往返＋listNearby 联动；manager/clerk FORBIDDEN；越域 NOT_FOUND；hq 硬拒零副作用 |
| `apps/merchant/src/pages/HqConsolePage.tsx` | 新页 `/hq`：店列表默认仅 active（「含已关闭」默认不勾，勾上见 closed＋徽标）；hq 行可见无关钮；关店二次确认＋勾选「已知晓仍关闭」；再开确认；克隆（仅 active 店可作源，提示须另行入职/排班）；空/加载/错误态诚实 |
| `apps/merchant/src/App.tsx` | 路由 `/hq`（clerk 由 ClerkRouteGuard 白名单拦） |
| `apps/merchant/src/components/MerchantRail.tsx` | 管理组 owner-only 口「总部台」（`rail-hq-console`），头注同步 |
| `apps/merchant/src/copy/console.ts` | `wnav.hqConsole`＝「总部台」 |
| `apps/merchant/src/copy/consoleAdmin.ts` | 控制台办事卡 hint 去「新店克隆」改「克隆新店请至总部台」；退役键注记 |
| `apps/merchant/src/lib/roles.ts` | `clerkGuideText('/hq')` 专属引导文案 |
| `apps/merchant/src/pages/ProfilePortBody.tsx` | 克隆写钮/弹层撤除，改只读说明「克隆新店请至总部台」（`profile-clone-moved`） |

**关店/再开写口归属说明**：基线无任何 close/reopen 写口（PD-70 同批并行在造完整软关语义：强警示枚举/
listMine 默认排除/报表勾选）。本片为让总部台写 UI 真实可验，落了**最小写口**（owner 闸＋店域校验＋hq 硬拒＋
仅写 status）；完整语义权威＝PD-70，合部时若撞 `store.ts` 以 PD-70 版本为准（两口均为追加式，冲突面小）。

## 权限闸（双闸诚实）

- owner：写口全开（页面＋server merchantOwnerProcedure）。
- clerk：墨轨无「总部台」口；直达 `/hq` 走 ClerkRouteGuard 白名单拦截 → 引导页「总部台仅店主可用」；server 写口 FORBIDDEN。
- manager：墨轨无口（owner-only 装配）；页内 `isOwner` 闸 → 同一引导页；server 写口 FORBIDDEN。

## RED → GREEN

```text
RED（基线 b255876）：grep -c "closeStore\|reopenStore" server/src/routers/store.ts → 0（无写口）；
  前端无 /hq 路由、墨轨无「总部台」口
GREEN：
  cd server && PHILIA_DB_URL=file:./data/tmp.db npx tsx src/db/migrate.ts && npx tsx src/routers/__tests__/domain.smoke.ts
  ✅ 1–5 原有断言全绿（零回归）
  ✅ 6. PD-71 closeStore/reopenStore：owner 软关/再开往返正确；manager/clerk FORBIDDEN；越域 NOT_FOUND；hq 硬拒零副作用
  [domain.smoke] 全部 6 项通过 🎉            （全量输出见 smoke.log）
```

## 静态闸

- `apps/merchant`：`npm run build`（tsc -b && vite build）绿（build-merchant.log）；改动文件 eslint 零警。
- `server`：`npm run typecheck` 12 错**全部在基线遗留** `src/db/pd66EvidenceFixture.ts`（顶层 await 非模块，
  b255876 原样未触、本片改动文件零错；见 typecheck-server.log）。

## 运行时实证（临时库/临时口，测完已自清）

server :7210（PHILIA_DB_URL=一次性 verify 库，标准 seed＋1 hq 夹具行）＋ merchant vite :7113，内置浏览器真人链路：

1. owner 登入 → 墨轨管理组见「总部台」→ `/hq` 列表：示例店（克隆新店/关闭门店）＋总部行（「总部」徽标，
   **无关钮**，明文「总部记录不可关闭」）——shots/hq-list-owner.png
2. 克隆：源示例店 → 新店「验证克隆店B」入列（toast 提示须另行入职/排班）
3. 关店：确认弹层＝软关警示＋勾选「已知晓影响，仍要关闭」方可提交（shots/hq-close-modal.png）；
   提交后默认列表即刻剔除该店
4. 勾「含已关闭」→ closed 行带「已关闭」徽标＋「重新开业」钮（shots/hq-include-closed-reopen.png）；
   再开后恢复 active 回默认列表
5. clerk（小周）：墨轨仅收银台、直达 `/hq` 得引导页（shots/hq-clerk-guide.png）；manager/clerk 写口
   server 侧 FORBIDDEN 由 smoke 第 6 节钉死
6. 控制台 › 门店档案：克隆写钮已撤，仅「克隆新店请至总部台」说明

自清：验证库/夹具脚本已删，临时进程已杀，`package-lock.json` 已还原——工作区仅余上表改动。
