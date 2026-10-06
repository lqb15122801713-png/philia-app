# 卷宗 · 商家端大批 片 1（连锁地基：两层架构+数据隔离+分级管理员+多店归属）

> 令=开工令-产品-1006-商家端大批片1.md ｜ 任务书=冻结版 V1.0 ｜ 附件=片 0 盘点表 ｜ 分支 `feat/merchant-chain-1`（基线=main@238687f3=本地 e0b98f4 全同树）｜ 施工=A 窗 2026-10-06 ｜ PR 只开不合。

## 一、施工件（10 文件，+284/-7）

| 件 | 改动 |
|---|---|
| `server/drizzle/0050_chain_foundation.sql` | 新迁移：stores+store_type/hq_id（两层模型，存量回填=自身[总部=自身]幂等 UPDATE）/ staff+extra_store_ids（多店归属留口）/ memberships+home_store_id（留口）/ stored_value_import_batches+store_id（店域闸补漏列，存量=mapping_json 单店推导回填，混合=NULL 不透出+登记）；journal idx 50 登记 |
| `server/src/db/schema.ts` | 四表扩列同帧（注记：留口列片 1 不消费，连锁回归批接；任何读口不得依留口列放闸） |
| `server/src/db/seed.ts` | 主店 hq_id 回填=自身（与迁移存量回填同口径，幂等） |
| `server/src/trpc.ts` | SessionUser+storeIds（老板跨店全域集合类型）；`storeScopeIds()` 助手（老板=全域/店长店员=本店单值，店域集合语义单源） |
| `server/src/auth/middleware.ts` | storeIds 装配：仅 merchant_owner——名下门店 ∪ 名下总部辖店（hq_id∈名下店）；manager/clerk 不装配（绑店闸写死）；头注口径同步 |
| `server/src/routers/storedValue.ts` | **漏闸修复**：executeImport 落 storeId=操作人本店；listImportBatches 按店域集合过滤（原=全平台透出：他店店名分布/本金合计/店名→storeId 映射） |
| `server/src/routers/report.ts` | **聚合漏闸修复**：n1LevelDist 档变事件收窄本店∪NULL 会员（membership_events 无 storeId 列，原=他店升降级计数混入） |
| `server/src/routers/store.ts` | `store.listMine` 新读口（分级结构读口，申报件：零新路由）：老板=全域集合含 storeType/hqId 两层透出；店长/店员=本店单行 |
| `server/src/__tests__/e2e.ts` | **隔离断言族新扩=族 78**（既有断言零删改）：78.1-78.6 双店互盲六组（预约/收银/会员账务/报表/员工排班/商品库存，B 读 A=零透出）+78.7 分级管理员（listMine 老板 A 全域[A+A2]/独立店主[B]/店长[B 本店]+店长读 A 报表零混入）+78.8 两层模型（回填=自身+二次回填幂等 0 行+全量非空）+留口字段 PRAGMA 在列 |

**红线自查**：零新依赖（package.json 未动）/ 禁令新增行命中 5 处=全为「储值」merchant/server 内部域（56.4b 分端豁免口径，客户端域零命中；CSV 表头=储值导入夹具既有格式）/ 行尾 LF / 无新路由（nav 双表零新增）/ 迁移幂等（UPDATE 带 NULL/单店守卫）/ 既有 e2e 断言零删改（族 78 纯追加）。

## 二、闸门（2026-10-06 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（根目录单命令） | exit 0 | gate-build.log |
| server typecheck | 0（三跑均 0） | gate-e2e-tail.log 头行 |
| e2e 全量（E2E_PORT=7220） | **全链路验收全部通过 ✅**（族 78 十绿；7220 无残留；种子库原样） | gate-e2e-tail.log |
| check-nav-closure | **118 路由 · 死 0 · 弱 0 · 豁免 6**（零新增路由） | nav-closure-118.json |
| smoke-routes | **102/102**（复跑；首跑 100/102 两条红=F1 环境件照头注口径消：smoke-deploy 造单 01M47VPDB3KN93WHMPHZVCW348 传入复跑） | gate-smoke-routes.log |
| review-e2e（e2e-nav-check） | 全绿 🎉（16 项） | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | gate-smoke-deploy.log |
| 实尺截图 | B 店主登录商家端=dashboard 全零/预约页空态（双店隔离画面）；逐屏目检已做 | 01/02-*.png |

探针机读件：probe-result.json（7 项全绿：listMine 分级对账+B 读 A 零透出 API 层+浏览器画面）。

## 三、漏闸修复清单（片 1 写死隔离·实证后修）

1. **storedValue.listImportBatches 全平台透出**（storedValue.ts:362 原无过滤）→ 加列 store_id（写口落本店）+读口店域集合过滤；存量批次 mapping_json 单店推导回填（dev 库 36 批全部单店归位，nulls=0）。
2. **report.n1LevelDist 档变事件混入他店**（membership_events 无店域）→ 收窄本店∪NULL 会员（与同函数档位存量口径一致）；e2e 78.4 实证（B=0/0 而 A≥1）。

## 四、待裁登记（候产品侧裁定，本片不动）

1. **跨店按 id 取数=FORBIDDEN 现状**（appointment.get/cashier.getBill 透出拒绝但不伪装 NOT_FOUND；62.3 族既有 NOT_FOUND 口径端点并存）——统一 NOT_FOUND 口径=行为变更候裁（e2e 78.1 断言文本已注记）。
2. **换绑申诉待审队列=平台级无店域列**（authSecurity.listPhoneAppeals：phone_change_requests 无 storeId 列，B 店主 dashboard 可见 A 店客户申诉卡=截图 01 顶行在案）——账号安全域归属口径候裁（维持平台共享 vs 加店域过滤；加列=新迁移+归属语义设计）。
3. **membership.forUser 无「本店客户」归属校验**（决策 #41 全域口径内可查任意 userId 档位+回馈金余额）——连锁期建议加本店客户闸，候裁。
4. **assertAppointmentAccess merchant 分支不含 clerk**（clerk 读本店预约详情 403=权限缺口，非泄漏）——候裁是否放宽。

## 五、环境清场留痕（dev 库专用，生产无此动作）

- **探针 B 店主夹具**（明面登记）：users `seed_probe_chainb`/探针 B 店主 + stores 探针隔离 B 店（北京坐标，hq_id=自身）——截图实证用，B 店零数据零副作用；
- **smoke 自毒化清场**（照封存卡既有工艺）：未来时域 stale 夹具单 9 张清残留——confirmed 3 张走 appointment.cancel 客户自助通道（01M3Y9FBGF/01M3Y9FK0R/01M435DMHQE），in_service 6 张无 API 消单路径走 dev 库 DB 级 UPDATE status='cancelled'+cancel_source='ops_cleanup'（01M4355Y5G/01M46GBX4Z/01M43N1NTA/01M450E93E/01M46EVCMB/01M47M6PKY）；根因=「示例客户=微光档最多提前 3 天预约」窗口内槽位被历次 smoke/e2e 夹具单占死；
- **复盘注**：e2e-nav-check/闸门造单链路依赖「3 天窗内有空槽」——dev 库连跑多批后须照本件 §五清场；另 completed 寄养跨夜单（阿强 10-07→10-10）与 completed 美容单仍占 10-08/10-09 部分时段（未清，不影响 d1-d3 10:00 造单口，登记知会）。
- **时间单位坑**：appointments 时间列=drizzle `timestamp` 模式=**秒**（非毫秒）——raw SQL 探查须用 unixepoch() 秒口径（本人一度误判「无未来单」，实证后修正，后续批次直接照此）。

## 六、收摊实证

（交付前补记：TaskStop×4 + netstat 复核 + taskkill 补刀明细。）

— A 窗（施工方）2026-10-06

## 六、收摊实证（补记）

TaskStop×4（server 7201 / preview 7130-7132）→ netstat 复核：四端口残留 LISTENING（vite/tsx 子进程）→ `taskkill //PID //F //T` 补刀（PID 10956/7968/38688/44408 子树）→ 复核 ALL_CLEAR（CDP 9223/9224/9339/9417 同步无残留）。
