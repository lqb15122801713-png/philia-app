# R11a 可执行核查证据包（Kimi Code B 窗 · 角色卡⑨）

- 核查对象：PR #40 `feat/r11-membership`（squash 合并 main@65911fba）
- 核查人：Kimi Code B 窗（可执行监理），直报老板，PM 登记
- 环境：老板本机，Node v24.21.0（CJ-0923-03 授权），全部闸门亲跑
- 日期：2026-09-23

## gates/（闸门日志与 JSON）

| 文件 | 内容 | 结果 |
|---|---|---|
| 三端build.log | 根单命令 `npm run build` 三端构建尾部 | ✅ exit 0 |
| typecheck+迁移幂等.log | server `tsc --noEmit`；全新库连跑两遍迁移同单 16 条（含 0015） | ✅ exit 0 / 幂等 |
| e2e-48节全绿-tail.log | server e2e 全链路 48 节尾部（R11a §40~§48 逐条 ✓ + 全链路全部通过） | ✅ exit 0 |
| smoke-routes-首跑48-50.json | 首跑 48/50（/execute 两条红） | 根因见下 |
| smoke-routes-复跑50-50.json + 复跑.log | 插夹具预约后复跑 | ✅ 50/50 exit 0 |
| check-nav-closure-66路由0死胡同.json + .log | 66 路由四要素体检 | ✅ 0 死胡同 0 弱 exit 0 |
| smoke-deploy-73项.log | 生产 VPS 120.53.102.45 复跑（main@65911fba，口令门启用态）：**77 项全绿 0 失败**（R11a 段：微光开档/openFree 幂等/萤火 4 宠 25800/双归属/回馈金 2% 挂期次/抵扣段仅商品 403/日结分摊双口径 cashFen 129000→154800 vs amortizedFen 19350） | ✅ exit 0 |

## shots/（渲染实证截图）

| 文件 | 内容 |
|---|---|
| 01-客户端-member-非会员态.png | /member 开通引导+权益对照（四档数值与 27 号档一致） |
| 02-客户端-member-open-四档选档.png | /member/open 第 1 步：微光一键开通/付费档到店开通 |
| 03-客户端-微光开通成功-有效期2027-09-23.png | 真实点击开通，有效期=+365 天精确 |
| 04-客户端-会员中心-会员态回馈金账本.png | 生效中卡面+回馈金账本零值诚实显示+期次 2026-09 |
| staff-execute_01M256D240E19GWNG2QMFV3Q8V.png | 首跑 /execute 失败留证（根因：fresh seed 零预约+SMOKE_APPT_ID 默认值为规范环境 ULID，非本批回归；复跑 50/50 已证） |

## 结论

R11a 骨架批**全链闭环**：本地闸门（build/typecheck/e2e/smoke-routes/nav/禁令 grep/零新依赖零新迁移/迁移幂等/钱红线五条/渲染实证）+ 生产 smoke-deploy 77 项全绿。卷宗 evidence/r11-membership 分支在库核对一致。B 窗 T14 核查令执行完毕。
