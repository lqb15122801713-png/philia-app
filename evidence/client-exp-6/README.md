# 卷宗 · 客户端体验大批 片 6（批内末片 · 转正归并 2 件）

> 令=开工令-产品-1006-体验大批片6.md ｜ 施工依据=UX-1006-归并稿-正式版V1.0.md（档号 UX-08，老板 10-06 两拍转正）｜ 分支 `feat/client-exp-6`（基线=main@4f9927bc，即令基线 780420fc+UX-08 归档 docs-only 一件；codeload tarball 物化树逐字一致已核）｜ 施工=A 窗（施工方，角色卡⑧ V2.1）2026-10-06。

## 一、施工件（7 文件，+117/-96）

| 件 | 改动 |
|---|---|
| `apps/merchant/src/components/MerchantRail.tsx` | 批次扩口组整组撤销；管理组扩 9 口（员工/排班/薪资/XP 审核/**运营 · 审批中心**/监控 Hub/报表/权限矩阵/门店档案·设置）；/ops 双入口消歧=一口（testid rail-ops 沿用，ClipboardCheck 沿用）；bd 角标接线=审批（selfCheck.listPending）+申诉（report.listMetricAppeals pending）合并计数（仅 canManage 取数，props 覆盖留口）；头注同步 UX-08 冻结结构 |
| `apps/merchant/src/components/ConsoleDock.tsx` | 第五槽「我的」→「设置」（指向 /settings 不变；slot key me→settings、testid dock-me→dock-settings=结构转正件申报）；头注同步 |
| `apps/merchant/src/copy/console.ts` | wnav.ops 键值「审批中心」→「运营 · 审批中心」；wnav.dockMe「我的」→「设置」（改键值不改键名）；删 5 键（wnav.groupBatch/wnav.batchNote/wnav.opsBatch/wnav.opsBatchNote/wnav.dockMeNote） |
| `server/src/db/copySeedRows.ts` | 生成器重跑产物（3138→3133 行；2 改 5 删同帧） |
| `server/drizzle/0049_client_exp6_wnav_merge.sql` | 新迁移：UPDATE 2 键值 + DELETE 5 键（幂等；端口值优先口径下存量库必须落） |
| `server/drizzle/meta/_journal.json` | idx 49 登记 |
| `server/src/__tests__/e2e.ts` | 56.1/76.3 计数断言 3139→3134 同步（结构转正件申报）；新增族 77（77.1 一口转正+4 键零残留 / 77.2 设置转正+注记撤除+wnav 域「我的」零残留）；头注血统续登 |

**红线自查**：零新依赖（package.json 未动）/ 禁令六词新增行命中=0 / 行尾 LF / icon 零新画（lucide 沿用）/ clerk 白名单仅收银台不动 / 断点双形态不动 / 无新路由（nav 双表零新增）/ 迁移幂等（UPDATE/DELETE 天然幂等，重放零副作用）。
**未施工（令外件）**：候补「我的」页=方案 B 归补缺专项；段 2 所见即所得（候裁）。

## 二、闸门全绿（2026-10-06 实跑）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（根目录单命令 `npm run build`） | exit 0 | gate-build.log |
| server typecheck（`tsc --noEmit`） | exit 0 | （本卷 README 登记；输出空=0 错） |
| e2e 全量（`E2E_PORT=7220 npx tsx src/__tests__/e2e.ts`） | 全链路验收全部通过 ✅（族 77 两绿新增；7220 无残留；种子库原样） | gate-e2e-tail.log |
| check-nav-closure | **118 路由 · 死 0 · 弱 0 · 豁免 6**（复跑绿；首跑 60 死=server 初启未带 CORS_ORIGINS 致登录失败环境件，补 CORS 复跑即 0 死，见 §四） | gate-nav-closure.log + nav-closure-118.json |
| smoke-routes | **102/102**（复跑；首跑 100/102 两条红=[staff] /execute/历史演示单=F1 口径环境件，smoke-deploy 造单 01M47M6PKYK2EVRRW03E6Y34W5 传入 SMOKE_APPT_ID 复跑消红） | gate-smoke-routes.log |
| review-e2e（e2e-nav-check） | 全绿 🎉（真实造单/双出口/整行可点/R-Nav-2 状态闭环/R-Nav-3） | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（口令门未设置开发期口径；held 零新增残留） | gate-smoke-deploy.log |

## 三、实尺截图（Edge headless CDP，逐屏目检已做）

| 图 | 内容 | 目检结论 |
|---|---|---|
| 00-rail-full-tall.png | rail 全高全景（1440×1260 owner）：经营 6/商城 3/管理 9+foot（开发者管理端+规则配置/文案端口/槽位端口+门店卡） | 十九口+foot 逐口可见；「运营 · 审批中心」236px 不折行（UX 风险②实测过）；bd 角标赭红胶囊=2 |
| 01-rail-19-desktop.png | /dashboard 桌面形态（1440×900） | 总览·驾驶舱淡金左条激活；角标 2 在「运营 · 审批中心」一口 |
| 02-ops-single-highlight.png | /ops 落屏 | rail 单高亮（仅 rail-ops 亮）；页内自检审核 pending 1+指标申诉 pending 1=角标 2 的双源实证同框 |
| 03-dock-5slots-mobile.png | mobile 390×844 dock | 五槽逐字 总览/门店/收银/报表/设置；「我的」零残留；rail 藏形互斥 |
| 04-dock-settings-active.png | mobile /settings | dock「设置」槽激活短划；页题「设置」 |

结构对账机读件：rail-dump.json（十九口口序/指向/角标）/ dock-dump.json（五槽逐字+href）/ probe-result.json（探针 14 项全绿）。
角标数据核：dev 库 selfCheck.listPending=1（2026-10-03 自检）+ report.listMetricAppeals pending=1（丽丽差评归属申诉）→ 合并=2，API 双源直查已核（探针 check 6 详情）。

## 四、环境件观察（非本片缺陷，登记不瞒）

1. **nav-closure 首跑 60 死**：server 7201 初启未带 CORS_ORIGINS（缺省不含 7130-7132）→ 三端页 dev-login 跨域失败 → 误判死胡同；补 `CORS_ORIGINS=http://localhost:7130,http://localhost:7131,http://localhost:7132` 重启复跑=0 死。后续批次跑前清单应含「server 起前核 CORS_ORIGINS 覆盖 preview 端口」。
2. **/ops PDCA 区「数据加载失败」**：dev 店主账号未绑 staff 记录 → pdca.list 403（需要员工身份）——dev 种子数据既有特征，本片未触 pdca/taskCollab 任何代码（diff 零命中），巡检汇总/自检审核/申诉复核三区正常。
3. **迁移手工追平（dev 库纪律）**：0049 手工套用（PRAGMA FK=OFF，upd 2/del 5，sha256=5faf7069dfa873b30763c4edf9581c5deb6563c0664eafa62045025a297d9ae7 补登 __drizzle_migrations），未跑 db:migrate 全量重放。
4. **0047 回填件保持原样**：生成器重跑会带出新版 0047（删 5 键后的版本），但 0047 已上生产——已 `git checkout` 复原，删键口径全部由 0049 承载（已应用迁移不重写）。

## 五、申报件汇总（结构转正件申报制）

1. e2e 断言同步改：56.1 两处 + 76.3 一处计数 3139→3134（wnav 2 改 5 删所致；68 域不变）；
2. copySeedRows 生成件重生成（3133 行+seed 手补 1=3134）；
3. 迁移 0049 新增（幂等；sha256 见 §四.3）；
4. dock 第五槽 testid dock-me→dock-settings、slot key me→settings（码内标识符，非文案；全域 grep 无外部引用——员工端 dock-me 系另一应用不受影响）；
5. wnav.* 改键值不改键名（wnav.ops/wnav.dockMe）+ 删组签注记 5 键（随批注册=本件+0049）。

— A 窗（施工方）2026-10-06

## 六、收摊实证

TaskStop×4（server 7201 / preview 7130-7132）→ netstat 复核：7130/7131/7132/7201 四端口残留 LISTENING（vite/tsx 子进程）→ `taskkill //PID //F //T` 补刀（PID 29988/41760/54308/48388）→ 复核 ALL_CLEAR（CDP 9223/9224/9339/9341/9417 同步无残留；Edge 探针进程 exit 钩已 taskkill+rmSync profile）。
