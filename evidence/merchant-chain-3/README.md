# 卷宗 · 商家端大批 片 3（收银台 18 件+裁件④）

> 令=开工令-产品-1006-商家端大批片3.md ｜ 任务书=冻结版 V1.0 ｜ 附件=片 0 盘点表 ｜ 基线=叠片 2 尖 85292e36（本地 d7c6fa6 同树）｜ 分支 `feat/merchant-chain-3` ｜ 施工=A 窗 2026-10-06 ｜ PR 只开不合。

## 一、施工总账（63 文件，+5073/−469；迁移 0053/0054 均幂等）

### 主建（盘点表差额行全收）
- **挂单增强**：整单备注输入+落库透出（快照带 note 既有通道点亮）+HoldPanel「挂出超 24h」徽标+单品备注（cashier_bill_items+note 列，0053；入参/落库/透出/小票全链）；
- **聚合扫码留口**：copy 键置灰注记（cashier.scanPayNote=通道资质候）+外设 PWA 上限注记（cashier.peripheralNote）——开口项 2 裁照办；
- **整单折扣精度实证补断言**：e2e 80.2（percent 90 对 100.05 元单 round-half-up=90.05 精确到分/amount 立减 0.05/优惠超非预约行合计=400）；
- **抹零**：规则端口 cashier_rounding_rule（none|jiao|yuan，service_rules 注册+seed 补种）+computeAmounts 第四参（roundingFen 落 cashier_bills+透出）——**退货不读取**（refund 不调经 computeAmounts，码径写死；整单退按 paidFen 口径一致，按行退不还原抹零=登记）；e2e 80.5（jiao 100.67→100.60 让利 0.07/yuan→100.00 让利 0.67/none 复原）；
- **挂账赊账**：settle 第七段 method='credit'（payments 段仅登记，computeDayTender 既有口径 credit 跳过不计已收）+credit_ledgers/credit_ledger_logs 两表（0053，状态机 open→partial→settled|written_off，**记录不可删**，结清/核销全程不碰真钱支付表）+creditList/creditSettle（超余额 400）/creditWriteoff（仅 owner+强制原因）；e2e 80.6（tender 仅现金段前后值精确）；
- **订金押金留痕透出**：appointment.prepaidListForStore 本店预付台账（押金 deposit 读口 66.1 已核）+台账专页透出；
- **小票打印+历史补打**：ReceiptPage 版式页（/cashier/receipt/:billNo，window.print+@media print 内联 72mm；实收=支付段合计，找零=现场动作不落票=注记）+PaySheet 成交态「打印小票」+BillDetailDialog「补打」（开口项 3 裁=浏览器打印 API，硬件直驱不做）；
- **快捷收款**：item kind='custom'（零迁移 text 扩域；customName/customAmountFen，自定义金额≠行改价 clerk 放行；不进库存/不进 rebate 校验）+PickPanel 快捷金额入口；e2e 80.4（金额精确+库存零扣减+tender 前后值）；
- **订单·单品备注**：行 note 全链（见挂单增强行）+小票透出；
- **交接班族六件**：开班备用金（ensureOpenShift 落规则默认额 shifts_opening_float_default_fen=50000 端口留口）+closeShift floatFen 点交+confirmHandover 接班人确认（指定接班人/当班开岗人，越权 403，幂等）/盲交（dayClosePreview blind=true→stats=null 不透账面）/长短款分级（|diff|>cashier_cash_diff_review_thresh_fen=1000 须 diffNote 否则 400 明文，落 reason 留痕）/非现金对账（dayClose 实点微信/支付宝入参+day_closes 落列）/现金收支 paid in-out（cash_movements 台账+日结账面=流水现金+Σin−Σout 快照透出调整额）+免单/折扣单列进交班快照 discountStats（免单本体=闸门骨架候批注记，本列=折扣+抹零）；e2e 80.7/80.8 全绿；
- **授权台账专页+周会导出**：agreement.listForStore（本店口径=签署人∈本店客户集，明面登记）+agreement.exportCsv（固定列+BOM+手写转义+emitEvent AgreementLedgerExported 导出留痕，仅 owner）+台账专页四区（挂账/押金/预付/授权）；
- **寄养按晚结算明细复走**：services/nightBreakdown.ts 公共件（与 refund 寄养剩余晚退逐字同源）+billSnapshot 寄养行 nightBreakdown 透出（总晚/已住/剩余/晚单价 floor 残余归已住）；e2e 80.11（3/1/2/19900 精确）。

### 裁件④随带
assertAppointmentAccess 增 merchant_clerk 本店放行分支（跨店仍 NOT_FOUND=裁件①不回退）；e2e 80.1（绑店 clerk 读 200/B 店 clerk 跨店 404）。

### 已建核销不施工（标注）
S1 挂单取单/S13 退款链按晚明细/S15 返还无月上限/S17 开发票登记——实证在仓照案；候他批注记行：S8 电子小票（随推送通道）/S10 团购平台券（体验批 E4/G2）/S16 券核销三缺口（同）。

## 二、申报件汇总

1. 迁移 **0053**（抹零列/单品备注列/班次备用金列/点交+确认列/实点非现金列/credit_ledgers+credit_ledger_logs+cash_movements 三新表/service_rules 三键注册；幂等）+**0054**（copy 键 43 枚注册；生成件 copySeedRows 3192 行同帧）——**0053 初版再犯 0052 断链（2 句缺 INSERT 前缀成空 SELECT）已修复复套，教训二次入卷：多句 INSERT 迁移=脚本生成+计数断言**；
2. e2e 族 80 新增（14 组断言；既有断言零删改）；56.1/76.3 计数 3150→3193 同步；71.1/72.1/78 不回退；
3. 新路由 2 个 nav 双表申报：/cashier/receipt/:billNo（check-nav-closure+smoke-routes 双表入行，120 路由/104 冒烟）+/ledger；
4. 新读口/写口：cashier.creditList/creditSettle/creditWriteoff/cashMoveRecord/cashMoveList/confirmHandover、appointment.prepaidListForStore、agreement.listForStore/exportCsv（agreementRouter 新命名空间）；EventType.AgreementLedgerExported 枚举扩列；
5. seed.ts service_rules 补种三键（重置后存续）；staff2/ManagerPage 类型收窄随动（dayClosePreview blind union 致 stats 可空，st!+注记）；
6. staff 端 taskCollabPort cashierHandoverOf 桥=无人调用残留（前端已全切直连 typed trpc，桥未动，退役候批）——前端 agent 报备在卷。

## 三、闸门（2026-10-06 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（根目录单命令） | exit 0（staff 类型收窄修复后复核绿） | gate-build.log |
| server typecheck | 0 | gate-e2e-full.log 头行 |
| e2e 全量 | **全链路验收全部通过 ✅**（族 80 十四组全绿；78/79 不回退；56.1 3193 键/68 域；7220 无残留；种子库原样） | gate-e2e-full.log |
| check-nav-closure | **120 路由 · 死 0 · 弱 0 · 豁免 6**（新路由 2 申报） | nav-closure-120.json + gate-nav-closure.log |
| smoke-routes | **104/104**（新路由 2 冒烟入行） | gate-smoke-routes.log |
| review-e2e | 全绿 🎉 | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | （终跑输出见交付回执，tail 段全绿） |
| 实尺截图 6 帧 | 快捷收款入口/挂单备注透出/结账屏挂账段+两注记/小票抹零行+单品备注/台账四区/交接班族面板——逐屏目检已做 | 01-06-*.png |

## 四、红线自查

零新依赖 / 禁令新增行命中=0（「储值」仅既有语境引用无新增）/ 行尾 LF / 迁移幂等 / 涉钱件全=台账状态机留痕不碰真钱（挂账/现金收支/押金预付口径一致，e2e 不碰真钱实证在案）/ 隔离族不回退（80.12 抽查绿）/ 收摊必净（TaskStop×4+netstat 复核+taskkill 补刀 PID 10692/12596/36084 子树→ALL_CLEAR）。

## 五、环境件登记

- 根目录 build 会重烧 dist 为默认 7200——截图/闸门前须重烧 VITE_API_BASE=7201（本片首跑探针 6 红=此因，重烧复跑全绿；后续批次照此序）；
- 探针备数=API 正规通路（抹零单/挂单备注单/挂账单/现金收支，dev 库，jiao 规则用后复原 none 守尾）。

— A 窗（施工方）2026-10-06 深夜
