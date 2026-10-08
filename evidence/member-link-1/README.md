# 卷宗 · 会员链路修正小批 片 1（收银台三件：死路+读路径+人话化）

> 令=开工令-产品-1008-会员链路小批片1.md ｜ 任务书=冻结版 V1.0（老板 10-08「按建议」签）｜ **纪律-PM-1008（人类可维护红线 CJ-1008-01）随批生效** ｜ 基线=main@f5d44cd1 ｜ 分支 `feat/member-link-1` ｜ 施工=A 窗 2026-10-08 ｜ PR 只开不合（批两片全齐产品侧直合直部）｜ 档位=K3·Max（涉钱面）。

## 一、施工总账（A 股三件全收，裁死四条照执）

1. **升级死路修通**：MembershipPanel `upgradeAvailable` 撤「微光档（free）仍走售卡 mode 不动」排除行——**微光档（free）active+存在更高档=同亮「升级补差」页签**（标「新购口径」既有件=cashier.upgradeNewPurchaseTag/Note 双键在列）；**售卡页签只对纯非会员开放**（member 已识别含微光一律不走进售卡=页签不渲）+`cashier-member-service-entry`「会员服务 ›」常驻入口（已识别会员唯一入口=面板按状态自动落页签）；
2. **读路径缺口补掉**：选中客户即读会员状态（forUser 正式通道+MEMBER_FOR_USER_KEY 缓存同帧——既有管道接通零改动）+**识别后自动落页签**（useEffect 三态：非会员=售卡／active=升级[upgradeAvailable]或续费／frozen=续费解冻；deps 不含 mode=手动切页签不回拽）；**撤牌两键**=`cashier.memberStatusNote`/`cashier.memberDiscountUnknown` 随修撤除（出码内宇宙；库内行留档=端口宇宙只增不改；渲染位三处[MembershipPanel 注记/CartPanel 提示/CashierPage 传参+注释]同帧清）；
3. **错误人话化（裁④=会员域全端点扫净）**：membership.ts 全端点 badRequest/forbidden/notFound 逐条过——唯一代码标识漏点=`:806` sell 已有会员拒单文案含 `membership.renew`，改=「该客户已是会员（续费/升档请走对应页签办理，不要重复购卡；退会后可重新购卡）」（纯人话零标识）；其余各条本已人话（会员码格式/签名不符/已过期/多宠封顶/支付合计须等于续费金额等=中文人话在案）；新文案入 copy 端口（memberNonMember/memberServiceEntry 两键非工程师可改）。

**裁①法条化照执**：微光→付费 UI 语义统一「开通会员」（新购口径标在案，不漂移）；裁③期内只升不降维持不变（server 闸原文不动）。

## 二、申报件

1. 迁移 **0067**（copy 键 2 枚=cashier.memberNonMember+cashier.memberServiceEntry；**撤牌两键不写 DELETE=宇宙只增不改仓行留档**；INSERT 计数断言==2 ✓）；journal idx 67；dev 库手工追平（sha256=15999dfd… 补登，migrows=68）；
2. e2e 族 87 新增（8 组 8 断言；既有断言零删改）；56.1/76.3 计数 **3874→3873→3874**（片 4=3874；本片撤 2 增 2=3874 等值回；域 72 不变）同步；
3. **nav 双表零申报**（零新路由；归屏率 97.0%>90% 军规线，未归屏 115/3874=3.0%<10%）；
4. **已部署迁移永不重写军规零违例**（0067 全新件）；
5. **CJ-1008-01 六条自过**：命名说人话（memberServiceEntry/openFreeMembershipCore=业务语言）/函数短小单一职责（openFreeMembershipCore 落档内核单职责）/注释写为什么（upgradeAvailable 撤行注记=死路修通来历）/零死代码零调试残留（memberDiscountUnknown 全链清：prop/传参/注释/渲染位）/结构按业务域摆（收银台域文件内扩不新址）/维护者视角自过 diff=已做；
6. **环境件登记**：e2e 静默死三发（fetch failed/ECONNRESET，run3/6/9 清残留后复跑，两绿采信带重试脚本在 tmp/e2e-ml1-green.mjs）；探针两轮修正（入口 testid 精确化[会员服务 › 新开钮]+面板打开等待加长）=探针工艺修正非产品缺陷；**B 窗可维护性评审候件**=本卷宗。

## 三、闸门（2026-10-08 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（7201 轨）+根目录 build（Y1 轨） | 全 exit 0 | gate-build.log |
| server typecheck / merchant tsc | 0 / 0 | （随改随跑终态 0） |
| e2e 全量 | **两绿采信 933 断言**（族 87 八组 8 连 ✓；51-86 零回退；56.1/76.3=3874/72；76.1 归屏率 97.0%；76.4 未归屏 3.0%） | gate-e2e-full.log（绿 2）+gate-e2e-green1.log（绿 1） |
| check-nav-closure | **124 路由 · 死 0 · 弱 0 · 豁免 6** | nav-closure.json+gate-nav-closure.log |
| smoke-routes | **108/108** | gate-smoke-routes.log |
| review-e2e | 全绿 🎉 | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | gate-smoke-deploy.log |
| 实尺截图 5 帧 | 微光档升级补差页签亮+新购口径标+售卡不亮/萤火 active 自动落升级页签/frozen 注记/纯非会员售卡亮/人话 400 对照——**逐屏目检已做** | 01-03-*.png+probe-result.json（PROBE_ALL_GREEN） |

## 四、红线自查

零新依赖 / 禁令新增行命中=0 / 行尾 LF / 迁移幂等（0067 NOT EXISTS 守卫）/ 多句 INSERT=脚本生成+计数断言（0067=2 ✓）/ **涉钱=前后值精确到分**（87.1 upgrade 萤火全价 19900 成交+paidFen=19900+soldStoreId=办理店+补差单号留痕+同档重放幂等零单据；87.4 Σ段≠差价 400+会员档零动作；87.5 frozen 400 明文）/ server 算式写死唯一可信源 / 隔离族不回退（87.6 权限闸+87.8 互盲）/ 收摊必净（TaskStop×4+netstat 复核+taskkill 补刀实证在卷）/ **CJ-1008-01 六条自过**。

## 五、观察项

1. **83.5 自动回滚 sweep 态漂移对测试夹具的影响**（87.1 实证）：幂等锚把窗口内端口值回滚会改变后续注册落档档位——e2e 87.1 开局钉 default_plan_key=plan_weiguang（钉死夹具）已防；生产语义=特性正确，**候裁**=是否给幂等锚加「改+复原对豁免」（片 4 观察项 1 同款，合并另批评估）；
2. **e2e 静默死今天三连**（本机环境抖动加剧，清残留后两绿采信工艺照旧有效）——B 窗核查时若遇同征照案复跑；
3. 收银员 clerk 无「会员服务 ›」入口（canManage 闸与 server merchantProcedure 同档——读口 quote 同闸 87.6 已断 403/200 双帧）。

— A 窗（施工方，角色卡⑧ V2.2）2026-10-08 午
