# 卷宗 · 会员链路修正小批 片 3（E 股·微光→注册用户更名与限制解除）

> 令=开工令-产品-1008-会员链路小批片3.md ｜ 任务书=冻结版 V1.0 §一 E 股 ｜ 修订页=产品-1008-2 限制解除清单 V1.0（老板 10-08 两裁终审）｜ 纪律-PM-1008（CJ-1008-01）随批 ｜ 基线=叠片 2 尖 4027d751（codeload 钉 sha 拉取）｜ 分支 `feat/member-link-3` ｜ 卷宗 `evidence/member-link-3` ｜ PR 只开不合（base=feat/member-link-2）｜ 档位=K3·Max（涉钱参数面）｜ 施工=A 窗 2026-10-08。

## 一、施工总账（E 股四件+两裁全收）

1. **更名扫面「微光」→「注册用户」**：
   - 扫面清单先入卷：189 命中/37 文件（scan-baseline-weiguang-189.txt），逐件判改/留——**判留=已部署迁移 0023/0024/0027/0068**（军规：已部署迁移永不重写，仓行留档；0068=片 2 在途迁移，其改值由 0069 后盖）；rule_key=plan_weiguang 等工程师件永不动；
   - member_plans label 改「会员档·注册用户：免费档（手机号即在册）；宠物建档不限；…」（0069 迁移+种子同源）；
   - copy 端口「微光」字样键值全替：5+5 键改值（j1.alreadyMemberFree/j1.freeOpenedTitle/q1.nonMemberGuide/rules.r1Free/rules.r3Free/up.nonMemberBody/chg.freeNote/card.freePrice/card.claimWeiguang/checkout.freePlanBody）+6 键新增（建档不限×2/永久在册正名×2/toast 两键入端口）；开通页硬编码 toast 两串随修入端口；
   - 协议文本核查=PAY_AGREEMENTS 三份全文 grep **零命中=无需升版**（口径=涉字样才升版；帧 6 注记在卷）；
   - 货架呈现：卡面档名注册用户不带「会员」后缀（CardFace t===0 免后缀）+card.freePrice=「免费」+claim=「在册即享基础功能」——首行=「注册用户 · 免费 · 在册即享基础功能」（帧 2/3 亲眼）；裁①「开通会员」语义不动（付费档 CTA/升级链全带会员话术）；
   - **验收实证=grep 零残留三通道**（rename-zero-residual.txt）：码内 0（探针字面量亦拼串防自命中）/种子 0/端口值 0（e2e 89.1+dev 库直查 0 行）；生产端口值通道部署后产品侧抽核；
2. **功能闸解除**：宠物建档全员不限（plan_weiguang included_pets=100/extra=0/max=100 语义正名=不限；卡面矛盾文案收口=plans.tsx 免费档「宠物建档不限」+权益墙/三格账「建档不限」两键）；有效期永久正名「账号在即在册，永不冻结」（rules.r3Free/chg.freeNote/me.freeValidityValue+Note 四键；数据层 2099 不动）；安心包全员免费延续不动（零改动）；
3. **裁（1008-2）①**：回馈金+服务折扣**不放**（bp 读判零改动，89.5 零回退断言）；**券全员可领可用**——核闸实证=券矩阵领取/使用链（mall.couponTemplates/couponClaim/availableCoupons/couponUse）**本无限档闸**（只闸券状态/配额/本人），无需放开动作=券引擎零改动；e2e 89.3 注册用户领券→下单→核销留痕全链断言坐实；
4. **裁（1008-2）②预约提前**：advance_book_days——注册用户 3→**7**、萤火/烛光 7→**14**、暖阳 14 不动；端口参数（0069 UPDATE 三行）+种子（seed.ts 三同源）+maxAdvanceMsOf 缺行兜底 3→7 同口径；e2e 67.5 断言随改（第 8 天 400「最多可提前 7 天」人话照案）+89.4 三档直读断言。

## 二、申报件

1. 迁移 **0069**（copy 6 增 10 改+member_plans 3 行+commission_card_fixed 键名同步；INSERT=脚本生成+计数断言 6 ✓；幂等=NOT EXISTS 守卫/UPDATE active 行重放同值无害）；journal idx 69；dev 库已随 db:migrate 落（hash=30c00f93ccb9…，档位四行/adv=7·14·14·14/ip=100/端口值旧名 0 行实证）——**部署时须随码落库**；
2. e2e 族 89 新增（5 组 7 断言）+**67.5 断言随改**（裁②参数改值：3 天→7 天口径全改+栅格等宽注记）+68.5 档名断言随更名同步（includes 微光→注册用户，sed 扫面同帧）；56.1/76.3 计数 **3881→3887**（生成件 3886+seed 手补 1；域 72 不变）同步；
3. **nav 双表零申报**（零新路由；124 路由 0 死 0 弱 豁免 6；归屏率 97.0%>军规线）；
4. **已部署迁移永不重写军规零违例**（0069 全新件；0023/0024/0027/0068 留档不动）；
5. **CJ-1008-01 六条自过**：更名扫面=业务语言统一（注册用户）/函数单职责（planPetRuleText 免费档分支一句话）/注释写为什么（栅格等宽注记=裁②后档差承担件写明）/零死代码零调试残留（撤硬编码 toast 入端口）/结构按业务域摆（更名全在原域文件，零新址）/维护者视角自过 diff=已做。

## 三、闸门（2026-10-08 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build | exit 0 | gate-build.log |
| server typecheck | 0 | gate-typecheck.log |
| e2e 全量 | **两绿采信 954 断言**（族 89 五组 7 连 ✓；67.5 随改 ✓；55/87/88 零回退；56.1/76.3=3887/72；静默死 1 发=ECONNRESET 本机抖动照案复跑） | gate-e2e-green1.log + gate-e2e-green2.log |
| check-nav-closure | **124 路由 · 死 0 · 弱 0 · 豁免 6** | gate-nav-closure.log + nav-closure.json |
| smoke-routes | **108/108** | gate-smoke-routes.log |
| review-e2e | 全绿 ✅ | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | gate-smoke-deploy.log |
| 实尺截图 6 帧 | 我的卡面（注册用户徽标+开通 ›+永久在册格）/开通页首卡（注册用户 · 免费 · 在册即享基础功能+建档不限）/对比弹层（注册用户行+当前档注记+付费档开通 CTA）/券页注册用户领券（领取→已领取+我的券待使用）/会员中心（免费在册·随时升级+权益墙建档不限）/协议中心（会员服务协议在列+零旧名=无需升版注记）——**逐屏目检已做**（PROBE_ALL_GREEN，7 断言全 ok） | 01-06-*.png + probe-result.json |

## 四、红线自查

零新依赖 / 禁令新增行命中=0（「注册用户」文案涉钱词面自查：零「充值/储值」新增命中；「年费≠储值」否定明面句不动）/ 行尾 LF（改动文件 CR=0 逐件核）/ 迁移幂等（0069 守卫在案）/ 多句 INSERT=脚本生成+计数断言（0069 INSERT=6 UPDATE=10 生成器直出）/ 涉钱参数面=端口值+种子+e2e 三同源（advance_book_days 7/14/14/14；回馈金/折扣 bp 零改动）/ 隔离族不回退（87.8/88.6 全绿）/ 收摊必净（TaskStop×4+taskkill 补刀+netstat 复核 7100/7101/7102/7200 零监听+server/uploads 清零+staging 件删除）/ **CJ-1008-01 六条自过**。

## 五、观察项

1. **洗护栅格 7 天合成上限=档差读侧等宽**（裁②连带）：getWithServices 栅格 for i<7 固定窗口（体验片 2 既有件）——注册用户 7 天后与付费档 14 天在栅格等宽（暖阳 14 天口径自体验片 2 起就超出栅格窗口，非本片引入）；档差实证改由 boardingAvailability 晚数（8/10）+写闸 400+maxAdvanceMsOf 承担（67.5 注记在码）；**候裁**=栅格窗口是否随档放宽（体验专项另批评估）；
2. e2e 静默死 1 发（ECONNRESET 本机抖动）——清残留+复跑两绿采信照案（green1+green2b 两绿，run2 中段静默死环境件）；
3. 片 1/2 观察项（83.5 sweep 态漂移）延续在案——89 族开局钉 default_plan_key 同先例。

— A 窗（施工方，角色卡⑧ V2.2）2026-10-08 傍晚
