# R11a 会员前置批（骨架批）· 施工设计底稿（K3 内部单一事实源）

> 依据：docs/ops/27_R11会员前置批任务书-冻结版V1.0.md（CJ-0922-12 会签+CJ-0922-13 三小项清零）+ docs/ops/28_R11a骨架批施工令.md。唯一真身=27 号档。
> 骨架批口径：不依赖设计规范 v2.0 的全部先行；会员页上骨架版（功能全通、工艺件自装、美观不评审，R11b 后置）。

## 一、数据域（迁移 0015）

### member_plans（档位配置表，端口管，同构 commission_rules）
version/rule_key/label/value_json/effective_from/active/created_by+audit。种子 version=1：
- `plan_weiguang` 微光：{free:true, price_fen:0, rebate_bp:0, service_discount_bp:10000, included_pets:∞→按多宠统一, label 权益}
- `plan_yinghuo` 萤火：{price_fen:19900, rebate_bp:200(2%), service_discount_bp:8800(88折), included_pets:3, extra_pet_fen:5900, max_pets:10}
- `plan_zhuguang` 烛光：{price_fen:29900, rebate_bp:500, service_discount_bp:8500, 多宠同上}
- `plan_nuanyang` 暖阳：{price_fen:59900, rebate_bp:1000, service_discount_bp:8000, 多宠同上}
- `rebate_settlement_day`：{day:5}（次月 5 日到账口径，故障顺延≤3 天页面明示）；`rebate_validity_days`：{days:365}；`membership_validity_days`：{days:365}。
- config 路由 domain 增 'member_plans'；配置端口加第四+页签「会员档」。

### memberships（会员实例）
id / user_id→users / plan_key text / sold_store_id→stores（办卡店；微光自助开档=null 或注册店） / started_at / expires_at（=开通日+365 天不重算） / status('active'|'frozen'|'cancelled') / pet_count int default 0 / paid_fen int default 0（实付，多宠附加费含） / cancel 留痕列（cancelled_at/cancel_reason/refund_fen） / created_at/updated_at。索引 user_id+status。

### rebate_accounts（回馈金余额）
id / user_id unique / balance_fen default 0 / status('active'|'frozen') / updated/created。

### rebate_logs（五类流水）
id / user_id / account_id / type('grant' 发放|'deduct' 抵扣|'clawback' 扣回|'freeze' 冻结|'clear' 清零) / delta_fen（正负） / before_fen / after_fen / source_id text（单号：订单/账单/退款单/期次批次） / period text 可空（'YYYY-MM' 期次） / settlement_id 可空→rebate_settlements / note / created_at/updated_at。索引 user+created / period。

### rebate_settlements（月度结算批次）
id / period unique / granted_count / granted_fen / scheduled_day / executed_at / status('done') / note / created/updated。

### 单据双归属列（决策 #41）
cashier_bills 已是消费店（store_id=消费店 consumed_store 语义，注释写死）；售卡单 sold_store=bill.store_id 落 memberships.sold_store_id；回馈金抵扣单 consumed_store=bill.store_id（消费店，提成/业绩按消费店算）。不新增列——以注释+报表口径落地，如有歧义再列。

### cashier 支付段
method 枚举应用层增 'rebate'（回馈金段）：settle 时 server 硬校验——rebate 段金额 ≤ 当单商品行合计（服务/寄养行禁用，红线 2）；余额不足可混搭；rebate 段不计已收（参考列同储值口径）；扣 rebate_accounts+rebate_logs type='deduct'（前后余额+单号）。用回馈金付的部分不再返（grant 计算基数=实收−rebate 段）。

## 二、回馈金账本域（决策 #33+CJ-0922-13）
- 发放 grant：商品实收完成时点（商城收货/收银结账）计提入"待到账"？——口径=计提即入账 rebate_logs type='grant' 挂期次 period，**统一次月到账**：grant 行生效日=次月 settlement；简化为 grant 落 logs（balance 即时+）还是次月才进余额？按任务书"统一次月到账"=次月 5 日才进可用余额。落法：grant 行写 logs（balance 不动，available 口径=settled 期次）；rebate_accounts 余额只反映已到账。月度结算定时器：每月 5 日（端口可调）把上一期次（上月 26~本月 25）grant 行汇总→rebate_settlements 批次单+余额入账（前后余额留痕）。故障顺延≤3 天+会员页明示口径。
- 抵扣 deduct：结账时余额 1:1 扣（仅已到账余额），rebate_logs 前后值。
- 扣回 clawback：R12 冻结接口启用——refund 商品行退款时：扣回额=该单已发回馈金×(退款商品金额÷该单商品总额)，1:1 扣减（余额不足扣 0 不负账，差额快照记"未扣回"），rebate_logs type='clawback' note 关联退款单号，refund linkage_json.rebateClawbackFen 填实值（ refund.ts 最小改动：列位从 0 变实算，接口形状不变）。
- 冻结 freeze：membership 到期→status='frozen'+rebate freeze 行（余额在不可用）；续费→解冻（active+expire 延 365 天）。
- 清零 clear：退会→balance 清零留痕+档位终止。
- 会员页账本=余额+本期预计（当期 grant 未结算合计）+明细五类+规则明面（红线 5：比例/周期/到账日/有效期/冻结解冻/退卡清零/扣回全写上）。

## 三、收银台四件
1. 售卡：bill item kind='membership'（refId=plan_key）；微光免费开档（0 元单直接成交）；付费三档到店付（现金/微信/支付宝段）+开通确认→memberships 落库（sold_store=本店，expires=+365d，pet_count 校验多宠附加费入单：第 4 只起 +¥59/年/只 10 封顶）。**售卡提成定额接通**：commission.ts cardLines 复活——kind='membership' 行按 commission_card_fixed.fixed_fen_by_plan 定额计提（萤火 5 元/烛光 10 元/暖阳 20 元，微光 0；规则版本时序口径保持），cardNote 退役。
2. 服务折扣：识别会员后服务/预约行自动按档折扣（adjusted=门市价×discount_bp，划线对照 unit_price 不动）；未识别=门市价；微光无折扣（10000）。
3. rebate 抵扣段：见§一 cashier 支付段。
4. 立省钩子：membership.savingsPreview(billId 或行集)→非会员当单"开通萤火立省 ¥X"=（服务折扣差+商品回馈金 2% 估）；结算页一屏一次不打扰。
5. 新客快速开卡：收银台旁路建档+开微光档（手机号）。

## 四、年费分摊双口径（APP-32）+退会（CJ-0922-13）
- 分摊：membership 月摊=paid_fen÷12（精确到分，余数落首月）；日结/看板并列：收现口径（售卡当日已收）+分摊口径（当月确认=Σ 有效会员月摊）。refund.dayStats 同型增 membershipStats（或 cashier dayStats 扩展）。
- 退会折算：剩余整月×月均价（月均价=paid_fen÷12 精确到分；例 599÷12≈49.92/月，剩 3 整月退 ¥149.75）；内测期线下原路退回+实退标记口径沿用 R12（membership.cancel 算额+清零回馈金+终止档位+全留痕；退款金额透出待线下退）。

## 五、客户端骨架（功能全通不评审美观）
- /member 会员页骨架：身份大卡（档位/有效期/状态）+回馈金账本（余额/本期预计/明细/规则明面）+权益表（四档对照，安心包=全员免费表述）+续费入口（到期前 30/7 天提醒条，非自动续费）+退会入口（重确认）。
- /member/open 开通页：四档对照卡（价格/回馈金/折扣/多宠明面）+≤3 步；内测期到店付口径明示（到店收银台开通指引）。
- 微光一键注册：member 页/开通页一键开微光（手机号即会员，customerProcedure）。
- 会员码页档位联动（既有码页读 membership 档位）。
- 新路由双表申报。

## 六、权限与三总规则
- 售卡/抵扣/折扣：收银台既有三级（clerk 可售卡收款；改价/退会审批 owner|manager）。
- 退会：manager|owner（留痕）；导出仅老板；三总规则沿用；防假功能：未开通件明文提示零写入。
- 店员不看营业额：分摊口径属营收数据——日结/看板维持既有角色闸。

## 七、e2e 增补（28 号令全清单）
三本账无互转（无接口实证+代码扫）/抵扣段仅商品（服务行 rebate 段 server 硬拒）/无月上限（grant 不设 cap 实证多笔累计）/到期冻结（expire 过日→frozen+余额不可用）/退卡清零（退会→余额 0+档位终止+留痕）/退货扣回接 R12（rebateClawbackFen 实算+余额不足扣 0+未扣回差额）/服务 88 折自动+门市价划线/售卡提成定额（萤火单→5 元入 cardLines）/多宠第 4 只+59（4 只=199+59）/双归属两字段（售卡单 sold_store/消费单 consumed_store 口径注释+实证）/退会折算剩余整月×月均价精确到分/安心包全员免费（权益表述+无 ¥15 残留 grep）。smoke-deploy 增：微光开档/萤火售卖到店付/回馈金返 2%/抵扣段仅商品/日结分摊双口径。
