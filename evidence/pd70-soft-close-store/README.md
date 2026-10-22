# PD-70 · 软关店（soft close store）卷宗

- 分支：`feat/pd70-soft-close-store`
- 基线：main@`b2558760b48dfdbf7c3b0e341c7e9e8a41a82a49`（短 `b255876`；WT 自 origin/main 拉取核对后建树）
- 模型：K3 MAX · Desktop 施工
- 范围：软关/再开 API＋默认排除＋hq 硬禁关＋强警示＋closed 写口闸；**未动 drizzle／`_journal.json`（迁移号 0111 声明未占用——`stores.status`/`storeType` 字段基线已存在，零 schema 变更）**
- 写操作 UI 主入口：以 PD-71 总部台为准，本窗未在商家端糊写口小块

## 改动清单（最小 diff：5 文件 +175/−25，另新增 1 冒烟脚本）

1. `server/src/routers/store.ts`
   - `closeStore`（merchantOwnerProcedure，店域集合内）：active→closed + updatedAt，**零物理删**；
     `storeType=hq` → FORBIDDEN「总部门店记录不可关闭」（`store.update` 不接 status、全仓 `update(schema.stores)` 仅 auth 门店资料与 store.update 两处均无 status 通路 → 本端点为唯一 status 写口）；
     未完成履约强警示非硬阻断：进行中=in_service/in_boarding、待履约=未来 pending/confirmed/cancel_requested，
     合计>0 且未勾 `acknowledgeOpenFulfillment` → 返回 `requiresAcknowledgement:true` 零写入；勾选重调即关；已关重调幂等 `changed:false`。
   - `reopenStore`：对称 closed→active，恢复默认可见/可约；幂等。
   - `listMine`／`chainDashboard`：增 `includeClosed`（缺省 false=仅 active）——连锁/调拨目标/报表店下拉默认排除 closed 的服务端口径；includeClosed 时行透出 `status` 供「已关闭」标识。
   - `cloneStore`：源店 `status!=active` → BAD_REQUEST「已关闭门店不可作为克隆源」。
2. `server/src/routers/cashier.ts`：`hold` 无 billNo（=新开单）时店非 active → BAD_REQUEST「门店已关闭，不可新开单」（带 billNo 更新既有单不拦，收尾不卡钱）。
3. `server/src/routers/stock2.ts`：`transferCreate` 目标店非 active → BAD_REQUEST「目标门店已关闭，不可调入」。
4. `apps/merchant/src/pages/ReportPage.tsx`：报表店下拉默认仅 active（listMine 服务端默认排除）；新增「含已关闭」勾选（**默认不勾**，`data-testid="report-include-closed"`），勾选后带 closed 行并挂「（已关闭）」标识。
5. `apps/merchant/src/copy/report.ts`：`rpt.view.includeClosed`／`rpt.view.closedBadge` 两键（经营性文案走 copy 表纪律）。
6. `server/src/routers/__tests__/storeClose.smoke.ts`（新增）：PD-70 六项冒烟，夹具自建 finally 清场。

未动：会话 storeIds 装配／appointment.create 既有 closed 闸（appointment.ts:961 原样复用）／物理删除路径零新增／其余前端页面（DashboardPage 连锁卡、TransfersPage 调拨目标、ProfilePortBody hqId 下拉均消费 listMine，服务端默认排除即生效，零前端改动）。

## 验证（GREEN）

```text
storeClose.smoke.ts（新增 PD-70 六项）……… 全部 6 项通过 🎉
  1. closeStore 开心路径 + 零物理删 + 幂等
  2. listMine / chainDashboard 默认排除 closed（includeClosed 可含+标识）
  3. hq 硬禁关 FORBIDDEN 明文 / 越店 NOT_FOUND / manager FORBIDDEN
  4. 未完成履约：强警示+勾选后可关（非硬阻断），历史行全保留
  5. closed 拒：克隆源 / 收银新开单 / 调拨目标
  6. reopenStore 恢复默认可见 + 幂等 + 越店 NOT_FOUND
domain.smoke.ts（store/pet/boarding 回归）… 全部 5 项通过 🎉
appointment.voidcheckin / mall / slotAvailAfter409 …… 通过
build:merchant（vite）……………………………… 通过（4.84s）
```

## 预存在失败（基线 b255876 同集，与本 diff 无关）

- `tsc --noEmit`：12 错全部位于基线文件 `server/src/db/pd66EvidenceFixture.ts`（TS1375 非模块顶层 await；本分支改动文件零错误）。
- `appointment.smoke.ts` 1 项（寄养医疗授权硬闸夹具）：基线 stash 复跑同败。
- `serviceStep.smoke.ts` 4 项（service_certificates 插入）：基线 stash 复跑同败。
- `e2e.ts` 8 项（copy 种子计数 4279≠4300 等，新 WT 迁移+seed 环境与 e2e 硬编码期望之差）：
  基线（E2E_PORT=7321）与本分支（E2E_PORT=7322）失败集**逐项一致**（见 e2e-baseline-b255876.log / e2e-mine.log）；
  本分支首跑曾多 1 项「种子库原样」，定位为 e2e 运行期间并发重跑冒烟写 dev 库 mtime 所致，清净复跑后与基线一致。
  （e2e 默认 7200 端口被本机他窗占用，按 e2e.ts:285 注释用 E2E_PORT 避让，验收语义不变。）

## 文件索引

| 件 | 说明 |
|---|---|
| `diff.patch` | 全量 diff（含新增冒烟脚本） |
| `storeClose.smoke.log` | PD-70 六项冒烟输出 |
| `domain.smoke.log` | 域冒烟回归输出 |
| `appointment.smoke.log` / `serviceStep.smoke.log` | 预存在失败实录（基线同败） |
| `typecheck.log` | tsc --noEmit（12 预存在错，全在基线文件） |
| `build-merchant.log` | 商家端构建 |
| `e2e-mine.log` / `e2e-baseline-b255876.log` | e2e 本分支 vs 基线对照（失败集一致） |
