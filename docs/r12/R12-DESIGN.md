# R12 退款专项 · 施工设计底稿（K3 内部单一事实源）

> 依据：《批次 R12·退款专项任务书 冻结版 V1.0》（老板会签 CJ-0921-23，唯一施工依据）+ 权限矩阵 V1.2 修订页（退款行）。初稿 V0.9 与 19a 过稿意见为背景。
> 纲：退款 ≠ 反结账。反结账既有逻辑一行不动；退款=经营行为计退款单列，已收不涂改，当日净额=已收−退款。

## 一、数据域（迁移 0014）

### refund_bills（退款单头）
id ULID / store_id→stores / refund_no text unique（RB-yyyymmdd-NNN，日序同既有单号发生器口径） / biz_date text（执行日 YYYY-MM-DD，V7 跨日口径：计入发生日日结不回填封箱历史） / bill_id→cashier_bills（原单，永存不涂改） / type（'full' 全额 | 'partial_items' 按行 | 'partial_amount' 按金额 | 'boarding_nights' 寄养剩余晚 | 'pass_cancel' 次卡退卡） / amount_fen int（本次退款总额） / reason text（必填） / status（'draft'|'executed'|'settled'|'rejected'；executed 后不可撤销） / linkage_json text（六联动快照 JSON：**含 rebate_clawback_fen 列位默认 0**——回馈金未上线 R11，冻结规则+R11 回归；快照另含支付段回补/库存回补/储值次卡回补/提成冲减明细） / refund_method text 可空（'offline_original' 内测期线下原路 | 'to_stored_value' 退储值账户；次卡退卡二选一必选） / settled_at int 可空（实退完成时间） / settle_note text 可空 / operator_id→users（发起/执行人） / approver_id→users 可空（超阈值/涉储值=店主批；店长自批单发起即执行 approver=本人） / created_at / updated_at。
索引：store+biz_date / bill_id / status。

### refund_bill_items（按行/按段退明细）
id / refund_id→refund_bills / bill_item_id→cashier_bill_items 可空（按行退的行） / payment_id→cashier_payments 可空（支付段回补行） / kind（'item'|'segment'|'night'|'pass'） / qty int 可空 / amount_fen int（该行/段回补额，精确到分） / detail_json text 可空（分摊占比/晚数等） / created_at / updated_at。

### refund_rules（配置表，同构 commission_rules）
version/rule_key/label/value_json/effective_from/active/created_by+audit。种子 version=1：`refund_threshold_fen` {threshold_fen: 50000}（店长累计阈值，按原单累计校验 V1）。config 路由 domain 增 'refund'；配置端口加「退款」页签（第四域，同构）。

### cashier_bills 增列（原单只挂标记，一字不改）
refund_status text 可空（null|'partial' 部分退款|'refunded' 已退款） / refund_bill_no text 可空（最近一笔退款单号；双向可查=refund_bills.bill_id 索引 + 原单回指）。

## 二、权限闸（矩阵 V1.2 修订页写死）
- 店员：无入口（UI 不渲染+server 403 明文）。
- 店长（merchantManagerProcedure 本店）：**原单累计退款额+本次申请 ≤ refund_threshold_fen 且不含涉储值** → 发起即执行（无审批环）；超阈值 → FORBIDDEN「该单累计退款已达店长上限，须店主」；涉储值（原单含储值支付段或次卡扣次段，或次卡退卡类型）→ FORBIDDEN「储值退款须店主」。
- 店主：全域；超阈值/涉储值申请的驳回权仅店主；导出仅老板留痕（总规则③）。
- 终态禁退（V5）：原单已冲正（reversal_of/reversed_at 非空）/已撤单（voided）/已全额退款 → UI 无按钮 + server 明文拒「原单已冲正/已撤，不可退款」。
- 已核销/已服务预约行：禁止退款，提示转店主特批（本批不建特批流，明文引导）。

## 三、六联动同事务（红线 1：任一失败整体回滚，禁止第三态）
refund.execute（draft 直执或店长自批单一步）事务内：
1. 退款单落库（refund_bills status='executed' + refund_bill_items 明细 + linkage_json 快照含 rebate_clawback_fen:0）；
2. 支付段回补：按金额退=**按支付段占比同比例分摊回补**（V3，分摊明细落 items detail_json 并页面明示）；按行退=该行金额按同样占比分摊到支付段；全额=逐段全回。现金段→退现金标记；微信/支付宝段→线下原路+实退标记；**储值段→余额回补**（stored_value_accounts 余额+、stored_value_logs 正向行 note 关联退款单号，前后余额留痕）；**次卡段→次数回补**（pass_deduct_log 正向行+note 关联退款单号；member_pass 剩余次数+）。
3. 库存回补：商品行 → stock_movements source='refund'（来源=退款单号，delta 正，前后值）+ products.stock 回补；
4. 预约行：paid_at/paid_fen 清零回待收款口径（仅未核销未服务）；
5. 财务口径：当日净额=已收−退款，日结页"退款单列"+**现金段净额**（V2：现金已收−现金退款）——读侧按 refund_bills.biz_date 聚合，不回填历史封箱（V7）；
6. 回馈金扣回列位：rebate_clawback_fen=0 落快照（接口冻结，R11 回归）。
emitEvent：RefundExecuted → store 频道（店长视图待办/财务联动）。
寄养提前接回（V4）：剩余晚数×晚单价，按支付段占比回补；已发生晚数一分不退（页面分段明示）。
次卡退卡（V8）：折算=剩余付费次数×（实付÷付费总次数），赠次不计价（作废明示）；退到储值账户或线下原路（refund_method 必选）；卡作废留痕（member_pass 状态置废，既有状态机查口径后定）。

## 四、提成冲减（V6 按比例，接 R9 只读计算）
computeMonth：源单行金额按该单 refund_bill_items（kind='item'/'amount' 分摊到行）冲减——全额退=该行提成全额冲减；部分退=该行提成×退款比例（精确到分，行内 refund_ratio 快照）；已快照月份不动（差额进当月调整项口径沿用）。规则版本仍按源单 settled_at（回溯修复口径保持）。

## 五、页面与路由（新路由双表申报）
- 商家端：收银流水页行内「退款」按钮（终态单不渲染）→ 退款 dialog（选类型→填原因必填→**六联动预览清单**（退什么钱/补什么货/回什么余额/回馈金列位）→重确认 D 套）；新增 /cashier/refunds 退款单列表页（店长本店查询/老板导出按钮留痕）。日结页退款单列+现金段净额；财务页同口径。
- 员工端店长视图：第八区块「退款审批/实退待办」（超 24h 未登记实退的单进待办提醒；实退登记=「实退完成」+备注，店长本店可办；超阈值/涉储值申请列表对店长只读提示须店主，店主可批可驳）。店长视图既有"退款审批=补丁②拦截卡"**替换为真功能**（任务书兑现承诺：替换站岗拦截文案）。
- 原单状态呈现：收银流水行灰签+「退款 ¥X」红字标签，双向可查。

## 六、e2e 增补（§七全清单）
店员 403 / 店长≤阈值六联动成功 / 拆分两笔累计超阈值顶到店主（V1）/ 日结现金段净额（V2）/ 组合支付 6:4 分摊回补（V3）/ 寄养提前接回退剩余晚（V4）/ 已冲正单无退款入口（V5）/ 部分退提成按比例冲减精确到分（V6）/ 跨日退款入发生日日结不回填历史（V7）/ 次卡赠次不计价（V8）/ 涉储值单店长明文拦截 / 部分退款余额内可再退 / 实退待办（>24h 未登记进店长待办）/ 快照含 rebate_clawback_fen 列位。smoke-deploy 增：现金单全额退/储值单余额回补/商品单 refund 流水前后值/寄养剩余晚部分退。

## 七、状态机与幂等
draft→executed（账已联动）→settled（实退完成）；店长可驳回 draft（驳回留痕 rejected+原因）；executed 不可撤销（纠错=再开正单）。同单重复提交同参申请=返回现状（refund_no 唯一+原单可退余额校验：部分退款累计≤原单可退余额）。
