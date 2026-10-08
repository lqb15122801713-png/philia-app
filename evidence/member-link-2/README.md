# 卷宗 · 会员链路修正小批 片 2（线上升级 mock 域+入口断链）

> 令=开工令-产品-1008-会员链路小批片2.md ｜ 任务书=冻结版 V1.0 §一 B 股（老板 10-08「按建议」签）｜ 纪律-PM-1008（CJ-1008-01 人类可维护红线）随批生效 ｜ 基线=叠片 1 尖 7d88cc55（codeload 钉 sha 拉取）｜ 分支 `feat/member-link-2` ｜ 卷宗 `evidence/member-link-2` ｜ PR 只开不合（base=feat/member-link-1）｜ 档位=K3·Max（涉钱面）｜ 施工=A 窗 2026-10-08。

## 一、施工总账（B 股四件全收，裁死口径照执）

1. **pay.createOrder 实现 membership_upgrade 业务域**（预留枚举拒单→修通）：
   - 金额 server 重算=`computeUpgradeDiff` 同源（membership.ts 导出复用，不重写算式；微光档=新购口径全价+有效期重起算，付费档=剩余整月折算补差）；入参 amountFen/petCount 一律不信（宠物数=现会员档案值）；
   - 收单闸：无会员档案/已是目标档/冻结档/期内不降级=400 全人话（零代码标识，裁④延续）；
   - 兑付=`fulfillMembershipUpgrade`（事务内，settlePayOrderPaid 内核双域分支）：照 merchant upgrade 写行工艺，线上域差异=**无收银补差单**（bill_no=NULL，补差留痕=membership_events.meta.payNo=支付单号）+sold_store_id=NULL；**幂等=已是目标档零写入零单据**（只置 paid）；
   - 掉单补开 reconcile / mock-callback / HMAC 验签路径=membership_open 既有工艺域通用化（归属闸/懒超时/sweeper 全部域无关化）；listMine/recordsMine 双域并集透出（摘要含 fromPlanKey/newPurchase）；refund.execute 线上原路联动反查双域（预留域 mall 仍拒单）；
2. **MemberUpgradePage**：Mock 水印条页顶常显（R10）+每目标档卡「去支付 ¥{差价}」钮（金额=server 试算值透出零自算）→ /member/checkout 确认订单；channelEnabled=false=回落维护态到店指引卡（照 MemberCheckoutPage 工艺）；微光档=新购口径全价句明面（既有 newPurchaseLine 在列）；
3. **入口断链修通**：①「我的」卡面按档分化——微光=「开通 ›」指 /member/open，付费档=「续费 ›」不变（copy 键 me.cardOpenCta/me.cardRenewCta 入端口）；②开通页（MemberOpenPage/MemberCheckoutPage）对微光档不分流「已是会员→去会员中心」——直达选档开通流程（deck 默认选中末位=推荐付费档；确认订单页升级域直通）；③四档对比弹层行内 CTA 同口径接通（付费档→确认订单/免费档=一键开通/微光已是=「当前档」注记；付费档会员不画走升级页）；
4. **裁②重申照执**：不接真支付通道（微信/支付宝=线上化专项另批）；mock 内测链四态可演（成功/失败/超时关单/掉单补开，帧 6/7/8/9 实证在卷）。

## 二、申报件

1. 迁移 **0068**（copy 键 11 增 4 改：增=up.payCta/me.cardOpenCta/me.cardRenewCta/j1.compareRowCta/j1.compareRowFreeCta/j1.compareRowCurrent/checkout.planLabelUpgrade/checkout.upgradeNoteNewPurchase/checkout.upgradeNoteDiff/state.paidTitleUpgrade/state.paidBodyUpgrade；改=j1.alreadyMember/j1.alreadyMemberFree/j1.freeOpenedBody/up.freeTierGuide[升档线上化口径同步]；**撤牌 4 键**=checkout.alreadyTitle/alreadyBody/alreadyBodyFree/alreadyCta 出码内宇宙[仓行留档不写 DELETE]；INSERT=脚本生成+计数断言 11 ✓；幂等 NOT EXISTS 守卫/UPDATE active=1 行）；journal idx 68；dev 库已随 db:migrate 落（0068 hash=4f6f781d8ea9… 补登实证在交付回执）——**部署时须随码落库**；
2. e2e 族 88 新增（6 组 14 断言；既有断言零删改）；56.1/76.3 计数 3874→3881（生成件 3880+seed 手补 1；域 72 不变）同步；
3. **nav 双表零申报**（零新路由；124 路由 0 死 0 弱 豁免 6；归屏率 97.0%>军规线）；
4. **已部署迁移永不重写军规零违例**（0068 全新件）；
5. **CJ-1008-01 六条自过**：命名说人话（fulfillMembershipUpgrade/bizSummaryOf=业务语言）/函数短小单一职责（兑付内核按域分支单职责，quote/createOrder 升级域独立分支）/注释写为什么（线上域无收银补差单=报备明面、配置漂移防御注释）/零死代码零调试残留（撤牌四键全链清：码内宇宙/渲染位/探针断言同帧）/结构按业务域摆（pay 域文件内扩不新址，算式单源复用 membership.ts 导出）/维护者视角自过 diff=已做；
6. **探针工艺注记**：member-link-2-shots.mjs（tmp/memberlink2/，CDP 直驱 Edge headless，430×1400 实尺）——帧 8 超时关单夹具=直改 timeout_at（移位铁律=不动 created_at）；探针进程收尾时 libsql 句柄挂起由超时回收（断言/截图在挂起前已全绿落盘，工艺注记非产品缺陷）。

## 三、闸门（2026-10-08 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build | exit 0 | gate-build.log |
| server typecheck | 0 | （随改随跑终态 0） |
| e2e 全量 | **两绿采信 947 断言**（族 88 六组 14 连 ✓；55/87 零回退；56.1/76.3=3881/72；涉钱前后值精确到分：88.1 微光新购全价 19900 成交+paidFen=19900+有效期重起算≈365 天+sold_store=NULL；88.3 萤火→烛光补差=试算值精确到分+到期日不动+paid_fen=原实付+补差；**88.2 幂等=重放零写入零单据+memberships 行数不变+事件不增**；mock 四态 88.4 落） | gate-e2e-green1.log + gate-e2e-green2.log |
| check-nav-closure | **124 路由 · 死 0 · 弱 0 · 豁免 6** | gate-nav-closure.log + nav-closure.json |
| smoke-routes | **108/108** | gate-smoke-routes.log |
| review-e2e | 全绿 ✅ | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | gate-smoke-deploy.log |
| 实尺截图 10 帧 | 微光卡面「开通 ›」/开通页直达选档（默认暖阳）/升级页「去支付 ¥199.00」钮+Mock 水印+新购口径标/确认订单升级域（升级至档位+新购口径句+水印双位+多宠±不画）/paying/failed/closed/paid「会员已升级」/掉单补开前后——**逐屏目检已做**（PROBE_ALL_GREEN，12 断言全 ok） | 01-09b-*.png + probe-result.json |

## 四、红线自查

零新依赖 / 禁令新增行命中=0（新文案 grep「充值」「储值」零命中；「年费≠储值」否定明面句豁免口径不动）/ 行尾 LF（14 改动文件 CR=0 逐件核）/ 迁移幂等（0068 NOT EXISTS+active 守卫）/ 多句 INSERT=脚本生成+计数断言（0068 INSERT=11 UPDATE=4 生成器直出）/ **涉钱=前后值精确到分+server 重算唯一可信源**（入参假金额 1 分被覆盖=19900；宠物数入参错值被档案值覆盖；Σ段硬校验工艺延续）/ 隔离族不回退（88.6 他人单 403；87 族全绿）/ 收摊必净（TaskStop×4+taskkill 补刀+netstat 复核 7100/7101/7102/7200 零监听+server/uploads 清零）/ **CJ-1008-01 六条自过**。

## 五、观察项

1. 片 1 观察项延续：83.5 自动回滚 sweep 态漂移（88 族开局钉 default_plan_key 同 87.1 先例已防）；e2e 静默死口径照案（本次两跑两绿未遇）；
2. 续费域仍=到店既有链（pay.quote renewal 试算透出不动；真收走商家端 membership.renew）——线上续费=线上化专项候批，本批不碰；
3. PayStatePage 重试钮对升级域=同域同档重开（server 尝试序号分配）——已按 bizDomain 透传修正（帧 7 重试路径在列未点验，e2e 88.2 同档重放 400 口径互斥明面：重试发生在终结单后=新尝试序号，不撞 400）。

— A 窗（施工方，角色卡⑧ V2.2）2026-10-08 午后
