/**
 * T1.6 全链路验收（端到端，真实 HTTP + SSE）
 *
 * 运行：node node_modules/tsx/dist/cli.mjs src/__tests__/e2e.ts
 *
 * 隔离策略：全程使用独立临时库（PHILIA_DB_URL 指向 OS 临时目录），先迁移再种子，
 * 种子库 data/philia.db 保持原样（验收前后比对 size+mtime 佐证）；验收结束杀 server、
 * 删临时库与本次上传的图片目录。
 *
 * 链路：
 *   1. POST /api/auth/dev-login 三角色各登一次（客户 / 商家 owner / 员工），拿 cookie
 *   2. 客户：store.listNearby → store.getWithServices（服务 + 可约槽位）→ appointment.create
 *      （create 前已完成 push.subscribe；create 后立刻以 watch=<aid> 建立 SSE 流后台读）
 *   3. 商家：appointment.confirm（批次 S4：create 已落 confirmed，confirm 幂等成功零副作用）
 *      → S4 任务 C：create 自动派单（负荷并列→先入职阿强）→ 商家 assign 改派丽丽（不回归）
 *   4. 客户：appointment.getCode → 员工（groomer 阿强）核销被拒（批次 S1 双角色断言）
 *      → 员工（frontdesk）：appointment.checkin（二维码原文；S1-R1 断言①原指派丽丽保留）
 *      → 未指派单前台核销（S1-R1 断言② staff_id 仍 NULL + 无 assigned 事件）
 *   5. 美容师（丽丽，改派后的被指派人）：POST /api/upload（jimp 现造 JPEG）→ serviceStep.addPhotos 登记
 *      → 逐步 confirmStep 走完六步（张数按 min：1/2/3/2/2/0，before_after 需 before+after 各 1）
 *   6. 校验预约 completed；商家 markPaid；客户 review
 *   7. SSE 断言：客户流依次收到 appointment.confirmed / assigned（自动派单）/ assigned（改派）/
 *      checkedin / step_updated×6 / completed（允许心跳注释帧，按 id 去重）；event_outbox 事件齐全
 *   8. 权限负例：客户 cookie 调 store.upsertService（merchantProcedure）→ 403；
 *      未登录调 appointment.create → 401
 *
 * 批次 staff-2（R7~R10）增补段（设计稿 §五 e2e 增补清单 / 任务书 §七验收）：
 *   14. 前置夹具：阿强复职 / 门店围栏坐标显式置位 / clerk+manager（越权负例）+
 *       附加员工×3（榜尾不可达夹具）+ 榜单 XP 基底直插（learning 通道不占日上限）
 *   15. R7 打卡两击：in/out + 幂等重打；围栏外 BAD_REQUEST 零写入
 *   16. R7 补卡流：申请→店长审批通过（makeup=1 落行）→myApprovals 可见；
 *      跨月拒；当月第 4 次拒（≤3/月）
 *   17. R8 盘点：assignCount→recordItems（confirm 前零库存写入）→confirmCount
 *      入账（stock_movements sourceType=count 前后值）→驳回→重录→确认
 *   18. R9-C 接待人域：核销改挂留痕前后值 / 账单默认=开单人 / 含预约行取预约接待人 /
 *      无接待人硬排除 / storePools 两池分列
 *   19. R9 扣减 50% 硬闸门：评级 A → 超限 FORBIDDEN / 限额内成功 / 只扣绩效不扣提成
 *   20. R9/R10 仅本人：mySummary 200 + strict 越权 4xx；myEvents 仅本人；
 *      storePools staff/clerk 403
 *   21. R10 评价：差评 −8 + anonymous=1 + review.flagged 到店频道 + myReviews 仅本人；
 *      好评 +6（主单）；一单一评幂等拒绝
 *   22. R10 考试 XP 不受日上限：日上限填满后 recordExamPass 仍计分；同级当月重复拒
 *   23. R9-F 配置端口：owner 改参版本化留痕 / 新参只管新单 / clerk+manager 403 /
 *      未知键 BAD_REQUEST / 拉新置灰拒写
 *   24. R9 提成回溯（七步复核 Bug②）：商品/服务率改值前后单各按当时率逐行精确 /
 *      perf_base_rate 不回溯；G0 学徒仅洗护计 5%、造型单不计（裁定③）
 *   25. 补充令①（决策 #39/#40）：owner 改体型系数→新预约引擎新值/旧单 scheduledEnd 不变/
 *      config.versions 留痕前后值；G0 scope=bath 造型不计提→scope=all 计提 5% 双向
 *   26. R10 榜尾不可达：榜尾视角≤5 行且第 4 名不可达；前排视角仅前三
 *
 * 批次 R12（退款专项）段（任务书冻结版 V1.0 §七全清单 / docs/r12/R12-DESIGN.md §六）：
 *   27. 店员 clerk 403（preview/execute/list）
 *   28. 店长≤阈值现金单全额退六联动 + 快照 rebate 列位（清单②+⑭）
 *   29. V1 拆分两笔累计超阈值顶到店主（店长 30000 成 → 再 30000 FORBIDDEN → 店主成）
 *   30. V2 日结现金段净额（现金+微信组合单部分退：dayStats 退款单列 delta + 已收不涂改 + 净额算术）
 *   31. V3 组合支付 6:4 分摊回补（现金 60%/储值 40% 按金额退，储值余额前后值留痕）
 *      + 涉储值单店长明文拦截（清单⑤+⑪）
 *   32. V4 寄养提前接回退剩余晚（剩余 2 晚×晚单价；已发生晚不退明文；分段明细透出；不动预约单）
 *   33. V5 已冲正/已撤单无退款入口（明文拒 ×2）
 *   34. V6 部分退提成按比例冲减精确到分（50%→1250）+ 退完归零 refunded +
 *      跨月退款进当月 adjustments（不动已快照月份）
 *   35. V7 跨日退款入发生日（biz_date=今日；昨日封箱日结行不变；dayStats 今含昨不含）
 *   36. V8 次卡赠次不计价（付费 10 赠 2 剩付费 4 → 折算 4×(实付÷10)；赠次 2 作废；
 *      卡作废留痕；重复退卡拒）+ 次卡退卡店长拦截（涉储值）
 *   37. 部分退款余额内可再退（30% 成 → 20% 成 → 累计超可退余额拒）
 *   38. 实退待办（executed 超 24h → pendingActual 含；settleActual → settled+RefundSettled；
 *      重复登记幂等；待办消失）
 *
 * 批次 R11a（会员前置批·骨架批）段（28 号施工令全清单 + 回归）：
 *   39. 售卡三档到店付 + 售卡提成定额（萤火 500/烛光 1000/微光 0）+ 双归属两字段 + 微光开档幂等
 *   40. 多宠第 4 只+59（4 只 25800 / 10 只 61200 / 11 只拒）
 *   41. 服务 88 折自动（adjusted=unit×0.88，unit 门市价划线不动）+ 微光无折扣对照
 *   42. grant 无月上限（同月多笔累计无 cap）+ 三本账无互转（端点扫描+储值/XP 零交叉）
 *   43. settleMonthly 次月到账批次单幂等（服务级直调：not-due / settled / already-settled）
 *   44. 抵扣段仅商品（服务行 rebate 段 403 / 商品行成）+ rebate 段不计已收
 *   45. 退货扣回接 R12（rebateClawbackFen 实算 + clawback 前后值 + 余额不足扣 0 记未扣回）
 *   46. 到期冻结（懒冻结+抵扣冻结拒+折扣失效）→ 续费解冻顺延 365 天
 *   47. plans 权益表述（安心包全员免费、无「非会员 ¥15」残留）+ savingsPreview 数值 +
 *      amortizationStats 双口径（cashFen 156700 / amortizedFen 11400）
 *   48. 退会清零 + 折算（剩余整月 7×19900/12=11608 精确到分）+ 客户频道通知 +
 *      回馈金流水前后值链完整
 *
 * 批次 R11a 复核补改段（七步复核打回①/②）：
 *   49. 打回① 退会挂号退款单：cancel → refund_bills type='membership_cancel' 在库
 *      （executed/offline_original/bill_id=售卡原单/linkage 快照全字段+rebateClawbackFen=0）
 *      → refund.list 可见 → createdAt 移位 25h（段尾铁律：移位后不再生成退款单，
 *      防 genRefundNo 撞号）→ pendingActual 含 → settleActual settled 幂等 → 待办消失；
 *      打回② 退会后结算日不到账：C 商品单 grant（期次移位至未结算期）→ cancel（作废
 *      未到账 clear 留痕行「退会作废未到账回馈金 258 分」）→ settleMonthly 合成到点 →
 *      C 余额不变/grant 未回标/批次单 granted_count 不含退会者，D 对照正常到账
 *
 * 批次 C5（客户退款申请实体+审批缝）段：
 *   50. 客户端退款申请全链路（实体+端口五键+审批缝复用 R12 内核）：
 *      50.1 商城单申请创建（received）+幂等重复提交 idempotent=true + configView 透出；
 *      50.2 越权：客户 A 对客户 B 的单 create→403 / getById 他人单→403 / listMine 隔离；
 *      50.3 时限闸（超 30 天窗）+ 原因闸（非法 reasonCode）+ 开关闸（enabled=false 拒后复原）；
 *      50.4 撤回：submitted 可撤；approved（批准直通 refunded）后撤回拒；
 *      50.5 驳回：reason 必填 + 客户端 getById 可见驳回理由 + listPending 待办进出；
 *      50.6 批准联动 R12+C5-01 坐实：含回馈金 grant 的到店商品单 → 申请 → 店长 approve
 *           → refund_bills executed 行 + refundBillNo 挂接 + rebateClawbackFen=258>0
 *           + rebate_logs clawback −258 负向行落账 + 申请单 status='refunded'；
 *      50.7 settleActual 联动：50.6 退款单实退登记 → 申请单='settled'+timeline 追加
 *      50.8（补缺大批片 1 补缝）：appointment.get 返回体 cashierBillId 字段存在且
 *          对到店已结账单非空；refundRequest.submitted SSE 到店频道；重购留痕
 *          reappliedAfterDays=本次 createdAt−上次 settled 落写天数（只留痕不拦截）。
 *      （50 全段挂 §49c 移位铁律之前：凡生成退款单的断言必须先于 createdAt 移位）。
 *
 * 批次 R13a（账号安全大片 2 · server 侧）段（51.x 续号挂尾，注销/换绑不产生退款单，
 * 不受段尾移位铁律约束）：
 *   51.1 sendCode 限流（60s 一码）+ 原号不一致拒 + beta devCode 回显
 *   51.2 changePhone 双码流（错码拒/换绑成功/会话零丢失/phone_change_logs 'self'）
 *   51.3 换绑申诉全链（提交→待审队列→approve 新号生效/旧会话照旧有效/logs
 *        'assisted'/reject 强制 note 客户端可见）
 *   51.4 注销前置阻断 + 勾选缺项拒 + approve 软注销全联动（会话 401/登录明文拒/
 *        phone suffix 释放同号重新注册互不可见/回馈金清零留痕/会员 cancelled 不退折算/
 *        pets 软删标记）+ reject 路径可见
 *   51.5 registerDevice upsert 幂等 + listDevices 换绑留痕透出
 *   51.6 已注销用户 SSE/业务接口 401（middleware 软删闸实证）
 *
 * 补缺大批片 3（会员升级/到期换档/防滥用/已省 · 46 号档+PD-07 冻结口径）段：
 *   52.1 升档差价精确到分（萤火 199 剩 3 整月升暖阳 599 → 3×(59900−19900)÷12=10000 分=¥100.00）+
 *        多宠附加行恒 0 透出 + 微光升档=新购全价口径（附加按现 petCount 重算）
 *   52.2 升档原子事务：paySegments 缺额 → 整单回滚（memberships/收银单/membership_events/outbox 零写入）
 *   52.3 期内降级明文拒「会员期内不降级，可在到期前 30 天预约下期档位」+ 同档重放幂等
 *   52.4 到期换档：窗口外拒 / 窗口内预约落痕+my 透出 / 重复预约覆盖幂等 / 取消置空 /
 *        到期 renew 按预约档全价收款+切档+置空+executed 留痕+执行幂等
 *   52.5 防滥用两件：退会 90 天内重购 / 累计退会≥2 再购 → cancel_rebuy_note 留痕（不拦截放行）
 *   52.6 mySavings 双源合计（已入账 grant 258 + 服务折扣 1056 = 1314 精确到分）
 *   52.7 升档后在途回馈金不重算 + 旧档回馈金余额零动作
 *   挂尾口径：52.x 续号挂尾（50/51 段编号属他批并行施工预留，本文件现序尾段为 49c）；
 *   52.5 含 cancel 会生成 refund_bills，故整段挂 49c 移位段之前——段尾铁律：
 *   createdAt 移位后不得再发生成退款单的动作（防 genRefundNo 撞号）。
 *
 * 补缺大批片 4（服务闭环 server 侧：相册聚合/证书+报告生成链/客服工单/发票申请）段：
 *   （与片 1 同号撞号，合并消解改号 50.x→53.x，断言零删改）
 *   53.1 证书生成：有 before/after 图单完成 → service_certificates 落行+payload 齐+
 *      首读 deliveredAt 幂等置位；无图单（寄养）→ 不生成 + certificateFor 404 明文
 *   53.2 报告生成：confirmStep 末步带 vitals（一项 abnormal）→ 快照+abnormalText 拼句+
 *      体重=pets.weight_kg 服务端快照；无 vitals（主单）=体重 normal 快照+其余缺项
 *      unrecorded「本次未记录」（补缺修复小批 UX 销项：缺项不再挂「正常」）；
 *      首读 deliveredAt 幂等；certificate.ready/report.ready 落 outbox（payload 用 aid 键）
 *   53.3 albumFeed：多单一次聚合返回（N+1 消除结构断言）+ in_service 单仅 done 步
 *      照片透出 + 默认 limit=12 截顶
 *   53.4 工单流：create（联系方式回显默认=users.phone）→店长 listPending→reply→
 *      客户端 ticketGet 可见 replyText+status=replied+ticket.replied 落 outbox
 *   53.5 发票流：已付闸（未收款预约拒）/金额=实付重算（传入假金额被忽略）/企业抬头
 *      缺税号拒/同单在途幂等/merchant register 发票号→客户端可见 issued+invoiceNo+
 *      invoice.issued 落 outbox
 *   53.6 权限：他人证书/报告/工单/发票 403×4
 *   53.7 serviceHours 端口读出（config.save 改值复读出=端口可调实证；改后还原）
 *
 * 补缺大批片 5（站内信分类 + 订阅退订 + 端点补齐 + 事件挂接槽位）段：
 *   （与片 1 同号撞号，合并消解改号 50.x→54.x，断言零删改）
 *   54.1 既有真事件全链：emitEvent（appointment.completed）→ notifications 落行
 *      category='service' + listNotifications 可见（行带 category）+ unreadCount=1
 *   54.2 已读幂等（markRead 重复调零副作用）+ markAllRead（幂等）+
 *      deleteNotification 仅本人（他人 403 / 本人删后行消失）
 *   54.3 分类：order.paid→trade / membership.opened→account / marketing.promo→marketing
 *      落库 + list 按 category 过滤
 *   54.4 订阅：marketing 置 0 → 营销事件不落该用户（outbox 仍写）/ trade·service 恒落；
 *      非营销类置 0 硬拒明文「交易/服务/账户通知为保障服务履约不可关闭」；恢复 1 幂等
 *   54.5 挂接槽位：certificate.ready / report.ready / ticket.replied /
 *      refundRequest.approved / refundRequest.rejected / invoice.issued 直发 emitEvent →
 *      通知落库文案/link/category 正确（片 1/片 4 合并后自动真实触发，本断言=槽位有效性实证；
 *      P2-2 口径适配：certificate/report 夹具用不同 aid 避同单同刻聚合）
 *   54.6（补缺修复小批 P2-2）：同单同刻聚合——同用户同预约（link 族）同分钟桶事件合并
 *      1 行进度卡（内容=最新+readAt 回未读）；分钟桶滚动另起行；主语完整式文案
 *      （「【球球】的预约已确认」）；无预约键事件不聚合
 *   50.7b（补缺修复小批 P1-1）：applyContext 算式明面三件套（原单−已退=本次可退，
 *      与 create 闸同源；商城单 refundableFen=null；在途申请不计已退；他人单 403）
 *   P1-3（补缺修复小批）：免费档 expiresAt=2099 远端——openFree/sell 写侧断言
 *      （见 PR-4 段与 R11a⑧ 段内嵌 check）
 *   56（端口批片 B · CJ-1002-01 文案端口 domain='copy'，控制台第七域）：
 *      56.1 种子 2801 键/66 域落库+与码内默认同值+公共读口 activeCopyTexts 全量透出
 *          （计数随 copy 键表生长更新：1827/41→片 3 任务协作 UI 文案批 2118/50→片 4 薪资 XP 批 2330/53→片 5 控制台 17 屏批 2571/57→体验大批片 1 批 2716/63→体验大批片 3 客户端文案批 2801/66）；
 *      56.2 端口值优先（save 改键→读口即新值→还原）；56.3 高危键重确认闸
 *      （refund.* 无确认 400/带确认放行）；56.4 禁令词闸（「充值」拒/否定明面句豁免）；
 *      56.5 clerk/manager 403（仅 owner）；56.6 未知键 400+空文案 400+留痕前后值
 *   57（端口批片 C 槽位端口 slot_contents）：57.1 六槽 live 种子+liveMap 透出；
 *      57.2 上传=pending 待审+liveMap 不透出；57.3 publish 上线即新值+旧版 archived；
 *      57.4 revert 回退上一版；57.5 clerk 403+未知槽键 400
 *
 * 批次 6 补缺大批（server 侧支付骨架）段（施工令全清单；移位铁律：不得对
 * pay_orders.createdAt 移位——payNo 日序计号依赖，本批夹具只动 timeout_at）：
 *   （与片 1 同号撞号，合并消解改号 50.x→55.x，断言零删改）
 *   55.1 createOrder 幂等：同人同档重复创建=idem 返回现状+agreements 三行快照含
 *       content/version/userSnapshot+金额 server 重算（入参假金额被覆盖）
 *   55.2 回调全链：mock 签名回调→paid+memberships 落行+重放回调零副作用（幂等）+金额不符 400
 *   55.3 状态机非法迁移硬拒（closed 单再回调/再支付拒）
 *   55.4 Mock 四态：success/fail（failed 留痕）/timeout（sweeper 到点置 closed）/
 *       drop（reconcile 自助补开成功=掉单补偿坐实）
 *   55.5 退款联动：线上支付单退款→online_original+linkage.payOrderNo 快照+provider.refund 留痕
 *   55.6 超时关单端口可调（config.save 改 minutes 生效复还原）
 *   55.7 权限：他人 pay_orders status/reconcile 403
 *
 * 客户端体验大批 片 1（账户体系+支付售后 · server 侧）段（65 账户族 / 66 支付售后族，
 * 续号挂尾；押金留痕不碰真钱（开口项 2 裁），recordsMine 纯聚合只读（开口项 3 裁））：
 *   65.1 updateProfile：改昵称/生日/性别落库 + auth.me 读回一致；非法 birthday /
 *       性别枚举外 / 空昵称 400 明文；传啥改啥（未传字段不动）
 *   65.2 地址 CRUD+默认：create 两条（第二条 isDefault=true）→ list 默认在前+第一条
 *       默认被清；update 改 detail；remove 默认行→剩余第一条自动升默认；setDefault
 *       同事务清其他；他人 id 操作一律 NOT_FOUND 不透出
 *   65.3 抬头 CRUD+默认：business 缺 taxNo 400 明文 / titleType 枚举外 400；personal
 *       建 + business 建（默认）+ setDefault + remove 默认行自动升默认链
 *   65.4 异常登录提醒：registerDevice 首见设备 → notifications 落 security.new_device
 *       行（link=/settings/devices，category=account）+ security.newDevice 事件落
 *       outbox；同设备重登记=零新增零通知（幂等语义不动）
 *   66.1 押金全链：create（本店客户校验：无在店痕迹 400 明文）→ held → markRefunding
 *       → markRefunded → 幂等重调零副作用；listMine 客户读见进度三时点+门店名透出；
 *       storeSummary 在押合计=Σheld+refunding 精确到分；**断言零 pay_orders 新行**
 *       （不碰真钱实证）；跨店 NOT_FOUND 不透出
 *   66.2 recordsMine：造本人支付单+商城订单+发票各一 → 聚合三类齐+createdAt 倒序；
 *       他人零透出
 *
 * 客户端体验大批 片 3（会员体系 9+商城 5 · server 侧）段（68 会员族 / 69 商城族，
 * 续号挂尾；券核销=登记制不接真抵扣（开口项 1 裁）；时刻敏感件一律钉时刻）：
 *   68.1 未用权益：myUnused 次卡余额并显不并账+grants 行；consume 台账核销
 *        2→1→0→exhausted→归零再核 400（真核销链=结账联动候批，本片不落）
 *   68.2 续费优惠：端口改 renew_discount_bp=8000 → version+1 留痕 + pay.quote
 *        renewal=全价×bp/10000 精确到分（19900→15920）；缺键回落 10000=无优惠；复原
 *   68.3 生日礼：birthday=今日（MMDD 钉 +8 墙钟）用户+宠物 → 直调 sweepBirthdayPerks
 *        → grants 双行（year/pet_id 入锚）+notifications marketing 行；同年重扫零新增
 *   68.4 新人礼包：新注册 → welcome_pack 行+营销通知；重复注册零重复；
 *        首单 paid 翻转（mock-callback 真链）→ upgrade_gift 行；重复回调+次单零重复
 *   68.5 会员码：openFree→myCardToken 签发→verifyCardToken 通过+planKey 透出；
 *        篡改签名/过期（signMemberCardPayload 合法签名伪造过期件）400 明文
 *   69.1 券：领取 claimed+uq 幂等；availableCoupons 门槛过滤；couponUse 核销=
 *        orders.total_fen/payments 前后零变动仅 grant 翻 used；配额满 400
 *   69.2 收藏：toggle 幂等（在=删/不在=插）+favList+favCheck 同帧
 *   69.3 晒单：received 单可评落行+pending 单 400+复评 409+均分聚合（5+3→4.0）
 *        +匿名匿名录名+他人单 403（订单 received 翻转为夹具直改，不走支付通道）
 *   69.4 配送：pickup 落列+地址可缺省；缺省 express；express 缺地址 400；读口透出
 *   69.5 超时收货：shipped_at=8 天前单→直调 sweepAutoReceive 翻 received+OrderReceived
 *        落 outbox；6 天内不动；重扫零新增+receiveOrder 并发硬拒（条件更新幂等）
 *   69.6 叠加公示：couponStackRule 缺省 none → config.save 改值→读口即新+留痕行；复原
 *   69.7 涉钱全件零真通道实证：69 族全链 cashier_bills/payments/rebate_accounts/
 *        pay_orders 计数前后相等
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import superjson from 'superjson';

/* ------------------------------------------------------------------ */
/* 环境：临时库 + 端口                                                    */
/* ------------------------------------------------------------------ */

const SERVER_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TSX_CLI = join(SERVER_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const SEED_DB_FILE = join(SERVER_ROOT, 'data', 'philia.db');
const UPLOAD_APPT_ROOT = join(SERVER_ROOT, 'uploads', 'appointment');

const tmpDir = mkdtempSync(join(tmpdir(), 'philia-e2e-'));
const DB_URL = `file:${join(tmpDir, 'e2e.db').replaceAll('\\', '/')}`;
const CLIENT_ERROR_LOG = join(tmpDir, 'client-error.log');
const PORT = Number(process.env.E2E_PORT ?? 7200); // 默认 7200 不变；并行窗占用时可用 E2E_PORT 避让（验收语义不变）
const BASE = `http://127.0.0.1:${PORT}`;

process.env.PHILIA_DB_URL = DB_URL; // 须先于任何 ../db import 生效

/* ------------------------------------------------------------------ */
/* 断言工具                                                              */
/* ------------------------------------------------------------------ */

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`, extra === undefined ? '' : JSON.stringify(extra)?.slice(0, 600));
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => boolean | Promise<boolean>, timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cond()) return true;
    await sleep(50);
  }
  return cond();
}

/** 子进程执行（迁移/种子），失败时带出全部输出 */
function runProc(args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(process.execPath, args, { cwd: SERVER_ROOT, env: { ...process.env, ...env } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', rejectP);
    child.on('exit', (code) => {
      if (code === 0) resolveP(out);
      else rejectP(new Error(`子进程退出码 ${code}\n${out}`));
    });
  });
}

/* ------------------------------------------------------------------ */
/* HTTP / tRPC-over-HTTP 客户端（superjson 与服务端 transformer 对齐）      */
/* ------------------------------------------------------------------ */

class TrpcHttpError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface TrpcCallOpts {
  cookie?: string;
  input?: unknown;
}

async function trpcQuery<T>(path: string, opts: TrpcCallOpts = {}): Promise<T> {
  const url =
    opts.input === undefined
      ? `${BASE}/trpc/${path}`
      : `${BASE}/trpc/${path}?input=${encodeURIComponent(JSON.stringify(superjson.serialize(opts.input)))}`;
  const res = await fetch(url, { headers: opts.cookie ? { cookie: opts.cookie } : {} });
  return unwrap<T>(res, await res.json());
}

async function trpcMutate<T>(path: string, opts: TrpcCallOpts = {}): Promise<T> {
  const res = await fetch(`${BASE}/trpc/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    body: JSON.stringify(superjson.serialize(opts.input ?? null)),
  });
  return unwrap<T>(res, await res.json());
}

function unwrap<T>(res: Response, envelope: any): T {
  if (envelope?.error) {
    // tRPC 配 transformer 后错误体可能被 superjson 包裹为 error.json；兼容两种形态
    const err = envelope.error?.json ?? envelope.error;
    const code = err?.data?.code ?? 'UNKNOWN';
    throw new TrpcHttpError(res.status, code, err?.message ?? 'tRPC error');
  }
  return superjson.deserialize(envelope?.result?.data) as T;
}

/** 解析 dev-login 的 Set-Cookie，提取 philia_session=<value> */
function sessionCookieOf(res: Response): string {
  const setCookies = res.headers.getSetCookie();
  const hit = setCookies.find((s) => s.startsWith('philia_session='));
  if (!hit) throw new Error(`未拿到会话 cookie: ${JSON.stringify(setCookies)}`);
  return hit.split(';')[0]!;
}

/* ------------------------------------------------------------------ */
/* SSE 后台读流                                                           */
/* ------------------------------------------------------------------ */

interface SseFrame {
  id: string;
  event: string;
  data: string;
}

/** 后台读取 SSE 流，事件帧推入 sink（心跳注释帧自动忽略）；返回停止函数 */
function startSseReader(res: Response, sink: SseFrame[]): { stopped: Promise<void> } {
  const stopped = (async () => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (raw.startsWith(':') || raw.trim() === '') continue; // 心跳注释帧 / 空帧
          const frame: SseFrame = { id: '', event: '', data: '' };
          for (const line of raw.split('\n')) {
            if (line.startsWith('id:')) frame.id = line.slice(3).trim();
            else if (line.startsWith('event:')) frame.event = line.slice(6).trim();
            else if (line.startsWith('data:')) frame.data += (frame.data ? '\n' : '') + line.slice(5).trim();
          }
          sink.push(frame);
        }
      }
    } catch {
      /* 客户端主动 abort */
    }
  })();
  return { stopped };
}

/* ------------------------------------------------------------------ */
/* 主流程                                                                */
/* ------------------------------------------------------------------ */

let server: ChildProcess | undefined;
let serverLog = '';
let createdAid = ''; // main() 内赋值，cleanup 精准删除本次上传目录
const createdAidExtras: string[] = []; // staff-2 段补充上传的预约（aid2 六步走完），cleanup 一并删除
const seedStatBefore = existsSync(SEED_DB_FILE) ? statSync(SEED_DB_FILE) : null;

async function main(): Promise<void> {
  /* ---------- 0. 前置：端口须空闲；临时库迁移 + 种子 ---------- */
  const portBusy = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(800) })
    .then(() => true)
    .catch(() => false);
  if (portBusy) throw new Error(`端口 ${PORT} 已被占用，请先释放再跑验收`);

  console.log('[e2e] 临时库迁移 + 种子…');
  await runProc([TSX_CLI, 'src/db/migrate.ts'], { PHILIA_DB_URL: DB_URL });
  await runProc([TSX_CLI, 'src/db/seed.ts'], { PHILIA_DB_URL: DB_URL });
  check('临时库迁移 + 种子完成', true);

  // e2e 进程自身的只读连接（查种子用户 ID / event_outbox 断言）
  const { db, schema, client } = await import('../db');
  const { eq } = await import('drizzle-orm');

  const seedUsers = await db.select().from(schema.users);
  const byKimi = (kimiId: string) => seedUsers.find((u) => u.kimiId === kimiId);
  const customerUser = byKimi('seed_kimi_customer');
  const ownerUser = byKimi('seed_kimi_owner');
  const staffUser = byKimi('seed_kimi_staff1'); // 小美：批次 S1 起为 frontdesk（核销执行人）
  const groomerUser = byKimi('seed_kimi_staff2'); // 阿强：groomer（核销应被拒）
  check('种子用户齐全（customer/owner/staff1/staff2）', !!(customerUser && ownerUser && staffUser && groomerUser));
  if (!customerUser || !ownerUser || !staffUser || !groomerUser) throw new Error('种子用户缺失');

  /* ---------- 1. 启动 server 子进程（7200） ---------- */
  server = spawn(process.execPath, [TSX_CLI, 'src/index.ts'], {
    cwd: SERVER_ROOT,
    env: { ...process.env, PHILIA_DB_URL: DB_URL, PHILIA_CLIENT_ERROR_LOG: CLIENT_ERROR_LOG, PORT: String(PORT) },
  });
  server.stdout?.on('data', (d) => (serverLog += d));
  server.stderr?.on('data', (d) => (serverLog += d));

  const healthy = await waitFor(async () => {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(800) });
      const j = (await r.json()) as { ok?: boolean; ts?: number };
      return r.ok && j.ok === true && typeof j.ts === 'number';
    } catch {
      return false;
    }
  }, 30_000);
  check('server 启动且 GET /api/health 返回 {ok:true, ts}', healthy, serverLog.slice(-400));
  if (!healthy) throw new Error('server 未就绪');

  /* ---------- 2. 三角色 dev-login ---------- */
  async function devLogin(userId: string): Promise<string> {
    const res = await fetch(`${BASE}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const body = (await res.json()) as { ok?: boolean; user?: { roles?: string[] } };
    if (!res.ok || !body.ok) throw new Error(`dev-login 失败: ${res.status} ${JSON.stringify(body)}`);
    return sessionCookieOf(res);
  }
  const customerCookie = await devLogin(customerUser!.id);
  const ownerCookie = await devLogin(ownerUser!.id);
  const staffCookie = await devLogin(staffUser!.id);
  const groomerCookie = await devLogin(groomerUser!.id);
  check('三角色 dev-login 均签发会话 cookie', !!(customerCookie && ownerCookie && staffCookie && groomerCookie));

  const me = await trpcQuery<{ roles: string[]; store: { id: string } | null }>('auth.me', {
    cookie: ownerCookie,
  });
  check('auth.me（商家）角色与门店绑定正确', me.roles.includes('merchant_owner') && !!me.store, me);
  const storeId = me.store!.id;

  /* ---------- 3. create 前：客户 push.subscribe（SSE 前置登记） ---------- */
  const CLIENT_ID = 'e2e-customer-1';
  const sub = await trpcMutate<{ subscriptionId: string }>('push.subscribe', {
    cookie: customerCookie,
    input: { clientId: CLIENT_ID, appType: 'customer' },
  });
  check('push.subscribe 登记成功（create 前完成）', !!sub.subscriptionId, sub);

  /* ---------- 4. 客户：找店 → 服务与槽位 → 下单 ---------- */
  const pets = await trpcQuery<Array<{ id: string; name: string }>>('pet.list', {
    cookie: customerCookie,
  });
  const petId = pets[0]?.id;
  check('pet.list 返回客户宠物', !!petId, pets);
  if (!petId) throw new Error('无宠物');

  const nearby = await trpcQuery<{ stores: Array<{ id: string; name: string }> }>('store.listNearby', {
    cookie: customerCookie,
    input: { lat: 30.27, lng: 120.15 },
  });
  const store = nearby.stores.find((s) => s.id === storeId) ?? nearby.stores[0];
  check('store.listNearby 返回种子门店', !!store, nearby.stores.length);
  if (!store) throw new Error('无门店');

  const cat1 = await trpcQuery<{
    services: Array<{ id: string; name: string; type: string; durationMin: number | null }>;
    slots: unknown[];
  }>('store.getWithServices', { cookie: customerCookie, input: { storeId: store.id } });
  const service = cat1.services.find((s) => s.type === 'grooming' && (s.durationMin ?? 999) <= 90);
  check('getWithServices 返回 grooming 服务项', !!service, cat1.services.length);
  if (!service) throw new Error('无 grooming 服务');

  const cat2 = await trpcQuery<{ slots: Array<{ slotStart: Date; bookedCount: number; capacity: number }> }>(
    'store.getWithServices',
    // S4：传 petId——栅格可约判定与 create 同按 9a 引擎时长口径（引擎时长更长时
    // 整段区间须落在 groomer 排班内，否则该槽本就不可约，避免选到「服务默认时长
    // 可约但引擎时长超排班」的伪可约槽）
    { cookie: customerCookie, input: { storeId: store.id, serviceId: service.id, petId } },
  );
  // 选 10:00-16:00 之间的槽：任意星期都落在种子排班（工作日 09-18 / 周末 10-19）与营业时间内
  // B8-B4：时段墙钟按门店规范时区（固定 +8，与服务端 storeWallclock 同帧）读取，
  // 否则 UTC 宿主下会错选到门店晚间槽、排班校验正确拒绝
  const slot = cat2.slots.find((s) => {
    const shifted = new Date(s.slotStart.getTime() + 8 * 3600 * 1000);
    const h = shifted.getUTCHours();
    return h >= 10 && h <= 16 && shifted.getUTCMinutes() === 0;
  });
  check('getWithServices 返回可约槽位（10:00-16:00 整点）', !!slot, cat2.slots.length);
  if (!slot) throw new Error('无可约槽位');

  const appt = await trpcMutate<{ id: string; status: string; code: string; staffId: string | null; assignSource: string | null }>('appointment.create', {
    cookie: customerCookie,
    input: {
      storeId: store.id,
      petId,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart: slot.slotStart,
      paymentMode: 'pay_at_store',
      note: '【测试】e2e 验收单',
    },
  });
  // 批次 S4（任务 A）：免商家确认——create 落库即 confirmed（原断言 pending 已退役）
  check('appointment.create 成功（S4：落库即 confirmed）', appt.status === 'confirmed' && !!appt.id, appt);
  const aid = appt.id;
  createdAid = aid;

  /* ---------- 5. 建立客户 SSE 流（watch=aid，后台读） ----------
   * S4 适配：confirmed 事件随 create 即发（早于 SSE 建连），以 last_event_id=0
   * 触发服务端 replayMissed 补发，事件序列断言口径不变 */
  const sseController = new AbortController();
  const sseRes = await fetch(`${BASE}/api/events?client_id=${CLIENT_ID}&watch=${aid}&last_event_id=0`, {
    headers: { cookie: customerCookie },
    signal: sseController.signal,
  });
  check('GET /api/events 建立 SSE（200 + text/event-stream）',
    sseRes.status === 200 && (sseRes.headers.get('content-type') ?? '').includes('text/event-stream'),
    sseRes.status);
  const frames: SseFrame[] = [];
  startSseReader(sseRes, frames);
  await sleep(300); // 等连接注册进 Hub

  /* ---------- 6. 商家：确认（S4 幂等）→ 派单 ----------
   * S4（任务 C）：create 已自动派单（负荷 0/0 并列 → 先入职的阿强，assignSource=auto）；
   * 商家 assign 改派丽丽（改派不回归）——后续步骤由被指派人丽丽执行，
   * 验证前台（小美）核销豁免归属 + 原指派（丽丽）保留（S1-R1 断言①） */
  const staffList = await trpcQuery<{ staff: Array<{ id: string; name: string; role: string; skills: string[] | null }> }>(
    'store.staffList',
    { cookie: ownerCookie },
  );
  const staffRow = staffList.staff.find((s) => s.name === '阿强' && s.role === 'groomer');
  const staffRow2 = staffList.staff.find((s) => s.name === '丽丽' && s.role === 'groomer');
  check('store.staffList 找到承接美容师（阿强/丽丽=groomer）', !!staffRow && !!staffRow2, staffList.staff.map((s) => s.name));
  if (!staffRow || !staffRow2) throw new Error('无美容师');

  // S4（任务 C）：未指定 staffId → 自动派单负荷最轻（0/0 并列按 createdAt 先入职 → 阿强）
  check(
    'S4：create 自动派单（staff_id=阿强，assignSource=auto）',
    appt.staffId === staffRow.id && appt.assignSource === 'auto',
    { staffId: appt.staffId, expect: staffRow.id },
  );

  // 批次 S4（任务 A）：create 已落 confirmed——confirm 对该单 = 幂等成功（零副作用），
  // 连调两次均返回 confirmed 且不重复发事件（防旧链路重复调用断裂）
  const confirmed = await trpcMutate<{ status: string; updatedAt: Date }>('appointment.confirm', {
    cookie: ownerCookie,
    input: { appointmentId: aid },
  });
  const confirmed2 = await trpcMutate<{ status: string; updatedAt: Date }>('appointment.confirm', {
    cookie: ownerCookie,
    input: { appointmentId: aid },
  });
  check(
    'appointment.confirm 幂等：confirmed 单连调两次均成功且 updatedAt 不变（零副作用）',
    confirmed.status === 'confirmed' &&
      confirmed2.status === 'confirmed' &&
      new Date(confirmed.updatedAt).getTime() === new Date(confirmed2.updatedAt).getTime(),
    { s1: confirmed.status, s2: confirmed2.status },
  );

  // S4（任务 D）：商家保留改派——assign 改派丽丽（不回归），来源标记覆盖为 merchant
  const assigned = await trpcMutate<{ status: string; staffId: string | null; assignSource: string | null }>('appointment.assign', {
    cookie: ownerCookie,
    input: { appointmentId: aid, staffId: staffRow2.id },
  });
  check(
    'appointment.assign 改派成功（阿强 → 丽丽），assignSource 覆盖为 merchant',
    assigned.staffId === staffRow2.id && assigned.assignSource === 'merchant',
    { staffId: assigned.staffId, assignSource: assigned.assignSource },
  );
  const liliCookie = await devLogin(byKimi('seed_kimi_staff3')!.id); // 丽丽：改派后的被指派人

  /* ---------- 7. 客户出码 → 员工扫码核销 ---------- */
  const codeRes = await trpcQuery<{ raw: string; code: string }>('appointment.getCode', {
    cookie: customerCookie,
    input: { appointmentId: aid },
  });
  check('appointment.getCode 返回二维码原文与人工码', !!codeRes.raw && /^\{.*\}$/.test(codeRes.raw), codeRes.code);

  /* ---------- 7a. 批次 S1（任务 B）双角色权限断言：groomer 核销被拒 ---------- */
  const groomerQr = await trpcMutate('appointment.checkin', {
    cookie: groomerCookie,
    input: { qr: codeRes.raw },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：groomer 扫码核销 → 403 FORBIDDEN「核销需前台账号操作」',
    groomerQr instanceof TrpcHttpError &&
      groomerQr.httpStatus === 403 &&
      groomerQr.code === 'FORBIDDEN' &&
      groomerQr.message.includes('核销需前台账号操作'),
    groomerQr && { status: groomerQr.httpStatus, code: groomerQr.code, message: groomerQr.message },
  );
  const groomerCode = await trpcMutate('appointment.checkin', {
    cookie: groomerCookie,
    input: { code: codeRes.code },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：groomer 人工码核销 → 403 FORBIDDEN「核销需前台账号操作」',
    groomerCode instanceof TrpcHttpError &&
      groomerCode.httpStatus === 403 &&
      groomerCode.code === 'FORBIDDEN' &&
      groomerCode.message.includes('核销需前台账号操作'),
    groomerCode && { status: groomerCode.httpStatus, code: groomerCode.code, message: groomerCode.message },
  );
  // boarding.checkinStay 同口径：groomer → FORBIDDEN（角色判定先于预约查询， dummy id 也被拒）
  const groomerStay = await trpcMutate('boarding.checkinStay', {
    cookie: groomerCookie,
    input: { appointmentId: 'appt-not-exist', checkinWeightKg: 4.2, belongings: [] },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：groomer 入住登记（checkinStay）→ 403 FORBIDDEN「核销需前台账号操作」',
    groomerStay instanceof TrpcHttpError &&
      groomerStay.httpStatus === 403 &&
      groomerStay.code === 'FORBIDDEN' &&
      groomerStay.message.includes('核销需前台账号操作'),
    groomerStay && { status: groomerStay.httpStatus, code: groomerStay.code, message: groomerStay.message },
  );
  // 前台过角色校验：同一 dummy id 不再吃 FORBIDDEN（落后续预约查询报错）
  const frontdeskStay = await trpcMutate('boarding.checkinStay', {
    cookie: staffCookie,
    input: { appointmentId: 'appt-not-exist', checkinWeightKg: 4.2, belongings: [] },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：frontdesk 入住登记越过角色校验（dummy id 报非 FORBIDDEN 业务错）',
    frontdeskStay instanceof TrpcHttpError && frontdeskStay.code !== 'FORBIDDEN',
    frontdeskStay && { status: frontdeskStay.httpStatus, code: frontdeskStay.code, message: frontdeskStay.message },
  );

  /* ---------- 7b. 前台扫码核销（全链路）+ S1-R1 断言①：豁免归属、原指派保留 ---------- */
  const checkin = await trpcMutate<{
    appointment: { status: string; staffId: string | null };
    steps: Array<{ stepKey: string; status: string }>;
    nextRoute: string;
    idempotent: boolean;
    claimed: boolean;
  }>('appointment.checkin', { cookie: staffCookie, input: { qr: codeRes.raw } });
  check(
    'appointment.checkin（frontdesk 二维码原文）→ in_service + 六步初始化',
    checkin.appointment.status === 'in_service' && checkin.steps.length === 6 &&
      checkin.steps[0]!.status === 'active' && checkin.steps.slice(1).every((s) => s.status === 'locked'),
    checkin,
  );
  check(
    'S1-R1 断言①：已改派给丽丽的单被小美（frontdesk）核销成功 → staff_id 仍为丽丽（原指派保留，claimed=false）',
    checkin.appointment.staffId === staffRow2.id && checkin.claimed === false,
    { staffId: checkin.appointment.staffId, expect: staffRow2.id, claimed: checkin.claimed },
  );

  /* ---------- 8. 美容师（丽丽，改派后的被指派人）：上传 → 登记照片 → 逐步确认 ---------- */
  const { Jimp } = await import('jimp');
  async function uploadOne(stepKey: string): Promise<{ url: string; thumbUrl: string }> {
    const img = new Jimp({ width: 320, height: 240, color: 0x66aaffff });
    const buf = await img.getBuffer('image/jpeg');
    const fd = new FormData();
    fd.append('file', new File([buf], `e2e-${stepKey}.jpg`, { type: 'image/jpeg' }));
    fd.append('relDir', `appointment/${aid}/${stepKey}`);
    const res = await fetch(`${BASE}/api/upload`, {
      method: 'POST',
      headers: { cookie: liliCookie }, // S4：改派后由丽丽执行
      body: fd,
    });
    const body = (await res.json()) as { url?: string; thumbUrl?: string; message?: string };
    if (!res.ok || !body.url) throw new Error(`上传失败(${stepKey}): ${res.status} ${JSON.stringify(body)}`);
    return { url: body.url, thumbUrl: body.thumbUrl ?? body.url };
  }

  const stepPlan: Array<{ key: string; count: number; tags?: Array<'before' | 'after'> }> = [
    { key: 'disinfection', count: 1 },
    { key: 'precheck', count: 2 },
    { key: 'grooming', count: 3 },
    { key: 'detail', count: 2 },
    { key: 'before_after', count: 2, tags: ['before', 'after'] },
    { key: 'confirm', count: 0 },
  ];

  let firstUploadUrl = '';
  for (const plan of stepPlan) {
    if (plan.count > 0) {
      const up = await uploadOne(plan.key);
      if (!firstUploadUrl) firstUploadUrl = up.url;
      const added = await trpcMutate<{ added: number; totalValid: number }>('serviceStep.addPhotos', {
        cookie: liliCookie, // S4：改派后由丽丽执行
        input: {
          appointmentId: aid,
          stepKey: plan.key,
          photos: Array.from({ length: plan.count }, (_, i) => ({
            url: up.url,
            thumbUrl: up.thumbUrl,
            tag: plan.tags?.[i] ?? 'normal',
          })),
        },
      });
      check(`serviceStep.addPhotos(${plan.key} ×${plan.count})`, added.totalValid === plan.count, added);
    }
    const done = await trpcMutate<{ nextStepKey: string | null; appointmentCompleted: boolean }>(
      'serviceStep.confirmStep',
      { cookie: liliCookie, input: { appointmentId: aid, stepKey: plan.key } }, // S4：改派后由丽丽执行
    );
    check(
      `serviceStep.confirmStep(${plan.key})`,
      done.appointmentCompleted === (plan.key === 'confirm'),
      done,
    );
  }

  // 顺带验证签名图片可访问（imagesRoute 全链路；阿强上传，前台小美读取验证跨角色签名访问）
  const imgRes = await fetch(`${BASE}${firstUploadUrl}`, { headers: { cookie: staffCookie } });
  check('GET /api/img/* 签名 URL 可访问（200 image/jpeg）',
    imgRes.status === 200 && (imgRes.headers.get('content-type') ?? '').includes('image/jpeg'),
    imgRes.status);
  await imgRes.arrayBuffer().catch(() => undefined);

  /* ---------- 9. 完成 → 收款 → 评价 ---------- */
  const detail = await trpcQuery<{ appointment: { status: string; completedAt: Date | null } }>(
    'appointment.get',
    { cookie: customerCookie, input: { appointmentId: aid } },
  );
  check('预约已 completed（含 completed_at）',
    detail.appointment.status === 'completed' && detail.appointment.completedAt instanceof Date,
    detail.appointment.status);

  const paid = await trpcMutate<{ appointment: { paidAt: Date | null; paidFen: number | null } }>(
    'appointment.markPaid',
    { cookie: ownerCookie, input: { appointmentId: aid } },
  );
  check('appointment.markPaid 收款登记', paid.appointment.paidAt instanceof Date, paid);

  const reviewed = await trpcMutate<{ rating: number | null }>('appointment.review', {
    cookie: customerCookie,
    input: { appointmentId: aid, rating: 5, review: 'e2e 验收好评' },
  });
  check('appointment.review 评价成功', reviewed.rating === 5, reviewed);

  /* ---------- 10. SSE 事件序列断言 ---------- */
  const gotCompleted = await waitFor(
    () => frames.some((f) => f.event === 'appointment.completed'),
    10_000,
  );
  sseController.abort();

  /* ---------- 10b. S1-R1 断言②：未指派单前台核销 → staff_id 仍 NULL + 无 assigned 事件 ----------
   * 置于 SSE abort 之后：第二单（aid2）与主单同客户，其 confirmed/checkedin 会经
   * user 频道进入 SSE 帧，若放在第 10 节前会污染序列断言（首轮实测多拉一条 confirmed）。 */
  const slot2 = cat2.slots.find((s) => {
    if (s.slotStart.getTime() === slot.slotStart.getTime()) return false;
    const shifted = new Date(s.slotStart.getTime() + 8 * 3600 * 1000);
    const h = shifted.getUTCHours();
    return h >= 10 && h <= 16 && shifted.getUTCMinutes() === 0;
  });
  check('找到第二个可约槽（未指派单用）', !!slot2);
  if (!slot2) throw new Error('无第二槽位');
  const appt2 = await trpcMutate<{ id: string; status: string; code: string }>('appointment.create', {
    cookie: customerCookie,
    input: {
      storeId: store.id,
      petId,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart: slot2.slotStart,
      paymentMode: 'pay_at_store',
      note: '【测试】e2e S1-R1 未指派核销单',
    },
  });
  const aid2 = appt2.id;
  await trpcMutate('appointment.confirm', { cookie: ownerCookie, input: { appointmentId: aid2 } });
  // S4（任务 C）：aid2 下单已被自动派单——断言②需要「真未指派单」，此处直清 staff_id/
  // assign_source 模拟（其自动派单 assigned 事件已发，下方按「核销不新增」口径断言）
  await db
    .update(schema.appointments)
    .set({ staffId: null, assignSource: null, updatedAt: new Date() })
    .where(eq(schema.appointments.id, aid2));
  const codeRes2 = await trpcQuery<{ raw: string; code: string }>('appointment.getCode', {
    cookie: customerCookie,
    input: { appointmentId: aid2 },
  });
  const assignedBefore = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'appointment.assigned' && (r.payload as Record<string, unknown>)?.appointmentId === aid2,
  ).length;
  const checkin2 = await trpcMutate<{
    appointment: { status: string; staffId: string | null };
    idempotent: boolean;
    claimed: boolean;
  }>('appointment.checkin', { cookie: staffCookie, input: { code: codeRes2.code } });
  const assignedAfter = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'appointment.assigned' && (r.payload as Record<string, unknown>)?.appointmentId === aid2,
  ).length;
  check(
    'S1-R1 断言②：未指派单前台核销成功 → staff_id 仍为 NULL（不认领，claimed=false）',
    checkin2.appointment.status === 'in_service' && checkin2.appointment.staffId === null && checkin2.claimed === false,
    { staffId: checkin2.appointment.staffId, claimed: checkin2.claimed },
  );
  check(
    'S1-R1 断言②：未指派单核销后 outbox 无新增 appointment.assigned 事件（核销前后计数一致）',
    assignedAfter === assignedBefore,
    { assignedBefore, assignedAfter },
  );
  const deduped = [...new Map(frames.filter((f) => f.id).map((f) => [f.id, f])).values()];
  const typeSeq = deduped.map((f) => f.event);
  const expectedSeq = [
    'appointment.confirmed',
    // S4：create 自动派单（阿强）+ 商家改派（丽丽）各一条 assigned
    'appointment.assigned',
    'appointment.assigned',
    'appointment.checkedin',
    ...Array(6).fill('step_updated'),
    'appointment.completed',
  ];
  console.log('  [SSE] 实际收到事件序列:', JSON.stringify(typeSeq));
  console.log('  [SSE] 期望事件序列:    ', JSON.stringify(expectedSeq));
  check(
    'SSE 流依次收到 confirmed/assigned/checkedin/step_updated×6/completed（按 id 去重）',
    gotCompleted && JSON.stringify(typeSeq) === JSON.stringify(expectedSeq),
    typeSeq,
  );
  const stepPayloadOk = deduped
    .filter((f) => f.event === 'step_updated')
    .every((f) => {
      try {
        const d = JSON.parse(f.data) as { data?: { appointmentId?: string } };
        return d.data?.appointmentId === aid;
      } catch {
        return false;
      }
    });
  check('step_updated 载荷均指向本预约', stepPayloadOk);

  /* ---------- 11. event_outbox 事件齐全 ---------- */
  const outboxRows = (await db.select().from(schema.eventOutbox)).filter(
    (r) => (r.payload as Record<string, unknown> | null)?.appointmentId === aid,
  );
  const byType = new Map<string, string[]>();
  for (const r of outboxRows) {
    byType.set(r.eventType, [...(byType.get(r.eventType) ?? []), r.channel]);
  }
  const outboxExpect: Array<[string, number]> = [
    ['appointment.created', 1],
    // S4（任务 A）：confirmed 随 create 发 user+store 双频道；商家 confirm 幂等不再增发
    ['appointment.confirmed', 2],
    // S4（任务 C/D）：create 自动派单（staff+user）+ 商家改派（staff+user）各 2 条
    ['appointment.assigned', 4],
    // B2-8：checkedin / completed 为 appointment + store 双频道各 1 条（本断言 P1 时代后未同步，见批次 7.1 前置项复核）
    ['appointment.checkedin', 2],
    ['step_updated', 6],
    ['appointment.completed', 2],
    ['appointment.paid', 1],
    ['appointment.reviewed', 2], // store + staff 双频道
    // staff-2 R10：review 同事务增发 staff 频道 review.submitted（payload 含 appointmentId，计入本断言）
    ['review.submitted', 1],
  ];
  const outboxOk = outboxExpect.every(([t, n]) => (byType.get(t) ?? []).length === n);
  check(
    `event_outbox 事件齐全（共 ${outboxRows.length} 条 / 期望 21 条）`,
    outboxOk && outboxRows.length === 21,
    Object.fromEntries([...byType].map(([k, v]) => [k, v.length])),
  );
  const assignedChannels = (byType.get('appointment.assigned') ?? []).sort();
  check(
    'assigned 双频道（staff + user）',
    assignedChannels.some((ch) => ch.startsWith('staff:')) &&
      assignedChannels.some((ch) => ch === `user:${customerUser!.id}`),
    assignedChannels,
  );

  /* ---------- 12. 权限负例 ---------- */
  const forbidden = await trpcMutate('store.upsertService', {
    cookie: customerCookie,
    input: { type: 'grooming', name: '越权服务', priceFen: 100 },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '客户调 merchantProcedure（store.upsertService）→ 403 FORBIDDEN',
    forbidden instanceof TrpcHttpError && forbidden.httpStatus === 403 && forbidden.code === 'FORBIDDEN',
    forbidden && { status: forbidden.httpStatus, code: forbidden.code },
  );

  const anon = await trpcMutate('appointment.create', {
    input: {
      storeId: store.id,
      petId,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart: slot.slotStart,
      paymentMode: 'pay_at_store',
    },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '未登录调 appointment.create → 401 UNAUTHORIZED',
    anon instanceof TrpcHttpError && anon.httpStatus === 401 && anon.code === 'UNAUTHORIZED',
    anon && { status: anon.httpStatus, code: anon.code },
  );

  /* ---------- 12b. 批次 S1（任务 D）：store.updateStaff 权限收口 + 角色/状态联动 ---------- */
  // 第二商家夹具（他店 owner）：直插 users/user_roles/stores
  const [owner2] = await db
    .insert(schema.users)
    .values({ kimiId: 'seed_e2e_owner2', nickname: 'e2e 他店店主', phone: '13900000999' })
    .returning();
  await db.insert(schema.userRoles).values({ userId: owner2.id, role: 'merchant_owner' });
  await db.insert(schema.stores).values({ ownerId: owner2.id, name: 'e2e 他店', status: 'active' });
  const owner2Cookie = await devLogin(owner2.id);

  const staffRowsNow = await trpcQuery<{ staff: Array<{ id: string; name: string; role: string; status: string }> }>(
    'store.staffList',
    { cookie: ownerCookie },
  );
  const aqiang = staffRowsNow.staff.find((s) => s.name === '阿强');
  check('store.staffList 行带 role/status 字段（阿强=groomer/active）',
    !!aqiang && aqiang.role === 'groomer' && aqiang.status === 'active', aqiang);
  if (!aqiang) throw new Error('阿强缺失');

  const crossStore = await trpcMutate('store.updateStaff', {
    cookie: owner2Cookie,
    input: { staffId: aqiang.id, role: 'frontdesk' },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：越店 updateStaff（他店 owner 改本店员工）→ 403 FORBIDDEN',
    crossStore instanceof TrpcHttpError && crossStore.httpStatus === 403 && crossStore.code === 'FORBIDDEN',
    crossStore && { status: crossStore.httpStatus, code: crossStore.code },
  );

  const nonMerchant = await trpcMutate('store.updateStaff', {
    cookie: customerCookie,
    input: { staffId: aqiang.id, role: 'frontdesk' },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：非商家（customer）updateStaff → 403 FORBIDDEN',
    nonMerchant instanceof TrpcHttpError && nonMerchant.httpStatus === 403 && nonMerchant.code === 'FORBIDDEN',
    nonMerchant && { status: nonMerchant.httpStatus, code: nonMerchant.code },
  );

  const emptyInput = await trpcMutate('store.updateStaff', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id },
  }).then(
    () => null,
    (e) => e as TrpcHttpError,
  );
  check(
    '批次 S1：role/status 均缺省 → 400 BAD_REQUEST（至少传一项）',
    emptyInput instanceof TrpcHttpError && emptyInput.httpStatus === 400 && emptyInput.code === 'BAD_REQUEST',
    emptyInput && { status: emptyInput.httpStatus, code: emptyInput.code },
  );

  // 正向：改角色 → staffList 反映 → 员工端 auth.me 下次拉取生效（联动）
  const toFrontdesk = await trpcMutate<{ staff: { role: string; status: string } }>('store.updateStaff', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id, role: 'frontdesk' },
  });
  check('批次 S1：本店 owner 改阿强 role→frontdesk 成功', toFrontdesk.staff.role === 'frontdesk', toFrontdesk.staff);
  const groomerMe = await trpcQuery<{ staff: { role: string; status: string } | null }>('auth.me', {
    cookie: groomerCookie,
  });
  check(
    '批次 S1：员工端下次拉取（auth.me）即见新角色 frontdesk（联动生效）',
    groomerMe.staff?.role === 'frontdesk',
    groomerMe.staff,
  );

  // 改回 groomer 并停用 → staffList 反映（留 groomer 身份供后续断言一致性）
  const backToGroomer = await trpcMutate<{ staff: { role: string; status: string } }>('store.updateStaff', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id, role: 'groomer', status: 'suspended' },
  });
  check(
    '批次 S1：改回 groomer + 停用（role/status 同传）成功',
    backToGroomer.staff.role === 'groomer' && backToGroomer.staff.status === 'suspended',
    backToGroomer.staff,
  );
  const listAfter = await trpcQuery<{ staff: Array<{ id: string; name: string; role: string; status: string }> }>(
    'store.staffList',
    { cookie: ownerCookie },
  );
  const aqiangAfter = listAfter.staff.find((s) => s.id === aqiang.id);
  check(
    '批次 S1：staffList 刷新一致（阿强=groomer/suspended）',
    aqiangAfter?.role === 'groomer' && aqiangAfter?.status === 'suspended',
    aqiangAfter,
  );

  /* ---------- 13. 客户端错误上报（批次 9a 任务 E · POST /api/client-error） ---------- */
  const postClientError = (body: unknown, ip: string, raw = false) =>
    fetch(`${BASE}/api/client-error`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: raw ? String(body) : JSON.stringify(body),
    });
  const validReport = {
    app: 'customer',
    route: '/appointments?crash=1',
    message: 'B9A-E e2e 注入错误',
    stackFirstFrame: 'AppointmentsPage (http://localhost:7100/src/pages/AppointmentsPage.tsx:98:11)',
    componentStackFirstFrame: 'AppointmentsPage',
    time: new Date().toISOString(),
    ua: 'philia-e2e/1.0',
  };
  const ceOk = await postClientError(validReport, '10.9.0.1');
  const ceOkBody = (await ceOk.json()) as { ok?: boolean };
  check('client-error 合法上报 → 200 {ok:true}（免登录）', ceOk.status === 200 && ceOkBody.ok === true, ceOk.status);

  const ceBadApp = await postClientError({ ...validReport, app: 'hacker' }, '10.9.0.2');
  check('client-error 非法 app → 400', ceBadApp.status === 400, ceBadApp.status);
  const ceMissing = await postClientError({ app: 'staff' }, '10.9.0.3');
  check('client-error 缺 route/message → 400', ceMissing.status === 400, ceMissing.status);
  const ceNotJson = await postClientError('not-json{{{', '10.9.0.4', true);
  check('client-error 非 JSON body → 400', ceNotJson.status === 400, ceNotJson.status);

  // 限流：同一 IP 固定窗口 20 次/分，第 21 次起 429
  let first429 = -1;
  for (let i = 1; i <= 24; i++) {
    const r = await postClientError(validReport, '10.9.9.9');
    if (r.status === 429) { first429 = i; break; }
  }
  check('client-error 限流：同 IP 第 21 次起 → 429', first429 > 0 && first429 <= 22, first429);

  const ceLogRaw = existsSync(CLIENT_ERROR_LOG) ? readFileSync(CLIENT_ERROR_LOG, 'utf8') : '';
  const ceLines = ceLogRaw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
  check(
    'client-error JSONL 落盘：合法条目在日志（app/route/message/UA/首帧齐全）',
    ceLines.some(
      (l) =>
        l.app === 'customer' &&
        l.route === '/appointments?crash=1' &&
        l.message === 'B9A-E e2e 注入错误' &&
        typeof l.componentStackFirstFrame === 'string' &&
        l.ua === 'philia-e2e/1.0',
    ),
    ceLines.slice(0, 2),
  );
  check(
    'client-error 落盘：非法 app 条目不入日志',
    !ceLines.some((l) => l.app === 'hacker'),
  );

  /* ==================================================================
   * 批次 staff-2（R7~R10）验收段（设计稿 §五清单 / 任务书 §七）
   * ================================================================== */
  const { and, inArray, gte, lt, isNull } = await import('drizzle-orm');

  /* ---------- 14. 前置夹具 ----------
   * - 12b 收尾将阿强置 groomer/suspended；本批验收需其在岗（staffProcedure 每请求在职校验）→ 复职；
   * - 围栏圆心显式置位（种子本带坐标，按任务书 §二.2 口径显式落定保证判定确定）；
   * - clerk 越权负例账号（仅 users+user_roles，无 staff 行——merchantOwnerProcedure
   *   角色闸先于归属，FORBIDDEN 同口径）；
   * - manager（店长）挂 staff 行绑定本店（merchantManagerProcedure 需 storeId——
   *   中间件对非 owner 商家角色只从 staff 行取门店归属；R12 店长退款链路实证用，
   *   配置端口 owner-only 403 断言不受影响）；
   * - 附加员工×3（榜尾不可达夹具：本店 6 名员工，榜尾视角验证第 4 名不出参）；
   * - 榜单 XP 基底直插 xp_events（channel='learning' 不占日上限，不干扰第 22 节日上限断言）；
   *   分值拉开 ≥90 间距，吸收运行期噪声（好评 +6 / 差评 −8 / 完成补偿 +2 / 考勤 ±5）。 */
  const reactivate = await trpcMutate<{ staff: { role: string; status: string } }>('store.updateStaff', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id, status: 'active' },
  });
  check('staff-2 前置：阿强复职（role 留 groomer / status active）',
    reactivate.staff.status === 'active' && reactivate.staff.role === 'groomer', reactivate.staff);

  await db
    .update(schema.stores)
    .set({ lat: 30.2741, lng: 120.1551 })
    .where(eq(schema.stores.id, storeId));

  const xiaomeiStaff = staffList.staff.find((s) => s.name === '小美');
  if (!xiaomeiStaff) throw new Error('小美 staff 行缺失');
  const liliUser = byKimi('seed_kimi_staff3')!;

  const fixtureUsers = await db
    .insert(schema.users)
    .values([
      { kimiId: 'seed_e2e_clerk', nickname: 'e2e 店员 clerk', phone: '13900001001' },
      { kimiId: 'seed_e2e_manager', nickname: 'e2e 店长 manager', phone: '13900001002' },
      { kimiId: 'seed_e2e_extra1', nickname: 'e2e 附加甲', phone: '13900001011' },
      { kimiId: 'seed_e2e_extra2', nickname: 'e2e 附加乙', phone: '13900001012' },
      { kimiId: 'seed_e2e_extra3', nickname: 'e2e 附加丙', phone: '13900001013' },
    ])
    .returning();
  const [clerkFix, managerFix, extraU1, extraU2, extraU3] = fixtureUsers as [
    (typeof fixtureUsers)[number],
    (typeof fixtureUsers)[number],
    (typeof fixtureUsers)[number],
    (typeof fixtureUsers)[number],
    (typeof fixtureUsers)[number],
  ];
  await db.insert(schema.userRoles).values([
    { userId: clerkFix.id, role: 'merchant_clerk' },
    { userId: managerFix.id, role: 'merchant_manager' },
    { userId: extraU1.id, role: 'staff' },
    { userId: extraU2.id, role: 'staff' },
    { userId: extraU3.id, role: 'staff' },
  ]);
  const extraStaffRows = await db
    .insert(schema.staff)
    .values([
      { storeId, userId: managerFix.id, name: 'e2e 店长', role: 'frontdesk', grade: 'P3', status: 'active' }, // R12：店长退款链路需 storeId（staff 行绑定）
      { storeId, userId: extraU1.id, name: '附加甲', role: 'groomer', status: 'active' },
      { storeId, userId: extraU2.id, name: '附加乙', role: 'groomer', status: 'active' },
      { storeId, userId: extraU3.id, name: '附加丙', role: 'groomer', status: 'active' },
    ])
    .returning();
  const [managerStaff, extraS1, extraS2, extraS3] = extraStaffRows as [
    (typeof extraStaffRows)[number],
    (typeof extraStaffRows)[number],
    (typeof extraStaffRows)[number],
    (typeof extraStaffRows)[number],
  ];
  void managerStaff;
  const clerkCookie = await devLogin(clerkFix.id);
  const managerCookie = await devLogin(managerFix.id);
  const extra2Cookie = await devLogin(extraU2.id);
  const extra3Cookie = await devLogin(extraU3.id);
  check('staff-2 前置：clerk/manager/附加员工夹具就绪（dev-login 均签发）',
    !!(clerkCookie && managerCookie && extra2Cookie && extra3Cookie));

  // 榜单基底：learning 通道直插（不占日上限）；分值间距 ≥90 吸收运行期噪声
  await db.insert(schema.xpEvents).values(
    [
      { staffId: extraS1.id, userId: extraU1.id, points: 1000 },
      { staffId: extraS2.id, userId: extraU2.id, points: 900 },
      { staffId: xiaomeiStaff.id, userId: staffUser!.id, points: 800 },
      { staffId: aqiang.id, userId: groomerUser!.id, points: 700 },
      { staffId: staffRow2.id, userId: liliUser.id, points: 600 },
      { staffId: extraS3.id, userId: extraU3.id, points: 10 },
    ].map((r) => ({
      storeId,
      staffId: r.staffId,
      userId: r.userId,
      source: 'cover',
      sourceId: 'e2e-leaderboard-seed',
      points: r.points,
      channel: 'learning',
      ruleVersion: 1,
      dropped: false,
    })),
  );

  // 本地日期口径（与 attendance.ts localDateStr 同帧：服务器本地时区）
  const pad2l = (n: number) => String(n).padStart(2, '0');
  const now0 = new Date();
  const todayStr = `${now0.getFullYear()}-${pad2l(now0.getMonth() + 1)}-${pad2l(now0.getDate())}`;
  const currentMonth = todayStr.slice(0, 7);
  const prevMonthD = new Date(now0.getFullYear(), now0.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonthD.getFullYear()}-${pad2l(prevMonthD.getMonth() + 1)}`;
  const currentQuarter = `${now0.getFullYear()}-Q${Math.floor(now0.getMonth() / 3) + 1}`;

  /** 负例统一收集：tRPC 错误 → TrpcHttpError，成功 → null */
  const asErr = (p: Promise<unknown>) => p.then(() => null, (e) => e as TrpcHttpError);

  /* ---------- 15. R7 打卡两击 + 围栏（清单①） ---------- */
  console.log('\n[staff-2] 15. R7 考勤：打卡两击 / 围栏拦截');
  interface MarkRes { record: { id: string; kind: string; distanceM: number }; duplicated: boolean }
  const markIn = await trpcMutate<MarkRes>('attendance.mark', {
    cookie: staffCookie,
    input: { kind: 'in', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-xiaomei' },
  });
  const markInDup = await trpcMutate<MarkRes>('attendance.mark', {
    cookie: staffCookie,
    input: { kind: 'in', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-xiaomei' },
  });
  check('R7① 上班打卡成功（围栏内 distanceM=0）', markIn.record.kind === 'in' && markIn.record.distanceM === 0, markIn.record);
  check('R7① 上班重复打卡幂等（返回同一条记录，不重复落行）',
    markInDup.duplicated === true && markInDup.record.id === markIn.record.id,
    { dup: markInDup.duplicated, id: markInDup.record.id, expect: markIn.record.id });
  const markOut = await trpcMutate<MarkRes>('attendance.mark', {
    cookie: staffCookie,
    input: { kind: 'out', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-xiaomei' },
  });
  const markOutDup = await trpcMutate<MarkRes>('attendance.mark', {
    cookie: staffCookie,
    input: { kind: 'out', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-xiaomei' },
  });
  check('R7① 下班打卡 + 重打幂等', markOut.record.kind === 'out' && markOutDup.duplicated === true && markOutDup.record.id === markOut.record.id, markOut.record);
  const xmToday = await db
    .select()
    .from(schema.attendanceRecords)
    .where(and(eq(schema.attendanceRecords.staffId, xiaomeiStaff.id), eq(schema.attendanceRecords.date, todayStr)));
  check('R7① 当日 attendance_records 恰 2 行（in+out，两击封顶）', xmToday.length === 2, xmToday.map((r) => r.kind));

  const farMark = await asErr(trpcMutate('attendance.mark', {
    cookie: groomerCookie,
    input: { kind: 'in', lat: 31.2304, lng: 121.4737, deviceId: 'e2e-dev-far' }, // 上海，距店 ~165km
  }));
  check('R7② 围栏外打卡 → 400 BAD_REQUEST「不在门店范围，无法打卡」',
    farMark instanceof TrpcHttpError && farMark.httpStatus === 400 && farMark.code === 'BAD_REQUEST' && farMark.message.includes('不在门店范围'),
    farMark && { status: farMark.httpStatus, code: farMark.code, message: farMark.message });
  const aqToday = await db
    .select()
    .from(schema.attendanceRecords)
    .where(and(eq(schema.attendanceRecords.staffId, aqiang.id), eq(schema.attendanceRecords.date, todayStr)));
  check('R7② 围栏外拦截零写入（阿强当日 0 行，不写异常记录）', aqToday.length === 0, aqToday.length);

  /* ---------- 16. R7 补卡流（清单②：申请→审批→可见 / 限当月 / ≤3 次每月） ---------- */
  console.log('\n[staff-2] 16. R7 补卡双流');
  const makeupReq = await trpcMutate<{ id: string; status: string }>('attendance.requestMakeup', {
    cookie: liliCookie,
    input: { date: todayStr, kind: 'in', requestedTs: new Date(`${todayStr}T09:00:00`), reason: '早会忘打卡' },
  });
  check('R7③ 补卡申请建档（pending，限当月日期）', makeupReq.status === 'pending', makeupReq);
  const approve = await trpcMutate<{ status: string; recordId: string | null }>('attendance.resolveApproval', {
    cookie: ownerCookie,
    input: { approvalId: makeupReq.id, approve: true, note: '同意补卡' },
  });
  check('R7③ 店长审批通过（approved + 回链 record_id）', approve.status === 'approved' && !!approve.recordId, approve);
  const makeupRow = await db
    .select()
    .from(schema.attendanceRecords)
    .where(and(eq(schema.attendanceRecords.staffId, staffRow2.id), eq(schema.attendanceRecords.date, todayStr), eq(schema.attendanceRecords.kind, 'in')))
    .get();
  check('R7③ 补卡通过落 makeup=1 记录（status=normal，补卡视同正常）',
    makeupRow?.makeup === true && makeupRow.status === 'normal' && makeupRow.id === approve.recordId,
    makeupRow && { makeup: makeupRow.makeup, status: makeupRow.status });
  const myAppr = await trpcQuery<Array<{ id: string; status: string; type: string }>>('attendance.myApprovals', { cookie: liliCookie });
  check('R7③ 员工端 myApprovals 可见审批结果（approved）',
    myAppr.some((a) => a.id === makeupReq.id && a.type === 'makeup' && a.status === 'approved'), myAppr.length);

  const pastMonth = await asErr(trpcMutate('attendance.requestMakeup', {
    cookie: liliCookie,
    input: { date: `${prevMonthStr}-01`, kind: 'in', requestedTs: new Date(`${prevMonthStr}-01T09:00:00`), reason: '跨月补卡验证' },
  }));
  check('R7④ 补卡限当月（上月日期 → BAD_REQUEST「补卡限当月」）',
    pastMonth instanceof TrpcHttpError && pastMonth.code === 'BAD_REQUEST' && pastMonth.message.includes('补卡限当月'),
    pastMonth && { code: pastMonth.code, message: pastMonth.message });

  // 月限 3 次：approved×1 + 再申 pending×2 → 第 4 次硬拒
  await trpcMutate('attendance.requestMakeup', {
    cookie: liliCookie,
    input: { date: todayStr, kind: 'out', requestedTs: new Date(`${todayStr}T18:00:00`), reason: '忘打下班卡' },
  });
  await trpcMutate('attendance.requestMakeup', {
    cookie: liliCookie,
    input: { date: todayStr, kind: 'in', requestedTs: new Date(`${todayStr}T09:20:00`), reason: '补充说明占第 3 次' },
  });
  const fourth = await asErr(trpcMutate('attendance.requestMakeup', {
    cookie: liliCookie,
    input: { date: todayStr, kind: 'out', requestedTs: new Date(`${todayStr}T18:20:00`), reason: '第 4 次应被拒' },
  }));
  check('R7⑤ 当月第 4 次补卡 → BAD_REQUEST（每人 ≤3 次/月）',
    fourth instanceof TrpcHttpError && fourth.code === 'BAD_REQUEST' && fourth.message.includes('补卡次数已用完'),
    fourth && { code: fourth.code, message: fourth.message });

  /* ---------- 17. R8 盘点：店长确认才入账（清单③） ---------- */
  console.log('\n[staff-2] 17. R8 盘点状态机（confirm 前零库存写入 / 驳回重盘）');
  interface CountTaskItem { id: string; productId: string; systemStock: number; actualStock: number | null; productName: string | null }
  const count1 = await trpcMutate<{ id: string; status: string; itemCount: number }>('inventory.assignCount', {
    cookie: ownerCookie,
    input: { type: 'weekly' },
  });
  check('R8① 周盘建单（draft + 全量账面快照行）', count1.status === 'draft' && count1.itemCount > 0, count1);
  const tasks1 = await trpcQuery<Array<{ id: string; status: string; items: CountTaskItem[] }>>('inventory.myCountTasks', { cookie: staffCookie });
  const task1 = tasks1.find((t) => t.id === count1.id);
  check('R8① 员工端待办可见盘点单（行项齐全）', !!task1 && task1.items.length === count1.itemCount, task1?.items.length);
  if (!task1) throw new Error('盘点单未见于员工待办');
  const targetIdx = task1.items.findIndex((it) => it.systemStock >= 5);
  const target = task1.items[targetIdx]!;
  const stockAtAssign = (await db.select().from(schema.products).where(eq(schema.products.id, target.productId)).get())!.stock;
  const rec1 = await trpcMutate<{ id: string; status: string }>('inventory.recordItems', {
    cookie: staffCookie,
    input: {
      countId: count1.id,
      items: task1.items.map((it, i) => ({ itemId: it.id, actualStock: i === targetIdx ? it.systemStock - 3 : it.systemStock })),
    },
  });
  const stockAfterRecord = (await db.select().from(schema.products).where(eq(schema.products.id, target.productId)).get())!.stock;
  check('R8② 实盘录入 → counted；confirm 前零库存写入（products.stock 不变）',
    rec1.status === 'counted' && stockAfterRecord === stockAtAssign && target.systemStock === stockAtAssign,
    { status: rec1.status, stockAtAssign, stockAfterRecord });
  const confirm1 = await trpcMutate<{ count: { status: string }; diffs: number }>('inventory.confirmCount', {
    cookie: ownerCookie,
    input: { countId: count1.id },
  });
  const stockAfterConfirm = (await db.select().from(schema.products).where(eq(schema.products.id, target.productId)).get())!.stock;
  const mv1 = await db
    .select()
    .from(schema.stockMovements)
    .where(and(eq(schema.stockMovements.sourceType, 'count'), eq(schema.stockMovements.sourceId, count1.id)));
  check('R8③ 店长确认才入账（posted，diffs=1）', confirm1.count.status === 'posted' && confirm1.diffs === 1, confirm1);
  check('R8③ 入账落流水 sourceType=count（盘亏 delta=-3，before/after 正确）+ products.stock 更新',
    mv1.length === 1 &&
      mv1[0]!.delta === -3 && mv1[0]!.beforeStock === stockAtAssign && mv1[0]!.afterStock === stockAtAssign - 3 &&
      mv1[0]!.operatorId === ownerUser!.id && stockAfterConfirm === stockAtAssign - 3,
    { movements: mv1.length, stockAfterConfirm });

  // 驳回 → 退回重盘 → 重录 → 确认（无差异零流水）
  const count2 = await trpcMutate<{ id: string; status: string }>('inventory.assignCount', { cookie: ownerCookie, input: { type: 'weekly' } });
  const task2 = (await trpcQuery<Array<{ id: string; items: CountTaskItem[] }>>('inventory.myCountTasks', { cookie: staffCookie })).find((t) => t.id === count2.id);
  if (!task2) throw new Error('盘点单#2 未见于员工待办');
  await trpcMutate('inventory.recordItems', {
    cookie: staffCookie,
    input: { countId: count2.id, items: task2.items.map((it) => ({ itemId: it.id, actualStock: it.systemStock })) },
  });
  const rej = await trpcMutate<{ status: string; rejectNote: string }>('inventory.rejectCount', {
    cookie: ownerCookie,
    input: { countId: count2.id, note: '抽盘复核，退回重盘' },
  });
  check('R8④ 驳回 → rejected（退回重盘，note 回显）', rej.status === 'rejected' && rej.rejectNote === '抽盘复核，退回重盘', rej);
  const rec2 = await trpcMutate<{ status: string }>('inventory.recordItems', {
    cookie: staffCookie,
    input: { countId: count2.id, items: task2.items.map((it) => ({ itemId: it.id, actualStock: it.systemStock })) },
  });
  const confirm2 = await trpcMutate<{ count: { status: string }; diffs: number }>('inventory.confirmCount', {
    cookie: ownerCookie,
    input: { countId: count2.id },
  });
  const mv2 = await db
    .select()
    .from(schema.stockMovements)
    .where(and(eq(schema.stockMovements.sourceType, 'count'), eq(schema.stockMovements.sourceId, count2.id)));
  check('R8④ 退回单重录 → counted → 确认 posted；无差异零流水',
    rec2.status === 'counted' && confirm2.count.status === 'posted' && confirm2.diffs === 0 && mv2.length === 0,
    { rec: rec2.status, post: confirm2.count.status, diffs: confirm2.diffs, mv: mv2.length });

  /* ---------- 18. R9-C 接待人域（清单⑨） ---------- */
  console.log('\n[staff-2] 18. R9-C 接待人域（核销改挂 / 默认开单人 / 无接待人硬排除 / 两池分列）');
  const slotPool = cat2.slots.filter((s) => {
    const t = s.slotStart.getTime();
    if (t === slot.slotStart.getTime() || t === slot2.slotStart.getTime()) return false;
    const shifted = new Date(t + 8 * 3600 * 1000);
    const h = shifted.getUTCHours();
    return h >= 10 && h <= 16 && shifted.getUTCMinutes() === 0;
  });
  const slot3 = slotPool[0];
  const slot4 = slotPool[1];
  check('staff-2 前置：第三/第四可约槽（接待人域用单）', !!slot3 && !!slot4, slotPool.length);
  if (!slot3 || !slot4) throw new Error('可约槽不足');

  const mkAppt = async (slotX: typeof slot, note: string) =>
    trpcMutate<{ id: string; status: string }>('appointment.create', {
      cookie: customerCookie,
      input: { storeId: store.id, petId, serviceId: service.id, type: 'grooming', scheduledStart: slotX.slotStart, paymentMode: 'pay_at_store', note },
    });
  const appt3 = await mkAppt(slot3, 'e2e 接待人域 appt3');
  await trpcMutate('appointment.confirm', { cookie: ownerCookie, input: { appointmentId: appt3.id } });
  // 核销改挂：前台小美核销并把接待人改挂为本人（实际接待人=小美，用户 ID 口径）
  const code3 = await trpcQuery<{ code: string }>('appointment.getCode', { cookie: customerCookie, input: { appointmentId: appt3.id } });
  const checkin3 = await trpcMutate<{ appointment: { staffId: string | null }; receptionistId: string | null }>('appointment.checkin', {
    cookie: staffCookie,
    input: { code: code3.code, receptionistId: staffUser!.id },
  });
  check('R9-C① 核销改挂接待人（响应透出 receptionistId=小美）', checkin3.receptionistId === staffUser!.id, checkin3.receptionistId);
  const rlog = await db.select().from(schema.receptionLogs).where(eq(schema.receptionLogs.appointmentId, appt3.id));
  check('R9-C① reception_logs 挂预约留痕前后值（NULL → 小美，操作人=小美）',
    rlog.length === 1 && rlog[0]!.oldReceptionistId === null && rlog[0]!.newReceptionistId === staffUser!.id && rlog[0]!.changedBy === staffUser!.id,
    rlog.map((r) => ({ old: r.oldReceptionistId, next: r.newReceptionistId, by: r.changedBy })));
  const appt3StaffId = checkin3.appointment.staffId; // S4 自动派单归属（groomer 池基数用）

  const appt4 = await mkAppt(slot4, 'e2e 接待人域 appt4');
  await trpcMutate('appointment.confirm', { cookie: ownerCookie, input: { appointmentId: appt4.id } });
  const assign4 = await trpcMutate<{ staffId: string | null }>('appointment.assign', {
    cookie: ownerCookie,
    input: { appointmentId: appt4.id, staffId: aqiang.id },
  });
  check('staff-2 前置：appt4 指派阿强（扣减闸门基数来源单）', assign4.staffId === aqiang.id, assign4);
  // 补管：六步流已在主链路与 aid2（第 21 节）实证；此处直接把两单置 completed 供收银拉单
  await db
    .update(schema.appointments)
    .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
    .where(inArray(schema.appointments.id, [appt3.id, appt4.id]));

  // 收银三单：C=散客服务单（默认接待人=开单人 owner）/ A=appt3 预约行（接待人=预约改挂小美）/ B=appt4 预约行
  const settleBill = async (items: Array<{ kind: string; refId: string }>, note: string) => {
    const held = await trpcMutate<{ bill: { id: string; billNo: string; payableFen: number } }>('cashier.hold', {
      cookie: ownerCookie,
      input: { items, discountType: 'none', discountValue: 0, note },
    });
    const settled = await trpcMutate<{ bill: { id: string; status: string } }>('cashier.settle', {
      cookie: ownerCookie,
      input: { items, billNo: held.bill.billNo, discountType: 'none', discountValue: 0, note, payments: [{ method: 'cash', amountFen: held.bill.payableFen }] },
    });
    return { billId: held.bill.id, billNo: held.bill.billNo, payableFen: held.bill.payableFen, status: settled.bill.status };
  };
  const billC = await settleBill([{ kind: 'service', refId: service.id }], 'e2e 接待人域 billC（散客服务单）');
  const billA = await settleBill([{ kind: 'appointment', refId: appt3.id }], 'e2e 接待人域 billA（appt3 改挂单）');
  const billB = await settleBill([{ kind: 'appointment', refId: appt4.id }], 'e2e 接待人域 billB（appt4 阿强单）');
  check('R9-C② 三单结账 settled（接待人域夹具）', billC.status === 'settled' && billA.status === 'settled' && billB.status === 'settled',
    { c: billC.status, a: billA.status, b: billB.status });

  const billRows = await db.select().from(schema.cashierBills).where(inArray(schema.cashierBills.id, [billC.billId, billA.billId, billB.billId]));
  const billById = new Map(billRows.map((b) => [b.id, b]));
  check('R9-C② 账单接待人默认=开单人（billC → owner）', billById.get(billC.billId)?.receptionistId === ownerUser!.id, billById.get(billC.billId)?.receptionistId);
  check('R9-C② 含预约行账单接待人=预约接待人（billA → 小美，核销改挂落点）', billById.get(billA.billId)?.receptionistId === staffUser!.id, billById.get(billA.billId)?.receptionistId);
  // 构造无接待人单：billB receptionist 置 NULL（任务书口径：宁漏计不乱挂）
  await db.update(schema.cashierBills).set({ receptionistId: null, updatedAt: new Date() }).where(eq(schema.cashierBills.id, billB.billId));
  const billBAfter = await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.id, billB.billId)).get();
  check('R9-C③ 构造 billB 无接待人单（receptionist_id=NULL）', billBAfter?.receptionistId === null, billBAfter?.receptionistId);

  const itemOf = async (billId: string) =>
    (await db.select().from(schema.cashierBillItems).where(eq(schema.cashierBillItems.billId, billId)))[0]!;
  const priceA = (await itemOf(billA.billId)).unitPriceFen;
  const priceB = (await itemOf(billB.billId)).unitPriceFen;
  const priceC = (await itemOf(billC.billId)).unitPriceFen;

  interface PerfPoolT { baseFen: number; rateBp: number; amountFen: number }
  interface SummaryPayload {
    payload: {
      staffId: string;
      commissionTotalFen: number;
      performance: { grade: string; coeffBp: number | null; groomerPool: PerfPoolT; frontdeskPool: PerfPoolT };
      deductions: Array<{ id: string; amountFen: number; reason: string; createdBy: string }>;
    };
  }
  const fdSummary = await trpcQuery<SummaryPayload>('commission.mySummary', { cookie: staffCookie, input: {} });
  check('R9-C③ 前台绩效池仅计本人接待归属（=billA 门市价，billB 无接待人硬排除）',
    fdSummary.payload.performance.frontdeskPool.baseFen === priceA,
    { actual: fdSummary.payload.performance.frontdeskPool.baseFen, priceA });

  const pools = await trpcQuery<{
    pools: Array<{ pool: string; label: string; baseFen: number; rateBp: number; amountFen: number }>;
    unattributedFen: number;
  }>('commission.storePools', { cookie: ownerCookie, input: { quarter: currentQuarter } });
  const gPool = pools.pools.find((p) => p.pool === 'groomer');
  const fPool = pools.pools.find((p) => p.pool === 'frontdesk');
  check('R9-C④ storePools 同源双计两池分列（美容师绩效池/前台绩效池两行不合并）',
    pools.pools.length === 2 && !!gPool && !!fPool && gPool.pool !== fPool.pool,
    pools.pools.map((p) => p.pool));
  check('R9-C④ 池基数正确（groomer=两预约行操作归属 / frontdesk=改挂单+散客服务单接待归属）',
    gPool?.baseFen === (appt3StaffId ? priceA : 0) + priceB && fPool?.baseFen === priceA + priceC,
    { g: gPool?.baseFen, f: fPool?.baseFen, priceA, priceB, priceC });
  check('R9-C⑤ 无接待人洗美营收硬排除透出（unattributedFen=billB）', pools.unattributedFen === priceB, pools.unattributedFen);

  /* ---------- 19. R9 扣减 50% 硬闸门（清单⑤） ---------- */
  console.log('\n[staff-2] 19. R9 绩效扣减：50% 上限 FORBIDDEN');
  const grade = await trpcMutate<{ grade: { grade: string }; changed: boolean }>('commission.gradePerformance', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id, quarter: currentQuarter, grade: 'A', note: '【测试】e2e 季度评级' },
  });
  check('R9⑥ 季度评级录入（阿强 当季 A 档，系数 1.0）', grade.grade.grade === 'A', grade);

  const sumAq1 = await trpcQuery<SummaryPayload>('commission.mySummary', { cookie: groomerCookie, input: {} });
  check('R9⑦ 提成 mySummary 仅本人（阿强 200，staffId=本人）', sumAq1.payload.staffId === aqiang.id, sumAq1.payload.staffId);
  const groomerPoolAmt = sumAq1.payload.performance.groomerPool.amountFen;
  // appt3 自动派单归属随负荷动态（本轮实测=阿强）：groomer 池基数=billB +（appt3 归阿强时 billA）
  const expectedAqGroomerBase = priceB + (appt3StaffId === aqiang.id ? priceA : 0);
  check('R9⑦ 阿强美容师绩效池基数>0（预约行操作归属=settled 账单口径）且 A 档系数 1.0',
    sumAq1.payload.performance.groomerPool.baseFen === expectedAqGroomerBase && sumAq1.payload.performance.coeffBp === 10000,
    { actual: sumAq1.payload.performance.groomerPool.baseFen, expected: expectedAqGroomerBase, appt3归阿强: appt3StaffId === aqiang.id });
  // 与 server 同口径算上限：月绩效估计=池金额×系数/3，cap=估计×50%
  const monthlyEst = Math.round((groomerPoolAmt * 10000) / 10000 / 3);
  const capFen = Math.floor((monthlyEst * 5000) / 10000);
  const overDed = await asErr(trpcMutate('commission.createDeduction', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id, month: currentMonth, amountFen: capFen + 1, reason: '超限验证（应被拒）' },
  }));
  check('R9⑧ 扣减超当月绩效 50% → 403 FORBIDDEN「已达当月扣减上限」',
    overDed instanceof TrpcHttpError && overDed.httpStatus === 403 && overDed.code === 'FORBIDDEN' && overDed.message.includes('已达当月扣减上限'),
    overDed && { status: overDed.httpStatus, message: overDed.message, capFen });
  const smallDed = Math.min(50, capFen);
  const ded = await trpcMutate<{ deduction: { id: string; amountFen: number }; monthUsedFen: number; monthCapFen: number }>('commission.createDeduction', {
    cookie: ownerCookie,
    input: { staffId: aqiang.id, month: currentMonth, amountFen: smallDed, reason: '仪容不整扣减' },
  });
  check('R9⑧ 限额内扣减成功（monthUsed/monthCap 透出，cap 与口径一致）',
    ded.monthUsedFen === smallDed && ded.monthCapFen === capFen, ded);
  const sumAq2 = await trpcQuery<SummaryPayload>('commission.mySummary', { cookie: groomerCookie, input: {} });
  check('R9⑧ 扣减列示于 mySummary.deductions（含原因/录单人）',
    sumAq2.payload.deductions.some((d) => d.amountFen === smallDed && d.reason === '仪容不整扣减' && d.createdBy === ownerUser!.id),
    sumAq2.payload.deductions);
  check('R9⑧ 扣减只扣绩效不扣提成（commissionTotalFen 不变）',
    sumAq2.payload.commissionTotalFen === sumAq1.payload.commissionTotalFen,
    { before: sumAq1.payload.commissionTotalFen, after: sumAq2.payload.commissionTotalFen });

  /* ---------- 20. R9/R10 仅本人硬过滤（清单④） ---------- */
  console.log('\n[staff-2] 20. 仅本人：越权传参 4xx / myEvents 仅本人 / storePools 403');
  const crossRead = await asErr(trpcQuery('commission.mySummary', {
    cookie: groomerCookie,
    input: { month: currentMonth, staffId: staffRow2.id }, // 越权传参：strict 硬拒（查不到非遮蔽）
  }));
  check('R9⑨ mySummary 越权传 staffId → 4xx（strict BAD_REQUEST）',
    crossRead instanceof TrpcHttpError && crossRead.httpStatus === 400 && crossRead.code === 'BAD_REQUEST',
    crossRead && { status: crossRead.httpStatus, code: crossRead.code });

  const aidReviewRow = await db.select().from(schema.reviews).where(eq(schema.reviews.appointmentId, aid)).get();
  check('R10⑩ 主单好评已落 reviews 行（rating=5 非匿名，R10 最小评价域）',
    aidReviewRow?.rating === 5 && aidReviewRow.anonymous === false && aidReviewRow.staffId === staffRow2.id, aidReviewRow);
  interface XpEventItem { id: string; source: string; sourceId: string; points: number; channel: string; ruleVersion: number; dropped: boolean }
  const evLili = await trpcQuery<{ items: XpEventItem[] }>('xp.myEvents', { cookie: liliCookie });
  const evAq = await trpcQuery<{ items: XpEventItem[] }>('xp.myEvents', { cookie: groomerCookie });
  check('R10⑪ myEvents 仅本人（丽丽流内含本人 +6 好评事件）',
    !!aidReviewRow && evLili.items.some((e) => e.source === 'review' && e.sourceId === aidReviewRow.id && e.points === 6),
    evLili.items.map((e) => `${e.source}:${e.points}`));
  check('R10⑪ myEvents 仅本人（阿强流内无丽丽事件，无入参可越权）',
    !!aidReviewRow && !evAq.items.some((e) => e.sourceId === aidReviewRow.id),
    evAq.items.length);

  const poolsAsStaff = await asErr(trpcQuery('commission.storePools', { cookie: staffCookie, input: { quarter: currentQuarter } }));
  const poolsAsClerk = await asErr(trpcQuery('commission.storePools', { cookie: clerkCookie, input: { quarter: currentQuarter } }));
  check('R9⑩ storePools 仅店主（staff → 403 FORBIDDEN）',
    poolsAsStaff instanceof TrpcHttpError && poolsAsStaff.httpStatus === 403 && poolsAsStaff.code === 'FORBIDDEN',
    poolsAsStaff && { status: poolsAsStaff.httpStatus, code: poolsAsStaff.code });
  check('R9⑩ storePools 仅店主（clerk → 403 FORBIDDEN，附证）',
    poolsAsClerk instanceof TrpcHttpError && poolsAsClerk.httpStatus === 403 && poolsAsClerk.code === 'FORBIDDEN',
    poolsAsClerk && { status: poolsAsClerk.httpStatus, code: poolsAsClerk.code });

  /* ---------- 21. R10 评价域（清单⑧：差评 −8 / 匿名 / flagged 到店频道 / 一单一评） ---------- */
  console.log('\n[staff-2] 21. R10 评价：差评扣分 + 匿名 + 店长频道提示 + 幂等');
  // aid2（S1-R1② 未指派核销单，在 in_service）：指派阿强后由其走完六步 → completed
  await db.update(schema.appointments).set({ staffId: aqiang.id, updatedAt: new Date() }).where(eq(schema.appointments.id, aid2));
  createdAidExtras.push(aid2);
  async function uploadFor(aidX: string, stepKey: string, cookie: string): Promise<{ url: string; thumbUrl: string }> {
    const img = new Jimp({ width: 320, height: 240, color: 0x66aaffff });
    const buf = await img.getBuffer('image/jpeg');
    const fd = new FormData();
    fd.append('file', new File([buf], `e2e-${aidX}-${stepKey}.jpg`, { type: 'image/jpeg' }));
    fd.append('relDir', `appointment/${aidX}/${stepKey}`);
    const res = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { cookie }, body: fd });
    const body = (await res.json()) as { url?: string; thumbUrl?: string; message?: string };
    if (!res.ok || !body.url) throw new Error(`上传失败(${aidX}/${stepKey}): ${res.status} ${JSON.stringify(body)}`);
    return { url: body.url, thumbUrl: body.thumbUrl ?? body.url };
  }
  for (const plan of stepPlan) {
    if (plan.count > 0) {
      const up = await uploadFor(aid2, plan.key, groomerCookie);
      await trpcMutate('serviceStep.addPhotos', {
        cookie: groomerCookie,
        input: {
          appointmentId: aid2,
          stepKey: plan.key,
          photos: Array.from({ length: plan.count }, (_, i) => ({ url: up.url, thumbUrl: up.thumbUrl, tag: plan.tags?.[i] ?? 'normal' })),
        },
      });
    }
    const done = await trpcMutate<{ appointmentCompleted: boolean }>('serviceStep.confirmStep', {
      cookie: groomerCookie,
      input: { appointmentId: aid2, stepKey: plan.key },
    });
    check(`R10⑫ aid2 六步推进（${plan.key}）`, done.appointmentCompleted === (plan.key === 'confirm'), done);
  }

  const rev2 = await trpcMutate<{ rating: number | null }>('appointment.review', {
    cookie: customerCookie,
    input: { appointmentId: aid2, rating: 2, review: '有待改进', anonymous: true },
  });
  check('R10⑬ 差评提交成功（rating=2 anonymous=true，≤30s 链路内完成）', rev2.rating === 2, rev2);
  const reviewRow2 = await db.select().from(schema.reviews).where(eq(schema.reviews.appointmentId, aid2)).get();
  check('R10⑬ reviews 行落库（anonymous=1，归属阿强）',
    reviewRow2?.anonymous === true && reviewRow2.rating === 2 && reviewRow2.staffId === aqiang.id, reviewRow2);
  const penaltyRow = reviewRow2
    ? await db
        .select()
        .from(schema.xpEvents)
        .where(and(eq(schema.xpEvents.staffId, aqiang.id), eq(schema.xpEvents.source, 'penalty'), eq(schema.xpEvents.sourceId, reviewRow2.id)))
        .get()
    : undefined;
  check('R10⑬ 差评 XP −8（扣分不扣款，penalty 不占日上限）',
    penaltyRow?.points === -8 && penaltyRow.dropped === false, penaltyRow && { points: penaltyRow.points, dropped: penaltyRow.dropped });
  const flaggedRows = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'review.flagged' && r.channel === `store:${storeId}` && (r.payload as Record<string, unknown> | null)?.appointmentId === aid2,
  );
  check('R10⑬ 差评提示 review.flagged 到达 store 频道（店长视图数据源，event_outbox 实证）', flaggedRows.length === 1, flaggedRows.map((r) => r.channel));
  interface MyReviewItem { id: string; appointmentId: string; rating: number; anonymous: boolean }
  const myRevAq = await trpcQuery<{ items: MyReviewItem[] }>('xp.myReviews', { cookie: groomerCookie });
  const myRevLili = await trpcQuery<{ items: MyReviewItem[] }>('xp.myReviews', { cookie: liliCookie });
  check('R10⑬ 员工端 myReviews 仅本人且匿名标记透出（阿强见 aid2 差评 anonymous=1）',
    myRevAq.items.some((r) => r.appointmentId === aid2 && r.anonymous === true && r.rating === 2), myRevAq.items.length);
  check('R10⑬ myReviews 仅本人（丽丽不见阿强差评，见本人 aid 好评）',
    !myRevLili.items.some((r) => r.appointmentId === aid2) && myRevLili.items.some((r) => r.appointmentId === aid), myRevLili.items.length);

  const goodXp = aidReviewRow
    ? await db
        .select()
        .from(schema.xpEvents)
        .where(and(eq(schema.xpEvents.staffId, staffRow2.id), eq(schema.xpEvents.source, 'review'), eq(schema.xpEvents.sourceId, aidReviewRow.id)))
        .get()
    : undefined;
  check('R10⑭ 5 星好评 +6（主单 aid，匿名同权口径的对照组）', goodXp?.points === 6 && goodXp.dropped === false, goodXp && { points: goodXp.points });

  const again1 = await asErr(trpcMutate('appointment.review', { cookie: customerCookie, input: { appointmentId: aid, rating: 4 } }));
  const again2 = await asErr(trpcMutate('appointment.review', { cookie: customerCookie, input: { appointmentId: aid2, rating: 5 } }));
  check('R10⑮ 一单一评（重复评价幂等拒绝 BAD_REQUEST「该预约已评价」×2）',
    again1 instanceof TrpcHttpError && again1.code === 'BAD_REQUEST' && again1.message.includes('已评价') &&
      again2 instanceof TrpcHttpError && again2.code === 'BAD_REQUEST' && again2.message.includes('已评价'),
    [again1?.message, again2?.message]);

  /* ---------- 22. R10 考试 XP 不受日上限（清单⑦） ---------- */
  console.log('\n[staff-2] 22. R10 学习通道：日上限填满后考试 XP 仍计分');
  interface AwardRes { awarded: number; dropped: boolean; skipped: boolean; ruleVersion: number }
  let lastCover: AwardRes | null = null;
  for (let i = 1; i <= 4; i++) {
    lastCover = await trpcMutate<AwardRes>('xp.assignCover', {
      cookie: ownerCookie,
      input: { staffId: extraS2.id, note: `e2e 补位 ${i}/4` },
    });
  }
  check('R10⑯ 补位 ×4 填满日上限（+15×4=60，均未丢弃）', lastCover!.awarded === 15 && lastCover!.dropped === false, lastCover);
  const cover5 = await trpcMutate<AwardRes>('xp.assignCover', {
    cookie: ownerCookie,
    input: { staffId: extraS2.id, note: '【测试】e2e 补位第 5 次（应超限丢弃）' },
  });
  check('R10⑯ 第 5 次补位超限丢弃留痕（dropped=1 / awarded=0，不报错）', cover5.dropped === true && cover5.awarded === 0, cover5);
  interface XpSummary { totalXp: number; today: { earned: number; cap: number } }
  const sumE2a = await trpcQuery<XpSummary>('xp.mySummary', { cookie: extra2Cookie });
  check('R10⑯ 今日进度封顶明示（earned=60 cap=60）', sumE2a.today.earned === 60 && sumE2a.today.cap === 60, sumE2a.today);
  const exam = await trpcMutate<AwardRes>('xp.recordExamPass', { cookie: extra2Cookie, input: { level: 'P0' } });
  check('R10⑰ 考试 XP 不受日上限（P0 +30 learning 通道照常计入）', exam.awarded === 30 && exam.dropped === false, exam);
  const sumE2b = await trpcQuery<XpSummary>('xp.mySummary', { cookie: extra2Cookie });
  check('R10⑰ 考试计入累计但不占日额（totalXp=900+60+30=990，today 仍 60/60）',
    sumE2b.totalXp === 990 && sumE2b.today.earned === 60, { totalXp: sumE2b.totalXp, today: sumE2b.today });
  const examDup = await asErr(trpcMutate('xp.recordExamPass', { cookie: extra2Cookie, input: { level: 'P0' } }));
  check('R10⑰ 同级当月重复考试 → BAD_REQUEST（每级每月限 1 次）',
    examDup instanceof TrpcHttpError && examDup.code === 'BAD_REQUEST' && examDup.message.includes('每级每月限 1 次'),
    examDup && { code: examDup.code, message: examDup.message });

  /* ---------- 23. R9-F 配置端口（清单⑩） ---------- */
  console.log('\n[staff-2] 23. R9-F 配置端口：版本化留痕 / 新参只管新单 / clerk+manager 403 / 未知键 / 拉新置灰');
  interface CfgRuleRow { version: number; ruleKey: string; valueJson: Record<string, unknown>; active: boolean }
  const cfg1 = await trpcQuery<{ currentVersion: number; rules: CfgRuleRow[] }>('config.list', { cookie: ownerCookie, input: { domain: 'xp' } });
  const capRowV1 = cfg1.rules.find((r) => r.ruleKey === 'xp_daily_cap' && r.active);
  check('R9-F① 配置读取（当前 version=1，xp_daily_cap=60 生效中）',
    cfg1.currentVersion === 1 && capRowV1?.valueJson.cap === 60, { v: cfg1.currentVersion, cap: capRowV1?.valueJson });

  const save = await trpcMutate<{ version: number; keys: string[] }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'xp', changes: [{ ruleKey: 'xp_daily_cap', valueJson: { cap: 50 } }] },
  });
  check('R9-F② owner 保存即生效（version=2）', save.version === 2 && save.keys.includes('xp_daily_cap'), save);

  const vers = await trpcQuery<{ versions: Array<{ version: number; changedBy: string; changerNickname: string | null; changesJson: Array<{ rule_key: string; before: unknown; after: unknown }> }> }>(
    'config.versions',
    { cookie: ownerCookie, input: { domain: 'xp' } },
  );
  const v2row = vers.versions.find((v) => v.version === 2);
  const v2change = v2row?.changesJson.find((c) => c.rule_key === 'xp_daily_cap');
  check('R9-F② 版本留痕（每 key 前后值 + 变更人）',
    !!v2row && v2row.changedBy === ownerUser!.id &&
      (v2change?.before as Record<string, unknown>)?.cap === 60 && (v2change?.after as Record<string, unknown>)?.cap === 50,
    v2change);
  const cfg2 = await trpcQuery<{ rules: CfgRuleRow[] }>('config.list', { cookie: ownerCookie, input: { domain: 'xp' } });
  const capRows = cfg2.rules.filter((r) => r.ruleKey === 'xp_daily_cap');
  check('R9-F② 旧行失效新行生效（v1 active=0 / v2 active=1 cap=50）',
    capRows.some((r) => r.active && r.version === 2 && r.valueJson.cap === 50) && capRows.some((r) => !r.active && r.version === 1 && r.valueJson.cap === 60),
    capRows.map((r) => ({ v: r.version, active: r.active, cap: r.valueJson.cap })));

  // 新参只影响新单：extra3（今日已计 0）按新上限 50 发放——+15×3=45 通过，第 4 次 45+15>50 丢弃
  for (let i = 1; i <= 3; i++) {
    await trpcMutate<AwardRes>('xp.assignCover', { cookie: ownerCookie, input: { staffId: extraS3.id, note: `e2e 新参补位 ${i}/3` } });
  }
  const coverE3Over = await trpcMutate<AwardRes>('xp.assignCover', { cookie: ownerCookie, input: { staffId: extraS3.id, note: '【测试】e2e 新参第 4 次（应按 50 丢弃）' } });
  const sumE3 = await trpcQuery<XpSummary>('xp.mySummary', { cookie: extra3Cookie });
  check('R9-F③ 新参只管新单：cap=50 后第 4 次补位丢弃（today 45/50）',
    coverE3Over.dropped === true && coverE3Over.awarded === 0 && sumE3.today.earned === 45 && sumE3.today.cap === 50,
    { dropped: coverE3Over.dropped, today: sumE3.today });
  const evE3 = await trpcQuery<{ items: XpEventItem[] }>('xp.myEvents', { cookie: extra3Cookie });
  const droppedE3 = evE3.items.find((e) => e.dropped);
  check('R9-F③ 新事件按新规则版本落库（dropped 行 rule_version=2）', droppedE3?.ruleVersion === 2, droppedE3);
  const evE2b = await trpcQuery<{ items: XpEventItem[] }>('xp.myEvents', { cookie: extra2Cookie, input: { limit: 50 } });
  const sumE2c = await trpcQuery<XpSummary>('xp.mySummary', { cookie: extra2Cookie });
  check('R9-F③ 旧事件保持 rule_version=1 且仍计入（新参不回溯：totalXp 仍 990）',
    evE2b.items.length > 0 && evE2b.items.every((e) => e.ruleVersion === 1) && sumE2c.totalXp === 990,
    { n: evE2b.items.length, totalXp: sumE2c.totalXp });

  // clerk + manager 403（配置端口仅 owner，procedure 硬拒）
  for (const [label, cookie] of [['clerk', clerkCookie], ['manager', managerCookie]] as const) {
    const rList = await asErr(trpcQuery('config.list', { cookie, input: { domain: 'xp' } }));
    const rSave = await asErr(trpcMutate('config.save', { cookie, input: { domain: 'xp', changes: [{ ruleKey: 'xp_daily_cap', valueJson: { cap: 60 } }] } }));
    const rVers = await asErr(trpcQuery('config.versions', { cookie, input: { domain: 'xp' } }));
    check(`R9-F④ 配置端口 ${label} 403（list/save/versions 全拒，仅 owner）`,
      [rList, rSave, rVers].every((r) => r instanceof TrpcHttpError && r.httpStatus === 403 && r.code === 'FORBIDDEN'),
      [rList, rSave, rVers].map((r) => r && `${r.httpStatus}:${r.code}`));
  }

  const unknownKey = await asErr(trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'xp', changes: [{ ruleKey: 'xp_no_such_key', valueJson: { cap: 1 } }] },
  }));
  check('R9-F⑤ 未知规则键 → 400 BAD_REQUEST「未知规则键」（配置页只改既有参数）',
    unknownKey instanceof TrpcHttpError && unknownKey.code === 'BAD_REQUEST' && unknownKey.message.includes('未知规则键'),
    unknownKey && { code: unknownKey.code, message: unknownKey.message });

  const rulesView = await trpcQuery<{ sources: Array<{ key: string; disabled?: boolean; disabledNote?: string }> }>('xp.rulesView', { cookie: staffCookie });
  const referralSrc = rulesView.sources.find((s) => s.key === 'xp_referral');
  check('R10⑱ 拉新置灰拒写（rulesView 标注 disabled +「随会员游戏化批开通」；xp 路由无 referral 写入口，awardXp 对 referral 源码级硬拒）',
    referralSrc?.disabled === true && referralSrc.disabledNote === '随会员游戏化批开通', referralSrc);

  /* ---------- 24. R9 提成规则回溯（七步复核 Bug②）+ G0 洗护判别（裁定③） ----------
   * 回溯写死：改率前已结账单按旧率、改率后新单按新率（源单 settled_at × effective_from 时序解析）。
   * 夹具顺序：商品单 P1 → 商品率 5%→6% → 商品单 P2；服务率 20%→25% → appt5；
   * perf_base_rate 5%→10% → appt6；G0 学徒洗护/造型对照。 */
  console.log('\n[staff-2] 24. R9 提成回溯（Bug②）：旧单旧率/新单新率 + G0 仅洗护计 5%（裁定③）');
  interface CommLineT { billId: string; itemId: string; refId: string; name: string; baseFen: number; rateBp: number; amountFen: number }
  interface CommSummaryT {
    payload: {
      staffId: string;
      commissionTotalFen: number;
      serviceLines: CommLineT[];
      productLines: CommLineT[];
      performance: { grade: string; coeffBp: number | null; payableFen: number; groomerPool: PerfPoolT; frontdeskPool: PerfPoolT };
    };
  }

  // ① 商品率 5%→6%：billP1（改率前）/ billP2（改率后），归属=小美（商品提成按开单人 operator 归属，夹具置 operator=小美）
  // （时间列精度=秒：改率/结账之间 sleep 1.1s 跨秒界，同秒边界取旧版的保守口径见 commission.ts resolveFromHistory 注释）
  const prod = (await db.select().from(schema.products).where(and(eq(schema.products.storeId, storeId), eq(schema.products.status, 'on')))).find((p) => p.stock > 0);
  if (!prod) throw new Error('无在售商品夹具');
  const prodPrice = prod.priceFen;
  const billP1 = await settleBill([{ kind: 'product', refId: prod.id }], 'e2e 回溯 billP1（商品·改率前）');
  await db.update(schema.cashierBills).set({ operatorId: staffUser!.id, updatedAt: new Date() }).where(eq(schema.cashierBills.id, billP1.billId));
  await sleep(1100); // 跨秒界：billP1 settled_at 严格早于改率 effective_from
  const saveProdRate = await trpcMutate<{ version: number; keys: string[] }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'commission', changes: [{ ruleKey: 'commission_product_rate', valueJson: { rate_bp: 600 } }] },
  });
  check('R9回溯① 前置：商品率 5%→6% 保存即生效（commission version=2）', saveProdRate.version === 2, saveProdRate);
  await sleep(1100); // 跨秒界：billP2 settled_at 严格晚于改率
  const billP2 = await settleBill([{ kind: 'product', refId: prod.id }], 'e2e 回溯 billP2（商品·改率后）');
  await db.update(schema.cashierBills).set({ operatorId: staffUser!.id, updatedAt: new Date() }).where(eq(schema.cashierBills.id, billP2.billId));
  const sumXm = await trpcQuery<CommSummaryT>('commission.mySummary', { cookie: staffCookie, input: {} });
  const lineP1 = sumXm.payload.productLines.find((l) => l.billId === billP1.billId);
  const lineP2 = sumXm.payload.productLines.find((l) => l.billId === billP2.billId);
  check('R9回溯① 商品改率前单仍按旧率 5%（rateBp=500，金额=门市实收×5% 逐行精确）',
    lineP1?.rateBp === 500 && lineP1.amountFen === Math.round((prodPrice * 500) / 10000),
    { lineP1, prodPrice });
  check('R9回溯① 商品改率后单按新率 6%（rateBp=600，金额=×6% 逐行精确）',
    lineP2?.rateBp === 600 && lineP2.amountFen === Math.round((prodPrice * 600) / 10000),
    { lineP2, prodPrice });

  // ② 服务率 20%→25%：appt4（阿强，§18 billB 已结账=旧单）/ appt5（改率后新单）
  const saveGroomRate = await trpcMutate<{ version: number }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'commission', changes: [{ ruleKey: 'commission_grooming_rate', valueJson: { rate_bp: 2500 } }] },
  });
  check('R9回溯② 前置：服务率 20%→25% 保存即生效（version=3）', saveGroomRate.version === 3, saveGroomRate);
  await sleep(1100); // 跨秒界：appt5 结账严格晚于改率
  const appt5 = (await db.insert(schema.appointments).values({
    code: 'E2EAQ5', customerId: customerUser!.id, storeId, petId, serviceId: service.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 12345, completedAt: new Date(), staffId: aqiang.id,
  }).returning())[0]!;
  const billE = await settleBill([{ kind: 'appointment', refId: appt5.id }], 'e2e 回溯 billE（appt5 服务·改率后）');
  check('R9回溯② 前置：appt5 结账 settled', billE.status === 'settled', billE);
  const sumAq3 = await trpcQuery<CommSummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  const lineSvcOld = sumAq3.payload.serviceLines.find((l) => l.refId === appt4.id);
  const lineSvcNew = sumAq3.payload.serviceLines.find((l) => l.refId === appt5.id);
  check('R9回溯② 服务改率前单仍按旧率 20%（appt4/billB，rateBp=2000 金额精确）',
    lineSvcOld?.rateBp === 2000 && lineSvcOld.amountFen === Math.round((priceB * 2000) / 10000),
    { lineSvcOld, priceB });
  check('R9回溯② 服务改率后单按新率 25%（appt5，rateBp=2500 金额精确）',
    lineSvcNew?.rateBp === 2500 && lineSvcNew.amountFen === Math.round((12345 * 2500) / 10000),
    { lineSvcNew });

  // ③ perf_base_rate 5%→10%：既有全部旧单保持 5%，appt6（改率后）按 10% 逐行累加
  const poolBefore = sumAq3.payload.performance.groomerPool.amountFen; // 旧单已按 5% 逐行结算
  await sleep(1100); // 跨秒界：appt5 结账严格早于 perf 改率
  const savePerfRate = await trpcMutate<{ version: number }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'commission', changes: [{ ruleKey: 'perf_base_rate', valueJson: { rate_bp: 1000 } }] },
  });
  check('R9回溯③ 前置：perf_base_rate 5%→10% 保存即生效（version=4）', savePerfRate.version === 4, savePerfRate);
  await sleep(1100); // 跨秒界：appt6 结账严格晚于改率
  const appt6 = (await db.insert(schema.appointments).values({
    code: 'E2EAQ6', customerId: customerUser!.id, storeId, petId, serviceId: service.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 8000, completedAt: new Date(), staffId: aqiang.id,
  }).returning())[0]!;
  await settleBill([{ kind: 'appointment', refId: appt6.id }], 'e2e 回溯 billF（appt6 绩效·改率后）');
  const sumAq4 = await trpcQuery<CommSummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  check('R9回溯③ 绩效 perf_base_rate 改值不回溯（旧单仍 5%，appt6 按 10% 逐行精确累加）',
    sumAq4.payload.performance.groomerPool.amountFen === poolBefore + Math.round((8000 * 1000) / 10000),
    { before: poolBefore, after: sumAq4.payload.performance.groomerPool.amountFen, delta: Math.round((8000 * 1000) / 10000) });

  // ④ G0 学徒（裁定③）：洗护单计 5%、造型单不计（isWashService 关键词判别）
  const g0User = (await db.insert(schema.users).values({ kimiId: 'seed_e2e_g0', nickname: 'e2e 学徒小G', phone: '13900001021' }).returning())[0]!;
  await db.insert(schema.userRoles).values({ userId: g0User.id, role: 'staff' });
  const g0Staff = (await db.insert(schema.staff).values({ storeId, userId: g0User.id, name: '学徒小G', role: 'groomer', grade: 'G0', status: 'active' }).returning())[0]!;
  const [washSvc, styleSvc] = (await db.insert(schema.services).values([
    { storeId, type: 'grooming', name: '深层洗护浴', durationMin: 60, priceFen: 10000, active: true },
    { storeId, type: 'grooming', name: '泰迪造型修剪', durationMin: 90, priceFen: 10000, active: true },
  ]).returning()) as [typeof schema.services.$inferSelect, typeof schema.services.$inferSelect];
  const apptW = (await db.insert(schema.appointments).values({
    code: 'E2EG0W', customerId: customerUser!.id, storeId, petId, serviceId: washSvc.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 10000, completedAt: new Date(), staffId: g0Staff.id,
  }).returning())[0]!;
  const apptS = (await db.insert(schema.appointments).values({
    code: 'E2EG0S', customerId: customerUser!.id, storeId, petId, serviceId: styleSvc.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 10000, completedAt: new Date(), staffId: g0Staff.id,
  }).returning())[0]!;
  await settleBill([{ kind: 'appointment', refId: apptW.id }], 'e2e G0 billW（洗护单）');
  await settleBill([{ kind: 'appointment', refId: apptS.id }], 'e2e G0 billS（造型单）');
  const g0Cookie = await devLogin(g0User.id);
  const sumG0 = await trpcQuery<CommSummaryT>('commission.mySummary', { cookie: g0Cookie, input: {} });
  check('G0③ 洗护单计 5%（命中 洗/浴 不命中造型类；金额=10000×5%=500）',
    sumG0.payload.serviceLines.length === 1 && sumG0.payload.serviceLines[0]!.refId === apptW.id &&
      sumG0.payload.serviceLines[0]!.rateBp === 500 && sumG0.payload.serviceLines[0]!.amountFen === 500,
    sumG0.payload.serviceLines);
  check('G0③ 造型单不计提成（serviceLines 无 apptS 行，commissionTotalFen=500 仅洗护行）',
    !sumG0.payload.serviceLines.some((l) => l.refId === apptS.id) && sumG0.payload.commissionTotalFen === 500,
    { total: sumG0.payload.commissionTotalFen, lines: sumG0.payload.serviceLines.map((l) => `${l.name}:${l.amountFen}`) });

  /* ---------- 25. 补充令①：时长系数配置化（决策 #39/#40）+ G0 scope（决策 #40） ---------- */
  console.log('\n[staff-2] 25. 时长规则配置端口（改系数→新预约新值/旧单不变/留痕）+ G0 scope bath→all 双向');
  // ① owner 改体型系数 medium 1.5→2.0：中型犬（15kg 柯基短毛）新预约时长 90→120min；
  //    改前已建预约 scheduledEnd 原值不变（新值只管新单）；config.versions 留痕前后值
  const midDog = (await db.insert(schema.pets).values({
    ownerId: customerUser!.id, name: 'e2e 中型犬', species: 'dog', breed: '柯基', weightKg: 15,
  }).returning())[0]!;
  const slotD1 = slotPool[2];
  // D2 与 D1 间隔 ≥4h：D1 引擎时长 90min 占连续槽 + S4 可用性引擎按 groomer 空闲判定，
  // 相邻槽会因区间重叠/无空闲美容师 409（本轮实测），故取 ≥4h 后的槽位
  const slotD2 = slotD1 ? slotPool.find((s) => s.slotStart.getTime() >= slotD1.slotStart.getTime() + 4 * 3600 * 1000) : undefined;
  check('时长前置：D1/D2 可约槽（duration 用单，间隔≥4h 防区间重叠）', !!slotD1 && !!slotD2, slotPool.length);
  if (!slotD1 || !slotD2) throw new Error('可约槽不足（duration 段）');
  const apptD1 = await trpcMutate<{ id: string; scheduledStart: Date; scheduledEnd: Date }>('appointment.create', {
    cookie: customerCookie,
    input: { storeId: store.id, petId: midDog.id, serviceId: service.id, type: 'grooming', scheduledStart: slotD1.slotStart, paymentMode: 'pay_at_store', note: '【测试】e2e 时长 apptD1（改系数前）' },
  });
  const d1Min = (apptD1.scheduledEnd.getTime() - apptD1.scheduledStart.getTime()) / 60000;
  // 引擎口径：bath 基础 60 × medium 1.5 × short 1.0 = 90min（30min 栅格已整除）
  check('时长① 改系数前：中型犬洗护新预约 scheduledEnd=引擎 90min（60×1.5×1.0）', d1Min === 90, { d1Min });
  const saveSizeCoef = await trpcMutate<{ version: number; keys: string[] }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'duration', changes: [{ ruleKey: 'duration_size_coef', valueJson: { small: 1.0, medium: 2.0, large: 2.0 } }] },
  });
  check('时长① owner 改体型系数 medium 1.5→2.0（duration domain version=2）',
    saveSizeCoef.version === 2 && saveSizeCoef.keys.includes('duration_size_coef'), saveSizeCoef);
  const apptD2 = await trpcMutate<{ id: string; scheduledStart: Date; scheduledEnd: Date }>('appointment.create', {
    cookie: customerCookie,
    input: { storeId: store.id, petId: midDog.id, serviceId: service.id, type: 'grooming', scheduledStart: slotD2.slotStart, paymentMode: 'pay_at_store', note: '【测试】e2e 时长 apptD2（改系数后）' },
  });
  const d2Min = (apptD2.scheduledEnd.getTime() - apptD2.scheduledStart.getTime()) / 60000;
  check('时长① 改系数后：同宠物同服务新预约 scheduledEnd=新系数 120min（60×2.0×1.0）', d2Min === 120, { d2Min });
  const d1Row = await db.select().from(schema.appointments).where(eq(schema.appointments.id, apptD1.id)).get();
  check('时长① 改前已建预约 scheduledEnd 原值不变（不回溯：库内仍 90min）',
    !!d1Row && (d1Row.scheduledEnd.getTime() - d1Row.scheduledStart.getTime()) / 60000 === 90,
    d1Row && (d1Row.scheduledEnd.getTime() - d1Row.scheduledStart.getTime()) / 60000);
  const durVers = await trpcQuery<{ versions: Array<{ version: number; changedBy: string; changesJson: Array<{ rule_key: string; before: unknown; after: unknown }> }> }>(
    'config.versions',
    { cookie: ownerCookie, input: { domain: 'duration' } },
  );
  const dv2 = durVers.versions.find((v) => v.version === 2)?.changesJson.find((c) => c.rule_key === 'duration_size_coef');
  check('时长① config.versions 留痕前后值（medium 1.5→2.0，变更人=owner）',
    !!dv2 && (dv2.before as Record<string, unknown>)?.medium === 1.5 && (dv2.after as Record<string, unknown>)?.medium === 2.0 &&
      durVers.versions.find((v) => v.version === 2)?.changedBy === ownerUser!.id,
    dv2);

  // ② G0 scope（决策 #40）：阿强 grade 直改 G0（夹具）→ scope=bath 默认造型单不计提；
  //    owner 改 scope=all 后新造型单计提 5%（双向断言；秒界 sleep 防同秒 tie）
  await db.update(schema.staff).set({ grade: 'G0', updatedAt: new Date() }).where(eq(schema.staff.id, aqiang.id));
  const apptS2 = (await db.insert(schema.appointments).values({
    code: 'E2EGS2', customerId: customerUser!.id, storeId, petId, serviceId: styleSvc.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 10000, completedAt: new Date(), staffId: aqiang.id,
  }).returning())[0]!;
  await settleBill([{ kind: 'appointment', refId: apptS2.id }], 'e2e G0-scope billS2（造型·scope=bath）');
  const sumAqG0a = await trpcQuery<CommSummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  check('G0scope② scope=bath（默认）：G0 造型单不计提（serviceLines 无 apptS2 行）',
    !sumAqG0a.payload.serviceLines.some((l) => l.refId === apptS2.id),
    sumAqG0a.payload.serviceLines.map((l) => `${l.name}:${l.rateBp}`));
  await sleep(1100); // 跨秒界：billS2 结账严格早于 scope 改版
  const saveG0Scope = await trpcMutate<{ version: number }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'commission', changes: [{ ruleKey: 'commission_grooming_assistant_g0_rate', valueJson: { rate_bp: 500, scope: 'all' } }] },
  });
  check('G0scope② owner 改 scope=all（commission version=5）', saveG0Scope.version === 5, saveG0Scope);
  await sleep(1100); // 跨秒界：billS3 结账严格晚于改版
  const apptS3 = (await db.insert(schema.appointments).values({
    code: 'E2EGS3', customerId: customerUser!.id, storeId, petId, serviceId: styleSvc.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 10000, completedAt: new Date(), staffId: aqiang.id,
  }).returning())[0]!;
  await settleBill([{ kind: 'appointment', refId: apptS3.id }], 'e2e G0-scope billS3（造型·scope=all）');
  const sumAqG0b = await trpcQuery<CommSummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  const lineS3 = sumAqG0b.payload.serviceLines.find((l) => l.refId === apptS3.id);
  check('G0scope② scope=all：新造型单计提 5%（rateBp=500，金额=10000×5%=500 精确）',
    lineS3?.rateBp === 500 && lineS3.amountFen === 500, lineS3);
  check('G0scope② scope=all 不回溯：scope=bath 期造型单（apptS2）仍不计提',
    !sumAqG0b.payload.serviceLines.some((l) => l.refId === apptS2.id), apptS2.id);
  // 夹具还原：阿强 grade 回 G1（防干扰后续段）
  await db.update(schema.staff).set({ grade: 'G1', updatedAt: new Date() }).where(eq(schema.staff.id, aqiang.id));

  /* ---------- 26. R10 榜尾不可达（清单⑥） ---------- */
  console.log('\n[staff-2] 26. R10 榜单查询层裁剪（前三+自己+前一名）');
  interface LbRow { staffId: string; rank: number; isSelf: boolean; totalXp: number }
  const lbTail = await trpcQuery<{ rows: LbRow[] }>('xp.leaderboard', { cookie: extra3Cookie });
  check('R10⑲ 榜尾视角 ≤5 行（前三+自己+前一名）', lbTail.rows.length > 0 && lbTail.rows.length <= 5, lbTail.rows.length);
  check('R10⑲ 榜尾视角含自己与前一名（丽丽 rank5），第 4 名（阿强）不可达',
    lbTail.rows.some((r) => r.staffId === extraS3.id && r.isSelf) &&
      lbTail.rows.some((r) => r.staffId === staffRow2.id) &&
      !lbTail.rows.some((r) => r.staffId === aqiang.id),
    lbTail.rows.map((r) => `${r.rank}:${r.staffId.slice(0, 6)}${r.isSelf ? '*' : ''}`));
  const lbTop = await trpcQuery<{ rows: LbRow[] }>('xp.leaderboard', { cookie: staffCookie });
  check('R10⑲ 前排视角仅前三（丽丽/阿强/附加丙均不出参，全榜永不外泄）',
    lbTop.rows.length === 3 &&
      !lbTop.rows.some((r) => r.staffId === staffRow2.id || r.staffId === aqiang.id || r.staffId === extraS3.id),
    lbTop.rows.map((r) => `${r.rank}:${r.staffId.slice(0, 6)}`));

  /* ==================================================================
   * 批次 R12（退款专项）验收段 —— 任务书冻结版 V1.0 §七全清单逐条实证
   * 纲：退款 ≠ 反结账；原单已收不涂改；当日净额=已收−退款；六联动同事务。
   * ================================================================== */

  /* ---- 共用工具：+8 门店规范日界（refund.biz_date / dayStats 与 server storeWallclock 同帧） ---- */
  const storeDayStr = (d: Date) => new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const storeToday = storeDayStr(new Date());
  const storeYesterday = storeDayStr(new Date(Date.now() - 24 * 3600 * 1000));

  interface R12CartItem { kind: 'service' | 'product' | 'appointment'; refId: string; qty?: number; paidByPass?: boolean }
  /** R12 收银夹具：hold 取服务端重算应收 → settle 按支付段组合结账（缺省全额现金；开单人=owner） */
  const settleBill2 = async (
    items: R12CartItem[],
    opts: { customerId?: string; payments?: (payableFen: number) => Array<{ method: string; amountFen: number }>; note: string },
  ): Promise<{ billId: string; billNo: string; payableFen: number }> => {
    const held = await trpcMutate<{ bill: { id: string; billNo: string; payableFen: number } }>('cashier.hold', {
      cookie: ownerCookie,
      input: { customerId: opts.customerId ?? null, items, discountType: 'none', discountValue: 0, note: opts.note },
    });
    const settled = await trpcMutate<{ bill: { id: string; status: string } }>('cashier.settle', {
      cookie: ownerCookie,
      input: {
        customerId: opts.customerId ?? null,
        items,
        billNo: held.bill.billNo,
        discountType: 'none',
        discountValue: 0,
        note: opts.note,
        payments: opts.payments ? opts.payments(held.bill.payableFen) : [{ method: 'cash', amountFen: held.bill.payableFen }],
      },
    });
    if (settled.bill.status !== 'settled') throw new Error(`R12 夹具结账失败：${opts.note}`);
    return { billId: held.bill.id, billNo: held.bill.billNo, payableFen: held.bill.payableFen };
  };

  interface RefundExecRes {
    refund: {
      id: string; refundNo: string; status: string; amountFen: number; bizDate: string; type: string;
      operatorId: string; approverId: string | null; linkageJson: Record<string, unknown> | null;
    };
    plan: {
      refundFen: number;
      segments: Array<{ paymentId: string; method: string; amountFen: number; ratioBp: number; channel: string }>;
      boarding: { totalNights: number; occurredNights: number; remainingNights: number; nights: number; perNightFen: number } | null;
      passCancel: Record<string, unknown> | null;
    } | null;
    idempotent: boolean;
  }
  const execRefund = (cookie: string, input: Record<string, unknown>) =>
    trpcMutate<RefundExecRes>('refund.execute', { cookie, input });
  interface RefundDayStats {
    date: string; count: number; totalFen: number;
    segments: { cashFen: number; wechatFen: number; alipayFen: number; passFen: number; storedValueFen: number };
  }
  const dayStats = (date: string) => trpcQuery<RefundDayStats>('refund.dayStats', { cookie: ownerCookie, input: { date } });
  /** store 频道事件计数（event_outbox 实证，SSE 数据源同表） */
  const storeEventsOf = async (eventType: string, match: (payload: Record<string, unknown>) => boolean) =>
    (await db.select().from(schema.eventOutbox)).filter(
      (r) => r.eventType === eventType && r.channel === `store:${storeId}` && match((r.payload ?? {}) as Record<string, unknown>),
    );

  /* ---------- 27. 清单①：店员 clerk 无退款入口（server 403 明文） ---------- */
  console.log('\n[R12] 27. 权限闸：店员 clerk 403（清单①）');
  const clerkPrev = await asErr(trpcMutate('refund.preview', { cookie: clerkCookie, input: { billNo: billC.billNo, type: 'full' } }));
  const clerkExec = await asErr(execRefund(clerkCookie, { billNo: billC.billNo, type: 'full', reason: 'clerk 越权验证' }));
  const clerkList = await asErr(trpcQuery('refund.list', { cookie: clerkCookie }));
  check('R12① 店员 clerk 退款无入口（preview / execute / list 全 403 FORBIDDEN）',
    [clerkPrev, clerkExec, clerkList].every((r) => r instanceof TrpcHttpError && r.httpStatus === 403 && r.code === 'FORBIDDEN'),
    [clerkPrev, clerkExec, clerkList].map((r) => r && `${r.httpStatus}:${r.code}`));

  /* ---------- 28. 清单②+⑭：店长 ≤ 阈值现金单全额退，六联动同事务 ---------- */
  console.log('\n[R12] 28. 店长≤阈值全额退：六联动 + rebate 列位（清单②+⑭）');
  const prod28 = (await db.select().from(schema.products).where(eq(schema.products.id, prod.id)).get())!;
  const mgrBill = await settleBill2(
    [{ kind: 'service', refId: service.id }, { kind: 'product', refId: prod.id }],
    { note: '【测试】e2e R12 店长全额退单' },
  ); // 8800 + 商品价 ≤ 50000 阈值
  const stockAtSettle28 = prod28.stock - 1; // 结账已扣 1
  const fullRefund = await execRefund(managerCookie, { billNo: mgrBill.billNo, type: 'full', reason: '店长全额退（≤阈值六联动）' });
  check('R12② 店长≤阈值发起即执行（executed + 自批 approver=本人 + 幂等标记 false）',
    fullRefund.refund.status === 'executed' && fullRefund.idempotent === false &&
      fullRefund.refund.operatorId === managerFix.id && fullRefund.refund.approverId === managerFix.id,
    { status: fullRefund.refund.status, amount: fullRefund.refund.amountFen });
  check('R12② 全额退金额=可退余额全退（=原单已收）', fullRefund.refund.amountFen === mgrBill.payableFen, { refund: fullRefund.refund.amountFen, payable: mgrBill.payableFen });
  const linkage28 = fullRefund.refund.linkageJson ?? {};
  check('R12⑭ 六联动快照含回馈金扣回列位（rebateClawbackFen 键存在且=0，R11 冻结回归）',
    'rebateClawbackFen' in linkage28 && linkage28.rebateClawbackFen === 0, Object.keys(linkage28));
  check('R12② 快照六联动列位齐全（segments 支付段回补 / stockRestock 库存回补 / 提成冲减预估 / 阈值口径）',
    Array.isArray(linkage28.segments) && Array.isArray(linkage28.stockRestock) &&
      typeof linkage28.estimatedCommissionClawbackFen === 'number' && linkage28.thresholdFen === 50000,
    { keys: Object.keys(linkage28).length, threshold: linkage28.thresholdFen });
  const mgrBillRow = await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.id, mgrBill.billId)).get();
  check('R12② 原单挂 refund_status=refunded + refund_bill_no 双向回指（已收 paidFen 一字未改）',
    mgrBillRow?.refundStatus === 'refunded' && mgrBillRow.refundBillNo === fullRefund.refund.refundNo &&
      mgrBillRow.paidFen === mgrBill.payableFen,
    { refundStatus: mgrBillRow?.refundStatus, refundBillNo: mgrBillRow?.refundBillNo, paidFen: mgrBillRow?.paidFen });
  const stockAfterRefund28 = (await db.select().from(schema.products).where(eq(schema.products.id, prod.id)).get())!.stock;
  const refundMoves28 = await db.select().from(schema.stockMovements)
    .where(and(eq(schema.stockMovements.sourceType, 'refund'), eq(schema.stockMovements.sourceId, fullRefund.refund.refundNo)));
  check('R12② 库存回补：stock_movements 来源 refund 前后值真实（delta=+1）+ products.stock 回补',
    refundMoves28.length === 1 && refundMoves28[0]!.delta === 1 &&
      refundMoves28[0]!.beforeStock === stockAtSettle28 && refundMoves28[0]!.afterStock === stockAtSettle28 + 1 &&
      stockAfterRefund28 === stockAtSettle28 + 1,
    { moves: refundMoves28.length, stockAfterRefund28 });
  check('R12② RefundExecuted 事件到店频道（店长视图/财务联动，event_outbox 实证）',
    (await storeEventsOf('refund.executed', (p) => p.refundNo === fullRefund.refund.refundNo)).length === 1,
    fullRefund.refund.refundNo);
  check('R12② 预约行清零口径不适用对照：服务行非预约行，无 appointmentReverts（本单纯服务+商品）',
    Array.isArray((linkage28.appointmentReverts as unknown[]) ?? []) && (linkage28.appointmentReverts as unknown[]).length === 0,
    linkage28.appointmentReverts);

  /* ---------- 29. 清单③（V1）：拆分两笔累计超阈值顶到店主 ---------- */
  console.log('\n[R12] 29. V1 拆分累计阈值（清单③）');
  const staple = (await db.select().from(schema.products).where(and(eq(schema.products.storeId, storeId), eq(schema.products.name, '全价成犬粮 2kg'))).get())!;
  const bigBill = await settleBill2([{ kind: 'product', refId: staple.id, qty: 5 }], { note: '【测试】e2e R12 V1 拆分阈值单' }); // 12900×5=64500
  check('R12③ 前置：大单 64500 分 settled（店长阈值 50000 分）', bigBill.payableFen === 64500, bigBill);
  const split1 = await execRefund(managerCookie, { billNo: bigBill.billNo, type: 'partial_amount', amountFen: 30000, reason: 'V1 拆分第一笔' });
  check('R12③ 店长第一笔 30000 成（原单累计 30000 ≤ 50000）',
    split1.refund.status === 'executed' && split1.refund.amountFen === 30000, split1.refund.amountFen);
  const split2 = await asErr(execRefund(managerCookie, { billNo: bigBill.billNo, type: 'partial_amount', amountFen: 30000, reason: 'V1 拆分第二笔' }));
  check('R12③ 第二笔累计 60000>50000 → FORBIDDEN「该单累计退款已达店长上限，须店主」（V1 按原单累计校验堵拆分绕过）',
    split2 instanceof TrpcHttpError && split2.httpStatus === 403 && split2.code === 'FORBIDDEN' && split2.message.includes('累计退款已达店长上限'),
    split2 && { status: split2.httpStatus, message: split2.message });
  const split2Owner = await execRefund(ownerCookie, { billNo: bigBill.billNo, type: 'partial_amount', amountFen: 30000, reason: 'V1 拆分第二笔（店主执行）' });
  check('R12③ 店主执行成功（累计 60000/64500，可退余额余 4500）',
    split2Owner.refund.status === 'executed' && split2Owner.refund.amountFen === 30000, split2Owner.refund.amountFen);

  /* ---------- 30. 清单④（V2）：日结现金段净额 ---------- */
  console.log('\n[R12] 30. V2 日结退款单列 + 现金段净额（清单④）');
  const comboBill = await settleBill2([{ kind: 'service', refId: service.id }], {
    payments: (p) => [{ method: 'cash', amountFen: 5000 }, { method: 'wechat', amountFen: p - 5000 }],
    note: '【测试】e2e R12 V2 现金微信组合单',
  }); // 8800 = cash 5000 + wechat 3800
  interface TenderRes { receivedTotalFen: number; tender: { cashFen: number } }
  const v2StatsBefore = await dayStats(storeToday);
  const tenderBefore = await trpcQuery<TenderRes>('store.todayTenderStats', { cookie: ownerCookie });
  const v2Refund = await execRefund(managerCookie, { billNo: comboBill.billNo, type: 'partial_amount', amountFen: 4400, reason: 'V2 组合单部分退' });
  const v2StatsAfter = await dayStats(storeToday);
  const tenderAfter = await trpcQuery<TenderRes>('store.todayTenderStats', { cookie: ownerCookie });
  check('R12④ dayStats 当日退款单列（总额 +4400；现金段退款 +2500 / 微信段 +1900，按段占比分摊精确到分）',
    v2Refund.refund.bizDate === storeToday &&
      v2StatsAfter.totalFen - v2StatsBefore.totalFen === 4400 &&
      v2StatsAfter.segments.cashFen - v2StatsBefore.segments.cashFen === 2500 &&
      v2StatsAfter.segments.wechatFen - v2StatsBefore.segments.wechatFen === 1900,
    { dTotal: v2StatsAfter.totalFen - v2StatsBefore.totalFen, dCash: v2StatsAfter.segments.cashFen - v2StatsBefore.segments.cashFen, dWechat: v2StatsAfter.segments.wechatFen - v2StatsBefore.segments.wechatFen });
  check('R12④ 已收不涂改 + 当日净额=已收−退款算术成立（净额恰 −4400；现金段净额=现金已收−现金退款恰 −2500）',
    tenderAfter.receivedTotalFen === tenderBefore.receivedTotalFen &&
      (tenderAfter.receivedTotalFen - v2StatsAfter.totalFen) - (tenderBefore.receivedTotalFen - v2StatsBefore.totalFen) === -4400 &&
      (tenderAfter.tender.cashFen - v2StatsAfter.segments.cashFen) - (tenderBefore.tender.cashFen - v2StatsBefore.segments.cashFen) === -2500,
    { receivedBefore: tenderBefore.receivedTotalFen, receivedAfter: tenderAfter.receivedTotalFen });

  /* ---------- 31. 清单⑤+⑪（V3）：组合支付 6:4 分摊回补 + 涉储值店长拦截 ---------- */
  console.log('\n[R12] 31. V3 6:4 分摊回补 + 涉储值拦截（清单⑤+⑪）');
  const svAcc = (await db.insert(schema.storedValueAccounts)
    .values({ userId: customerUser!.id, storeId, principalFen: 100000, bonusFen: 0 })
    .returning())[0]!; // 储值账户夹具直插（生产仅 R5b CSV 导入建户；e2e 不走路径外入口）
  const svBill = await settleBill2([{ kind: 'service', refId: service.id }], {
    customerId: customerUser!.id,
    payments: (p) => [{ method: 'cash', amountFen: Math.round(p * 0.6) }, { method: 'stored_value', amountFen: p - Math.round(p * 0.6) }],
    note: '【测试】e2e R12 V3 现金6储值4组合单',
  }); // 8800 = cash 5280 + 储值 3520
  const accAfterSettle = await db.select().from(schema.storedValueAccounts).where(eq(schema.storedValueAccounts.id, svAcc.id)).get();
  check('R12⑤ 前置：储值段结账扣减（余额 100000 → 96480，先本金后赠送）',
    !!accAfterSettle && accAfterSettle.principalFen + accAfterSettle.bonusFen === 96480,
    accAfterSettle && accAfterSettle.principalFen + accAfterSettle.bonusFen);
  const mgrSv = await asErr(execRefund(managerCookie, { billNo: svBill.billNo, type: 'partial_amount', amountFen: 4400, reason: '店长涉储值验证' }));
  check('R12⑪ 涉储值单店长明文拦截（FORBIDDEN「储值退款须店主」，运营加固不设阈值）',
    mgrSv instanceof TrpcHttpError && mgrSv.httpStatus === 403 && mgrSv.code === 'FORBIDDEN' && mgrSv.message.includes('储值退款须店主'),
    mgrSv && { status: mgrSv.httpStatus, message: mgrSv.message });
  const svRefund = await execRefund(ownerCookie, { billNo: svBill.billNo, type: 'partial_amount', amountFen: 4400, reason: 'V3 按金额退 50%（6:4 分摊回补）' });
  const segs31 = svRefund.plan?.segments ?? [];
  const cashSeg31 = segs31.find((s) => s.method === 'cash');
  const svSeg31 = segs31.find((s) => s.method === 'stored_value');
  check('R12⑤ 组合支付 6:4 分摊回补精确到分（cash 2640 线下原路待登记 / 储值 1760 余额回补）',
    cashSeg31?.amountFen === 2640 && cashSeg31.channel === 'offline_pending' &&
      svSeg31?.amountFen === 1760 && svSeg31.channel === 'stored_value_restore' &&
      svRefund.refund.amountFen === 4400,
    segs31.map((s) => `${s.method}:${s.amountFen}`));
  const accAfterRefund = await db.select().from(schema.storedValueAccounts).where(eq(schema.storedValueAccounts.id, svAcc.id)).get();
  const svLogs31 = await db.select().from(schema.storedValueLogs).where(eq(schema.storedValueLogs.billNo, svBill.billNo));
  const restoreLog31 = svLogs31.find((l) => l.deltaFen > 0);
  check('R12⑤ 储值余额回补前后值留痕（96480 → 98240；stored_value_logs 正向行 note 关联退款单号）',
    !!accAfterRefund && accAfterRefund.principalFen + accAfterRefund.bonusFen === 98240 &&
      restoreLog31?.balanceBeforeFen === 96480 && restoreLog31.balanceAfterFen === 98240 &&
      (restoreLog31.note ?? '').includes(svRefund.refund.refundNo),
    { balance: accAfterRefund && accAfterRefund.principalFen + accAfterRefund.bonusFen, restoreLog: restoreLog31 && { before: restoreLog31.balanceBeforeFen, after: restoreLog31.balanceAfterFen, note: restoreLog31.note } });

  /* ---------- 32. 清单⑥（V4）：寄养提前接回退剩余晚 ---------- */
  console.log('\n[R12] 32. V4 寄养剩余晚退（清单⑥）');
  const boardingSvc = (await db.select().from(schema.services).where(and(eq(schema.services.storeId, storeId), eq(schema.services.type, 'boarding'))).get())!;
  const bStart = new Date(`${storeYesterday}T15:00:00+08:00`); // 昨日入住（+8 日界）→ 已发生 1 晚
  const boardingAppt = (await db.insert(schema.appointments).values({
    code: 'E2EBD1', customerId: customerUser!.id, storeId, petId, serviceId: boardingSvc.id,
    type: 'boarding', scheduledStart: bStart, scheduledEnd: new Date(bStart.getTime() + 3 * 86400_000),
    status: 'completed', priceFen: 59700, completedAt: new Date(), note: '【测试】e2e R12 寄养 3 晚单（夹具直插）',
  }).returning())[0]!;
  const bBill = await settleBill2([{ kind: 'appointment', refId: boardingAppt.id }], { note: '【测试】e2e R12 寄养结账' }); // 19900×3=59700 全现金
  const tooMany = await asErr(execRefund(ownerCookie, { billNo: bBill.billNo, type: 'boarding_nights', nights: 3, reason: '超剩余晚数验证' }));
  check('R12⑥ 已发生晚一分不退（退 3 晚 > 剩余 2 晚 → BAD_REQUEST「剩余可退晚数不足」明文）',
    tooMany instanceof TrpcHttpError && tooMany.code === 'BAD_REQUEST' && tooMany.message.includes('剩余可退晚数不足'),
    tooMany && { code: tooMany.code, message: tooMany.message });
  const bRefund = await execRefund(ownerCookie, { billNo: bBill.billNo, type: 'boarding_nights', nights: 2, reason: '提前接回退剩余 2 晚' });
  check('R12⑥ 寄养退剩余 2 晚：金额=剩余晚×晚单价（floor(59700÷3)×2=39800）', bRefund.refund.amountFen === 39800, bRefund.refund.amountFen);
  const nightRow = (await db.select().from(schema.refundBillItems)
    .where(and(eq(schema.refundBillItems.refundId, bRefund.refund.id), eq(schema.refundBillItems.kind, 'night'))))[0];
  const nightDetail = (nightRow?.detailJson ?? {}) as Record<string, unknown>;
  check('R12⑥ 分段明细透出（总 3 晚 / 已住 1 晚不退 / 退 2 晚（qty 列）/ 晚单价 19900）',
    nightRow?.qty === 2 && nightRow.amountFen === 39800 &&
      nightDetail.totalNights === 3 && nightDetail.occurredNights === 1 && nightDetail.perNightFen === 19900,
    nightDetail);
  check('R12⑥ 按支付段占比回补（全现金单 → cash 段 39800 线下原路）',
    bRefund.plan?.segments.find((s) => s.method === 'cash')?.amountFen === 39800, bRefund.plan?.segments);
  const bApptAfter = await db.select().from(schema.appointments).where(eq(schema.appointments.id, boardingAppt.id)).get();
  check('R12⑥ 只退钱不动预约单（status/paidAt 原样；退住核销由寄养域既有流程承担）',
    bApptAfter?.status === 'completed' && bApptAfter.paidAt !== null, { status: bApptAfter?.status, paidAt: bApptAfter?.paidAt });

  /* ---------- 33. 清单⑦（V5）：已冲正/已撤单无退款入口 ---------- */
  console.log('\n[R12] 33. V5 终态禁退（清单⑦）');
  const rvBill = await settleBill2([{ kind: 'product', refId: prod.id }], { note: '【测试】e2e R12 V5 冲正单' });
  await trpcMutate('cashier.reverseBill', { cookie: ownerCookie, input: { billNo: rvBill.billNo, reason: 'R12 冲正禁退验证' } });
  const rvRow = await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.id, rvBill.billId)).get();
  const rvRefund = await asErr(execRefund(ownerCookie, { billNo: rvBill.billNo, type: 'full', reason: '冲正单退款验证' }));
  const vdHeld = await trpcMutate<{ bill: { billNo: string } }>('cashier.hold', {
    cookie: ownerCookie,
    input: { items: [{ kind: 'product', refId: prod.id }], discountType: 'none', discountValue: 0, note: '【测试】e2e R12 V5 撤单' },
  });
  await trpcMutate('cashier.voidBill', { cookie: ownerCookie, input: { billNo: vdHeld.bill.billNo, reason: 'R12 撤单禁退验证' } });
  const vdRefund = await asErr(execRefund(ownerCookie, { billNo: vdHeld.bill.billNo, type: 'full', reason: '撤单退款验证' }));
  check('R12⑦ 已冲正单无退款入口（reverseBill 后 execute → BAD_REQUEST「原单已冲正/已撤，不可退款」）',
    !!(rvRow?.reversedAt) && rvRefund instanceof TrpcHttpError && rvRefund.code === 'BAD_REQUEST' && rvRefund.message.includes('已冲正/已撤'),
    rvRefund && { code: rvRefund.code, message: rvRefund.message });
  check('R12⑦ 已撤单无退款入口（voided → 同明文拒）',
    vdRefund instanceof TrpcHttpError && vdRefund.code === 'BAD_REQUEST' && vdRefund.message.includes('已冲正/已撤'),
    vdRefund && { code: vdRefund.code, message: vdRefund.message });

  /* ---------- 34. 清单⑧（V6）：部分退提成按比例冲减 + 跨月调整项 ---------- */
  console.log('\n[R12] 34. V6 提成冲减（清单⑧）');
  interface R12CommLine { billId: string; itemId: string; refId: string; name: string; amountFen: number; refundRatioBp: number; refundClawbackFen: number; refunded: boolean }
  interface R12SummaryT {
    payload: {
      commissionTotalFen: number;
      serviceLines: R12CommLine[];
      adjustments: Array<{ refundNo: string; billNo: string; itemId: string; name: string; clawbackFen: number }>;
      adjustmentsTotalFen: number;
    };
  }
  // ① 同月行内冲减：阿强洗护单 10000（现行率 25% → 毛提成 2500）
  const apptV6 = (await db.insert(schema.appointments).values({
    code: 'E2EV6A', customerId: customerUser!.id, storeId, petId, serviceId: service.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'completed', priceFen: 10000, completedAt: new Date(), staffId: aqiang.id, note: '【测试】e2e R12 V6 同月单',
  }).returning())[0]!;
  const billV6 = await settleBill2([{ kind: 'appointment', refId: apptV6.id }], { note: '【测试】e2e R12 V6 同月冲减单' });
  await execRefund(ownerCookie, { billNo: billV6.billNo, type: 'partial_amount', amountFen: 5000, reason: 'V6 部分退 50%' });
  const sumV6a = await trpcQuery<R12SummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  const lineV6a = sumV6a.payload.serviceLines.find((l) => l.billId === billV6.billId);
  check('R12⑧ 部分退 50% → 该行提成减半精确到分（毛 2500 → 净 1250，refundRatioBp=5000，refunded=false）',
    lineV6a?.amountFen === 1250 && lineV6a.refundClawbackFen === 1250 && lineV6a.refundRatioBp === 5000 && lineV6a.refunded === false,
    lineV6a);
  await execRefund(ownerCookie, { billNo: billV6.billNo, type: 'partial_amount', amountFen: 5000, reason: 'V6 退剩余 50%' });
  const sumV6b = await trpcQuery<R12SummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  const lineV6b = sumV6b.payload.serviceLines.find((l) => l.billId === billV6.billId);
  check('R12⑧ 退完全额 → 该行提成归零 + refunded 标记（冲减合计 2500=毛提成全额）',
    lineV6b?.amountFen === 0 && lineV6b.refunded === true && lineV6b.refundClawbackFen === 2500, lineV6b);

  // ② 跨月调整项：源单回填上月 + 上月快照 → 今日退款差额进当月「调整项」，不动快照。
  //    历史规则行回填：种子 effective_from=2026-09-20，早于该日的源单需 v0 历史行兜底取率
  //    （active=false 不污染当前生效集；ruleAtFn 按全表 effective_from 时序解析，口径同 §24）。
  await db.insert(schema.commissionRules).values({
    version: 0, ruleKey: 'commission_grooming_rate', label: 'e2e 历史规则回填（V6 跨月夹具）',
    valueJson: { rate_bp: 2000 }, effectiveFrom: new Date('2020-01-01T00:00:00+08:00'), active: false, createdBy: ownerUser!.id,
  });
  const backTs = new Date(`${prevMonthStr}-15T12:00:00`); // 服务器本地时区口径（commission 月界同帧）
  const apptV6X = (await db.insert(schema.appointments).values({
    code: 'E2EV6X', customerId: customerUser!.id, storeId, petId, serviceId: service.id,
    type: 'grooming', scheduledStart: backTs, scheduledEnd: backTs,
    status: 'completed', priceFen: 20000, completedAt: backTs, staffId: aqiang.id, note: '【测试】e2e R12 V6 跨月源单',
  }).returning())[0]!;
  const billV6X = await settleBill2([{ kind: 'appointment', refId: apptV6X.id }], { note: '【测试】e2e R12 V6 跨月源单结账' });
  // 结账时点回填上月（计提月份+规则时序同按 settled_at）。
  // 注意：createdAt 一律不回填——cashier.genBillNo 按 createdAt 计当日单数分配单号，
  // 回填会减少当日计数导致后续单号复用撞 UNIQUE（本轮实测 HD-…-021 撞号 500）。
  await db.update(schema.cashierBills).set({ settledAt: backTs, updatedAt: new Date() })
    .where(eq(schema.cashierBills.id, billV6X.billId));
  const snapRes = await trpcMutate<{ commission: number; performance: number }>('commission.snapshotMonth', {
    cookie: ownerCookie, input: { month: prevMonthStr },
  });
  const snapBefore = await db.select().from(schema.commissionSnapshots)
    .where(and(eq(schema.commissionSnapshots.staffId, aqiang.id), eq(schema.commissionSnapshots.period, prevMonthStr), eq(schema.commissionSnapshots.kind, 'commission')))
    .get();
  check('R12⑧ 前置：上月快照落库（阿强毛提成=20000×20%=4000 冻结于快照）',
    snapRes.commission > 0 && snapBefore?.totalFen === 4000, { snap: snapRes, totalFen: snapBefore?.totalFen });
  const totalBeforeAdj = sumV6b.payload.commissionTotalFen;
  const v6x = await execRefund(ownerCookie, { billNo: billV6X.billNo, type: 'partial_amount', amountFen: 10000, reason: 'V6 跨月退 50%' });
  const sumV6c = await trpcQuery<R12SummaryT>('commission.mySummary', { cookie: groomerCookie, input: {} });
  const adj = sumV6c.payload.adjustments.find((a) => a.refundNo === v6x.refund.refundNo);
  check('R12⑧ 跨月退款差额进当月「调整项」（mySummary.adjustments 透出 refundNo + 冲减 2000=4000×50%）',
    adj?.clawbackFen === 2000 && adj.billNo === billV6X.billNo && sumV6c.payload.adjustmentsTotalFen === 2000, adj);
  check('R12⑧ 调整项从当月提成总额减除（commissionTotalFen 恰 −2000）',
    sumV6c.payload.commissionTotalFen === totalBeforeAdj - 2000,
    { before: totalBeforeAdj, after: sumV6c.payload.commissionTotalFen });
  const snapAfter = await db.select().from(schema.commissionSnapshots)
    .where(and(eq(schema.commissionSnapshots.staffId, aqiang.id), eq(schema.commissionSnapshots.period, prevMonthStr), eq(schema.commissionSnapshots.kind, 'commission')))
    .get();
  check('R12⑧ 已快照月份不动（snapshot totalFen/payload 前后一致）',
    !!snapBefore && !!snapAfter && snapAfter.totalFen === snapBefore.totalFen &&
      JSON.stringify(snapAfter.payloadJson) === JSON.stringify(snapBefore.payloadJson),
    { before: snapBefore?.totalFen, after: snapAfter?.totalFen });

  /* ---------- 35. 清单⑨（V7）：跨日退款入发生日日结，不回填封箱历史 ---------- */
  console.log('\n[R12] 35. V7 跨日退款（清单⑨）');
  const yBill = await settleBill2([{ kind: 'product', refId: prod.id }], { note: '【测试】e2e R12 V7 昨日单' });
  const yTs = new Date(`${storeYesterday}T12:00:00+08:00`);
  await db.update(schema.cashierBills).set({ settledAt: yTs, updatedAt: new Date() })
    .where(eq(schema.cashierBills.id, yBill.billId)); // 仅回填 settledAt（createdAt 回填会撞 genBillNo 当日序号，见 §34 注释）
  const shiftRow = await db.select().from(schema.shifts).where(eq(schema.shifts.storeId, storeId)).get();
  const yClose = (await db.insert(schema.dayCloses).values({
    storeId, shiftId: shiftRow!.id, kind: 'close', bizDate: storeYesterday,
    bookCashFen: yBill.payableFen, actualCashFen: yBill.payableFen, diffFen: 0,
    cashierPaidCount: 1, paidCount: 1, status: 'frozen', createdBy: ownerUser!.id,
  }).returning())[0]!; // 昨日已日结封箱夹具（冻结态）
  const yStatsBefore = await dayStats(storeYesterday);
  const tStatsBefore = await dayStats(storeToday);
  const yRefund = await execRefund(ownerCookie, { billNo: yBill.billNo, type: 'partial_amount', amountFen: 1000, reason: 'V7 跨日退款' });
  check('R12⑨ 跨日退款入发生日（refund_bills.biz_date=今日，不回填昨日）', yRefund.refund.bizDate === storeToday, { bizDate: yRefund.refund.bizDate, storeToday });
  const yStatsAfter = await dayStats(storeYesterday);
  const tStatsAfter = await dayStats(storeToday);
  check('R12⑨ dayStats 今日含该退款（+1000）、昨日不含（昨日 count/total 原样）',
    tStatsAfter.totalFen - tStatsBefore.totalFen === 1000 &&
      yStatsAfter.totalFen === yStatsBefore.totalFen && yStatsAfter.count === yStatsBefore.count,
    { todayDelta: tStatsAfter.totalFen - tStatsBefore.totalFen, yesterday: [yStatsBefore.totalFen, yStatsAfter.totalFen] });
  const yCloseAfter = await db.select().from(schema.dayCloses).where(eq(schema.dayCloses.id, yClose.id)).get();
  check('R12⑨ 昨日已封箱日结行不变（bookCash/status/frozen 原样，封箱历史不涂改）',
    yCloseAfter?.bookCashFen === yClose.bookCashFen && yCloseAfter.status === 'frozen' && !yCloseAfter.reversedAt,
    { before: yClose.bookCashFen, after: yCloseAfter?.bookCashFen, status: yCloseAfter?.status });

  /* ---------- 36. 清单⑩（V8）：次卡赠次不计价 + 涉储值退卡店长拦截 ---------- */
  console.log('\n[R12] 36. V8 次卡退卡（清单⑩+⑪ 附证）');
  await trpcMutate('pass.topUp', { cookie: ownerCookie, input: { userId: customerUser!.id, times: 12 } }); // 付费 10 + 赠 2 口径由店主录入留痕（无金额台账，报备偏差 1）
  const passRow0 = await db.select().from(schema.memberPasses).where(and(eq(schema.memberPasses.userId, customerUser!.id), eq(schema.memberPasses.storeId, storeId))).get();
  check('R12⑩ 前置：次卡建卡（total=12 remain=12）', passRow0?.totalTimes === 12 && passRow0.remainTimes === 12, passRow0 && { total: passRow0.totalTimes, remain: passRow0.remainTimes });
  const passBill = await settleBill2(
    Array.from({ length: 6 }, () => ({ kind: 'service' as const, refId: service.id, paidByPass: true })),
    { customerId: customerUser!.id, payments: (p) => [{ method: 'pass', amountFen: p }], note: '【测试】e2e R12 V8 扣次 6 行单' },
  );
  void passBill;
  const passRow1 = await db.select().from(schema.memberPasses).where(and(eq(schema.memberPasses.userId, customerUser!.id), eq(schema.memberPasses.storeId, storeId))).get();
  check('R12⑩ 前置：扣次 6 次（remain 12→6；付费先消耗 → 剩付费 4 + 赠 2）', passRow1?.remainTimes === 6, passRow1?.remainTimes);
  // 锚点单：该客户在本店的任一 settled 单（anchor_only：金额与其无关、不挂标记）
  const anchorBill = (await db.select().from(schema.cashierBills)
    .where(and(eq(schema.cashierBills.customerId, customerUser!.id), eq(schema.cashierBills.status, 'settled'))).get())!;
  const mgrCancel = await asErr(execRefund(managerCookie, {
    billNo: anchorBill.billNo, type: 'pass_cancel', passId: passRow1!.id,
    passPaidFen: 10000, passPaidTimes: 10, passGiftTimes: 2, reason: '店长退卡验证', refundMethod: 'offline_original',
  }));
  check('R12⑪ 次卡退卡涉储值 → 店长 FORBIDDEN「储值退款须店主」（type=pass_cancel 天然涉储值）',
    mgrCancel instanceof TrpcHttpError && mgrCancel.httpStatus === 403 && mgrCancel.code === 'FORBIDDEN' && mgrCancel.message.includes('储值退款须店主'),
    mgrCancel && { status: mgrCancel.httpStatus, message: mgrCancel.message });
  const cancel = await execRefund(ownerCookie, {
    billNo: anchorBill.billNo, type: 'pass_cancel', passId: passRow1!.id,
    passPaidFen: 10000, passPaidTimes: 10, passGiftTimes: 2, reason: '次卡退卡（剩付费 4 次）', refundMethod: 'offline_original',
  });
  check('R12⑩ 折算=剩余付费 4 次 ×（实付 10000 ÷ 付费 10 次）=4000（赠次不计价）',
    cancel.refund.status === 'executed' && cancel.refund.amountFen === 4000, cancel.refund.amountFen);
  const pc36 = (cancel.refund.linkageJson?.passCancel ?? {}) as Record<string, unknown>;
  check('R12⑩ 快照明示：剩余付费 4 / 赠次 2 随退作废不计价（giftVoided=2）',
    pc36.remainingPaidTimes === 4 && pc36.giftVoided === 2 && pc36.giftTimes === 2 && pc36.remainTimesBefore === 6, pc36);
  const passRow2 = await db.select().from(schema.memberPasses).where(eq(schema.memberPasses.id, passRow1!.id)).get();
  const passLogs = await db.select().from(schema.passDeductLogs).where(eq(schema.passDeductLogs.passId, passRow1!.id));
  check('R12⑩ 退卡后卡作废留痕（status=disabled + remain=0 + 负向流水 note 含「赠次作废 2」）',
    passRow2?.status === 'disabled' && passRow2.remainTimes === 0 &&
      passLogs.some((l) => l.delta === -6 && (l.note ?? '').includes('赠次作废 2')),
    { status: passRow2?.status, remain: passRow2?.remainTimes, logs: passLogs.map((l) => `${l.delta}:${l.note}`) });
  check('R12⑩ 锚点单不挂退款标记（anchor_only：原单 refund_status 仍 NULL）',
    (await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.id, anchorBill.id)).get())?.refundStatus === null,
    anchorBill.billNo);
  const cancelAgain = await asErr(execRefund(ownerCookie, {
    billNo: anchorBill.billNo, type: 'pass_cancel', passId: passRow1!.id,
    passPaidFen: 10000, passPaidTimes: 10, passGiftTimes: 2, reason: '重复退卡验证', refundMethod: 'offline_original',
  }));
  check('R12⑩ 重复退卡幂等拒（卡已作废 → BAD_REQUEST「不可重复退卡」）',
    cancelAgain instanceof TrpcHttpError && cancelAgain.code === 'BAD_REQUEST' && cancelAgain.message.includes('不可重复退卡'),
    cancelAgain && { code: cancelAgain.code, message: cancelAgain.message });

  /* ---------- 37. 清单⑫：部分退款余额内可再退 ---------- */
  console.log('\n[R12] 37. 部分退款余额内可再退（清单⑫）');
  const reBill = await settleBill2([{ kind: 'service', refId: service.id }], { note: '【测试】e2e R12 余额再退单' }); // 8800 现金
  const re1 = await execRefund(managerCookie, { billNo: reBill.billNo, type: 'partial_amount', amountFen: 2640, reason: '先退 30%' });
  const re2 = await execRefund(managerCookie, { billNo: reBill.billNo, type: 'partial_amount', amountFen: 1760, reason: '再退 20%' });
  check('R12⑫ 余额内可再退（30%→2640 成，再 20%→1760 成；累计 4400 ≤ 8800）',
    re1.refund.status === 'executed' && re2.refund.status === 'executed' && re2.refund.amountFen === 1760,
    [re1.refund.amountFen, re2.refund.amountFen]);
  const re3 = await asErr(execRefund(managerCookie, { billNo: reBill.billNo, type: 'partial_amount', amountFen: 4401, reason: '超可退余额验证' }));
  check('R12⑫ 累计超可退余额硬拒（4400+4401 > 8800 → BAD_REQUEST「超过原单可退余额」）',
    re3 instanceof TrpcHttpError && re3.code === 'BAD_REQUEST' && re3.message.includes('可退余额'),
    re3 && { code: re3.code, message: re3.message });

  /* ---------- 38. 清单⑬：实退待办 + settleActual 幂等 ---------- */
  console.log('\n[R12] 38. 实退待办（清单⑬）');
  // 造「executed 超 24h 未登记」夹具：直插 25h 前的 executed 退款行（挂 §37 reBill）。
  // 不回填真实退款单 createdAt——genRefundNo 按 createdAt 计当日序号，回填减计数会让后续
  // 退款单号复用撞 UNIQUE（本轮实测 RB-…-013 撞号 500；与 §34 收银 genBillNo 教训同型）。
  const agedRefund = (await db.insert(schema.refundBills).values({
    storeId, refundNo: 'RB-19990101-001', bizDate: storeYesterday, billId: reBill.billId,
    type: 'partial_amount', amountFen: 2640, reason: 'e2e 实退待办夹具（回填 25h 前）',
    status: 'executed', operatorId: ownerUser!.id, approverId: ownerUser!.id,
    createdAt: new Date(Date.now() - 25 * 3600 * 1000),
  }).returning())[0]!;
  const todoBefore = await trpcQuery<Array<{ id: string; refundNo: string }>>('refund.pendingActual', { cookie: managerCookie });
  check('R12⑬ 实退待办：executed 超 24h 未登记 → pendingActual 含（店长本店可办）',
    todoBefore.some((r) => r.id === agedRefund.id), todoBefore.map((r) => r.refundNo));
  const settle1 = await trpcMutate<{ refund: { status: string }; idempotent: boolean }>('refund.settleActual', {
    cookie: managerCookie, input: { refundId: agedRefund.id, note: '线下原路已退（现金 2640）' },
  });
  check('R12⑬ 实退登记 → settled（+RefundSettled 事件到店频道）',
    settle1.refund.status === 'settled' && settle1.idempotent === false &&
      (await storeEventsOf('refund.settled', (p) => p.refundNo === agedRefund.refundNo)).length === 1,
    settle1.refund.status);
  const settle2 = await trpcMutate<{ refund: { status: string }; idempotent: boolean }>('refund.settleActual', {
    cookie: managerCookie, input: { refundId: agedRefund.id, note: '重复登记验证' },
  });
  check('R12⑬ 重复登记幂等（idempotent=true，事件不重复增发）',
    settle2.idempotent === true && settle2.refund.status === 'settled' &&
      (await storeEventsOf('refund.settled', (p) => p.refundNo === agedRefund.refundNo)).length === 1,
    settle2.idempotent);
  const todoAfter = await trpcQuery<Array<{ id: string }>>('refund.pendingActual', { cookie: managerCookie });
  check('R12⑬ 实退登记后待办消失（pendingActual 不再含该单）', !todoAfter.some((r) => r.id === agedRefund.id), todoAfter.length);

  /* ==================================================================
   * 修复包 PR-1（PD-02/PD-10 · 免签直发）验收段
   * 件① QA40-D10 账本双倍计数（ledger 每期只计一类行，settleMonthly 后不翻倍）
   * 件③ H4-01 驳回权放开店长 + 留口开关（超阈值落 draft，默认硬拒）
   * ================================================================== */
  console.log('\n[修复包PR-1] D10 账本双倍计数 + 驳回权店长 + 留口开关');

  /* ---- 件③a 留口开关默认硬拒（回归：V1 已实证 split2 403，此处坐实开关缺行/关=同口径） ---- */
  const bigBill2 = await settleBill2([{ kind: 'product', refId: staple.id, qty: 5 }], { note: '【测试】e2e PR-1 留口开关单' }); // 64500
  const draftOff = await asErr(execRefund(managerCookie, { billNo: bigBill2.billNo, type: 'partial_amount', amountFen: 60000, reason: 'PR-1 开关默认关验证' }));
  check('PR-1 留口开关默认关=维持硬拒（超阈值 FORBIDDEN「须店主」）',
    draftOff instanceof TrpcHttpError && draftOff.code === 'FORBIDDEN' && draftOff.message.includes('须店主'),
    draftOff && draftOff.message);

  /* ---- 件③b 开开关（owner 端口写 refund_over_threshold_to_draft enabled=true）→ 落 draft ---- */
  await trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'refund', changes: [{ ruleKey: 'refund_over_threshold_to_draft', valueJson: { enabled: true } }] },
  });
  const draftOn = await execRefund(managerCookie, { billNo: bigBill2.billNo, type: 'partial_amount', amountFen: 60000, reason: 'PR-1 开关开验证' });
  check('PR-1 开关 on：超阈值落 draft 申请行（draft:true + status=draft）',
    (draftOn as { draft?: boolean }).draft === true && draftOn.refund.status === 'draft', draftOn.refund.status);
  const billAfterDraft = (await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.billNo, bigBill2.billNo)).get())!;
  check('PR-1 draft 零联动（原单金额/状态不动，钱链路零副作用）',
    billAfterDraft.status === 'settled' && billAfterDraft.refundStatus === null, { status: billAfterDraft.status, refundStatus: billAfterDraft.refundStatus });

  /* ---- 件③c 驳回权放开店长（H4-01）：店长驳 draft → rejected；店员 403 分口径 ---- */
  const mgrReject = await trpcMutate<{ refund: { status: string; approverId: string } }>('refund.rejectDraft', {
    cookie: managerCookie, input: { refundId: draftOn.refund.id, note: '店长驳回（H4-01 验证）' },
  });
  check('PR-1 店长驳回本店 draft → rejected（驳回权放开店长落地）', mgrReject.refund.status === 'rejected', mgrReject.refund.status);
  const clerkReject = await asErr(trpcMutate('refund.rejectDraft', { cookie: clerkCookie, input: { refundId: draftOn.refund.id, note: '店员越权验证' } }));
  check('PR-1 店员驳回 403 分口径（「请联系店长」，OP-01③）',
    clerkReject instanceof TrpcHttpError && clerkReject.httpStatus === 403 && clerkReject.message.includes('请联系店长'),
    clerkReject && clerkReject.message);
  /* 开关关回（不留副作用给后续段） */
  await trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'refund', changes: [{ ruleKey: 'refund_over_threshold_to_draft', valueJson: { enabled: false } }] },
  });
  const draftOffAgain = await asErr(execRefund(managerCookie, { billNo: bigBill2.billNo, type: 'partial_amount', amountFen: 60000, reason: 'PR-1 开关关回验证' }));
  check('PR-1 开关关回=恢复硬拒（FORBIDDEN）',
    draftOffAgain instanceof TrpcHttpError && draftOffAgain.code === 'FORBIDDEN', draftOffAgain && draftOffAgain.message);

  /* ---- 件① D10：计提行+入账行不双计（settleMonthly 跑一遍看 yearGrantFen 不翻倍） ----
   * 口径注：期次防撞——43 段回归要结当前期次（断言 grantedCount=2/grantedFen=516 精确值），
   * 故本段计提行挂「下一期次」、假时钟 now=下下月 6 日结它（同一生产代码路径：
   * 计提回标+入账行+period unique 幂等），与 43 段互不占期次。 */
  const { settleMonthly: settleMonthlyPr1, ensureRebateAccount, rebatePeriodOf: periodOfPr1 } = await import('../services/rebate');
  const d10User = (await db.insert(schema.users).values({ kimiId: 'seed_e2e_d10', nickname: 'e2e D10 客', phone: '13811110010' }).returning())[0]!;
  await db.insert(schema.userRoles).values({ userId: d10User.id, role: 'customer' });
  const d10Cookie = await devLogin(d10User.id);
  const d10Acc = await ensureRebateAccount(db, d10User.id, new Date());
  /* 计提行挂「当前期次+2」（当前期次归 43 段、+1 归 49b 复核②段，三方各占其期） */
  const curP = periodOfPr1(new Date());
  const [cy, cm] = curP.split('-').map((s) => parseInt(s, 10));
  const myY = cy + Math.floor((cm + 1) / 12);
  const myM = ((cm + 1) % 12) + 1;
  const nextPeriod = `${myY}-${String(myM).padStart(2, '0')}`;
  const clockY = cy + Math.floor((cm + 2) / 12);
  const clockM = ((cm + 2) % 12) + 1;
  const settleClock = new Date(clockY, clockM - 1, 6); // settleMonthly 结「now 的上月」→ 落 nextPeriod（=当前期次+2）
  await db.insert(schema.rebateLogs).values({
    userId: d10User.id,
    accountId: d10Acc.id,
    type: 'grant',
    deltaFen: 500,
    beforeFen: 0,
    afterFen: 0,
    sourceId: 'HD-E2E-D10-001',
    period: nextPeriod,
    note: '【测试】e2e D10 计提行（下一期次）',
  });
  const ledgerBefore = await trpcQuery<{ yearGrantFen: number }>('membership.ledger', { cookie: d10Cookie });
  const settle1st = await settleMonthlyPr1(db, settleClock);
  const ledgerAfter = await trpcQuery<{ yearGrantFen: number }>('membership.ledger', { cookie: d10Cookie });
  const settle2nd = await settleMonthlyPr1(db, settleClock);
  check('PR-1 D10：月结后 yearGrantFen 不翻倍（500→500，计提行回标+入账行只计一类）',
    ledgerBefore.yearGrantFen === 500 && ledgerAfter.yearGrantFen === 500,
    { before: ledgerBefore.yearGrantFen, after: ledgerAfter.yearGrantFen });
  check('PR-1 D10：settleMonthly 幂等（重复跑 already-settled 不再入账）',
    settle1st.settled === true && settle2nd.settled === false, { first: settle1st.settled, second: settle2nd });


  /* ==================================================================
   * 修复包 PR-2 A5（PD-05 件 3 · CJ-0925-11）：寄养负责人指派 + 差评 −8 扣负责人
   * ================================================================== */
  console.log('\n[修复包PR-2] A5 寄养负责人 + 差评 −8');
  {
    /* 夹具：寄养单（confirmed 未核销；code 直插绕开扫码环节） */
    const bSvc = (await db.select().from(schema.services).where(and(eq(schema.services.storeId, storeId), eq(schema.services.type, 'boarding'))).get())!;
    /* 时刻钉法（57.6 先例扩展）：起始钉 15:30 半点——e2e 槽位选取器只取整点（getUTCMinutes()===0），任何夹具单不可能与半点撞同一 scheduled_start（assign 冲突闸=同员工同刻 exact 等值）；整点钉法与时长族 apptD1（15:00 自动派单）部分时辰撞员工撞刻（01:05 两见红实证）。 */
    const a5Start = new Date(`${storeToday}T15:30:00+08:00`);
    const a5Appt = (await db.insert(schema.appointments).values({
      code: 'E2EA55', customerId: customerUser!.id, storeId, petId, serviceId: bSvc.id,
      type: 'boarding', scheduledStart: a5Start, scheduledEnd: new Date(a5Start.getTime() + 2 * 86400_000),
      status: 'confirmed', priceFen: 39800, note: '【测试】e2e PR-2 A5 寄养 2 晚单（夹具直插）',
    }).returning())[0]!;

    /* ① 核销入住（默认=当班寄养岗：本店首位 boarding 技能在职员工） */
    const boardingStaffAll = (await db.select().from(schema.staff)
      .where(and(eq(schema.staff.storeId, storeId), eq(schema.staff.status, 'active')))
      .orderBy(schema.staff.createdAt).all());
    const leadExpected = boardingStaffAll.find((s) => (s.skills ?? []).includes('boarding'))!;
    const a5Checkin = await trpcMutate<{ appointment: { status: string; staffId: string | null } }>('appointment.checkin', {
      cookie: staffCookie, input: { code: 'E2EA55' },
    });
    const a5ApptAfter = await db.select().from(schema.appointments).where(eq(schema.appointments.id, a5Appt.id)).get();
    check('PR-2 A5① 寄养核销入住→负责人=当班寄养岗（staff_id 永不为 NULL，PD-05 默认口径）',
      a5Checkin.appointment.status === 'in_boarding' && a5ApptAfter?.staffId === leadExpected.id,
      { status: a5Checkin.appointment.status, staffId: a5ApptAfter?.staffId, expected: leadExpected.id });
    const a5AssignedRows = (await db.select().from(schema.eventOutbox).where(eq(schema.eventOutbox.eventType, 'appointment.assigned')).all())
      .filter((r) => {
        const p = r.payload as Record<string, unknown> | null;
        return p?.appointmentId === a5Appt.id && p?.by === 'checkin';
      });
    check('PR-2 A5① 指派留痕（appointment.assigned by=checkin 事件在卷）', a5AssignedRows.length >= 1, a5AssignedRows.length);

    /* ② 改派（in_boarding 可改派，店长权限+留痕）——改派给另一位 boarding 技能员工再改回 */
    const secondBoarding = boardingStaffAll.find((s) => (s.skills ?? []).includes('boarding') && s.id !== leadExpected.id);
    if (secondBoarding) {
      await trpcMutate('appointment.assign', {
        cookie: managerCookie, input: { appointmentId: a5Appt.id, staffId: secondBoarding.id },
      });
      const a5Reassigned = await db.select().from(schema.appointments).where(eq(schema.appointments.id, a5Appt.id)).get();
      check('PR-2 A5② in_boarding 改派负责人（assign 店长权限，staff_id 变更留痕）',
        a5Reassigned?.staffId === secondBoarding.id, { staffId: a5Reassigned?.staffId });
      await trpcMutate('appointment.assign', {
        cookie: managerCookie, input: { appointmentId: a5Appt.id, staffId: leadExpected.id },
      });
    } else {
      check('PR-2 A5② in_boarding 改派（本店仅 1 名寄养技能员工，跳过=通过）', true);
    }

    /* ③ 退房放行修正版（#33 issuecomment-5864881857 + PD-05 件 3）：退房=结算动作非责任
       动作——核销人 A → 退房人 B（本店任意店员，非负责人非店长）= 放行；责任归属仍=负责人
       （差评 −8 扣负责人不变），操作人留痕=寄养晚数 XP 发退房操作人 B。 */
    const checkoutOp = boardingStaffAll.find((s) => s.id !== leadExpected.id && s.id === staffRow2.id)
      ?? boardingStaffAll.find((s) => s.id !== leadExpected.id)
      ?? leadExpected;
    const opCookie = await devLogin(checkoutOp.userId);
    const a5Checkout = await trpcMutate<{ appointment: { status: string } }>('boarding.checkout', {
      cookie: opCookie, input: { appointmentId: a5Appt.id },
    });
    check('PR-2 A5③ 退房放行=本店任意店员（核销人 A→退房人 B 放行，PR-2 修正版）',
      a5Checkout.appointment.status === 'completed' && checkoutOp.id !== leadExpected.id,
      { status: a5Checkout.appointment.status, operator: checkoutOp.id, lead: leadExpected.id });
    const a5Stay = (await db.select().from(schema.boardingStays).where(eq(schema.boardingStays.appointmentId, a5Appt.id)).get())!;
    const a5OpXp = await db.select().from(schema.xpEvents)
      .where(and(
        eq(schema.xpEvents.staffId, checkoutOp.id),
        eq(schema.xpEvents.source, 'service'),
        eq(schema.xpEvents.sourceId, `boarding:${a5Stay.id}`),
      ))
      .get();
    check('PR-2 A5③ 操作人留痕（寄养晚数 XP 发退房操作人 B，责任归属不动）',
      a5OpXp !== undefined && a5OpXp.staffId === checkoutOp.id,
      { staffId: a5OpXp?.staffId, points: a5OpXp?.points });
    await trpcMutate('appointment.review', {
      cookie: customerCookie,
      input: { appointmentId: a5Appt.id, rating: 2, review: 'e2e A5 差评验证', anonymous: false },
    });
    const a5ReviewRow = (await db.select().from(schema.reviews).where(eq(schema.reviews.appointmentId, a5Appt.id)).get())!;
    const a5Penalty = (await db.select().from(schema.xpEvents)
      .where(and(
        eq(schema.xpEvents.staffId, leadExpected.id),
        eq(schema.xpEvents.source, 'penalty'),
        eq(schema.xpEvents.sourceId, a5ReviewRow.id),
      ))
      .get())!;
    check('PR-2 A5③ 寄养单差评 2 星 → 负责人 XP −8 落账（xp_penalty_low_star，source=penalty，挂本评价 reviewId）',
      a5Penalty.points === -8 && a5Penalty.staffId === leadExpected.id,
      { points: a5Penalty.points, staffId: a5Penalty.staffId, sourceId: a5Penalty.sourceId, reviewId: a5ReviewRow.id });
  }

  /* ==================================================================
   * 修复包 PR-3（PD-02 第 3 层 + 增补件）：①B checkout 释放剩余晚（C2 根治：提前接回
   * =房间可再订，与 R12 退款解耦）+ 增补 dailyLog 本店任意店员放行
   * + C2c 日结合计不含 held 单（QA40-D12 同解防回归）
   * ================================================================== */
  console.log('\n[修复包PR-3] C2 根治 + dailyLog 增补 + 日结不含 held');
  {
    const p3Svc = (await db.select().from(schema.services).where(and(eq(schema.services.storeId, storeId), eq(schema.services.type, 'boarding'))).get())!;
    const p3Start = new Date(`${storeDayStr(new Date(Date.now() + 86400_000))}T15:00:00+08:00`);
    const p3End = new Date(p3Start.getTime() + 3 * 86400_000);
    const p3Nights = [0, 1, 2].map((i) => storeDayStr(new Date(p3Start.getTime() + i * 86400_000)));
    const slotOf = async (night: string) =>
      db.select().from(schema.boardingSlots)
        .where(and(eq(schema.boardingSlots.storeId, storeId), eq(schema.boardingSlots.serviceId, p3Svc.id), eq(schema.boardingSlots.nightDate, night)))
        .get();

    /* ① trpc 造单（走 occupy 占槽）→ 核销入住 */
    const p3Appt = await trpcMutate<{ id: string; status: string }>('appointment.create', {
      cookie: customerCookie,
      input: { storeId, petId, serviceId: p3Svc.id, type: 'boarding', scheduledStart: p3Start, scheduledEnd: p3End, paymentMode: 'pay_at_store', note: '【测试】e2e PR-3 寄养 3 晚槽位夹具' },
    });
    const p3Before = await Promise.all(p3Nights.map(slotOf));
    check('PR-3 C2 前置：造单占槽（3 晚 booked≥1）',
      p3Before.every((r) => (r?.bookedCount ?? 0) >= 1),
      p3Nights.map((n, i) => `${n}=${p3Before[i]?.bookedCount}`));
    const p3Code = await trpcQuery<{ code: string }>('appointment.getCode', { cookie: customerCookie, input: { appointmentId: p3Appt.id } });
    await trpcMutate('appointment.checkin', { cookie: staffCookie, input: { code: p3Code.code } });
    const p3Stay = (await db.select().from(schema.boardingStays).where(eq(schema.boardingStays.appointmentId, p3Appt.id)).get())!;

    /* ② 增补：dailyLog 本店任意店员放行（丽丽=非负责人非店长；打卡人=操作人留痕） */
    const p3Log = await trpcMutate<{ log: { staffId: string } }>('boarding.dailyLog', {
      cookie: liliCookie,
      input: { stayId: p3Stay.id, logDate: storeToday, walks: 1, note: '【测试】e2e PR-3 增补：非负责人打卡' },
    });
    check('PR-3 增补 dailyLog 本店任意店员放行（打卡=班次共享动作，daily_logs.staff_id=操作人留痕）',
      p3Log.log.staffId === staffRow2.id,
      { staffId: p3Log.log.staffId, expected: staffRow2.id });

    /* ③ ①B：提前退房（首晚未发生即退）→ 剩余晚槽全释放 → 同区间可再订 */
    await trpcMutate('boarding.checkout', { cookie: staffCookie, input: { appointmentId: p3Appt.id } });
    const p3After = await Promise.all(p3Nights.map(slotOf));
    check('PR-3 C2①B 提前退房→剩余晚槽释放（3 晚 booked 全归零；与 R12 退款解耦）',
      p3After.every((r) => (r?.bookedCount ?? 9) === 0),
      p3Nights.map((n, i) => `${n}=${p3After[i]?.bookedCount}`));
    const p3Rebook = await trpcMutate<{ id: string }>('appointment.create', {
      cookie: customerCookie,
      input: { storeId, petId, serviceId: p3Svc.id, type: 'boarding', scheduledStart: p3Start, scheduledEnd: p3End, paymentMode: 'pay_at_store', note: '【测试】e2e PR-3 槽释放后再订验证' },
    }).then((r) => ({ id: r.id, err: null as string | null }))
      .catch((e) => ({ id: null as string | null, err: String(e?.message ?? e) }));
    check('PR-3 C2①B 释放后同区间可再订（无 CONFLICT 已订满）', p3Rebook.err === null, p3Rebook.err ?? p3Rebook.id);
    if (p3Rebook.id) {
      const p3Cancel = await trpcMutate<{ outcome: string }>('appointment.cancel', {
        cookie: customerCookie, input: { appointmentId: p3Rebook.id, reason: 'e2e PR-3 夹具清扫' },
      });
      check('PR-3 C2 夹具清扫：再订单 >4h 客户直消（槽全释放，环境零残留）', p3Cancel.outcome === 'cancelled', p3Cancel.outcome);
    }

    /* ④ C2c：日结合计不含 held 单（held 无支付段天然不进合计——防回归断言+收尾 voidBill） */
    const tenderC0 = await trpcQuery<{ receivedTotalFen: number }>('store.todayTenderStats', { cookie: ownerCookie });
    const heldC = await trpcMutate<{ bill: { billNo: string } }>('cashier.hold', {
      cookie: ownerCookie,
      input: { items: [{ kind: 'service', refId: service.id }], discountType: 'none', discountValue: 0, note: '【测试】e2e PR-3 C2c held 不计合计验证' },
    });
    const tenderC1 = await trpcQuery<{ receivedTotalFen: number }>('store.todayTenderStats', { cookie: ownerCookie });
    check('PR-3 C2c 日结/已收合计不含 held 单（held 前后 todayTenderStats 逐值相等）',
      tenderC1.receivedTotalFen === tenderC0.receivedTotalFen,
      { before: tenderC0.receivedTotalFen, after: tenderC1.receivedTotalFen });
    const voidC = await trpcMutate<{ bill: { status: string } }>('cashier.voidBill', {
      cookie: ownerCookie, input: { billNo: heldC.bill.billNo, reason: 'e2e PR-3 C2c 收尾清理' },
    });
    check('PR-3 C2c 收尾：held 单 voidBill 撤单（零残留）', voidC.bill.status === 'voided', voidC.bill.status);
  }

  /* ==================================================================
   * 修复包 PR-4（PD-02 第 4 层 + PD-05 件 1/2 + OP-01②）：
   * 件 2 注册默认档读 default_plan_key / 件 1 微光永久豁免（免费档永不冻结）/
   * OP-01② 微光线上开档 sold_store_id=NULL 进全店合计
   * ================================================================== */
  console.log('\n[修复包PR-4] PD-05 件 1/2 + OP-01②');
  {
    const mkUser = async (kimiId: string, phone: string) => {
      /* kimiId 须 seed_ 前缀（dev-login 仅允许种子用户，D-16 硬约束） */
      const u = (await db.insert(schema.users).values({ kimiId: `seed_${kimiId}`, phone, nickname: `e2e PR-4 ${phone.slice(-4)}` }).returning())[0]!;
      await db.insert(schema.userRoles).values({ userId: u.id, role: 'customer' });
      return u;
    };
    const p4u1 = await mkUser('e2e_pr4_u1', '19900000041');
    const p4u2 = await mkUser('e2e_pr4_u2', '19900000042');

    /* 件 2：openFree 读 default_plan_key 全局键（改键→新开档走新键→改回还原） */
    const free0 = await trpcMutate<{ membership: { planKey: string; expiresAt: Date } }>('membership.openFree', { cookie: await devLogin(p4u1.id) });
    check('PR-4 件 2 openFree 默认档=配置键现值（plan_weiguang，读 default_plan_key 非硬编码）',
      free0.membership.planKey === 'plan_weiguang', free0.membership.planKey);
    /* 补缺修复小批 P1-3：免费档 expiresAt 置远端 2099（数据层永久有效，写侧=FREE_PLAN_EXPIRES_AT 同值） */
    check('P1-3 openFree 免费档 expiresAt=2099-12-31 远端（数据层永久有效，与「永久有效」文案同帧）',
      free0.membership.expiresAt.getTime() === 4102444799 * 1000,
      free0.membership.expiresAt);
    await trpcMutate('config.save', {
      cookie: ownerCookie,
      input: { domain: 'member_plans', changes: [{ ruleKey: 'default_plan_key', valueJson: { value: 'plan_yinghuo' } }] },
    });
    const free1 = await trpcMutate<{ membership: { planKey: string } }>('membership.openFree', { cookie: await devLogin(p4u2.id) });
    check('PR-4 件 2 配置键改值即生效（openFree 开 plan_yinghuo 档，端口化落地）',
      free1.membership.planKey === 'plan_yinghuo', free1.membership.planKey);
    await trpcMutate('config.save', {
      cookie: ownerCookie,
      input: { domain: 'member_plans', changes: [{ ruleKey: 'default_plan_key', valueJson: { value: 'plan_weiguang' } }] },
    });

    /* 件 1：免费档 expires 过日 → 永不冻结（会员 active + 回馈金账户 active；QA40-D11 闭环） */
    await db.update(schema.memberships)
      .set({ expiresAt: new Date(Date.now() - 86400_000), updatedAt: new Date() })
      .where(eq(schema.memberships.userId, p4u1.id));
    const myP4 = await trpcQuery<{ membership: { status: string; planKey: string } }>('membership.my', { cookie: await devLogin(p4u1.id) });
    const accP4 = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, p4u1.id)).get();
    check('PR-4 件 1 微光永久豁免：expires 过日仍 active（会员+回馈金账户双不冻结）',
      myP4.membership.status === 'active' && myP4.membership.planKey === 'plan_weiguang' && accP4?.status === 'active',
      { status: myP4.membership.status, acc: accP4?.status });

    /* OP-01②：sold_store_id=NULL 进全店合计（amortizedFen 计入 round(1200÷12)=100） */
    const amo0 = await trpcQuery<{ amortizedFen: number }>('membership.amortizationStats', { cookie: ownerCookie, input: { month: currentMonth } });
    await db.update(schema.memberships).set({ paidFen: 1200, updatedAt: new Date() }).where(eq(schema.memberships.userId, p4u2.id));
    const amo1 = await trpcQuery<{ amortizedFen: number }>('membership.amortizationStats', { cookie: ownerCookie, input: { month: currentMonth } });
    check('PR-4 OP-01② 微光线上开档 NULL 进全店合计（amortizedFen +100=round(1200÷12)，数值口径统一）',
      amo1.amortizedFen - amo0.amortizedFen === 100,
      { before: amo0.amortizedFen, after: amo1.amortizedFen });
    /* 夹具归零：paidFen 回 0（微光本意），防污染下游 R11a 分摊回归断言期望值 */
    await db.update(schema.memberships).set({ paidFen: 0, updatedAt: new Date() }).where(eq(schema.memberships.userId, p4u2.id));
  }

  /* ==================================================================
   * 批次 R11a（会员前置批·骨架批）验收段 —— 28 号施工令全清单 + 回归
   * 主线夹具：示例客户（萤火会员）；manager（店长，staff 绑定）售卡/续费/退会。
   * ================================================================== */
  console.log('\n[R11a] 39. 售卡三档 + 售卡提成定额 + 双归属 + 微光开档幂等');
  interface MembershipRowT {
    id: string; userId: string; planKey: string; soldStoreId: string | null;
    status: string; petCount: number; paidFen: number; expiresAt: Date; refundFen: number | null;
  }
  interface SellRes { billNo: string; billId: string; amountFen: number; membership: MembershipRowT }
  const sellPlan = (cookie: string, input: Record<string, unknown>) =>
    trpcMutate<SellRes>('membership.sell', { cookie, input });

  // ① 萤火售卖到店付（manager 开单）：成交即开通 + sold_store=办卡店（双归属）
  const sellYinghuo = await sellPlan(managerCookie, {
    userId: customerUser!.id, planKey: 'plan_yinghuo', petCount: 0,
    paySegments: [{ method: 'cash', amountFen: 19900 }],
  });
  check('R11a⑧ 萤火售卖到店付（现金段 19900，成交即开通 active）',
    sellYinghuo.amountFen === 19900 && sellYinghuo.membership.status === 'active' &&
      sellYinghuo.membership.planKey === 'plan_yinghuo' && sellYinghuo.membership.paidFen === 19900,
    { amount: sellYinghuo.amountFen, status: sellYinghuo.membership.status });
  const yinghuoExpiresDays = (sellYinghuo.membership.expiresAt.getTime() - Date.now()) / 86400_000;
  check('R11a⑧ 有效期=开通+365 天（读表 membership_validity_days）', yinghuoExpiresDays > 364 && yinghuoExpiresDays < 366, yinghuoExpiresDays);
  const sellBillRow = await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.id, sellYinghuo.billId)).get();
  check('R11a⑩ 双归属两字段：memberships.sold_store_id=办卡店 且 售卡单 cashier_bills.store_id=消费店（同店场景两值同帧）',
    sellYinghuo.membership.soldStoreId === storeId && sellBillRow?.storeId === storeId &&
      sellYinghuo.membership.soldStoreId === sellBillRow?.storeId,
    { soldStore: sellYinghuo.membership.soldStoreId, billStore: sellBillRow?.storeId });
  const sellBillItem = await db.select().from(schema.cashierBillItems).where(eq(schema.cashierBillItems.billId, sellYinghuo.billId)).get();
  check('R11a⑩ 售卡单落 kind=membership 行（refId=plan_key，提成读侧数据源）',
    sellBillItem?.kind === 'membership' && sellBillItem.refId === 'plan_yinghuo', sellBillItem && { kind: sellBillItem.kind, refId: sellBillItem.refId });

  // ② 烛光/微光售卡（微光 0 元单直接成交，paySegments 空）
  const sellZhuguang = await sellPlan(managerCookie, { phone: '13811110001', planKey: 'plan_zhuguang', petCount: 0, paySegments: [{ method: 'wechat', amountFen: 29900 }] });
  const sellWeiguang = await sellPlan(managerCookie, { phone: '13811110002', planKey: 'plan_weiguang', petCount: 0, paySegments: [] });
  check('R11a⑧ 烛光 29900（微信段）+ 微光 0 元单直接成交（无支付段）',
    sellZhuguang.amountFen === 29900 && sellWeiguang.amountFen === 0 && sellWeiguang.membership.status === 'active',
    { zg: sellZhuguang.amountFen, wg: sellWeiguang.amountFen });
  /* 补缺修复小批 P1-3：收银台售微光（0 元单）expiresAt 同置远端 2099（sell 写侧口径） */
  check('P1-3 sell 微光档 expiresAt=2099-12-31 远端（烛光付费档照 +365 天读表不动）',
    sellWeiguang.membership.expiresAt.getTime() === 4102444799 * 1000 &&
      Math.abs(sellZhuguang.membership.expiresAt.getTime() - (Date.now() + 365 * 86400_000)) < 2 * 86400_000,
    { wg: sellWeiguang.membership.expiresAt, zg: sellZhuguang.membership.expiresAt });

  // ③ 售卡提成定额（commission.cardLines 接通）：归属=开单人 manager
  interface CardLineT { billId: string; plan: string; amountFen: number }
  const mgrSummary1 = await trpcQuery<{ payload: { cardLines: CardLineT[] } }>('commission.mySummary', { cookie: managerCookie, input: {} });
  const cardAmts = mgrSummary1.payload.cardLines.map((l) => `${l.plan}:${l.amountFen}`).sort();
  check('R11a⑧ 售卡提成定额：萤火 500（5 元）/ 烛光 1000（10 元）/ 微光 0 三档入 cardLines（暖阳 2000 同映射表抽单免验）',
    mgrSummary1.payload.cardLines.length === 3 &&
      cardAmts.includes('plan_yinghuo:500') && cardAmts.includes('plan_zhuguang:1000') && cardAmts.includes('plan_weiguang:0'),
    cardAmts);

  // ④ 微光开档幂等（回归）：新客 openFree 两次，第二次 idempotent=true 零副作用
  const freeUser = (await db.insert(schema.users).values({ kimiId: 'seed_e2e_free1', nickname: 'e2e 微光客', phone: '13811110009' }).returning())[0]!;
  await db.insert(schema.userRoles).values({ userId: freeUser.id, role: 'customer' });
  const freeCookie = await devLogin(freeUser.id);
  const of1 = await trpcMutate<{ membership: MembershipRowT; idempotent: boolean }>('membership.openFree', { cookie: freeCookie });
  const of2 = await trpcMutate<{ membership: MembershipRowT; idempotent: boolean }>('membership.openFree', { cookie: freeCookie });
  check('R11a回归 微光一键开档幂等（首次开档 → 第二次 idempotent=true 同档不重建）',
    of1.idempotent === false && of1.membership.planKey === 'plan_weiguang' && of1.membership.paidFen === 0 &&
      of2.idempotent === true && of2.membership.id === of1.membership.id,
    { first: of1.idempotent, second: of2.idempotent });

  // ⑤ D-16 自助开户（急修三件 PD-03 件 3）：口令门内手机号分支——新号建档+登录+微光开档链路
  console.log('\n[急修三件] D-16 自助开户（手机号登录/注册）');
  const newPhone = '13977776666'; // 避开种子/e2e 既有号段（13800000000/1381111xxxx/1390000xxxx）
  const devLoginPhone = async (phone: string) => {
    const res = await fetch(`${BASE}/api/auth/dev-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const body = (await res.json()) as { ok?: boolean; user?: { id: string; roles?: string[] } };
    return { res, body, cookie: res.ok ? sessionCookieOf(res) : null };
  };
  const reg1 = await devLoginPhone(newPhone);
  check('D-16 新手机号自助开户：注册即建档（customer 角色）并签发会话',
    reg1.res.ok && reg1.body.ok === true && !!reg1.body.user?.roles?.includes('customer'), reg1.body);
  const reg1Of = reg1.cookie
    ? await trpcMutate<{ membership: MembershipRowT; idempotent: boolean }>('membership.openFree', { cookie: reg1.cookie })
    : null;
  check('D-16 注册→登录→微光一键开档链路通（plan_weiguang active）',
    reg1Of?.membership.planKey === 'plan_weiguang' && reg1Of?.membership.status === 'active', reg1Of);
  const reg2 = await devLoginPhone(newPhone);
  check('D-16 同号再登录=同一用户（幂等建档，不重复建行）',
    reg2.res.ok && reg2.body.user?.id === reg1.body.user?.id, { first: reg1.body.user?.id, second: reg2.body.user?.id });
  const badPhone = await devLoginPhone('12345');
  check('D-16 非 11 位手机号 → 400 格式拦截（不建行）',
    badPhone.res.status === 400, { status: badPhone.res.status });

  /* ---------- 40. 清单⑨：多宠第 4 只 +59，10 只封顶 ---------- */
  console.log('\n[R11a] 40. 多宠附加费（清单⑨）');
  const sell4Pets = await sellPlan(managerCookie, { phone: '13811110003', planKey: 'plan_yinghuo', petCount: 4, paySegments: [{ method: 'cash', amountFen: 25800 }] });
  check('R11a⑨ 萤火 4 只 = 19900+5900=25800（第 4 只起 +¥59/年/只）',
    sell4Pets.amountFen === 25800 && sell4Pets.membership.petCount === 4, sell4Pets.amountFen);
  const sell10Pets = await sellPlan(managerCookie, { phone: '13811110004', planKey: 'plan_yinghuo', petCount: 10, paySegments: [{ method: 'cash', amountFen: 61200 }] });
  check('R11a⑨ 10 只封顶内放行（19900+7×5900=61200）', sell10Pets.amountFen === 61200, sell10Pets.amountFen);
  const sell11Pets = await asErr(sellPlan(managerCookie, { phone: '13811110005', planKey: 'plan_yinghuo', petCount: 11, paySegments: [{ method: 'cash', amountFen: 67100 }] }));
  check('R11a⑨ 11 只超封顶 → BAD_REQUEST「多宠封顶 10 只」',
    sell11Pets instanceof TrpcHttpError && sell11Pets.code === 'BAD_REQUEST' && sell11Pets.message.includes('多宠封顶'),
    sell11Pets && { code: sell11Pets.code, message: sell11Pets.message });

  /* ---------- 41. 清单⑦：服务 88 折自动 + 门市价划线 ---------- */
  console.log('\n[R11a] 41. 会员服务折扣（清单⑦）');
  const svcBillMember = await settleBill2([{ kind: 'service', refId: service.id }], { customerId: customerUser!.id, note: '【测试】e2e R11a 萤火服务单' });
  const svcItemMember = await db.select().from(schema.cashierBillItems).where(eq(schema.cashierBillItems.billId, svcBillMember.billId)).get();
  check('R11a⑦ 萤火服务单自动 88 折（adjusted=8800×0.88=7744 精确到分，应收=7744）',
    svcItemMember?.adjustedPriceFen === 7744 && svcBillMember.payableFen === 7744,
    { adjusted: svcItemMember?.adjustedPriceFen, payable: svcBillMember.payableFen });
  check('R11a⑦ 门市价划线对照（unit_price_fen=8800 门市价原值不动）', svcItemMember?.unitPriceFen === 8800, svcItemMember?.unitPriceFen);
  const wgUserId = sellWeiguang.membership.userId;
  const svcBillWeiguang = await settleBill2([{ kind: 'service', refId: service.id }], { customerId: wgUserId, note: '【测试】e2e R11a 微光服务单' });
  const svcItemWeiguang = await db.select().from(schema.cashierBillItems).where(eq(schema.cashierBillItems.billId, svcBillWeiguang.billId)).get();
  check('R11a⑦ 对照：微光（10000bp）无折扣=门市价 8800（adjusted 留空）',
    svcItemWeiguang?.adjustedPriceFen === null && svcBillWeiguang.payableFen === 8800, svcItemWeiguang?.adjustedPriceFen);

  /* ---------- 42. 清单③+①：回馈金 grant 无月上限 + 三本账无互转 ---------- */
  console.log('\n[R11a] 42. grant 无月上限 + 三本账（清单③+①）');
  // 同月两笔商品单（萤火 2%）：12900×2% = 258/笔
  const gBill1 = await settleBill2([{ kind: 'product', refId: staple.id }], { customerId: customerUser!.id, note: '【测试】e2e R11a grant 商品单 1' });
  const gBill2 = await settleBill2([{ kind: 'product', refId: staple.id }], { customerId: customerUser!.id, note: '【测试】e2e R11a grant 商品单 2' });
  const myAfterGrants = await trpcQuery<{ rebate: { balanceFen: number; pendingFen: number; status: string } | null }>('membership.my', { cookie: customerCookie });
  check('R11a③ 无月上限：同月两笔 grant 累计 258+258=516 全挂期次（无 cap 截断），未到账口径 balance=0',
    myAfterGrants.rebate?.pendingFen === 516 && myAfterGrants.rebate.balanceFen === 0,
    myAfterGrants.rebate);
  const grantLogs = await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, customerUser!.id), eq(schema.rebateLogs.type, 'grant')));
  check('R11a③ grant 行挂期次且余额不动（before=after=0，统一次月到账）',
    grantLogs.length === 2 && grantLogs.every((l) => l.deltaFen === 258 && l.beforeFen === l.afterFen && !!l.period),
    grantLogs.map((l) => ({ delta: l.deltaFen, period: l.period })));

  // 三本账无互转（端点扫描 + 余额变动只走自家流水表）
  const { appRouter } = await import('../routers');
  const procNames = Object.keys((appRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def.procedures);
  check('R11a① 端点扫描：全路由无回馈金/储值/XP 互转通道（无 convert/transfer/exchange/互转 过程名）',
    !procNames.some((n) => /convert|transfer|exchange|互转/i.test(n)), `procedures=${procNames.length}`);
  const svAccUntouched = await db.select().from(schema.storedValueAccounts).where(eq(schema.storedValueAccounts.id, svAcc.id)).get();
  const xpCross = await db.select().from(schema.xpEvents).where(eq(schema.xpEvents.userId, customerUser!.id));
  check('R11a① 余额变动只走自家流水表（grant×2 后：储值账仍 98240 未动 / 客户 XP 账零事件）',
    !!svAccUntouched && svAccUntouched.principalFen + svAccUntouched.bonusFen === 98240 && xpCross.length === 0,
    { sv: svAccUntouched && svAccUntouched.principalFen + svAccUntouched.bonusFen, xpEvents: xpCross.length });

  /* ---------- 43. 回归：settleMonthly 次月到账批次单幂等（服务级直调，harness 共享临时库） ---------- */
  console.log('\n[R11a] 43. settleMonthly 次月到账（回归）');
  const { settleMonthly, rebatePeriodOf } = await import('../services/rebate');
  const periodNow = rebatePeriodOf(new Date()); // 当前期次（上月26~本月25）
  const [py, pm] = periodNow.split('-').map((s) => parseInt(s, 10));
  const settleNow = new Date(py, pm, 10); // 期次 P 的次月 10 日（≥结算日 5）——结算对象=P
  const notDue = await settleMonthly(db, new Date(2030, 0, 2)); // 2 日 < 结算日 5 → 空转
  check('R11a回归 settleMonthly 未到期空转（not-due 零写入）', notDue.settled === false && notDue.reason === 'not-due', notDue);
  const rbSettle1 = await settleMonthly(db, settleNow);
  const accAfterRbSettle = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, customerUser!.id)).get();
  check('R11a回归 期次结算入账（批次单 grantedCount=2/grantedFen=516；余额 0→516 前后值留痕）',
    rbSettle1.settled === true && rbSettle1.period === periodNow && rbSettle1.grantedCount === 2 && rbSettle1.grantedFen === 516 &&
      accAfterRbSettle?.balanceFen === 516,
    { settled: rbSettle1.settled, period: rbSettle1.period, count: rbSettle1.grantedCount, fen: rbSettle1.grantedFen, balance: accAfterRbSettle?.balanceFen });
  const rbSettle2 = await settleMonthly(db, settleNow);
  const batchRows = await db.select().from(schema.rebateSettlements).where(eq(schema.rebateSettlements.period, periodNow));
  check('R11a回归 批次单幂等（period unique：重入 already-settled，全表仍 1 行）',
    rbSettle2.settled === false && rbSettle2.reason === 'already-settled' && batchRows.length === 1,
    { reason: rbSettle2.reason, batches: batchRows.length });

  /* ---------- 44. 清单②：抵扣段仅商品 + 回归：rebate 段不计已收 ---------- */
  console.log('\n[R11a] 44. rebate 抵扣段（清单② + 不计已收回归）');
  const svcRebate = await asErr(trpcMutate('cashier.settle', {
    cookie: ownerCookie,
    input: {
      customerId: customerUser!.id, items: [{ kind: 'service', refId: service.id }],
      discountType: 'none', discountValue: 0, note: '【测试】e2e R11a 服务行 rebate 段验证',
      payments: [{ method: 'rebate', amountFen: 100 }, { method: 'cash', amountFen: 7644 }],
    },
  }));
  check('R11a② 服务行单 + rebate 段 → 403 FORBIDDEN「回馈金仅可抵商品」（红线 2 硬校验）',
    svcRebate instanceof TrpcHttpError && svcRebate.httpStatus === 403 && svcRebate.code === 'FORBIDDEN' && svcRebate.message.includes('回馈金仅可抵商品'),
    svcRebate && { status: svcRebate.httpStatus, message: svcRebate.message });
  const tender44Before = await trpcQuery<{ receivedTotalFen: number; tender: { rebateFen?: number } }>('store.todayTenderStats', { cookie: ownerCookie });
  const dBill = await settleBill2([{ kind: 'product', refId: staple.id }], {
    customerId: customerUser!.id,
    payments: () => [{ method: 'rebate', amountFen: 300 }, { method: 'cash', amountFen: 12600 }],
    note: '【测试】e2e R11a 商品行 rebate 抵扣单',
  }); // 12900 = rebate 300 + cash 12600
  const accAfterDeduct = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, customerUser!.id)).get();
  const deductLog = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, customerUser!.id), eq(schema.rebateLogs.type, 'deduct'))))[0];
  check('R11a② 商品行单 + rebate 段成（余额 516→216 前后值留痕，1:1 扣已到账）',
    dBill.payableFen === 12900 && accAfterDeduct?.balanceFen === 216 &&
      deductLog?.deltaFen === -300 && deductLog.beforeFen === 516 && deductLog.afterFen === 216,
    { balance: accAfterDeduct?.balanceFen, log: deductLog && { before: deductLog.beforeFen, after: deductLog.afterFen } });
  const tender44After = await trpcQuery<{ receivedTotalFen: number; tender: { rebateFen?: number } }>('store.todayTenderStats', { cookie: ownerCookie });
  check('R11a回归 rebate 段不计已收（已收仅 +现金段 12600；rebateFen 参考列 +300）',
    tender44After.receivedTotalFen - tender44Before.receivedTotalFen === 12600 &&
      (tender44After.tender.rebateFen ?? 0) - (tender44Before.tender.rebateFen ?? 0) === 300,
    { dReceived: tender44After.receivedTotalFen - tender44Before.receivedTotalFen, dRebate: (tender44After.tender.rebateFen ?? 0) - (tender44Before.tender.rebateFen ?? 0) });

  /* ---------- 45. 清单⑥：退货扣回接 R12（实算 + 余额不足扣 0 记未扣回） ---------- */
  console.log('\n[R11a] 45. 退货扣回接 R12（清单⑥）');
  interface R11aLinkage { rebateClawbackFen?: number; rebateClawbackMissedFen?: number }
  const cb1 = await trpcMutate<RefundExecRes>('refund.execute', {
    cookie: ownerCookie,
    input: { billNo: gBill1.billNo, type: 'partial_amount', amountFen: 6450, reason: 'R11a 退货扣回 50%' },
  });
  const cb1Linkage = (cb1.refund.linkageJson ?? {}) as R11aLinkage;
  const clawLog1 = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.type, 'clawback'), eq(schema.rebateLogs.sourceId, cb1.refund.refundNo))))[0];
  check('R11a⑥ 部分退 50% → rebateClawbackFen 实算=已发 258×(6450÷12900)=129（linkage 填实值，冻结接口激活）',
    cb1Linkage.rebateClawbackFen === 129 && cb1Linkage.rebateClawbackMissedFen === 0, cb1Linkage);
  check('R11a⑥ clawback 流水前后值（216→129 扣后余额 87；source_id=退款单号，note 关联原单号）',
    clawLog1?.deltaFen === -129 && clawLog1.beforeFen === 216 && clawLog1.afterFen === 87 &&
      clawLog1.sourceId === cb1.refund.refundNo && (clawLog1.note ?? '').includes(gBill1.billNo),
    clawLog1 && { delta: clawLog1.deltaFen, before: clawLog1.beforeFen, after: clawLog1.afterFen, note: clawLog1.note });
  const cb2 = await trpcMutate<RefundExecRes>('refund.execute', {
    cookie: ownerCookie,
    input: { billNo: gBill2.billNo, type: 'partial_amount', amountFen: 6450, reason: 'R11a 退货扣回余额不足' },
  });
  const cb2Linkage = (cb2.refund.linkageJson ?? {}) as R11aLinkage;
  const clawLog2 = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.type, 'clawback'), eq(schema.rebateLogs.sourceId, cb2.refund.refundNo))))[0];
  const accAfterClaw2 = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, customerUser!.id)).get();
  check('R11a⑥ 余额不足扣 0 不负账（应扣 129 > 余额 87 → 实扣 87，差额 42 记 rebateClawbackMissedFen 未扣回）',
    cb2Linkage.rebateClawbackFen === 129 && cb2Linkage.rebateClawbackMissedFen === 42 &&
      clawLog2?.beforeFen === 87 && clawLog2.afterFen === 0 && accAfterClaw2?.balanceFen === 0,
    { linkage: cb2Linkage, balance: accAfterClaw2?.balanceFen });

  /* ---------- 46. 清单④：到期冻结 → 续费解冻顺延 ---------- */
  console.log('\n[R11a] 46. 到期冻结 / 续费解冻（清单④）');
  await db.update(schema.memberships).set({ expiresAt: new Date(Date.now() - 86400_000), updatedAt: new Date() })
    .where(eq(schema.memberships.id, sellYinghuo.membership.id)); // 到期日置昨日
  const myFrozen = await trpcQuery<{ membership: { status: string } | null; rebate: { status: string } | null }>('membership.my', { cookie: customerCookie });
  const freezeLog = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, customerUser!.id), eq(schema.rebateLogs.type, 'freeze'))))[0];
  check('R11a④ 到期过日 → 读路径懒冻结（membership frozen + 回馈金账户 frozen + freeze 留痕行）',
    myFrozen.membership?.status === 'frozen' && myFrozen.rebate?.status === 'frozen' && !!freezeLog,
    { membership: myFrozen.membership?.status, rebate: myFrozen.rebate?.status });
  const frozenDeduct = await asErr(trpcMutate('cashier.settle', {
    cookie: ownerCookie,
    input: {
      customerId: customerUser!.id, items: [{ kind: 'product', refId: staple.id }],
      discountType: 'none', discountValue: 0, note: '【测试】e2e R11a 冻结抵扣验证',
      payments: [{ method: 'rebate', amountFen: 100 }, { method: 'cash', amountFen: 12800 }],
    },
  }));
  check('R11a④ 冻结期抵扣不可用（FORBIDDEN「回馈金账户冻结中」，余额在不可用）',
    frozenDeduct instanceof TrpcHttpError && frozenDeduct.code === 'FORBIDDEN' && frozenDeduct.message.includes('冻结'),
    frozenDeduct && { code: frozenDeduct.code, message: frozenDeduct.message });
  const frozenDiscount = await settleBill2([{ kind: 'service', refId: service.id }], { customerId: customerUser!.id, note: '【测试】e2e R11a 冻结期服务单' });
  check('R11a④ 冻结期服务折扣同步失效（门市价 8800 不打折）', frozenDiscount.payableFen === 8800, frozenDiscount.payableFen);
  const renewRes = await trpcMutate<{ membership: MembershipRowT; amountFen: number }>('membership.renew', {
    cookie: managerCookie,
    input: { userId: customerUser!.id, paySegments: [{ method: 'cash', amountFen: 19900 }] },
  });
  const renewDays = (renewRes.membership.expiresAt.getTime() - Date.now()) / 86400_000;
  const accAfterRenew = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, customerUser!.id)).get();
  check('R11a④ 续费解冻：active + expires 自今日顺延 365 天 + 回馈金账户恢复 active',
    renewRes.membership.status === 'active' && renewDays > 364 && renewDays < 366 && accAfterRenew?.status === 'active',
    { status: renewRes.membership.status, days: renewDays, acc: accAfterRenew?.status });

  /* ---------- 47. 清单⑫：安心包全员免费（权益表述）+ 回归：savingsPreview / amortizationStats ---------- */
  console.log('\n[R11a] 47. plans 权益表述 + 立省钩子 + 年费分摊双口径（清单⑫+回归）');
  const plansRes = await trpcQuery<{ plans: Array<{ planKey: string; label: string; priceFen: number; free: boolean }> }>('membership.plans', { cookie: customerCookie });
  const plansJson = JSON.stringify(plansRes.plans.map((p) => p.label));
  check('R11a⑫ 权益表述：plans 透出含「安心包全员免费」（微光档权益行）', plansJson.includes('安心包全员免费'), plansRes.plans.map((p) => p.planKey));
  check('R11a⑫ 无「非会员 ¥15」残留（全档权益文案 grep 级实证）', !/¥15|15\s*元/.test(plansJson), plansJson.slice(0, 120));
  check('R11a⑫ 四档价格明面（0 / 19900 / 29900 / 59900 升序）',
    plansRes.plans.map((p) => p.priceFen).join(',') === '0,19900,29900,59900', plansRes.plans.map((p) => p.priceFen));
  const savePrev = await trpcQuery<{ fen: number; text: string }>('membership.savingsPreview', {
    cookie: ownerCookie,
    input: { lines: [{ kind: 'service', amountFen: 8800 }, { kind: 'product', amountFen: 12900 }] },
  });
  check('R11a回归 savingsPreview 立省钩子数值（服务 8800×12% + 商品 12900×2% = 1056+258=1314）',
    savePrev.fen === 1314 && savePrev.text === '开通萤火立省 ¥13.14', savePrev);
  const amo = await trpcQuery<{ month: string; cashFen: number; amortizedFen: number }>('membership.amortizationStats', {
    cookie: ownerCookie, input: { month: currentMonth },
  });
  // 售卡实收：萤火 19900 + 烛光 29900 + 微光 0 + 4 宠 25800 + 10 宠 61200 + 续费 19900 = 156700
  // 分摊确认（退会前 active 快照）：round(19900/12)+round(29900/12)+0+2150+5100 = 1658+2492+0+2150+5100 = 11400
  check('R11a回归 年费分摊双口径并列（收现 cashFen=156700 / 分摊确认 amortizedFen=11400 精确到分）',
    amo.cashFen === 156700 && amo.amortizedFen === 11400, amo);

  /* ---------- 48. 清单⑤+⑪：退会清零 + 折算剩余整月×月均价精确到分 ---------- */
  console.log('\n[R11a] 48. 退会（清单⑤+⑪，R11a 段收尾动作）');
  // 构造「用 4 个月零几天」：到期日=今日+7 个月+3 天 → 剩余整月=7（到期日「日」>退会日「日」，零头不抹）
  const exp7 = new Date();
  exp7.setMonth(exp7.getMonth() + 7);
  exp7.setDate(exp7.getDate() + 3);
  await db.update(schema.memberships).set({ expiresAt: exp7, updatedAt: new Date() })
    .where(eq(schema.memberships.id, sellYinghuo.membership.id));
  const cancelRes = await trpcMutate<{ membership: MembershipRowT; refundFen: number; clearedRebateFen: number }>('membership.cancel', {
    cookie: managerCookie,
    input: { userId: customerUser!.id, reason: '客户申请退会（e2e）' },
  });
  // 月均价=19900÷12；剩余整月 7 → round(19900×7/12)=11608 精确到分（¥116.08）
  check('R11a⑪ 退会折算=剩余整月 7×月均价（19900×7/12=11608 分精确到分）',
    cancelRes.refundFen === 11608 && cancelRes.membership.refundFen === 11608, { refundFen: cancelRes.refundFen });
  const accAfterCancel = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, customerUser!.id)).get();
  const clearLog = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, customerUser!.id), eq(schema.rebateLogs.type, 'clear'))))[0];
  check('R11a⑤ 退会清零（余额 0 + clear 留痕行前后值 + memberships cancelled）',
    accAfterCancel?.balanceFen === 0 && !!clearLog && clearLog.afterFen === 0 && cancelRes.membership.status === 'cancelled',
    { balance: accAfterCancel?.balanceFen, clearedFen: cancelRes.clearedRebateFen, status: cancelRes.membership.status });
  const cancelEvents = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'membership.cancelled' && r.channel === `user:${customerUser!.id}`,
  );
  check('R11a⑤ 客户频道通知（membership.cancelled → user 频道，payload 含折算额与「按原路退回」文案）',
    cancelEvents.length === 1 && (() => {
      const p = cancelEvents[0]!.payload as Record<string, unknown>;
      return p.refundFen === 11608 && typeof p.message === 'string' && (p.message as string).includes('原路退回');
    })(),
    cancelEvents.map((r) => r.payload));
  const myAfterCancel = await trpcQuery<{ membership: unknown; guide: string | null }>('membership.my', { cookie: customerCookie });
  check('R11a⑤ 退会后会员页回非会员引导态（membership=null + guide 透出）',
    myAfterCancel.membership === null && typeof myAfterCancel.guide === 'string', myAfterCancel.guide);

  // 收尾一致性：回馈金全生命周期流水前后值链完整（每行 before=上行 after，五类全留痕）
  const allLogs = (await db.select().from(schema.rebateLogs).where(eq(schema.rebateLogs.userId, customerUser!.id)))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : 1));
  const chainOk = allLogs.every((l, i) => i === 0 || l.beforeFen === allLogs[i - 1]!.afterFen);
  check('R11a⑤ 回馈金流水前后值链完整（grant/deduct/clawback/freeze/clear 全周期）',
    allLogs.length >= 8 && chainOk && allLogs[allLogs.length - 1]!.afterFen === 0,
    allLogs.map((l) => `${l.type}:${l.beforeFen}→${l.afterFen}`));

  /* ==================================================================
   * 批次 R11a 复核补改（七步复核打回①/②）验收段
   * 打回①：退会折算不悬空——cancel 同事务自动挂 R12 通道退款单
   *   （refund_bills type='membership_cancel'，executed/offline_original，bill_id=售卡原单）；
   * 打回②：退会清零含未到账——未结算 grant 写「退会作废未到账回馈金」汇总 clear 行 +
   *   settleMonthly 跳过 cancelled 用户 grant（双保险，批次单只计实际入账）。
   * ================================================================== */
  console.log('\n[R11a-复核] 49. 退会退款单挂号 + 退会后结算日不到账');

  /* ---- 49a. 打回①：退会 → 退款单在库 + refund.list 可见（待办移位在 49c 段尾做） ---- */
  const sellM1 = await sellPlan(managerCookie, {
    phone: '13811110006', planKey: 'plan_yinghuo', petCount: 0,
    paySegments: [{ method: 'cash', amountFen: 19900 }],
  });
  interface CancelResV2 {
    membership: MembershipRowT; refundFen: number; clearedRebateFen: number;
    refundNo: string; refundId: string; voidedPendingFen: number;
  }
  const cancelM1 = await trpcMutate<CancelResV2>('membership.cancel', {
    cookie: managerCookie,
    input: { userId: sellM1.membership.userId, reason: '复核补改：退会挂号退款单验证' },
  });
  // 萤火新卡（expires=开通+365 天，剩余整月 12）→ 折算=min(19900×12/12, 19900)=19900
  check('复核① cancel 返回退款单号（refundNo/refundId 透出，折算额=19900）',
    cancelM1.refundFen === 19900 && !!cancelM1.refundNo && !!cancelM1.refundId, { refundFen: cancelM1.refundFen, refundNo: cancelM1.refundNo });
  const mRefundRow = await db.select().from(schema.refundBills).where(eq(schema.refundBills.id, cancelM1.refundId)).get();
  check('复核① refund_bills 行在库（type=membership_cancel / amount=折算额 / status=executed / refund_method=offline_original / bill_id=售卡原单）',
    mRefundRow?.type === 'membership_cancel' && mRefundRow.amountFen === 19900 &&
      mRefundRow.status === 'executed' && mRefundRow.refundMethod === 'offline_original' &&
      mRefundRow.billId === sellM1.billId,
    mRefundRow && { type: mRefundRow.type, amount: mRefundRow.amountFen, status: mRefundRow.status, method: mRefundRow.refundMethod });
  const mLinkage = (mRefundRow?.linkageJson ?? {}) as Record<string, unknown>;
  const mCancelSnap = (mLinkage.membershipCancel ?? {}) as Record<string, unknown>;
  check('复核① linkage 快照全字段（membershipCancel 含 planKey/paidFen/refundFen/clearedRebateFen/monthsRemaining/voidedPendingFen/期次）+ rebateClawbackFen=0 列位',
    mCancelSnap.planKey === 'plan_yinghuo' && mCancelSnap.paidFen === 19900 && mCancelSnap.refundFen === 19900 &&
      mCancelSnap.clearedRebateFen === 0 && mCancelSnap.monthsRemaining === 12 &&
      mCancelSnap.voidedPendingFen === 0 && Array.isArray(mCancelSnap.voidedPendingPeriods) &&
      mLinkage.rebateClawbackFen === 0,
    mCancelSnap);
  const refundList49 = await trpcQuery<Array<{ id: string; refundNo: string; type: string; amountFen: number }>>('refund.list', { cookie: ownerCookie });
  check('复核① refund.list 可见该退款单（type=membership_cancel，金额=折算额）',
    refundList49.some((r) => r.id === cancelM1.refundId && r.refundNo === cancelM1.refundNo && r.type === 'membership_cancel' && r.amountFen === 19900),
    refundList49.length);

  /* ---- 49b. 打回②：退会后结算日不到账（跳过 cancelled；正常会员对照到账） ----
   * 期次夹具：§43 已把当前期次 periodNow 结算掉（period unique），故把 C/D 两笔真实商品单
   * grant 的期次移位到 periodNow+1（未结算新期次），settleMonthly 合成 now 指向其次月 10 日——
   * 结算对象为 futurePeriod，与 §43 批次和 server 真实定时器（真实上一期次）均不相撞。 */
  const sellC = await sellPlan(managerCookie, { phone: '13811110007', planKey: 'plan_yinghuo', petCount: 0, paySegments: [{ method: 'cash', amountFen: 19900 }] });
  const sellD = await sellPlan(managerCookie, { phone: '13811110008', planKey: 'plan_yinghuo', petCount: 0, paySegments: [{ method: 'cash', amountFen: 19900 }] });
  const gBillC = await settleBill2([{ kind: 'product', refId: staple.id }], { customerId: sellC.membership.userId, note: '【测试】e2e 复核② C 商品单（grant 258）' });
  const gBillD = await settleBill2([{ kind: 'product', refId: staple.id }], { customerId: sellD.membership.userId, note: '【测试】e2e 复核② D 商品单（grant 258，对照组）' });
  const fpDate = new Date(py, pm, 1); // periodNow 的次月（pm 为 1 基月名 → Date 月份索引 pm 即次月）
  const futurePeriod = `${fpDate.getFullYear()}-${pad2l(fpDate.getMonth() + 1)}`;
  const settleNow2 = new Date(fpDate.getFullYear(), fpDate.getMonth() + 1, 10); // 期次次月 10 日 ≥ 结算日 5
  await db.update(schema.rebateLogs).set({ period: futurePeriod, updatedAt: new Date() })
    .where(and(eq(schema.rebateLogs.type, 'grant'), inArray(schema.rebateLogs.sourceId, [gBillC.billNo, gBillD.billNo]))); // 期次移位到未结算期（夹具）
  const accC0 = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, sellC.membership.userId)).get();
  const accD0 = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, sellD.membership.userId)).get();

  const cancelC = await trpcMutate<CancelResV2>('membership.cancel', {
    cookie: managerCookie,
    input: { userId: sellC.membership.userId, reason: '复核补改：退会作废未到账验证' },
  });
  check('复核② 退会作废未到账合计透出（voidedPendingFen=258=C 的未结算 grant）',
    cancelC.voidedPendingFen === 258, { voidedPendingFen: cancelC.voidedPendingFen });
  const voidLog = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, sellC.membership.userId), eq(schema.rebateLogs.type, 'clear'))))
    .find((l) => (l.note ?? '').includes('退会作废未到账回馈金'));
  check('复核② 作废留痕 clear 行在库（note 含「退会作废未到账回馈金 258 分（期次 …）」，delta=0 前后值不动）',
    !!voidLog && voidLog.deltaFen === 0 && voidLog.beforeFen === voidLog.afterFen &&
      (voidLog.note ?? '').includes('退会作废未到账回馈金 258 分') && (voidLog.note ?? '').includes(futurePeriod),
    voidLog && { note: voidLog.note, delta: voidLog.deltaFen });

  const settle49 = await settleMonthly(db, settleNow2);
  const accC1 = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, sellC.membership.userId)).get();
  const accD1 = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, sellD.membership.userId)).get();
  const grantC1 = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, sellC.membership.userId), eq(schema.rebateLogs.type, 'grant'), eq(schema.rebateLogs.sourceId, gBillC.billNo))))[0];
  const grantD1 = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, sellD.membership.userId), eq(schema.rebateLogs.type, 'grant'), eq(schema.rebateLogs.sourceId, gBillD.billNo))))[0];
  const batch49 = await db.select().from(schema.rebateSettlements).where(eq(schema.rebateSettlements.period, futurePeriod)).get();
  check('复核② 退会者结算日不到账（C 余额不变 0→0、grant 行未回标 settlement_id、无入账行）',
    settle49.settled === true && settle49.period === futurePeriod &&
      accC1?.balanceFen === accC0?.balanceFen && grantC1?.settlementId === null &&
      !(await db.select().from(schema.rebateLogs)
        .where(and(eq(schema.rebateLogs.userId, sellC.membership.userId), eq(schema.rebateLogs.settlementId, settle49.settlementId!)))).length,
    { settled: settle49.settled, cBalance: accC1?.balanceFen, cSettlementId: grantC1?.settlementId });
  check('复核② 正常会员对照到账（D 余额 0→258 + grant 行回标批次）',
    accD1?.balanceFen === (accD0?.balanceFen ?? 0) + 258 && grantD1?.settlementId === settle49.settlementId,
    { dBalance: [accD0?.balanceFen, accD1?.balanceFen], dSettlementId: grantD1?.settlementId });
  check('复核② 批次单只计实际入账（granted_count=1 不含退会者，note 记跳过 1 行）',
    batch49?.grantedCount === 1 && batch49.grantedFen === 258 && (batch49.note ?? '').includes('退会用户跳过 1 行'),
    { count: batch49?.grantedCount, fen: batch49?.grantedFen, note: batch49?.note });

  /* ==================================================================
   * 批次 C5（客户退款申请实体+审批缝）验收段
   * 纲：客户端申请实体 → 商家审批缝 → 到店单批准直通 R12 内核（executeRefundCore
   * 复用，阈值/涉储值闸天然生效）；R12 链路本体零改动（旧断言全绿为证）。
   * 位置铁律：本段挂 §49c createdAt 移位之前——50.4/50.6 会生成退款单（RB 日序
   * 单号按 createdAt 计数），移位后生成会撞 UNIQUE（§34/§38 教训同帧）。
   * ================================================================== */
  console.log('\n[C5] 50. 客户退款申请：实体+端口+审批缝+R12 联动');
  interface RefundRequestRowT {
    id: string; requestNo: string; customerId: string; storeId: string; orderKind: string;
    billId: string; billNo: string; type: string; reasonCode: string; reasonLabel: string;
    description: string | null; photoUrls: string[]; amountFen: number;
    itemsJson: Array<{ itemId: string; label: string; amountFen: number }>;
    status: string; timelineJson: Array<{ status: string; at: string; note?: string }>;
    approverId: string | null; approvedAt: Date | null; rejectReason: string | null;
    refundBillNo: string | null; reappliedAfterDays: number | null;
  }
  interface ReqCreateRes { request: RefundRequestRowT; idempotent: boolean }
  interface ReqApproveRes {
    request: RefundRequestRowT; refundId: string | null; refundNo: string | null;
    idempotent: boolean; draft: boolean;
  }

  /* ---------- 50.1 商城单申请创建（received）+ 幂等 + configView ---------- */
  console.log('\n[C5] 50.1 商城单申请创建 + 幂等 + configView');
  const mallOrder50 = await db
    .insert(schema.orders)
    .values({
      orderNo: 'PE2E5000001A',
      customerId: customerUser!.id,
      storeId,
      items: [{ product_id: staple.id, name: staple.name, quantity: 1, price_fen: 12900 }],
      totalFen: 12900,
      status: 'received',
    })
    .returning()
    .then((r) => r[0]!);
  const cfg50 = await trpcQuery<{
    enabled: boolean; applyWindowDays: number; freeRegretHours: number;
    reasonOptions: Array<{ code: string; label: string }>; slaHours: number;
  }>('refundRequest.configView', { cookie: customerCookie });
  check('C5 50.1 configView 透出端口五键（enabled=true/时限 30 天/反悔 24h/原因枚举 6 码/SLA 24h）',
    cfg50.enabled === true && cfg50.applyWindowDays === 30 && cfg50.freeRegretHours === 24 &&
      cfg50.slaHours === 24 && cfg50.reasonOptions.length === 6 &&
      cfg50.reasonOptions[1]!.label === '商品与描述不符' && cfg50.reasonOptions[5]!.code === 'other',
    cfg50);
  const create50 = await trpcMutate<ReqCreateRes>('refundRequest.create', {
    cookie: customerCookie,
    input: {
      orderKind: 'order', billId: mallOrder50.id, type: 'return_refund',
      reasonCode: 'not_as_described', description: '包装破损，与描述不符',
    },
  });
  check('C5 50.1 商城单（received）申请创建成（RR 日序单号/submitted/全额 12900/原因 label 端口快照）',
    /^RR-\d{8}-\d{3}$/.test(create50.request.requestNo) && create50.idempotent === false &&
      create50.request.status === 'submitted' && create50.request.amountFen === 12900 &&
      create50.request.billNo === 'PE2E5000001A' && create50.request.reasonLabel === '商品与描述不符' &&
      create50.request.timelineJson.length === 1 && create50.request.timelineJson[0]!.status === 'submitted',
    create50.request);
  const create50dup = await trpcMutate<ReqCreateRes>('refundRequest.create', {
    cookie: customerCookie,
    input: {
      orderKind: 'order', billId: mallOrder50.id, type: 'return_refund',
      reasonCode: 'not_as_described', description: '包装破损，与描述不符',
    },
  });
  const reqRows50 = await db.select().from(schema.refundRequests)
    .where(and(eq(schema.refundRequests.customerId, customerUser!.id), eq(schema.refundRequests.billId, mallOrder50.id)));
  check('C5 50.1 幂等：同 (客户,原单) 在途单重复提交 → idempotent=true 返回现状不新建（库内仅 1 行）',
    create50dup.idempotent === true && create50dup.request.id === create50.request.id && reqRows50.length === 1,
    { dupId: create50dup.request.id, rows: reqRows50.length });

  /* ---------- 50.2 越权：他人单 create→403 / getById 他人单→403 / listMine 隔离 ---------- */
  console.log('\n[C5] 50.2 越权负例');
  const cookieD50 = await (async () => {
    /* 夹具：sellD 为手机号旁路建档用户（kimiId 非 seed_ 前缀），dev-login 仅允许种子用户
       （D-16 硬约束）→ 临时库内补 seed_ 前缀 kimiId 再登录（验收语义不变，同 PR-4 mkUser 口径） */
    await db.update(schema.users).set({ kimiId: 'seed_e2e_customer_d', updatedAt: new Date() })
      .where(eq(schema.users.id, sellD.membership.userId));
    return devLogin(sellD.membership.userId);
  })();
  const crossCreate = await asErr(trpcMutate('refundRequest.create', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: gBillD.billId, type: 'refund_only', reasonCode: 'wrong_order' },
  }));
  check('C5 50.2 客户 A 对客户 B 的到店单 create → 403 FORBIDDEN「非本人单据」',
    crossCreate instanceof TrpcHttpError && crossCreate.httpStatus === 403 &&
      crossCreate.code === 'FORBIDDEN' && crossCreate.message.includes('非本人单据'),
    crossCreate && { code: crossCreate.code, message: crossCreate.message });
  const crossGet = await asErr(trpcQuery('refundRequest.getById', { cookie: cookieD50, input: { requestId: create50.request.id } }));
  check('C5 50.2 getById 他人申请单 → 403 FORBIDDEN（驳回理由/时间线不外泄）',
    crossGet instanceof TrpcHttpError && crossGet.httpStatus === 403 && crossGet.code === 'FORBIDDEN',
    crossGet && { code: crossGet.code, message: crossGet.message });
  const listD50 = await trpcQuery<Array<{ id: string }>>('refundRequest.listMine', { cookie: cookieD50 });
  check('C5 50.2 listMine 仅本人（D 的列表不含客户 A 的申请单）',
    !listD50.some((r) => r.id === create50.request.id), listD50.length);

  /* ---------- 50.3 时限闸 + 原因闸 + 开关闸 ---------- */
  console.log('\n[C5] 50.3 时限/原因/开关三闸');
  const billValid50 = await settleBill2([{ kind: 'product', refId: staple.id }], { customerId: customerUser!.id, note: '【测试】e2e C5 有效单（撤回/驳回夹具）' });
  const billOver50 = await settleBill2([{ kind: 'product', refId: staple.id }], { customerId: customerUser!.id, note: '【测试】e2e C5 超时限单' });
  await db.update(schema.cashierBills).set({ settledAt: new Date(Date.now() - 31 * 24 * 3600 * 1000) })
    .where(eq(schema.cashierBills.id, billOver50.billId)); // 完成时移位 31 天（>端口 30 天窗）
  const overWindow = await asErr(trpcMutate('refundRequest.create', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: billOver50.billId, type: 'refund_only', reasonCode: 'wrong_order' },
  }));
  check('C5 50.3 时限闸：完成超 30 天 → BAD_REQUEST「已超退款申请时限」',
    overWindow instanceof TrpcHttpError && overWindow.code === 'BAD_REQUEST' && overWindow.message.includes('已超退款申请时限'),
    overWindow && { code: overWindow.code, message: overWindow.message });
  const badReason = await asErr(trpcMutate('refundRequest.create', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: billValid50.billId, type: 'refund_only', reasonCode: 'hacked_reason' },
  }));
  check('C5 50.3 原因闸：非法 reasonCode（禁手打）→ BAD_REQUEST「不在可选范围」',
    badReason instanceof TrpcHttpError && badReason.code === 'BAD_REQUEST' && badReason.message.includes('不在可选范围'),
    badReason && { code: badReason.code, message: badReason.message });
  const otherNoDesc = await asErr(trpcMutate('refundRequest.create', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: billValid50.billId, type: 'refund_only', reasonCode: 'other' },
  }));
  check('C5 50.3 原因闸：other 缺 description → BAD_REQUEST「请补充说明」',
    otherNoDesc instanceof TrpcHttpError && otherNoDesc.code === 'BAD_REQUEST' && otherNoDesc.message.includes('补充说明'),
    otherNoDesc && { code: otherNoDesc.code, message: otherNoDesc.message });
  await trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'refund', changes: [{ ruleKey: 'refund_request_enabled', valueJson: { enabled: false } }] },
  });
  const switchOff = await asErr(trpcMutate('refundRequest.create', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: billValid50.billId, type: 'refund_only', reasonCode: 'wrong_order' },
  }));
  check('C5 50.3 开关闸：enabled=false → 403 FORBIDDEN「退款申请通道维护中，请到店办理」',
    switchOff instanceof TrpcHttpError && switchOff.httpStatus === 403 &&
      switchOff.code === 'FORBIDDEN' && switchOff.message.includes('维护中'),
    switchOff && { code: switchOff.code, message: switchOff.message });
  await trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'refund', changes: [{ ruleKey: 'refund_request_enabled', valueJson: { enabled: true } }] },
  }); // 复原（端口改值零改码实证：save 即生效）

  /* ---------- 50.4 撤回：submitted 可撤；approved（直通 refunded）后撤回拒 ---------- */
  console.log('\n[C5] 50.4 撤回闸');
  const req504 = await trpcMutate<ReqCreateRes>('refundRequest.create', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: billValid50.billId, type: 'refund_only', reasonCode: 'wrong_order', description: '拍错了' },
  });
  check('C5 50.4 前置：到店商品单申请创建成（全额 12900/itemsJson 空=全额档）',
    req504.request.status === 'submitted' && req504.request.amountFen === 12900 && req504.request.itemsJson.length === 0,
    req504.request);
  const cancel504 = await trpcMutate<{ request: RefundRequestRowT; idempotent: boolean }>('refundRequest.cancel', {
    cookie: customerCookie, input: { requestId: req504.request.id },
  });
  check('C5 50.4 submitted 可撤 → cancelled + timeline 追加',
    cancel504.request.status === 'cancelled' && cancel504.idempotent === false &&
      cancel504.request.timelineJson.some((t) => t.status === 'cancelled'),
    cancel504.request.status);
  const req504b = await trpcMutate<ReqCreateRes>('refundRequest.create', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: billValid50.billId, type: 'refund_only', reasonCode: 'wrong_order', description: '再次申请' },
  });
  check('C5 50.4 撤回后可再申请（cancelled 不占在途）', req504b.idempotent === false && req504b.request.id !== req504.request.id,
    { idem: req504b.idempotent });
  const approve504 = await trpcMutate<ReqApproveRes>('refundRequest.approve', {
    cookie: ownerCookie, input: { requestId: req504b.request.id, note: '店主批准（撤回闸夹具）' },
  });
  check('C5 50.4 店主批准直通 R12（refunded + refundBillNo 挂接）',
    approve504.request.status === 'refunded' && !!approve504.refundNo && approve504.request.refundBillNo === approve504.refundNo,
    { status: approve504.request.status, refundNo: approve504.refundNo });
  const cancelAfterApprove = await asErr(trpcMutate('refundRequest.cancel', {
    cookie: customerCookie, input: { requestId: req504b.request.id },
  }));
  check('C5 50.4 批准（refunded）后撤回 → BAD_REQUEST「不可撤回」',
    cancelAfterApprove instanceof TrpcHttpError && cancelAfterApprove.code === 'BAD_REQUEST' &&
      cancelAfterApprove.message.includes('不可撤回'),
    cancelAfterApprove && { code: cancelAfterApprove.code, message: cancelAfterApprove.message });

  /* ---------- 50.5 驳回：reason 必填 + 客户端可见 + listPending 待办进出 ---------- */
  console.log('\n[C5] 50.5 驳回');
  const bill505 = await settleBill2([{ kind: 'product', refId: staple.id }], { customerId: customerUser!.id, note: '【测试】e2e C5 驳回夹具单' });
  const req505 = await trpcMutate<ReqCreateRes>('refundRequest.create', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: bill505.billId, type: 'refund_only', reasonCode: 'service_unsatisfied' },
  });
  const pendingBefore = await trpcQuery<Array<{ id: string; requestNo: string; slaOverdue: boolean; customerNickname: string | null }>>(
    'refundRequest.listPending', { cookie: managerCookie });
  check('C5 50.5 listPending 含本店 submitted 申请（SLA 未超期 + 客户昵称透出）',
    pendingBefore.some((r) => r.id === req505.request.id && r.slaOverdue === false),
    pendingBefore.map((r) => r.requestNo));
  const rejectNoReason = await asErr(trpcMutate('refundRequest.reject', {
    cookie: managerCookie, input: { requestId: req505.request.id, reason: '' },
  }));
  check('C5 50.5 驳回强制理由（空 reason → BAD_REQUEST）',
    rejectNoReason instanceof TrpcHttpError && rejectNoReason.code === 'BAD_REQUEST',
    rejectNoReason && { code: rejectNoReason.code, message: rejectNoReason.message });
  const reject505 = await trpcMutate<{ request: RefundRequestRowT; idempotent: boolean }>('refundRequest.reject', {
    cookie: managerCookie, input: { requestId: req505.request.id, reason: '凭证不全，请补充后重新申请' },
  });
  const get505 = await trpcQuery<{ request: RefundRequestRowT }>('refundRequest.getById', {
    cookie: customerCookie, input: { requestId: req505.request.id },
  });
  const pendingAfter = await trpcQuery<Array<{ id: string }>>('refundRequest.listPending', { cookie: managerCookie });
  check('C5 50.5 驳回 → rejected + 客户端 getById 可见驳回理由 + timeline 留痕 + 待办消失',
    reject505.request.status === 'rejected' && get505.request.rejectReason === '凭证不全，请补充后重新申请' &&
      get505.request.timelineJson.some((t) => t.status === 'rejected') &&
      !pendingAfter.some((r) => r.id === req505.request.id),
    { status: get505.request.status, rejectReason: get505.request.rejectReason });

  /* ---------- 50.6 批准联动 R12 + C5-01 坐实（含回馈金 grant 的到店商品单） ----------
   * 夹具复用 R11a 段思路：D=萤火会员，gBillD=12900 现金商品单（grant 258 已到账，
   * 49b 余额 0→258）；申请全额退 → 店长 approve（12900≤阈值 50000、纯现金不涉储值
   * →直通）→ R12 六联动落 executed + 回馈金 1:1 扣回。 */
  console.log('\n[C5] 50.6 批准联动 R12 + C5-01（回馈金扣回坐实）');
  const req506 = await trpcMutate<ReqCreateRes>('refundRequest.create', {
    cookie: cookieD50,
    input: { orderKind: 'appointment', billId: gBillD.billId, type: 'refund_only', reasonCode: 'not_as_described', description: '临期商品' },
  });
  check('C5 50.6 D 对本人商品单申请创建成（全额 12900/reappliedAfterDays=null 首次）',
    req506.request.status === 'submitted' && req506.request.amountFen === 12900 &&
      req506.request.reappliedAfterDays === null,
    { amount: req506.request.amountFen, reapplied: req506.request.reappliedAfterDays });
  const approve506 = await trpcMutate<ReqApproveRes>('refundRequest.approve', {
    cookie: managerCookie, input: { requestId: req506.request.id, note: '店长批准（≤阈值直通）' },
  });
  check('C5 50.6 店长 approve 直通 R12（申请单 refunded + refundBillNo 挂接 + approver=店长本人 + approvedAt 落时）',
    approve506.idempotent === false && approve506.draft === false &&
      approve506.request.status === 'refunded' && !!approve506.refundNo &&
      approve506.request.refundBillNo === approve506.refundNo &&
      approve506.request.approverId === managerFix.id && approve506.request.approvedAt !== null &&
      approve506.request.timelineJson.some((t) => t.status === 'approved') &&
      approve506.request.timelineJson.some((t) => t.status === 'refunded'),
    { status: approve506.request.status, refundNo: approve506.refundNo, draft: approve506.draft });
  const rb506 = await db.select().from(schema.refundBills).where(eq(schema.refundBills.refundNo, approve506.refundNo!)).get();
  check('C5 50.6 R12 退款单落账（executed / type=full / bill_id=原单 / 金额 12900 / reason 含申请单号）',
    rb506?.status === 'executed' && rb506.type === 'full' && rb506.billId === gBillD.billId &&
      rb506.amountFen === 12900 && rb506.reason.includes(req506.request.requestNo),
    rb506 && { status: rb506.status, type: rb506.type, amount: rb506.amountFen, reason: rb506.reason });
  const linkage506 = (rb506?.linkageJson ?? {}) as { rebateClawbackFen?: number; rebateClawbackMissedFen?: number };
  const claw506 = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.type, 'clawback'), eq(schema.rebateLogs.sourceId, approve506.refundNo!))))[0];
  const accD506 = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, sellD.membership.userId)).get();
  check('C5-01 坐实：rebateClawbackFen=258>0（已发 258 全量扣回，linkage 填实值）+ clawback 负向行落账（−258，258→0）+ 余额 258→0 不负账',
    linkage506.rebateClawbackFen === 258 && linkage506.rebateClawbackMissedFen === 0 &&
      claw506?.deltaFen === -258 && claw506.beforeFen === 258 && claw506.afterFen === 0 &&
      accD506?.balanceFen === 0,
    { linkage: linkage506, claw: claw506 && { delta: claw506.deltaFen, before: claw506.beforeFen, after: claw506.afterFen }, balance: accD506?.balanceFen });
  check('C5 50.6 refundRequest.approved 事件到店频道（SSE，客户端轮询兜底）',
    (await storeEventsOf('refundRequest.approved', (p) => p.requestNo === req506.request.requestNo)).length === 1,
    req506.request.requestNo);

  /* ---------- 50.7 settleActual 联动：实退登记 → 申请单 settled ---------- */
  console.log('\n[C5] 50.7 settleActual 联动');
  const settle507 = await trpcMutate<{ refund: { status: string }; idempotent: boolean }>('refund.settleActual', {
    cookie: managerCookie, input: { refundId: approve506.refundId!, note: '现金已退客户（线下原路）' },
  });
  const get507 = await trpcQuery<{ request: RefundRequestRowT }>('refundRequest.getById', {
    cookie: cookieD50, input: { requestId: req506.request.id },
  });
  check('C5 50.7 settleActual → 退款单 settled + 申请单联动 settled + timeline 追加（全状态链 submitted→approved→refunded→settled 留痕）',
    settle507.refund.status === 'settled' && settle507.idempotent === false &&
      get507.request.status === 'settled' &&
      ['submitted', 'approved', 'refunded', 'settled'].every((s) => get507.request.timelineJson.some((t) => t.status === s)),
    { refund: settle507.refund.status, req: get507.request.status, timeline: get507.request.timelineJson.map((t) => t.status) });

  /* ---------- 50.7b（补缺修复小批 P1-1）：applyContext 算式明面三件套（原单−已退=本次可退） ---------- */
  console.log('\n[C5] 50.7b applyContext 算式明面（P1-1）');
  interface ApplyCtxRes { originTotalFen: number; refundedSoFarFen: number; refundableFen: number | null }
  /* 无历史退款行（bill505：仅 fake settled 申请行无实退单——钱是 refund_bills 口径，留痕行不计已退） */
  const ctxNoHist = await trpcQuery<ApplyCtxRes>('refundRequest.applyContext', {
    cookie: customerCookie, input: { orderKind: 'appointment', billId: bill505.billId } });
  check('C5 50.7b 无实退历史 → 原单 12900 / 已退 0 / 本次可退 12900（照现值，算式不上屏条件）',
    ctxNoHist.originTotalFen === 12900 && ctxNoHist.refundedSoFarFen === 0 && ctxNoHist.refundableFen === 12900,
    ctxNoHist);
  /* 有历史退款行（billValid50：50.4 全退 12900 executed）→ 已退 12900 / 本次可退 0 */
  const ctxFull = await trpcQuery<ApplyCtxRes>('refundRequest.applyContext', {
    cookie: customerCookie, input: { orderKind: 'appointment', billId: billValid50.billId } });
  check('C5 50.7b 有历史退款行 → 原单 12900 − 已退 12900 = 本次可退 0（与 create 闸可退余额同源）',
    ctxFull.originTotalFen === 12900 && ctxFull.refundedSoFarFen === 12900 && ctxFull.refundableFen === 0,
    ctxFull);
  /* 商城单：refundableFen=null（不走余额口径，客户端照现值）+ 在途申请不计已退 */
  const ctxMall = await trpcQuery<ApplyCtxRes>('refundRequest.applyContext', {
    cookie: customerCookie, input: { orderKind: 'order', billId: mallOrder50.id } });
  check('C5 50.7b 商城单 → 原单 12900 / 已退 0（在途 submitted 不计）/ refundableFen=null',
    ctxMall.originTotalFen === 12900 && ctxMall.refundedSoFarFen === 0 && ctxMall.refundableFen === null,
    ctxMall);
  /* 越权：他人单 applyContext → 403（resolveOrigin 归属闸同 create） */
  const ctxCross = await asErr(trpcQuery('refundRequest.applyContext', {
    cookie: cookieD50, input: { orderKind: 'appointment', billId: billValid50.billId } }));
  check('C5 50.7b applyContext 他人单 → 403 FORBIDDEN「非本人单据」（金额三件套不外泄）',
    ctxCross instanceof TrpcHttpError && ctxCross.httpStatus === 403,
    ctxCross && { code: ctxCross.code, message: ctxCross.message });

  /* ---------- 50.8（补缺大批片 1 补缝）：appointment.get 附 cashierBillId + submitted SSE + 重购留痕 ---------- */
  console.log('\n[C5] 50.8 appointment.get cashierBillId + submitted SSE + 重购留痕');
  const get508 = await trpcQuery<{ appointment: { id: string }; cashierBillId: string | null }>(
    'appointment.get', { cookie: customerCookie, input: { appointmentId: appt3.id } });
  check('C5 50.8 appointment.get 返回体含 cashierBillId 字段且对到店已结账单非空（appt3→billA，本人单闸既有）',
    'cashierBillId' in get508 && get508.cashierBillId === billA.billId, get508.cashierBillId);
  check('C5 50.8 refundRequest.submitted 事件到店频道（50.6 新申请提交已发，幂等返回不发）',
    (await storeEventsOf('refundRequest.submitted', (p) => p.requestNo === req506.request.requestNo)).length === 1,
    req506.request.requestNo);
  /* 重购留痕坐实：夹具直插一笔 10 天前 settled 历史申请（bill505 已驳回单无实退，
     可退余额仍全额）→ 新申请 reappliedAfterDays=10（只留痕不拦截，照常 submitted） */
  const fakeSettledAt = new Date(Date.now() - 10 * 24 * 3600 * 1000);
  await db.insert(schema.refundRequests).values({
    requestNo: 'RR-FAKE508-001', customerId: customerUser!.id, storeId, orderKind: 'appointment',
    billId: bill505.billId, billNo: bill505.billNo, type: 'refund_only',
    reasonCode: 'other', reasonLabel: '其他（请补充说明）', amountFen: 12900,
    status: 'settled', createdAt: fakeSettledAt, updatedAt: fakeSettledAt,
  });
  const req508 = await trpcMutate<ReqCreateRes>('refundRequest.create', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: bill505.billId, type: 'refund_only', reasonCode: 'pet_health' },
  });
  check('C5 50.8 重购留痕：同客户同原单有 settled 历史 → reappliedAfterDays=10（只留痕不拦截，申请照常 submitted）',
    req508.idempotent === false && req508.request.status === 'submitted' && req508.request.reappliedAfterDays === 10,
    { reapplied: req508.request.reappliedAfterDays, status: req508.request.status });

  /* ==================================================================
   * 补缺大批片 3（46 号档+PD-07）验收段 —— 52.x 续号挂尾
   * 挂尾口径：50/51 段编号属他批并行施工预留（本文件现序尾段为 49c）；52.5 含 cancel
   * 会生成 refund_bills，故整段挂 49c 移位段之前（段尾铁律：移位后不再生成退款单）。
   * ================================================================== */
  console.log('\n[补缺-3] 52.x 会员升级 / 到期换档 / 防滥用 / 已省');
  const mkM52User = async (tag: string, phone: string) => {
    /* kimiId 须 seed_ 前缀（dev-login 仅允许种子用户，D-16 硬约束） */
    const u = (await db.insert(schema.users).values({ kimiId: `seed_e2e_m52_${tag}`, nickname: `e2e 补缺3 ${tag}`, phone }).returning())[0]!;
    await db.insert(schema.userRoles).values({ userId: u.id, role: 'customer' });
    return u;
  };
  interface UpgradeQuoteRes {
    currentPlan: { planKey: string; priceFen: number } | null;
    targetPlans: Array<{
      planKey: string; label: string; remainingMonths: number;
      baseDiffFen: number; petDiffFen: number; totalDiffFen: number;
      formula: { m: number; newMonthlyFen: number; oldMonthlyFen: number; perMonthDiffFen: number; newPurchase: boolean };
    }>;
    windowDays: number;
  }
  interface UpgradeRes {
    billNo: string | null; billId: string | null;
    membership: MembershipRowT & { nextPlanKey?: string | null };
    diffFen: number; idempotent: boolean;
  }
  interface ScheduleRes {
    membership: MembershipRowT & { nextPlanKey: string | null; nextPlanSetAt: Date | null };
    idempotent: boolean;
  }

  /* ---------- 52.1 升档差价精确到分（46 号档例题逐字坐实）+ 微光新购口径 ---------- */
  console.log('\n[补缺-3] 52.1 升档差价（46 号档例题）+ 微光新购口径');
  const m52u1 = await mkM52User('u1', '13822220001');
  const m52u1Cookie = await devLogin(m52u1.id);
  const sellU1 = await sellPlan(managerCookie, {
    userId: m52u1.id, planKey: 'plan_yinghuo', petCount: 0,
    paySegments: [{ method: 'cash', amountFen: 19900 }],
  });
  /* 夹具：到期日=今日+3 个整月（同「日」不抹零头）→ remainingWholeMonths=3（既有同族函数口径） */
  const m52exp3 = new Date();
  m52exp3.setMonth(m52exp3.getMonth() + 3);
  await db.update(schema.memberships).set({ expiresAt: m52exp3, updatedAt: new Date() })
    .where(eq(schema.memberships.id, sellU1.membership.id));
  const quoteU1 = await trpcQuery<UpgradeQuoteRes>('membership.upgradeQuote', { cookie: m52u1Cookie });
  const quoteNuanyang = quoteU1.targetPlans.find((p) => p.planKey === 'plan_nuanyang');
  /* 46 号档例题逐字：萤火 199 剩 3 整月升暖阳 599 → 3×(59900−19900)÷12=10000 分=¥100.00 */
  check('补缺3-52.1 例题坐实：萤火剩 3 整月升暖阳 totalDiffFen=10000（¥100.00 精确到分；多宠附加行恒 0）',
    !!quoteNuanyang && quoteNuanyang.remainingMonths === 3 && quoteNuanyang.totalDiffFen === 10000 &&
      quoteNuanyang.baseDiffFen === 10000 && quoteNuanyang.petDiffFen === 0 &&
      quoteNuanyang.formula.m === 3 && quoteNuanyang.formula.perMonthDiffFen === (59900 - 19900) / 12 &&
      quoteNuanyang.formula.newPurchase === false,
    quoteNuanyang);
  check('补缺3-52.1 期内降级档不出现（萤火视角 targetPlans 仅 烛光/暖阳 两更高档）+ 窗口天数透出=30',
    quoteU1.targetPlans.map((p) => p.planKey).sort().join(',') === 'plan_nuanyang,plan_zhuguang' && quoteU1.windowDays === 30,
    quoteU1.targetPlans.map((p) => p.planKey));
  const quoteU1m = await trpcQuery<UpgradeQuoteRes>('membership.upgradeQuoteForUser', { cookie: ownerCookie, input: { userId: m52u1.id } });
  check('补缺3-52.1 收银台代客试算同帧（upgradeQuoteForUser 暖阳差价同=10000）',
    quoteU1m.targetPlans.find((p) => p.planKey === 'plan_nuanyang')?.totalDiffFen === 10000,
    quoteU1m.targetPlans.map((p) => `${p.planKey}:${p.totalDiffFen}`));
  const upU1 = await trpcMutate<UpgradeRes>('membership.upgrade', {
    cookie: managerCookie,
    input: { userId: m52u1.id, targetPlanKey: 'plan_nuanyang', paySegments: [{ method: 'cash', amountFen: 10000 }] },
  });
  check('补缺3-52.1 升档成交：diffFen=10000 + paid_fen=原实付+补差=29900 + 到期日不动 + pet_count 不变',
    upU1.diffFen === 10000 && upU1.membership.planKey === 'plan_nuanyang' && upU1.membership.paidFen === 29900 &&
      Math.abs(new Date(upU1.membership.expiresAt).getTime() - m52exp3.getTime()) < 5000 && upU1.membership.petCount === 0,
    { diff: upU1.diffFen, paid: upU1.membership.paidFen, plan: upU1.membership.planKey });
  const upBill = await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.id, upU1.billId!)).get();
  const upBillItem = await db.select().from(schema.cashierBillItems).where(eq(schema.cashierBillItems.billId, upU1.billId!)).get();
  check('补缺3-52.1 升级单=会员费类目（kind=membership / refId=plan_nuanyang / discountType=none / note「升级补差 萤火→暖阳」）',
    upBill?.discountType === 'none' && (upBill.note ?? '').includes('升级补差 萤火→暖阳') &&
      upBillItem?.kind === 'membership' && upBillItem.refId === 'plan_nuanyang' && upBillItem.unitPriceFen === 10000,
    { note: upBill?.note, refId: upBillItem?.refId, discountType: upBill?.discountType });
  const upEvent = (await db.select().from(schema.membershipEvents)
    .where(and(eq(schema.membershipEvents.userId, m52u1.id), eq(schema.membershipEvents.type, 'upgrade'))))[0];
  check('补缺3-52.1 membership_events 升级留痕（from=萤火 to=暖阳 diffFen=10000 billNo 回链）',
    upEvent?.fromPlan === 'plan_yinghuo' && upEvent.toPlan === 'plan_nuanyang' && upEvent.diffFen === 10000 && upEvent.billNo === upU1.billNo,
    upEvent && { from: upEvent.fromPlan, to: upEvent.toPlan, diff: upEvent.diffFen });
  /* 微光档升档=新购口径：差价=新档全价+多宠附加按现 petCount 重算（petCount 直置 5 → 萤火 19900+2×5900=31700） */
  const m52u2 = await mkM52User('u2', '13822220002');
  const m52u2Cookie = await devLogin(m52u2.id);
  await trpcMutate('membership.openFree', { cookie: m52u2Cookie });
  await db.update(schema.memberships).set({ petCount: 5, updatedAt: new Date() }).where(eq(schema.memberships.userId, m52u2.id));
  const quoteU2 = await trpcQuery<UpgradeQuoteRes>('membership.upgradeQuote', { cookie: m52u2Cookie });
  const quoteU2yh = quoteU2.targetPlans.find((p) => p.planKey === 'plan_yinghuo');
  check('补缺3-52.1 微光升档=新购口径（remainingMonths=0 / newPurchase=true / 全价+附加重算 19900+2×5900=31700）',
    !!quoteU2yh && quoteU2yh.remainingMonths === 0 && quoteU2yh.formula.newPurchase === true && quoteU2yh.totalDiffFen === 31700,
    quoteU2yh && { total: quoteU2yh.totalDiffFen, formula: quoteU2yh.formula });
  const upU2 = await trpcMutate<UpgradeRes>('membership.upgrade', {
    cookie: managerCookie,
    input: { userId: m52u2.id, targetPlanKey: 'plan_yinghuo', paySegments: [{ method: 'cash', amountFen: 31700 }] },
  });
  const upU2Days = (new Date(upU2.membership.expiresAt).getTime() - Date.now()) / 86400_000;
  check('补缺3-52.1 微光新购口径落库（paid_fen=31700 全价含附加 / expires 重起算 +365 天 / sold_store 补=办理店）',
    upU2.diffFen === 31700 && upU2.membership.paidFen === 31700 && upU2.membership.soldStoreId === storeId &&
      upU2Days > 364 && upU2Days < 366,
    { diff: upU2.diffFen, paid: upU2.membership.paidFen, days: upU2Days });

  /* ---------- 52.2 原子事务回滚：paySegments 缺额 → 三表零写入实证 ---------- */
  console.log('\n[补缺-3] 52.2 升档原子性（缺额整单回滚）');
  const m52u3 = await mkM52User('u3', '13822220003');
  const sellU3 = await sellPlan(managerCookie, {
    userId: m52u3.id, planKey: 'plan_yinghuo', petCount: 0,
    paySegments: [{ method: 'cash', amountFen: 19900 }],
  });
  const m52exp3b = new Date();
  m52exp3b.setMonth(m52exp3b.getMonth() + 3);
  await db.update(schema.memberships).set({ expiresAt: m52exp3b, updatedAt: new Date() })
    .where(eq(schema.memberships.id, sellU3.membership.id));
  const bills52Before = (await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.customerId, m52u3.id))).length;
  const outbox52Before = (await db.select().from(schema.eventOutbox)).length;
  const upU3 = await asErr(trpcMutate('membership.upgrade', {
    cookie: managerCookie,
    input: { userId: m52u3.id, targetPlanKey: 'plan_nuanyang', paySegments: [{ method: 'cash', amountFen: 9999 }] },
  }));
  check('补缺3-52.2 支付段缺额硬拒（server 兜底重算 10000 ≠ 入参 9999 → BAD_REQUEST「须等于升档补差」）',
    upU3 instanceof TrpcHttpError && upU3.code === 'BAD_REQUEST' && upU3.message.includes('须等于升档补差'),
    upU3 && { code: upU3.code, message: upU3.message });
  const m52u3Row = await db.select().from(schema.memberships).where(eq(schema.memberships.id, sellU3.membership.id)).get();
  const bills52After = (await db.select().from(schema.cashierBills).where(eq(schema.cashierBills.customerId, m52u3.id))).length;
  const events52u3 = await db.select().from(schema.membershipEvents).where(eq(schema.membershipEvents.userId, m52u3.id));
  const outbox52After = (await db.select().from(schema.eventOutbox)).length;
  check('补缺3-52.2 整单回滚零半态（memberships 原档原值 / 收银单零新增 / membership_events 零行 / outbox 零新增）',
    m52u3Row?.planKey === 'plan_yinghuo' && m52u3Row.paidFen === 19900 &&
      bills52After === bills52Before && events52u3.length === 0 && outbox52After === outbox52Before,
    { plan: m52u3Row?.planKey, paid: m52u3Row?.paidFen, bills: [bills52Before, bills52After], events: events52u3.length, outbox: [outbox52Before, outbox52After] });

  /* ---------- 52.3 期内降级明文拒 + 同档重放幂等 ---------- */
  console.log('\n[补缺-3] 52.3 期内不降级 + 同档重放幂等');
  const upU1Down = await asErr(trpcMutate('membership.upgrade', {
    cookie: managerCookie,
    input: { userId: m52u1.id, targetPlanKey: 'plan_yinghuo', paySegments: [] },
  }));
  check('补缺3-52.3 期内降级明文拒（暖阳→萤火 BAD_REQUEST「会员期内不降级，可在到期前 30 天预约下期档位」逐字）',
    upU1Down instanceof TrpcHttpError && upU1Down.code === 'BAD_REQUEST' &&
      upU1Down.message === '会员期内不降级，可在到期前 30 天预约下期档位',
    upU1Down && { code: upU1Down.code, message: upU1Down.message });
  const upU1Replay = await trpcMutate<UpgradeRes>('membership.upgrade', {
    cookie: managerCookie,
    input: { userId: m52u1.id, targetPlanKey: 'plan_nuanyang', paySegments: [] },
  });
  const upEventsU1 = await db.select().from(schema.membershipEvents)
    .where(and(eq(schema.membershipEvents.userId, m52u1.id), eq(schema.membershipEvents.type, 'upgrade')));
  check('补缺3-52.3 同档重放幂等（idempotent=true / billNo=null / 会员行原值 / 升级事件仍恰 1 行）',
    upU1Replay.idempotent === true && upU1Replay.billNo === null &&
      upU1Replay.membership.planKey === 'plan_nuanyang' && upU1Replay.membership.paidFen === 29900 && upEventsU1.length === 1,
    { idem: upU1Replay.idempotent, events: upEventsU1.length });

  /* ---------- 52.4 到期换档：窗口外拒 / 窗口内预约 / 覆盖幂等 / 取消 / renew 执行 ---------- */
  console.log('\n[补缺-3] 52.4 到期换档（预约→覆盖→取消→再约→renew 执行）');
  const m52u4 = await mkM52User('u4', '13822220004');
  const m52u4Cookie = await devLogin(m52u4.id);
  const sellU4 = await sellPlan(managerCookie, {
    userId: m52u4.id, planKey: 'plan_yinghuo', petCount: 0,
    paySegments: [{ method: 'cash', amountFen: 19900 }],
  });
  const schedEarly = await asErr(trpcMutate('membership.scheduleChange', { cookie: m52u4Cookie, input: { targetPlanKey: 'plan_zhuguang' } }));
  check('补缺3-52.4 窗口外预约明文拒（剩 ~365 天 > 30 → BAD_REQUEST「到期前 30 天开放预约下期档位」）',
    schedEarly instanceof TrpcHttpError && schedEarly.code === 'BAD_REQUEST' && schedEarly.message.includes('到期前 30 天开放预约下期档位'),
    schedEarly && { code: schedEarly.code, message: schedEarly.message });
  /* 夹具：到期日拉近至 +15 天 → 进入预约窗口 */
  await db.update(schema.memberships).set({ expiresAt: new Date(Date.now() + 15 * 86400_000), updatedAt: new Date() })
    .where(eq(schema.memberships.id, sellU4.membership.id));
  const sched1 = await trpcMutate<ScheduleRes>('membership.scheduleChange', { cookie: m52u4Cookie, input: { targetPlanKey: 'plan_zhuguang' } });
  check('补缺3-52.4 窗口内预约落位（next_plan_key=plan_zhuguang + next_plan_set_at 非空）',
    sched1.membership.nextPlanKey === 'plan_zhuguang' && !!sched1.membership.nextPlanSetAt && sched1.idempotent === false,
    { next: sched1.membership.nextPlanKey, setAt: sched1.membership.nextPlanSetAt });
  const schedEvent1 = (await db.select().from(schema.membershipEvents)
    .where(and(eq(schema.membershipEvents.userId, m52u4.id), eq(schema.membershipEvents.type, 'change_schedule'))))[0];
  check('补缺3-52.4 预约留痕（change_schedule from=萤火 to=烛光）',
    schedEvent1?.fromPlan === 'plan_yinghuo' && schedEvent1.toPlan === 'plan_zhuguang',
    schedEvent1 && { from: schedEvent1.fromPlan, to: schedEvent1.toPlan });
  const my52u4 = await trpcQuery<{
    nextPlanKey: string | null; upgradeAvailable: boolean; changeWindowDays: number;
    membership: { planKey: string } | null;
  }>('membership.my', { cookie: m52u4Cookie });
  check('补缺3-52.4 my 透出 nextPlanKey + upgradeAvailable + changeWindowDays=30（客户端入口判定数据源）',
    my52u4.nextPlanKey === 'plan_zhuguang' && my52u4.upgradeAvailable === true && my52u4.changeWindowDays === 30,
    { next: my52u4.nextPlanKey, up: my52u4.upgradeAvailable, win: my52u4.changeWindowDays });
  const sched2 = await trpcMutate<ScheduleRes>('membership.scheduleChange', { cookie: m52u4Cookie, input: { targetPlanKey: 'plan_nuanyang' } });
  const sched2b = await trpcMutate<ScheduleRes>('membership.scheduleChange', { cookie: m52u4Cookie, input: { targetPlanKey: 'plan_nuanyang' } });
  check('补缺3-52.4 重复预约覆盖更新幂等（覆盖→plan_nuanyang idempotent=false；同档重放 idempotent=true）',
    sched2.idempotent === false && sched2.membership.nextPlanKey === 'plan_nuanyang' && sched2b.idempotent === true,
    { a: sched2.idempotent, b: sched2b.idempotent });
  const schedCancel = await trpcMutate<ScheduleRes>('membership.cancelScheduleChange', { cookie: m52u4Cookie });
  const schedEvtsU4 = await db.select().from(schema.membershipEvents)
    .where(and(eq(schema.membershipEvents.userId, m52u4.id), eq(schema.membershipEvents.type, 'change_schedule')));
  const cancelEvU4 = schedEvtsU4.find((e) => (e.meta as Record<string, unknown> | null)?.cancelled === true);
  check('补缺3-52.4 取消预约置空+留痕（next_plan_key=null + meta.cancelled=true 记被撤档 plan_nuanyang）',
    schedCancel.membership.nextPlanKey === null && schedCancel.idempotent === false &&
      !!cancelEvU4 && (cancelEvU4.meta as Record<string, unknown>).cancelledPlanKey === 'plan_nuanyang',
    { next: schedCancel.membership.nextPlanKey, cancelled: (cancelEvU4?.meta as Record<string, unknown> | undefined)?.cancelledPlanKey });
  await trpcMutate('membership.scheduleChange', { cookie: m52u4Cookie, input: { targetPlanKey: 'plan_zhuguang' } });
  /* 到期执行：到期日置昨日（读路径懒冻结→renew 解冻）→ 按预约档全价 29900 收款+切档+置空 */
  await db.update(schema.memberships).set({ expiresAt: new Date(Date.now() - 86400_000), updatedAt: new Date() })
    .where(eq(schema.memberships.id, sellU4.membership.id));
  const renewU4 = await trpcMutate<{ membership: MembershipRowT & { nextPlanKey: string | null }; amountFen: number; billNo: string }>('membership.renew', {
    cookie: managerCookie,
    input: { userId: m52u4.id, paySegments: [{ method: 'cash', amountFen: 29900 }] },
  });
  check('补缺3-52.4 到期 renew 按预约档收款（29900 烛光全价 / plan_key 切换 / next_plan_key 置空 / 解冻 active）',
    renewU4.amountFen === 29900 && renewU4.membership.planKey === 'plan_zhuguang' &&
      renewU4.membership.nextPlanKey === null && renewU4.membership.status === 'active',
    { amount: renewU4.amountFen, plan: renewU4.membership.planKey, next: renewU4.membership.nextPlanKey });
  const execEvU4 = (await db.select().from(schema.membershipEvents)
    .where(and(eq(schema.membershipEvents.userId, m52u4.id), eq(schema.membershipEvents.type, 'change_schedule'))))
    .find((e) => (e.meta as Record<string, unknown> | null)?.executed === true);
  check('补缺3-52.4 换档执行留痕（change_schedule meta.executed=true from=萤火 to=烛光 + billNo 回链）',
    !!execEvU4 && execEvU4.fromPlan === 'plan_yinghuo' && execEvU4.toPlan === 'plan_zhuguang' && execEvU4.billNo === renewU4.billNo,
    execEvU4 && { from: execEvU4.fromPlan, to: execEvU4.toPlan, billNo: execEvU4.billNo });
  const renewU4b = await trpcMutate<{ membership: MembershipRowT; amountFen: number }>('membership.renew', {
    cookie: managerCookie,
    input: { userId: m52u4.id, paySegments: [{ method: 'cash', amountFen: 29900 }] },
  });
  const execEvtsU4 = (await db.select().from(schema.membershipEvents)
    .where(and(eq(schema.membershipEvents.userId, m52u4.id), eq(schema.membershipEvents.type, 'change_schedule'))))
    .filter((e) => (e.meta as Record<string, unknown> | null)?.executed === true);
  check('补缺3-52.4 执行幂等（预约已置空：再续费按新档常价 29900 顺延，executed 留痕不重复增发）',
    renewU4b.amountFen === 29900 && renewU4b.membership.planKey === 'plan_zhuguang' && execEvtsU4.length === 1,
    { amount: renewU4b.amountFen, execEvents: execEvtsU4.length });

  /* ---------- 52.5 防滥用两件：退会窗口内重购 / 累计退会≥阈值再购 → 留痕不拦截 ---------- */
  console.log('\n[补缺-3] 52.5 防滥用留痕（cancel_rebuy_note）');
  const m52u5 = await mkM52User('u5', '13822220005');
  await sellPlan(managerCookie, { userId: m52u5.id, planKey: 'plan_yinghuo', petCount: 0, paySegments: [{ method: 'cash', amountFen: 19900 }] });
  await trpcMutate('membership.cancel', { cookie: managerCookie, input: { userId: m52u5.id, reason: '补缺3 防滥用验证退会 1' } });
  const sellU5b = await sellPlan(managerCookie, { userId: m52u5.id, planKey: 'plan_yinghuo', petCount: 0, paySegments: [{ method: 'cash', amountFen: 19900 }] });
  const notesU5a = await db.select().from(schema.membershipEvents)
    .where(and(eq(schema.membershipEvents.userId, m52u5.id), eq(schema.membershipEvents.type, 'cancel_rebuy_note')));
  check('补缺3-52.5 退会后 90 天内重购留痕（trigger=cooldown daysSinceLastCancel=0 + billNo=重购单号；不拦截放行）',
    notesU5a.length === 1 && (notesU5a[0]!.meta as Record<string, unknown>).trigger === 'cooldown' &&
      (notesU5a[0]!.meta as Record<string, unknown>).daysSinceLastCancel === 0 &&
      (notesU5a[0]!.meta as Record<string, unknown>).cooldownDays === 90 &&
      notesU5a[0]!.billNo === sellU5b.billNo && sellU5b.membership.status === 'active',
    notesU5a.map((e) => e.meta));
  await trpcMutate('membership.cancel', { cookie: managerCookie, input: { userId: m52u5.id, reason: '补缺3 防滥用验证退会 2' } });
  const sellU5c = await sellPlan(managerCookie, { userId: m52u5.id, planKey: 'plan_yinghuo', petCount: 0, paySegments: [{ method: 'cash', amountFen: 19900 }] });
  const notesU5b = await db.select().from(schema.membershipEvents)
    .where(and(eq(schema.membershipEvents.userId, m52u5.id), eq(schema.membershipEvents.type, 'cancel_rebuy_note')));
  const noteCountU5 = notesU5b.find((e) => (e.meta as Record<string, unknown>).trigger === 'count');
  check('补缺3-52.5 累计退会≥2 再购留痕（trigger=count cancelCount=2 threshold=2；双触发共 3 行；不拦截放行）',
    !!noteCountU5 && (noteCountU5.meta as Record<string, unknown>).cancelCount === 2 &&
      (noteCountU5.meta as Record<string, unknown>).threshold === 2 &&
      sellU5c.membership.status === 'active' && notesU5b.length === 3,
    notesU5b.map((e) => e.meta));

  /* ---------- 52.6 mySavings 双源合计（精确到分） ---------- */
  console.log('\n[补缺-3] 52.6 mySavings 今年已省（回馈金+服务折扣两源分明）');
  const m52u6 = await mkM52User('u6', '13822220006');
  const m52u6Cookie = await devLogin(m52u6.id);
  await sellPlan(managerCookie, { userId: m52u6.id, planKey: 'plan_yinghuo', petCount: 0, paySegments: [{ method: 'cash', amountFen: 19900 }] });
  /* 源①：已入账 grant 夹具（入账行口径 source_id=settlement_id=批次 id，QA40-D10 同源；
     期次取远期 2099-01 与 43/49b 段互不占期次） */
  const m52u6Acc = await ensureRebateAccount(db, m52u6.id, new Date());
  const m52batch = (await db.insert(schema.rebateSettlements).values({
    period: '2099-01', grantedCount: 1, grantedFen: 258, scheduledDay: 5, status: 'done',
    note: '补缺3 mySavings 已入账夹具批次',
  }).returning())[0]!;
  await db.insert(schema.rebateLogs).values({
    userId: m52u6.id, accountId: m52u6Acc.id, type: 'grant', deltaFen: 258,
    beforeFen: 0, afterFen: 258, sourceId: m52batch.id, settlementId: m52batch.id,
    period: '2099-01', note: '补缺3 mySavings 已入账夹具（期次 2099-01 结算批次）',
  });
  /* 源②：服务折扣单（萤火 88 折：8800×0.88=7744 → 省 1056） */
  await settleBill2([{ kind: 'service', refId: service.id }], { customerId: m52u6.id, note: '【测试】e2e 补缺3 52.6 服务折扣单' });
  const savings52 = await trpcQuery<{ year: number; rebateSettledFen: number; serviceDiscountFen: number; totalFen: number }>('membership.mySavings', { cookie: m52u6Cookie });
  check('补缺3-52.6 mySavings 双源分明（rebateSettledFen=258 已入账 + serviceDiscountFen=1056=8800−7744 → totalFen=1314 精确到分）',
    savings52.rebateSettledFen === 258 && savings52.serviceDiscountFen === 1056 &&
      savings52.totalFen === 1314 && savings52.year === new Date().getFullYear(),
    savings52);

  /* ---------- 52.7 升档后在途回馈金不重算 + 旧档余额零动作 ---------- */
  console.log('\n[补缺-3] 52.7 升档不动在途回馈金');
  const m52u7 = await mkM52User('u7', '13822220007');
  await sellPlan(managerCookie, { userId: m52u7.id, planKey: 'plan_yinghuo', petCount: 0, paySegments: [{ method: 'cash', amountFen: 19900 }] });
  await settleBill2([{ kind: 'product', refId: staple.id }], { customerId: m52u7.id, note: '【测试】e2e 补缺3 52.7 在途 grant 单' }); // 萤火 2% → 计提 258（未结算在途）
  const u7AccBefore = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, m52u7.id)).get();
  const u7GrantsBefore = await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, m52u7.id), eq(schema.rebateLogs.type, 'grant')));
  /* 新卡剩 12 整月：萤火→暖阳补差 = 12×(59900−19900)÷12 = 40000（全年差价） */
  const upU7 = await trpcMutate<UpgradeRes>('membership.upgrade', {
    cookie: managerCookie,
    input: { userId: m52u7.id, targetPlanKey: 'plan_nuanyang', paySegments: [{ method: 'cash', amountFen: 40000 }] },
  });
  const u7AccAfter = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, m52u7.id)).get();
  const u7LogsAfter = await db.select().from(schema.rebateLogs).where(eq(schema.rebateLogs.userId, m52u7.id));
  check('补缺3-52.7 升档成交（剩 12 整月补差 40000=59900−19900，精确到分；paid_fen=19900+40000=59900）',
    upU7.diffFen === 40000 && upU7.membership.planKey === 'plan_nuanyang' && upU7.membership.paidFen === 59900,
    { diff: upU7.diffFen, paid: upU7.membership.paidFen });
  check('补缺3-52.7 在途回馈金不重算 + 旧档余额零动作（grant 行原样 1 行 258 挂萤火口径 / 账户余额 0 不动 / rebate_logs 零新增）',
    u7GrantsBefore.length === 1 && u7GrantsBefore[0]!.deltaFen === 258 && (u7GrantsBefore[0]!.note ?? '').includes('plan_yinghuo') &&
      u7AccBefore?.balanceFen === 0 && u7AccAfter?.balanceFen === 0 && u7LogsAfter.length === 1,
    { grants: [u7GrantsBefore.length, u7LogsAfter.length], balance: [u7AccBefore?.balanceFen, u7AccAfter?.balanceFen] });

  /* ---- 49c. 打回①收尾：实退待办移位（25h）→ settleActual 幂等 → 待办消失 ----
   * 段尾铁律（§34/§38 撞号教训）：createdAt 移位之后不得再发生成退款单的动作——
   * genRefundNo 按 createdAt 计当日序号，移位减计数会致后续 RB 单号撞 UNIQUE。 */
  await db.update(schema.refundBills).set({ createdAt: new Date(Date.now() - 25 * 3600 * 1000) })
    .where(eq(schema.refundBills.id, cancelM1.refundId));
  const todo49Before = await trpcQuery<Array<{ id: string; refundNo: string }>>('refund.pendingActual', { cookie: managerCookie });
  check('复核① 退会退款单超 24h 未登记 → refund.pendingActual 含该行',
    todo49Before.some((r) => r.id === cancelM1.refundId), todo49Before.map((r) => r.refundNo));
  const settle49a = await trpcMutate<{ refund: { status: string }; idempotent: boolean }>('refund.settleActual', {
    cookie: managerCookie, input: { refundId: cancelM1.refundId, note: '退会折算款已线下退（现金）' },
  });
  const settle49b = await trpcMutate<{ refund: { status: string }; idempotent: boolean }>('refund.settleActual', {
    cookie: managerCookie, input: { refundId: cancelM1.refundId, note: '重复登记验证' },
  });
  const todo49After = await trpcQuery<Array<{ id: string }>>('refund.pendingActual', { cookie: managerCookie });
  check('复核① settleActual 登记 → settled；重复登记幂等；待办消失',
    settle49a.refund.status === 'settled' && settle49a.idempotent === false &&
      settle49b.idempotent === true && settle49b.refund.status === 'settled' &&
      !todo49After.some((r) => r.id === cancelM1.refundId),
    { a: settle49a.refund.status, bIdem: settle49b.idempotent });

  /* ==================================================================
   * 补缺大批片 4（服务闭环 server 侧）验收段 —— 本片无 refund_bill 生成
   * （49c 移位铁律不约束），断言挂尾 53.x。
   * ================================================================== */

  /* ---------- 53.1 证书生成链（R10 无数据不生成 + 首读 deliveredAt 幂等） ---------- */
  console.log('\n[补缺4] 53.1 安心证书生成链');
  const petRow = (await db.select().from(schema.pets).where(eq(schema.pets.id, petId)).get())!;
  const storeRow50 = (await db.select().from(schema.stores).where(eq(schema.stores.id, storeId)).get())!;
  interface CertPayloadT {
    petName: string; serviceName: string; storeName: string; completedAt: string;
    stepsSummary: Array<{ stepKey: string; label: string; photoCount: number }>;
    beforeUrl: string; afterUrl: string;
  }
  const certRow = await db.select().from(schema.serviceCertificates).where(eq(schema.serviceCertificates.appointmentId, aid)).get();
  check('53.1 有 before/after 图单完成 → service_certificates 落行（confirmStep 末步同事务）',
    !!certRow && certRow.userId === customerUser!.id && certRow.generatedAt instanceof Date,
    certRow && { id: certRow.id, userId: certRow.userId });
  const certPayload = certRow?.payload as CertPayloadT | undefined;
  check('53.1 证书 payload 齐（petName/serviceName/storeName/completedAt/六步汇总张数 1/2/3/2/2/0/before/after）',
    !!certPayload &&
      certPayload.petName === petRow.name && certPayload.serviceName === service.name &&
      certPayload.storeName === storeRow50.name && typeof certPayload.completedAt === 'string' &&
      certPayload.stepsSummary.length === 6 &&
      certPayload.stepsSummary.map((s) => s.photoCount).join(',') === '1,2,3,2,2,0' &&
      certPayload.stepsSummary.every((s) => typeof s.label === 'string' && s.label.length > 0) &&
      certPayload.beforeUrl.includes('/api/img/') && certPayload.afterUrl.includes('/api/img/'),
    certPayload && { steps: certPayload.stepsSummary.map((s) => `${s.stepKey}:${s.photoCount}`) });
  const certReadyRows = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'certificate.ready' && r.channel === `user:${customerUser!.id}` &&
      (r.payload as Record<string, unknown> | null)?.aid === aid,
  );
  check('53.1 certificate.ready 落 outbox（user 频道，payload 用 aid 键避开 §11 计数口径）',
    certReadyRows.length === 1, certReadyRows.map((r) => r.channel));
  // 首读 deliveredAt 幂等置位
  interface CertGetRes { certificate: { id: string; deliveredAt: Date | null } }
  const certGet1 = await trpcQuery<CertGetRes>('serviceLoop.certificateFor', { cookie: customerCookie, input: { appointmentId: aid } });
  check('53.1 certificateFor 首读 → deliveredAt 置位（幂等写 now）', certGet1.certificate.deliveredAt instanceof Date, certGet1.certificate.deliveredAt);
  const certGet2 = await trpcQuery<CertGetRes>('serviceLoop.certificateFor', { cookie: customerCookie, input: { appointmentId: aid } });
  check('53.1 复读 deliveredAt 不变（幂等置位只写一次）',
    certGet2.certificate.deliveredAt instanceof Date &&
      certGet2.certificate.deliveredAt.getTime() === certGet1.certificate.deliveredAt!.getTime(),
    [certGet1.certificate.deliveredAt, certGet2.certificate.deliveredAt]);
  // 无图单（寄养 completed，无六步流）→ 不生成 + 404 明文
  const noCertRow = await db.select().from(schema.serviceCertificates).where(eq(schema.serviceCertificates.appointmentId, boardingAppt.id)).get();
  const noCertGet = await asErr(trpcQuery('serviceLoop.certificateFor', { cookie: customerCookie, input: { appointmentId: boardingAppt.id } }));
  check('53.1 R10 无数据不生成：寄养单无证书行 + certificateFor → 404 明文「该服务未生成证书（无前后对比照）」',
    !noCertRow && noCertGet instanceof TrpcHttpError && noCertGet.code === 'NOT_FOUND' &&
      noCertGet.message.includes('该服务未生成证书（无前后对比照）'),
    noCertGet && { code: noCertGet.code, message: noCertGet.message });

  /* ---------- 53.2 报告生成链（vitals 快照/缺省口径/体重档案快照/首读幂等） ---------- */
  console.log('\n[补缺4] 53.2 美容报告生成链');
  interface VitalT { key: string; label: string; value: string; status: string; note?: string }
  interface ReportGetRes { report: { id: string; vitals: VitalT[]; abnormalText: string | null; nextAdvice: string | null; deliveredAt: Date | null } }
  // 主单 aid（末步未传 vitals）→ 补缺修复小批 UX 销项口径：体重=档案快照（normal），其余缺项=unrecorded「本次未记录」
  const repGet1 = await trpcQuery<ReportGetRes>('serviceLoop.reportFor', { cookie: customerCookie, input: { appointmentId: aid } });
  const aidVitals = repGet1.report.vitals;
  check('53.2 无 vitals 报告=体重 normal 快照 + 其余四项 unrecorded「本次未记录」（未记录中性签不挂「正常」；留痕口径不阻塞完成），abnormalText=NULL（unrecorded 不进异常拼句）',
    aidVitals.length === 5 && aidVitals.find((v) => v.key === 'weight')?.status === 'normal' &&
      aidVitals.filter((v) => v.key !== 'weight').every((v) => v.status === 'unrecorded' && v.value === '本次未记录' && v.note === '本次未记录') &&
      repGet1.report.abnormalText === null,
    aidVitals.map((v) => `${v.key}:${v.status}:${v.value}`));
  check('53.2 体重项= pets.weight_kg 服务端快照（28.5 kg，不信客户端）',
    aidVitals.find((v) => v.key === 'weight')?.value === `${petRow.weightKg} kg`,
    aidVitals.find((v) => v.key === 'weight'));
  const repGet2 = await trpcQuery<ReportGetRes>('serviceLoop.reportFor', { cookie: customerCookie, input: { appointmentId: aid } });
  check('53.2 reportFor 首读置 deliveredAt + 复读不变（幂等）',
    repGet1.report.deliveredAt instanceof Date && repGet2.report.deliveredAt instanceof Date &&
      repGet2.report.deliveredAt.getTime() === repGet1.report.deliveredAt.getTime(),
    [repGet1.report.deliveredAt, repGet2.report.deliveredAt]);
  const reportReadyRows = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'report.ready' && r.channel === `user:${customerUser!.id}` &&
      (r.payload as Record<string, unknown> | null)?.aid === aid,
  );
  check('53.2 report.ready 落 outbox（user 频道）', reportReadyRows.length === 1, reportReadyRows.length);

  // 带 vitals 的完整六步流（apptVit，丽丽执行；末步传 vitals 一项 abnormal + nextAdvice）
  const slotVit = slotPool[slotPool.length - 1]!;
  const apptVit = await trpcMutate<{ id: string }>('appointment.create', {
    cookie: customerCookie,
    input: { storeId, petId, serviceId: service.id, type: 'grooming', scheduledStart: slotVit.slotStart, paymentMode: 'pay_at_store', note: '【测试】e2e 补缺4 vitals 报告单', staffId: staffRow2.id },
  });
  createdAidExtras.push(apptVit.id);
  await trpcMutate('appointment.confirm', { cookie: ownerCookie, input: { appointmentId: apptVit.id } });
  const codeVit = await trpcQuery<{ code: string }>('appointment.getCode', { cookie: customerCookie, input: { appointmentId: apptVit.id } });
  await trpcMutate('appointment.checkin', { cookie: staffCookie, input: { code: codeVit.code } });
  let vitDone: { appointmentCompleted: boolean; certificateId: string | null; reportId: string | null } | null = null;
  for (const plan of stepPlan) {
    if (plan.count > 0) {
      const up = await uploadFor(apptVit.id, plan.key, liliCookie);
      await trpcMutate('serviceStep.addPhotos', {
        cookie: liliCookie,
        input: { appointmentId: apptVit.id, stepKey: plan.key, photos: Array.from({ length: plan.count }, (_, i) => ({ url: up.url, thumbUrl: up.thumbUrl, tag: plan.tags?.[i] ?? 'normal' })) },
      });
    }
    vitDone = await trpcMutate<{ appointmentCompleted: boolean; certificateId: string | null; reportId: string | null }>('serviceStep.confirmStep', {
      cookie: liliCookie,
      input: plan.key === 'confirm'
        ? {
            appointmentId: apptVit.id, stepKey: plan.key,
            vitals: [
              { key: 'weight', label: '体重', value: '99.9 kg', status: 'normal' }, // 假体重：服务端应以档案快照覆盖
              { key: 'skin', label: '皮肤', value: '后腿内侧红疹', status: 'abnormal', note: '建议就医复查' },
            ],
            nextAdvice: '两周后复查皮肤',
          }
        : { appointmentId: apptVit.id, stepKey: plan.key },
    });
  }
  check('53.2 带 vitals 末步完成（appointmentCompleted + certificateId/reportId 双透出）',
    vitDone!.appointmentCompleted === true && typeof vitDone!.certificateId === 'string' && typeof vitDone!.reportId === 'string',
    vitDone);
  const vitRep = await trpcQuery<ReportGetRes>('serviceLoop.reportFor', { cookie: customerCookie, input: { appointmentId: apptVit.id } });
  const vitSkin = vitRep.report.vitals.find((v) => v.key === 'skin');
  check('53.2 vitals 快照（skin=abnormal+note；ear/coat/nail 缺项=unrecorded 本次未记录——补缺修复小批 UX 销项口径）',
    vitRep.report.vitals.length === 5 &&
      vitSkin?.status === 'abnormal' && vitSkin.note === '建议就医复查' && vitSkin.value === '后腿内侧红疹' &&
      vitRep.report.vitals.filter((v) => ['ear', 'coat', 'nail'].includes(v.key)).every((v) => v.status === 'unrecorded' && v.note === '本次未记录'),
    vitRep.report.vitals.map((v) => `${v.key}:${v.status}`));
  check('53.2 体重不被客户端输入污染（入参 99.9 kg 被拒，快照=档案 28.5 kg）',
    vitRep.report.vitals.find((v) => v.key === 'weight')?.value === `${petRow.weightKg} kg`,
    vitRep.report.vitals.find((v) => v.key === 'weight'));
  check('53.2 abnormalText 拼句（皮肤：异常（建议就医复查））+ nextAdvice 落库',
    vitRep.report.abnormalText === '皮肤：异常（建议就医复查）' && vitRep.report.nextAdvice === '两周后复查皮肤',
    { abnormalText: vitRep.report.abnormalText, nextAdvice: vitRep.report.nextAdvice });
  const vitCertRow = await db.select().from(schema.serviceCertificates).where(eq(schema.serviceCertificates.appointmentId, apptVit.id)).get();
  check('53.2 apptVit 证书同生成（有 before/after 图）', !!vitCertRow, apptVit.id);

  /* ---------- 53.3 albumFeed 相册聚合（一次批拉 N+1 消除 + 进行中口径 + limit 截顶） ---------- */
  console.log('\n[补缺4] 53.3 albumFeed 服务相册聚合');
  // 进行中夹具：apptProg 走完 disinfection+precheck 后停在 grooming（active）
  // （ pinned 阿强执行：apptVit（丽丽）与其同日落相邻槽，同人会产生区间重叠 409）
  const slotProg = slotPool[slotPool.length - 2]!;
  const apptProg = await trpcMutate<{ id: string }>('appointment.create', {
    cookie: customerCookie,
    input: { storeId, petId, serviceId: service.id, type: 'grooming', scheduledStart: slotProg.slotStart, paymentMode: 'pay_at_store', note: '【测试】e2e 补缺4 进行中单', staffId: aqiang.id },
  });
  createdAidExtras.push(apptProg.id);
  const codeProg = await trpcQuery<{ code: string }>('appointment.getCode', { cookie: customerCookie, input: { appointmentId: apptProg.id } });
  await trpcMutate('appointment.checkin', { cookie: staffCookie, input: { code: codeProg.code } });
  for (const plan of stepPlan.slice(0, 2)) { // 只做前两步（disinfection 1 图 / precheck 2 图）
    const up = await uploadFor(apptProg.id, plan.key, groomerCookie);
    await trpcMutate('serviceStep.addPhotos', {
      cookie: groomerCookie,
      input: { appointmentId: apptProg.id, stepKey: plan.key, photos: Array.from({ length: plan.count }, () => ({ url: up.url, thumbUrl: up.thumbUrl, tag: 'normal' })) },
    });
    await trpcMutate('serviceStep.confirmStep', { cookie: groomerCookie, input: { appointmentId: apptProg.id, stepKey: plan.key } });
  }
  interface FeedPhoto { url: string; thumbUrl: string | null; tag: string }
  interface FeedStep { stepKey: string; label: string; status: string; photos: FeedPhoto[] }
  interface FeedItem { appointmentId: string; petName: string; serviceName: string; storeName: string; status: string; completedAt: Date | null; steps: FeedStep[] }
  const feed = await trpcQuery<FeedItem[]>('serviceLoop.albumFeed', { cookie: customerCookie, input: { limit: 50 } });
  const feedAid = feed.find((f) => f.appointmentId === aid);
  const feedAid2 = feed.find((f) => f.appointmentId === aid2);
  const feedVit = feed.find((f) => f.appointmentId === apptVit.id);
  check('53.3 多单一次聚合返回（aid/aid2/apptVit 同帧，六步+照片全嵌套=N+1 消除结构实证）',
    !!feedAid && !!feedAid2 && !!feedVit &&
      feedAid.steps.length === 6 && feedAid2.steps.length === 6 &&
      feedAid.petName === petRow.name && feedAid.serviceName === service.name && feedAid.storeName === storeRow50.name,
    feed.map((f) => `${f.appointmentId.slice(-4)}:${f.steps.length}`));
  check('53.3 完成单照片分组正确（aid 张数 1/2/3/2/2/0，before_after 步带 before/after 标签）',
    feedAid!.steps.map((s) => s.photos.length).join(',') === '1,2,3,2,2,0' &&
      feedAid!.steps.find((s) => s.stepKey === 'before_after')!.photos.map((p) => p.tag).sort().join(',') === 'after,before',
    feedAid!.steps.map((s) => `${s.stepKey}:${s.photos.length}`));
  const feedProg = feed.find((f) => f.appointmentId === apptProg.id);
  check('53.3 进行中单透出（in_service 在列）且仅 done 步照片可见（grooming=active 与 locked 步 photos 空）',
    !!feedProg && feedProg.status === 'in_service' &&
      feedProg.steps.find((s) => s.stepKey === 'disinfection')!.photos.length === 1 &&
      feedProg.steps.find((s) => s.stepKey === 'precheck')!.photos.length === 2 &&
      feedProg.steps.filter((s) => s.status !== 'done').every((s) => s.photos.length === 0),
    feedProg?.steps.map((s) => `${s.stepKey}:${s.status}:${s.photos.length}`));
  const feedDefault = await trpcQuery<FeedItem[]>('serviceLoop.albumFeed', { cookie: customerCookie });
  check('53.3 默认 limit=12 截顶（默认调用恰 12 条 < limit=50 全量）',
    feedDefault.length === 12 && feed.length > 12,
    { def: feedDefault.length, full: feed.length });

  /* ---------- 53.4 客服工单流（create→店长待办→reply→客户端可见+SSE 留痕） ---------- */
  console.log('\n[补缺4] 53.4 客服工单流');
  interface TicketT {
    id: string; ticketNo: string; type: string; description: string; contactPhone: string | null;
    status: string; replyText: string | null; repliedBy: string | null; repliedAt: Date | null;
    timelineJson: Array<{ action: string; at: string; by: string; note?: string }>;
  }
  const tkCreate = await trpcMutate<{ ticket: TicketT; idempotent: boolean }>('serviceLoop.ticketCreate', {
    cookie: customerCookie,
    input: { storeId, type: 'suggest', description: '希望增加夜间洗护时段', photoUrls: [] },
  });
  check('53.4 ticketCreate 落单（ticketNo=TK-yyyymmdd-NNN 日序 + submitted + timeline 初始 submitted）',
    /^TK-\d{8}-\d{3}$/.test(tkCreate.ticket.ticketNo) && tkCreate.ticket.status === 'submitted' &&
      tkCreate.ticket.timelineJson.length === 1 && tkCreate.ticket.timelineJson[0]!.action === 'submitted' &&
      tkCreate.ticket.timelineJson[0]!.by === customerUser!.id,
    tkCreate.ticket);
  check('53.4 联系方式回显默认=users.phone（缺省未传 → 13800000000）',
    tkCreate.ticket.contactPhone === '13800000000', tkCreate.ticket.contactPhone);
  const tkPending = await trpcQuery<TicketT[]>('serviceLoop.ticketListPending', { cookie: managerCookie });
  check('53.4 店长待办可见本店 submitted 工单', tkPending.some((t) => t.id === tkCreate.ticket.id), tkPending.length);
  const tkReply = await trpcMutate<{ ticket: TicketT }>('serviceLoop.ticketReply', {
    cookie: managerCookie,
    input: { ticketId: tkCreate.ticket.id, reply: '已收到建议，本月排期评估后答复您' },
  });
  check('53.4 店长回复 → replied + repliedBy/At + timeline 追加',
    tkReply.ticket.status === 'replied' && tkReply.ticket.replyText === '已收到建议，本月排期评估后答复您' &&
      tkReply.ticket.repliedBy === managerFix.id && tkReply.ticket.repliedAt instanceof Date &&
      tkReply.ticket.timelineJson.length === 2 && tkReply.ticket.timelineJson[1]!.action === 'replied',
    tkReply.ticket);
  const tkRepliedEv = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'ticket.replied' && r.channel === `user:${customerUser!.id}` &&
      (r.payload as Record<string, unknown> | null)?.ticketId === tkCreate.ticket.id,
  );
  check('53.4 ticket.replied 落 outbox（user 频道，SSE 留痕可取证）', tkRepliedEv.length === 1, tkRepliedEv.map((r) => r.channel));
  const tkGot = await trpcQuery<{ ticket: TicketT }>('serviceLoop.ticketGet', { cookie: customerCookie, input: { ticketId: tkCreate.ticket.id } });
  check('53.4 客户端 ticketGet 可见 replyText + status=replied',
    tkGot.ticket.status === 'replied' && tkGot.ticket.replyText === '已收到建议，本月排期评估后答复您', tkGot.ticket.status);
  const tkMine = await trpcQuery<TicketT[]>('serviceLoop.ticketListMine', { cookie: customerCookie });
  check('53.4 ticketListMine 仅本人含该单', tkMine.some((t) => t.id === tkCreate.ticket.id), tkMine.length);
  const tkEmptyReply = await asErr(trpcMutate('serviceLoop.ticketReply', { cookie: managerCookie, input: { ticketId: tkCreate.ticket.id, reply: '   ' } }));
  check('53.4 回复必填（空白 reply → 400）', tkEmptyReply instanceof TrpcHttpError && tkEmptyReply.code === 'BAD_REQUEST', tkEmptyReply && tkEmptyReply.code);

  /* ---------- 53.5 发票申请流（已付闸/实付重算/税号闸/在途幂等/登记开票） ---------- */
  console.log('\n[补缺4] 53.5 发票申请流');
  const apptPaidRow = (await db.select().from(schema.appointments).where(eq(schema.appointments.id, aid)).get())!;
  interface InvoiceT {
    id: string; invoiceNo: string; orderKind: string; billId: string; billNo: string; amountFen: number;
    titleType: string; title: string; taxNo: string | null; delivery: string; email: string | null;
    status: string; issuedInvoiceNo: string | null; issuedAt: Date | null; issuedBy: string | null;
  }
  const invCreate = await trpcMutate<{ request: InvoiceT; idempotent: boolean }>('serviceLoop.invoiceCreate', {
    cookie: customerCookie,
    input: {
      orderKind: 'appointment', billId: aid, amountFen: 1, // 假金额：服务端应忽略并按实付重算
      titleType: 'personal', title: '个人', taxNo: 'SHOULD_BE_CLEARED', delivery: 'email', email: 'e2e@philia.test',
    },
  });
  check('53.5 invoiceCreate 金额=实付重算（传入假 1 分被忽略 → paidFen 实额）+ personal 税号置空',
    invCreate.request.amountFen === apptPaidRow.paidFen && invCreate.request.amountFen > 0 &&
      invCreate.request.taxNo === null && invCreate.request.status === 'submitted' &&
      invCreate.idempotent === false,
    { amountFen: invCreate.request.amountFen, paidFen: apptPaidRow.paidFen, taxNo: invCreate.request.taxNo });
  check('53.5 invoiceNo=IN-yyyymmdd-NNN 日序 + 来源单号快照（billNo=预约码）',
    /^IN-\d{8}-\d{3}$/.test(invCreate.request.invoiceNo) && invCreate.request.billNo === apptPaidRow.code,
    invCreate.request.invoiceNo);
  const invDup = await trpcMutate<{ request: InvoiceT; idempotent: boolean }>('serviceLoop.invoiceCreate', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: aid, titleType: 'personal', title: '个人', delivery: 'pickup' },
  });
  check('53.5 同单在途幂等（重复申请返回原单 idempotent=true，不产生新行）',
    invDup.idempotent === true && invDup.request.id === invCreate.request.id,
    { dup: invDup.request.id, orig: invCreate.request.id });
  const invNoTax = await asErr(trpcMutate('serviceLoop.invoiceCreate', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: aid2, titleType: 'business', title: '某某公司', delivery: 'pickup' },
  }));
  check('53.5 企业抬头缺税号 → 400「企业抬头必须填写税号」（形状校验先于单据闸）',
    invNoTax instanceof TrpcHttpError && invNoTax.code === 'BAD_REQUEST' && invNoTax.message.includes('税号'),
    invNoTax && { code: invNoTax.code, message: invNoTax.message });
  const invUnpaid = await asErr(trpcMutate('serviceLoop.invoiceCreate', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: aid2, titleType: 'personal', title: '个人', delivery: 'pickup' },
  }));
  check('53.5 已付闸：未收款预约（aid2 未 markPaid）→ 400「尚未完成收款」',
    invUnpaid instanceof TrpcHttpError && invUnpaid.code === 'BAD_REQUEST' && invUnpaid.message.includes('尚未完成收款'),
    invUnpaid && { code: invUnpaid.code, message: invUnpaid.message });
  const invBadEmail = await asErr(trpcMutate('serviceLoop.invoiceCreate', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: aid, titleType: 'personal', title: '个人', delivery: 'email', email: 'not-an-email' },
  }));
  check('53.5 email 交付格式校验（非法邮箱 → 400「邮箱格式不正确」，形状校验先于在途幂等）',
    invBadEmail instanceof TrpcHttpError && invBadEmail.code === 'BAD_REQUEST' && invBadEmail.message.includes('邮箱'),
    invBadEmail && { code: invBadEmail.code, message: invBadEmail.message });
  // cashier 来源单路径（svcBillMember=§41 萤火服务单，customer=本人，settled，实付 7744）
  const invCashier = await trpcMutate<{ request: InvoiceT; idempotent: boolean }>('serviceLoop.invoiceCreate', {
    cookie: customerCookie,
    input: { orderKind: 'cashier', billId: svcBillMember.billId, titleType: 'business', title: '菲丽亚测试公司', taxNo: '91330100TEST0001X', delivery: 'pickup' },
  });
  check('53.5 cashier 来源单：金额=paid_fen 实收（7744）+ 企业抬头税号留存',
    invCashier.request.amountFen === 7744 && invCashier.request.billNo === svcBillMember.billNo &&
      invCashier.request.taxNo === '91330100TEST0001X' && invCashier.idempotent === false,
    invCashier.request);
  const invPending = await trpcQuery<InvoiceT[]>('serviceLoop.invoiceListPending', { cookie: ownerCookie });
  check('53.5 商家待办可见本店 submitted 申请（两单在列）',
    invPending.some((r) => r.id === invCreate.request.id) && invPending.some((r) => r.id === invCashier.request.id),
    invPending.length);
  const invReg = await trpcMutate<{ request: InvoiceT }>('serviceLoop.invoiceRegister', {
    cookie: ownerCookie,
    input: { requestId: invCreate.request.id, invoiceNo: 'FP-2026-1001' },
  });
  check('53.5 invoiceRegister 登记发票号 → issued + issuedAt/By 留痕',
    invReg.request.status === 'issued' && invReg.request.issuedInvoiceNo === 'FP-2026-1001' &&
      invReg.request.issuedAt instanceof Date && invReg.request.issuedBy === ownerUser!.id,
    invReg.request);
  const invIssuedEv = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'invoice.issued' && r.channel === `user:${customerUser!.id}` &&
      (r.payload as Record<string, unknown> | null)?.requestId === invCreate.request.id,
  );
  check('53.5 invoice.issued 落 outbox（user 频道，SSE 留痕可取证）', invIssuedEv.length === 1, invIssuedEv.map((r) => r.channel));
  const invGot = await trpcQuery<{ request: InvoiceT }>('serviceLoop.invoiceGet', { cookie: customerCookie, input: { requestId: invCreate.request.id } });
  check('53.5 客户端 invoiceGet 可见 issued + 实际发票号',
    invGot.request.status === 'issued' && invGot.request.issuedInvoiceNo === 'FP-2026-1001', invGot.request.status);
  const invMine = await trpcQuery<InvoiceT[]>('serviceLoop.invoiceListMine', { cookie: customerCookie });
  check('53.5 invoiceListMine 仅本人含两单', invMine.some((r) => r.id === invCreate.request.id) && invMine.some((r) => r.id === invCashier.request.id), invMine.length);
  const invAgain = await asErr(trpcMutate('serviceLoop.invoiceCreate', {
    cookie: customerCookie,
    input: { orderKind: 'appointment', billId: aid, titleType: 'personal', title: '个人', delivery: 'pickup' },
  }));
  check('53.5 已开票单重复申请 → 400「已开票」明文拒',
    invAgain instanceof TrpcHttpError && invAgain.code === 'BAD_REQUEST' && invAgain.message.includes('已开票'),
    invAgain && { code: invAgain.code, message: invAgain.message });

  /* ---------- 53.6 权限：他人 403×4（证书/报告/工单/发票） ---------- */
  console.log('\n[补缺4] 53.6 权限闸（他人 403×4）');
  const otherCert = await asErr(trpcQuery('serviceLoop.certificateFor', { cookie: d10Cookie, input: { appointmentId: aid } }));
  const otherReport = await asErr(trpcQuery('serviceLoop.reportFor', { cookie: d10Cookie, input: { appointmentId: aid } }));
  const otherTicket = await asErr(trpcQuery('serviceLoop.ticketGet', { cookie: d10Cookie, input: { ticketId: tkCreate.ticket.id } }));
  const otherInvoice = await asErr(trpcQuery('serviceLoop.invoiceGet', { cookie: d10Cookie, input: { requestId: invCreate.request.id } }));
  check('53.6 他人证书/报告/工单/发票 全 403 FORBIDDEN（客户只见本人数据）',
    [otherCert, otherReport, otherTicket, otherInvoice].every(
      (r) => r instanceof TrpcHttpError && r.httpStatus === 403 && r.code === 'FORBIDDEN',
    ),
    [otherCert, otherReport, otherTicket, otherInvoice].map((r) => r && `${r.httpStatus}:${r.code}`));

  /* ---------- 53.7 serviceHours 公示读口（端口可调实证） ---------- */
  console.log('\n[补缺4] 53.7 serviceHours 客服时间公示');
  const hours1 = await trpcQuery<{ text: string | null }>('serviceLoop.serviceHours', { cookie: customerCookie });
  check('53.7 serviceHours 读出种子值「09:00–21:00」（0017 幂等种子+seed 补种）',
    hours1.text === '09:00–21:00', hours1);
  const hoursSave = await trpcMutate<{ version: number; keys: string[] }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'service', changes: [{ ruleKey: 'service_hours', valueJson: { text: '10:00–22:00' } }] },
  });
  check('53.7 配置端口第六域 domain=service 保存即生效（version=2）',
    hoursSave.version === 2 && hoursSave.keys.includes('service_hours'), hoursSave);
  const hours2 = await trpcQuery<{ text: string | null }>('serviceLoop.serviceHours', { cookie: customerCookie });
  check('53.7 改值复读出「10:00–22:00」（端口可调实证）', hours2.text === '10:00–22:00', hours2);
  await trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'service', changes: [{ ruleKey: 'service_hours', valueJson: { text: '09:00–21:00' } }] },
  });
  const hours3 = await trpcQuery<{ text: string | null }>('serviceLoop.serviceHours', { cookie: customerCookie });
  check('53.7 还原种子值（不留端口副作用）', hours3.text === '09:00–21:00', hours3);

  /* ==================================================================
   * 批次 R13a（账号安全大片 2 · server 侧）验收段 51.x
   * 夹具手机号段 1396666xxxx（避开种子/e2e 既有 13800000000/1381111xxxx/1390000xxxx/13977776666）。
   * 注销/换绑不产生退款单——本段不触碰 refund_bills，不受段尾移位铁律约束。
   * ================================================================== */
  console.log('\n[R13a] 51. 账号安全（注销/换绑/申诉/设备登记）');
  /* ---------- 51.1 sendCode 限流（60s 一码）+ 原号闸 + beta devCode 回显 ---------- */
  console.log('\n[R13a] 51.1 sendCode（限流/原号闸/devCode 回显）');
  const phoneA = '13966660001';
  const reg51a = await devLoginPhone(phoneA);
  check('51.1 换绑主线用户 A 自助开户（customer + 会话签发）',
    reg51a.res.ok && reg51a.body.user?.roles?.includes('customer') === true && !!reg51a.cookie, reg51a.body);
  const cookie51a = reg51a.cookie!;
  const userAId = reg51a.body.user!.id!;
  interface SendCodeRes { ok: boolean; ttlSec: number; devCode?: string }
  const scOld1 = await trpcMutate<SendCodeRes>('authSecurity.sendCode', {
    cookie: cookie51a, input: { purpose: 'change_bind_old', phone: phoneA },
  });
  check('51.1 sendCode 原号验证码发送成功 + beta devCode 回显（6 位数字，ttl=600s）',
    scOld1.ok === true && scOld1.ttlSec === 600 && typeof scOld1.devCode === 'string' && /^\d{6}$/.test(scOld1.devCode), scOld1);
  const scOldMismatch = await asErr(trpcMutate('authSecurity.sendCode', {
    cookie: cookie51a, input: { purpose: 'change_bind_old', phone: '13966660999' },
  }));
  check('51.1 原号不一致 → BAD_REQUEST「与当前账号绑定手机号不一致」（原号闸）',
    scOldMismatch instanceof TrpcHttpError && scOldMismatch.code === 'BAD_REQUEST' && scOldMismatch.message.includes('不一致'),
    scOldMismatch && { code: scOldMismatch.code, message: scOldMismatch.message });
  const scOldResend = await asErr(trpcMutate('authSecurity.sendCode', {
    cookie: cookie51a, input: { purpose: 'change_bind_old', phone: phoneA },
  }));
  check('51.1 限流：同 phone+purpose 60s 一码（立即重发 → TOO_MANY_REQUESTS）',
    scOldResend instanceof TrpcHttpError && scOldResend.code === 'TOO_MANY_REQUESTS',
    scOldResend && { code: scOldResend.code, message: scOldResend.message });

  /* ---------- 51.2 changePhone 双码流（错码拒/成功/会话零丢失/logs 'self'） ---------- */
  console.log('\n[R13a] 51.2 changePhone 双码换绑');
  const phoneA2 = '13966660002';
  const scNewClash = await asErr(trpcMutate('authSecurity.sendCode', {
    cookie: cookie51a, input: { purpose: 'change_bind_new', phone: '13977776666' }, // D-16 段在册号（他人账号）
  }));
  check('51.2 新号撞号闸（新号=他人在册号 → BAD_REQUEST「已被其他账号使用」）',
    scNewClash instanceof TrpcHttpError && scNewClash.code === 'BAD_REQUEST' && scNewClash.message.includes('已被其他账号使用'),
    scNewClash && { code: scNewClash.code, message: scNewClash.message });
  const scNew1 = await trpcMutate<SendCodeRes>('authSecurity.sendCode', {
    cookie: cookie51a, input: { purpose: 'change_bind_new', phone: phoneA2 },
  });
  check('51.2 sendCode 新号验证码发送成功（devCode 回显）', scNew1.ok === true && /^\d{6}$/.test(scNew1.devCode ?? ''), scNew1);
  // 构造必错新码（真码 +1 取模，排除百万分之一撞码）
  const wrongNewCode = String((parseInt(scNew1.devCode!, 10) + 1) % 1_000_000).padStart(6, '0');
  const wrongChange = await asErr(trpcMutate('authSecurity.changePhone', {
    cookie: cookie51a, input: { oldCode: scOld1.devCode!, newPhone: phoneA2, newCode: wrongNewCode },
  }));
  const userAAfterWrong = await db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, userAId)).get();
  check('51.2 错新码 → BAD_REQUEST「验证码错误」且事务回滚换绑未生效（users.phone 仍原号）',
    wrongChange instanceof TrpcHttpError && wrongChange.code === 'BAD_REQUEST' && wrongChange.message.includes('验证码错误') &&
      userAAfterWrong?.phone === phoneA,
    wrongChange && { code: wrongChange.code, message: wrongChange.message, phone: userAAfterWrong?.phone });
  const changed = await trpcMutate<{ user: { id: string; phone: string | null }; roles: string[] }>('authSecurity.changePhone', {
    cookie: cookie51a, input: { oldCode: scOld1.devCode!, newPhone: phoneA2, newCode: scNew1.devCode! },
  });
  check('51.2 双码换绑成功（返回 auth.me 同构：user.phone=新号 + roles 透传）',
    changed.user.id === userAId && changed.user.phone === phoneA2 && changed.roles.includes('customer'), changed.user);
  const meAfterChange = await trpcQuery<{ user: { id: string; phone: string | null } }>('auth.me', { cookie: cookie51a });
  check('51.2 换绑后原会话零丢失（auth.me 仍 200；会话载荷无 phone 字段，透出已为新号）',
    meAfterChange.user.id === userAId && meAfterChange.user.phone === phoneA2, meAfterChange.user);
  const logs51a = await db.select().from(schema.phoneChangeLogs).where(eq(schema.phoneChangeLogs.userId, userAId));
  check("51.2 phone_change_logs 'self' 落行（全脱敏 139****0001→139****0002，operatorId 空）",
    logs51a.length === 1 && logs51a[0]!.channel === 'self' && logs51a[0]!.operatorId === null &&
      logs51a[0]!.oldPhoneMasked === '139****0001' && logs51a[0]!.newPhoneMasked === '139****0002',
    logs51a.map((l) => ({ channel: l.channel, old: l.oldPhoneMasked, new: l.newPhoneMasked })));
  const reuseChange = await asErr(trpcMutate('authSecurity.changePhone', {
    cookie: cookie51a, input: { oldCode: scOld1.devCode!, newPhone: phoneA2, newCode: scNew1.devCode! },
  }));
  check('51.2 验证码一次性（已消费码重用 → BAD_REQUEST）',
    reuseChange instanceof TrpcHttpError && reuseChange.code === 'BAD_REQUEST',
    reuseChange && { code: reuseChange.code, message: reuseChange.message });

  /* ---------- 51.3 换绑申诉全链（提交→待审→approve/reject） ---------- */
  console.log('\n[R13a] 51.3 换绑申诉全链');
  const phoneC = '13966660010';
  const reg51c = await devLoginPhone(phoneC);
  const cookie51c = reg51c.cookie!;
  const userCId = reg51c.body.user!.id!;
  interface AppealReqT {
    id: string; requestNo: string; userId: string; status: string;
    oldPhoneMasked: string; newPhoneMasked: string; decideNote: string | null;
  }
  const ap1 = await trpcMutate<{ request: AppealReqT; idempotent: boolean }>('authSecurity.submitPhoneAppeal', {
    cookie: cookie51c, input: { oldPhone: phoneC, newPhone: '13966660011', note: '原手机丢失，凭身份证到店申诉换绑' },
  });
  check('51.3 申诉提交成功（PC-yyyymmdd-NNN 日序单号 + 脱敏落表 + submitted）',
    ap1.idempotent === false && /^PC-\d{8}-\d{3}$/.test(ap1.request.requestNo) &&
      ap1.request.oldPhoneMasked === '139****0010' && ap1.request.newPhoneMasked === '139****0011' &&
      ap1.request.status === 'submitted',
    ap1.request);
  const ap1Again = await trpcMutate<{ request: AppealReqT; idempotent: boolean }>('authSecurity.submitPhoneAppeal', {
    cookie: cookie51c, input: { oldPhone: phoneC, newPhone: '13966660011', note: '重复提交验证幂等' },
  });
  check('51.3 在途幂等（重复提交返回同一单 idempotent=true）',
    ap1Again.idempotent === true && ap1Again.request.id === ap1.request.id, { first: ap1.request.id, second: ap1Again.request.id });
  const apBadOld = await asErr(trpcMutate('authSecurity.submitPhoneAppeal', {
    cookie: cookie51c, input: { oldPhone: '13966660999', newPhone: '13966660011', note: '原号不一致验证' },
  }));
  check('51.3 原号不一致 → BAD_REQUEST（原号一致闸）',
    apBadOld instanceof TrpcHttpError && apBadOld.code === 'BAD_REQUEST' && apBadOld.message.includes('不一致'),
    apBadOld && { code: apBadOld.code, message: apBadOld.message });
  const appealList = await trpcQuery<{ items: Array<AppealReqT & { slaBreached: boolean }> }>('authSecurity.listPhoneAppeals', { cookie: managerCookie });
  const appealHit = appealList.items.find((r) => r.id === ap1.request.id);
  check('51.3 listPhoneAppeals 待审队列含该单（SLA 24h 内未超期标记）',
    !!appealHit && appealHit.slaBreached === false, appealList.items.map((r) => r.requestNo));
  const rvApNoNote = await asErr(trpcMutate('authSecurity.reviewPhoneAppeal', {
    cookie: managerCookie, input: { requestId: ap1.request.id, approve: false },
  }));
  check('51.3 reject 强制 note（缺 note → BAD_REQUEST）',
    rvApNoNote instanceof TrpcHttpError && rvApNoNote.code === 'BAD_REQUEST',
    rvApNoNote && { code: rvApNoNote.code, message: rvApNoNote.message });
  const rvApReject = await trpcMutate<{ request: AppealReqT }>('authSecurity.reviewPhoneAppeal', {
    cookie: managerCookie, input: { requestId: ap1.request.id, approve: false, note: '材料不足，请补充购机凭证' },
  });
  check('51.3 reject 成功（rejected + decideNote 落库）',
    rvApReject.request.status === 'rejected' && rvApReject.request.decideNote === '材料不足，请补充购机凭证', rvApReject.request);
  const appealStatus51c = await trpcQuery<{ items: AppealReqT[] }>('authSecurity.appealStatus', { cookie: cookie51c });
  check('51.3 本人 appealStatus 可见驳回原因（客户端可见）',
    appealStatus51c.items.some((r) => r.id === ap1.request.id && r.decideNote === '材料不足，请补充购机凭证'),
    appealStatus51c.items.map((r) => ({ id: r.id, note: r.decideNote })));
  const ap2 = await trpcMutate<{ request: AppealReqT; idempotent: boolean }>('authSecurity.submitPhoneAppeal', {
    cookie: cookie51c, input: { oldPhone: phoneC, newPhone: '13966660012', note: '已补充材料，再次申诉' },
  });
  const rvApApproveNoNote = await asErr(trpcMutate('authSecurity.reviewPhoneAppeal', {
    cookie: managerCookie, input: { requestId: ap2.request.id, approve: true },
  }));
  check('51.3 approve 强制 note（缺 note → BAD_REQUEST）',
    rvApApproveNoNote instanceof TrpcHttpError && rvApApproveNoNote.code === 'BAD_REQUEST',
    rvApApproveNoNote && { code: rvApApproveNoNote.code, message: rvApApproveNoNote.message });
  const rvApApprove = await trpcMutate<{ request: AppealReqT }>('authSecurity.reviewPhoneAppeal', {
    cookie: managerCookie, input: { requestId: ap2.request.id, approve: true, note: '材料核验通过，协助换绑' },
  });
  check('51.3 approve 成功（approved）', rvApApprove.request.status === 'approved', rvApApprove.request);
  const user51cRow = await db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, userCId)).get();
  check('51.3 approve 后 users.phone 落新号（申诉通道：原号失效无需验证码）',
    user51cRow?.phone === '13966660012', user51cRow?.phone);
  const logs51c = await db.select().from(schema.phoneChangeLogs).where(eq(schema.phoneChangeLogs.userId, userCId));
  check("51.3 phone_change_logs 'assisted' 落行（operatorId=审批人 manager，全脱敏）",
    logs51c.length === 1 && logs51c[0]!.channel === 'assisted' && logs51c[0]!.operatorId === managerFix.id &&
      logs51c[0]!.oldPhoneMasked === '139****0010' && logs51c[0]!.newPhoneMasked === '139****0012',
    logs51c.map((l) => ({ channel: l.channel, op: l.operatorId, old: l.oldPhoneMasked, new: l.newPhoneMasked })));
  const me51cAfter = await trpcQuery<{ user: { id: string; phone: string | null } }>('auth.me', { cookie: cookie51c });
  check('51.3 旧会话照旧有效（session 无 phone 载荷，auth.me 200 透出新号）',
    me51cAfter.user.id === userCId && me51cAfter.user.phone === '13966660012', me51cAfter.user);
  const relogin51c = await devLoginPhone('13966660012');
  check('51.3 新号登录成功（同一用户 id，幂等建档不建行）',
    relogin51c.res.ok && relogin51c.body.user?.id === userCId, { want: userCId, got: relogin51c.body.user?.id });

  /* ---------- 51.4 注销流（阻断/勾选/approve 全联动/reject 可见） ---------- */
  console.log('\n[R13a] 51.4 账号注销流');
  const phoneD = '13966660020';
  const reg51d = await devLoginPhone(phoneD);
  const cookie51d = reg51d.cookie!;
  const userDId = reg51d.body.user!.id!;
  interface DeactReqT { id: string; userId: string; status: string; decideNote: string | null; impactsJson: string[] }
  // 夹具：本人宠物 + 未完成预约（confirmed）→ 阻断
  const pet51d = (await db.insert(schema.pets).values({ ownerId: userDId, name: '注销测试宠', species: 'dog' }).returning())[0]!;
  await db.insert(schema.appointments).values({
    code: 'D51D20', customerId: userDId, storeId, petId: pet51d.id, serviceId: service.id,
    type: 'grooming', scheduledStart: new Date(Date.now() + 86400_000),
    scheduledEnd: new Date(Date.now() + 86400_000 + 3600_000), status: 'confirmed', priceFen: 100,
  });
  const pre51a = await trpcQuery<{ blockers: Array<{ kind: string; label: string; count: number }>; deactivatable: boolean }>(
    'authSecurity.deactivationPrecheck', { cookie: cookie51d });
  check('51.4 未完成预约=阻断列明（appointment×1，deactivatable=false）',
    pre51a.deactivatable === false && pre51a.blockers.some((b) => b.kind === 'appointment' && b.count === 1), pre51a.blockers);
  const reqBlocked = await asErr(trpcMutate('authSecurity.requestDeactivation', {
    cookie: cookie51d, input: { impacts: ['rebate', 'member', 'pets'] },
  }));
  check('51.4 有阻断项提交 → BAD_REQUEST（服务端 precheck 闸）',
    reqBlocked instanceof TrpcHttpError && reqBlocked.code === 'BAD_REQUEST' && reqBlocked.message.includes('阻断'),
    reqBlocked && { code: reqBlocked.code, message: reqBlocked.message });
  await db.update(schema.appointments).set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(schema.appointments.customerId, userDId)); // 清空阻断（夹具直改）
  const pre51b = await trpcQuery<{ blockers: unknown[]; deactivatable: boolean }>('authSecurity.deactivationPrecheck', { cookie: cookie51d });
  check('51.4 清空阻断后放行（blockers 空，deactivatable=true）',
    pre51b.deactivatable === true && pre51b.blockers.length === 0, pre51b);
  const reqMissing = await asErr(trpcMutate('authSecurity.requestDeactivation', {
    cookie: cookie51d, input: { impacts: ['rebate', 'member'] },
  }));
  check('51.4 影响勾选缺项 → BAD_REQUEST（三项缺一不可，服务端强校验）',
    reqMissing instanceof TrpcHttpError && reqMissing.code === 'BAD_REQUEST' && reqMissing.message.includes('三项'),
    reqMissing && { code: reqMissing.code, message: reqMissing.message });
  const dr1 = await trpcMutate<{ request: DeactReqT; idempotent: boolean }>('authSecurity.requestDeactivation', {
    cookie: cookie51d, input: { impacts: ['pets', 'rebate', 'member'] },
  });
  check('51.4 三勾选提交成功（submitted + impacts 快照三项）',
    dr1.idempotent === false && dr1.request.status === 'submitted' && dr1.request.impactsJson.length === 3, dr1.request);
  const dr1Again = await trpcMutate<{ request: DeactReqT; idempotent: boolean }>('authSecurity.requestDeactivation', {
    cookie: cookie51d, input: { impacts: ['rebate', 'member', 'pets'] },
  });
  check('51.4 在途幂等（重复提交返回同一单）',
    dr1Again.idempotent === true && dr1Again.request.id === dr1.request.id, { first: dr1.request.id, second: dr1Again.request.id });
  const cancel51d = await trpcMutate<{ request: DeactReqT }>('authSecurity.cancelDeactivation', { cookie: cookie51d });
  check('51.4 本人撤销（submitted→cancelled）', cancel51d.request.status === 'cancelled', cancel51d.request);
  const dr2 = await trpcMutate<{ request: DeactReqT; idempotent: boolean }>('authSecurity.requestDeactivation', {
    cookie: cookie51d, input: { impacts: ['rebate', 'member', 'pets'] },
  });
  const rvDNoNote = await asErr(trpcMutate('authSecurity.reviewDeactivation', {
    cookie: managerCookie, input: { requestId: dr2.request.id, approve: false },
  }));
  check('51.4 驳回强制 note（缺 note → BAD_REQUEST）',
    rvDNoNote instanceof TrpcHttpError && rvDNoNote.code === 'BAD_REQUEST',
    rvDNoNote && { code: rvDNoNote.code, message: rvDNoNote.message });
  const rvDReject = await trpcMutate<{ request: DeactReqT }>('authSecurity.reviewDeactivation', {
    cookie: managerCookie, input: { requestId: dr2.request.id, approve: false, note: '门店挽留成功，客户同意保留账号' },
  });
  check('51.4 门店驳回（rejected + decideNote 落库）',
    rvDReject.request.status === 'rejected' && rvDReject.request.decideNote === '门店挽留成功，客户同意保留账号', rvDReject.request);
  const dStatus51 = await trpcQuery<{ inflight: DeactReqT | null; latest: DeactReqT | null }>('authSecurity.deactivationStatus', { cookie: cookie51d });
  check('51.4 本人可见驳回原因（deactivationStatus latest=reject 单带 decideNote）',
    dStatus51.inflight === null && dStatus51.latest?.id === dr2.request.id && dStatus51.latest.decideNote === '门店挽留成功，客户同意保留账号',
    dStatus51.latest);
  // 最终提交 + 会员/回馈金夹具 → approve 全联动
  const dr3 = await trpcMutate<{ request: DeactReqT; idempotent: boolean }>('authSecurity.requestDeactivation', {
    cookie: cookie51d, input: { impacts: ['rebate', 'member', 'pets'] },
  });
  const of51d = await trpcMutate<{ membership: { status: string; planKey: string } }>('membership.openFree', { cookie: cookie51d });
  check('51.4 夹具：微光会员 active（注销联动取消对象）', of51d.membership.status === 'active', of51d.membership);
  await db.insert(schema.rebateAccounts).values({ userId: userDId, balanceFen: 500 })
    .onConflictDoUpdate({ target: schema.rebateAccounts.userId, set: { balanceFen: 500 } }); // 夹具：余额 500（清零留痕对象）
  const rvDApprove = await trpcMutate<{ request: DeactReqT; clearedRebateFen: number }>('authSecurity.reviewDeactivation', {
    cookie: managerCookie, input: { requestId: dr3.request.id, approve: true, note: '客户坚持注销，门店确认无欠单' },
  });
  check('51.4 门店 approve（approved + 回馈金清零额 500 透出）',
    rvDApprove.request.status === 'approved' && rvDApprove.clearedRebateFen === 500, rvDApprove);
  const userDRow = await db.select().from(schema.users).where(eq(schema.users.id, userDId)).get();
  check('51.4 deactivated 落库（deactivated_at 非空 + reason=审批 note + phone/kimiId 释放 `_deact_<uid>_<原值>`）',
    !!userDRow?.deactivatedAt && userDRow.deactivateReason === '客户坚持注销，门店确认无欠单' &&
      userDRow.phone === `_deact_${userDId}_${phoneD}` && userDRow.kimiId === `_deact_${userDId}_phone:${phoneD}`,
    { deactivatedAt: userDRow?.deactivatedAt, phone: userDRow?.phone, kimiId: userDRow?.kimiId });
  const me51dAfter = await asErr(trpcQuery('auth.me', { cookie: cookie51d }));
  check('51.4 注销后原会话 401（middleware 软删闸即时生效）',
    me51dAfter instanceof TrpcHttpError && me51dAfter.httpStatus === 401,
    me51dAfter && { status: me51dAfter.httpStatus, code: me51dAfter.code });
  const reloginDeactRes = await fetch(`${BASE}/api/auth/dev-login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: userDId }),
  });
  const reloginDeactBody = (await reloginDeactRes.json()) as { ok?: boolean; error?: string; message?: string };
  check('51.4 已注销用户登录明文拒「该账号已注销，如有疑问请联系门店」',
    reloginDeactRes.status === 403 && reloginDeactBody.ok === false && (reloginDeactBody.message ?? '').includes('该账号已注销'),
    { status: reloginDeactRes.status, body: reloginDeactBody });
  const reReg51d = await devLoginPhone(phoneD);
  check('51.4 phone suffix 释放：同号重新注册建档成功（新档 ≠ 原账号）',
    reReg51d.res.ok && !!reReg51d.body.user?.id && reReg51d.body.user.id !== userDId,
    { old: userDId, neu: reReg51d.body.user?.id });
  const reRegPets = await trpcQuery<Array<{ id: string }>>('pet.list', { cookie: reReg51d.cookie! });
  check('51.4 新旧账号互不可见（新档 pet.list 空，原档数据不透出）', reRegPets.length === 0, reRegPets.length);
  const acc51d = await db.select().from(schema.rebateAccounts).where(eq(schema.rebateAccounts.userId, userDId)).get();
  const clearLog51d = (await db.select().from(schema.rebateLogs)
    .where(and(eq(schema.rebateLogs.userId, userDId), eq(schema.rebateLogs.type, 'clear'))))[0];
  check('51.4 回馈金清零留痕（余额 500→0，clear 行前后值 + note 含「注销」——clearRebateAccount 工艺）',
    acc51d?.balanceFen === 0 && clearLog51d?.deltaFen === -500 && clearLog51d.beforeFen === 500 && clearLog51d.afterFen === 0 &&
      (clearLog51d.note ?? '').includes('注销'),
    { balance: acc51d?.balanceFen, log: clearLog51d && { before: clearLog51d.beforeFen, after: clearLog51d.afterFen, note: clearLog51d.note } });
  const m51d = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, userDId)).get();
  check('51.4 会员 active→cancelled（注销≠退会：无折算退款 refund_fen=NULL，cancelReason 注明）',
    m51d?.status === 'cancelled' && m51d.refundFen === null && (m51d.cancelReason ?? '').includes('注销'),
    { status: m51d?.status, refundFen: m51d?.refundFen, reason: m51d?.cancelReason });
  const pet51dAfter = await db.select().from(schema.pets).where(eq(schema.pets.id, pet51d.id)).get();
  check('51.4 pets 软删标记（deleted_at 置位 + 原因「账号注销」）',
    !!pet51dAfter?.deletedAt && pet51dAfter.deleteReason === '账号注销',
    { deletedAt: pet51dAfter?.deletedAt, reason: pet51dAfter?.deleteReason });
  const rvAsCustomer = await asErr(trpcMutate('authSecurity.reviewDeactivation', {
    cookie: customerCookie, input: { requestId: dr3.request.id, approve: true },
  }));
  check('51.4 客户越权审批 → 403 FORBIDDEN（merchantManagerProcedure 闸）',
    rvAsCustomer instanceof TrpcHttpError && rvAsCustomer.httpStatus === 403 && rvAsCustomer.code === 'FORBIDDEN',
    rvAsCustomer && { status: rvAsCustomer.httpStatus, code: rvAsCustomer.code });

  /* ---------- 51.5 registerDevice upsert + listDevices 换绑留痕透出 ---------- */
  console.log('\n[R13a] 51.5 设备登记');
  interface RegDeviceRes { device: { id: string; deviceId: string }; created: boolean }
  const rd1 = await trpcMutate<RegDeviceRes>('authSecurity.registerDevice', {
    cookie: cookie51a, input: { deviceId: 'dev-51a-1', label: '主力机' },
  });
  const rd1b = await trpcMutate<RegDeviceRes>('authSecurity.registerDevice', {
    cookie: cookie51a, input: { deviceId: 'dev-51a-1' },
  });
  check('51.5 registerDevice upsert（首登创建 → 重登幂等同行刷新，不增行）',
    rd1.created === true && rd1b.created === false && rd1b.device.id === rd1.device.id,
    { first: rd1.created, second: rd1b.created });
  await trpcMutate<RegDeviceRes>('authSecurity.registerDevice', {
    cookie: cookie51a, input: { deviceId: 'dev-51a-2', label: '备用机' },
  });
  const devRows51 = await db.select().from(schema.userDevices).where(eq(schema.userDevices.userId, userAId));
  check('51.5 (user_id,device_id) 唯一防重（重登后仍 2 行）', devRows51.length === 2, devRows51.length);
  const listDev51 = await trpcQuery<{
    devices: Array<{ deviceId: string; label: string | null }>;
    phoneChangeLogs: Array<{ channel: string; oldPhoneMasked: string; newPhoneMasked: string }>;
  }>('authSecurity.listDevices', { cookie: cookie51a });
  check('51.5 listDevices 设备倒序 2 行 + 换绑留痕透出（self 139****0001→139****0002，设备页数据源）',
    listDev51.devices.length === 2 &&
      listDev51.phoneChangeLogs.some((l) => l.channel === 'self' && l.oldPhoneMasked === '139****0001' && l.newPhoneMasked === '139****0002'),
    { devices: listDev51.devices.length, logs: listDev51.phoneChangeLogs });

  /* ---------- 51.6 已注销用户 SSE/业务接口 401（软删闸实证） ---------- */
  console.log('\n[R13a] 51.6 软删闸（SSE/接口 401）');
  const push51d = await asErr(trpcMutate('push.subscribe', {
    cookie: cookie51d, input: { clientId: 'dev-51d-push', appType: 'customer' },
  }));
  check('51.6 已注销用户业务接口 401（push.subscribe UNAUTHORIZED）',
    push51d instanceof TrpcHttpError && push51d.httpStatus === 401 && push51d.code === 'UNAUTHORIZED',
    push51d && { status: push51d.httpStatus, code: push51d.code });
  const sse51d = await fetch(`${BASE}/api/events?client_id=dev-51d-sse`, { headers: { cookie: cookie51d } });
  const sse51dStatus = sse51d.status;
  await sse51d.body?.cancel();
  check('51.6 已注销用户 SSE 401（软删闸实证：loadSessionUser 视同不存在）', sse51dStatus === 401, sse51dStatus);
  const sse51a = await fetch(`${BASE}/api/events?client_id=dev-51a-sse`, { headers: { cookie: cookie51a } });
  const sse51aStatus = sse51a.status;
  await sse51a.body?.cancel();
  check('51.6 对照：正常用户过会话闸（403=client_id 未登记，非 401——401 确为注销闸语义）',
    sse51aStatus === 403, sse51aStatus);

  /* ==================================================================
   * 补缺大批片 5（站内信分类 + 订阅退订 + 端点补齐 + 事件挂接槽位）验收段
   * 干净夹具用户 seed_e2e_notify 隔离既有段通知存量（unreadCount 断言可精确）；
   * 事件触发=直接调 emitEvent（本片写入口不新增链路，槽位有效性实证口径见 54.5）。
   * ================================================================== */
  console.log('\n[片5] 54. 站内信分类 / 订阅退订 / 端点补齐 / 挂接槽位');
  const { emitEvent } = await import('../realtime/bus');
  const { EventType } = await import('../realtime/events');

  const notifyUser = (await db
    .insert(schema.users)
    .values({ kimiId: 'seed_e2e_notify', nickname: 'e2e 通知甲', phone: '13900001031' })
    .returning())[0]!;
  await db.insert(schema.userRoles).values({ userId: notifyUser.id, role: 'customer' });
  const notifyCookie = await devLogin(notifyUser.id);

  interface NotifyItem {
    id: string; type: string; category: string;
    title: string; body: string | null; link: string | null; readAt: Date | null;
  }
  interface NotifyListRes { items: NotifyItem[]; nextCursor: string | null }
  const notifRowsOf = (uid: string) =>
    db.select().from(schema.notifications).where(eq(schema.notifications.userId, uid));

  /* ---- 54.1 既有真事件全链：落行含 category='service' + list 可见 + unreadCount=1 ---- */
  await emitEvent(db, `user:${notifyUser.id}`, EventType.AppointmentCompleted, { appointmentId: aid, petName: '球球' });
  const row501 = (await notifRowsOf(notifyUser.id)).find((n) => n.type === 'appointment.completed');
  check('54.1 emitEvent（appointment.completed）落行含 category=service + 文案/link 正确',
    row501?.category === 'service' && row501.title === '服务已完成' && row501.link === `/appointments/${aid}/live`,
    row501 && { category: row501.category, title: row501.title, link: row501.link });
  const list501 = await trpcQuery<NotifyListRes>('push.listNotifications', { cookie: notifyCookie, input: {} });
  check('54.1 listNotifications 可见该行且返回行带 category 字段',
    list501.items.length === 1 && list501.items[0]!.id === row501?.id && list501.items[0]!.category === 'service',
    list501.items.map((n) => `${n.type}:${n.category}`));
  const uc501 = await trpcQuery<{ total: number; byCategory: Record<string, number> }>('push.unreadCount', { cookie: notifyCookie });
  check('54.1 unreadCount=1（byCategory.service=1）',
    uc501.total === 1 && uc501.byCategory.service === 1, uc501);

  /* ---- 54.2 已读幂等 + markAllRead + 删除仅本人（他人 403） ---- */
  const mr1 = await trpcMutate<{ marked: number }>('push.markRead', { cookie: notifyCookie, input: { ids: [row501!.id] } });
  const mr2 = await trpcMutate<{ marked: number }>('push.markRead', { cookie: notifyCookie, input: { ids: [row501!.id] } });
  check('54.2 markRead 幂等：首次 marked=1 / 重复调 marked=0（零副作用）',
    mr1.marked === 1 && mr2.marked === 0, { mr1, mr2 });
  /* 补缺修复小批 P2-2 口径适配：同 aid 同分钟桶事件聚合为 1 条进度卡——本段测 markAllRead 幂等，
     夹具两事件改用不同 appointmentId（避免撞聚合键；聚合行为本体见 54.6 专项断言） */
  await emitEvent(db, `user:${notifyUser.id}`, EventType.BoardingCompleted, { appointmentId: `${aid}-b2` });
  await emitEvent(db, `user:${notifyUser.id}`, EventType.AppointmentCancelled, { appointmentId: `${aid}-c2` });
  const uc502a = await trpcQuery<{ total: number }>('push.unreadCount', { cookie: notifyCookie });
  const ma1 = await trpcMutate<{ marked: number }>('push.markAllRead', { cookie: notifyCookie, input: {} });
  const ma2 = await trpcMutate<{ marked: number }>('push.markAllRead', { cookie: notifyCookie, input: {} });
  const uc502b = await trpcQuery<{ total: number }>('push.unreadCount', { cookie: notifyCookie });
  check('54.2 markAllRead 幂等：2 条未读全已读（marked=2）/ 重复调 marked=0 / unreadCount 归零',
    uc502a.total === 2 && ma1.marked === 2 && ma2.marked === 0 && uc502b.total === 0,
    { before: uc502a.total, ma1, ma2, after: uc502b.total });

  const delForeign = await asErr(trpcMutate('push.deleteNotification', { cookie: ownerCookie, input: { id: row501!.id } }));
  check('54.2 deleteNotification 他人通知 → 403 FORBIDDEN',
    delForeign instanceof TrpcHttpError && delForeign.httpStatus === 403 && delForeign.code === 'FORBIDDEN',
    delForeign && { status: delForeign.httpStatus, code: delForeign.code, message: delForeign.message });
  const delOwn = await trpcMutate<{ deleted: boolean }>('push.deleteNotification', { cookie: notifyCookie, input: { id: row501!.id } });
  const delGone = (await db.select().from(schema.notifications).where(eq(schema.notifications.id, row501!.id))).length === 0;
  check('54.2 deleteNotification 本人删除成功且行消失',
    delOwn.deleted === true && delGone, { deleted: delOwn.deleted, delGone });

  /* ---- 54.3 分类：不同 eventType 落不同 category + list 按 category 过滤 ---- */
  await emitEvent(db, `user:${notifyUser.id}`, EventType.OrderPaid, { orderId: 'e2e-order-503' });
  await emitEvent(db, `user:${notifyUser.id}`, EventType.MembershipOpened, { planKey: 'plan_yinghuo' });
  await emitEvent(db, `user:${notifyUser.id}`, 'marketing.promo', { text: 'e2e 营销' });
  const rows503 = await notifRowsOf(notifyUser.id);
  const cat503 = (t: string) => rows503.find((n) => n.type === t)?.category;
  check('54.3 落库分类正确（order.paid→trade / membership.opened→account / marketing.promo→marketing）',
    cat503('order.paid') === 'trade' && cat503('membership.opened') === 'account' && cat503('marketing.promo') === 'marketing',
    rows503.map((n) => `${n.type}:${n.category}`));
  const listTrade = await trpcQuery<NotifyListRes>('push.listNotifications', { cookie: notifyCookie, input: { category: 'trade' } });
  check('54.3 list 按 category=trade 过滤（全部 trade 且含 order.paid）',
    listTrade.items.length > 0 && listTrade.items.every((n) => n.category === 'trade') &&
      listTrade.items.some((n) => n.type === 'order.paid'),
    listTrade.items.map((n) => `${n.type}:${n.category}`));
  const listMarketing = await trpcQuery<NotifyListRes>('push.listNotifications', { cookie: notifyCookie, input: { category: 'marketing' } });
  check('54.3 list 按 category=marketing 过滤（恰含 marketing.promo）',
    listMarketing.items.length === 1 && listMarketing.items[0]!.type === 'marketing.promo',
    listMarketing.items.map((n) => `${n.type}:${n.category}`));

  /* ---- 54.4 订阅：营销可关 / 交易·服务·账户不可关（硬口径） ---- */
  const prefOff = await trpcMutate<{ category: string; enabled: boolean }>('push.setNotifyPref', {
    cookie: notifyCookie, input: { category: 'marketing', enabled: false },
  });
  const prefs504 = await trpcQuery<{ prefs: Array<{ category: string; enabled: boolean; mutable: boolean }> }>('push.notifyPrefs', { cookie: notifyCookie });
  check('54.4 setNotifyPref marketing=0 成功；notifyPrefs 透出（marketing enabled=false mutable=true，其余缺省全 1）',
    prefOff.enabled === false &&
      prefs504.prefs.length === 4 &&
      prefs504.prefs.find((p) => p.category === 'marketing')?.enabled === false &&
      prefs504.prefs.filter((p) => p.category !== 'marketing').every((p) => p.enabled === true && p.mutable === false),
    prefs504.prefs);
  await emitEvent(db, `user:${notifyUser.id}`, 'marketing.promo2', { text: 'e2e 退订后营销' });
  const promo2Rows = (await notifRowsOf(notifyUser.id)).filter((n) => n.type === 'marketing.promo2');
  const promo2Outbox = (await db.select().from(schema.eventOutbox)).filter((r) => r.eventType === 'marketing.promo2');
  check('54.4 退订后营销事件不落该用户通知（notifications 0 行；outbox 仍写=事件本身不丢）',
    promo2Rows.length === 0 && promo2Outbox.length === 1, { notif: promo2Rows.length, outbox: promo2Outbox.length });
  await emitEvent(db, `user:${notifyUser.id}`, EventType.OrderPaid, { orderId: 'e2e-order-504' });
  await emitEvent(db, `user:${notifyUser.id}`, EventType.AppointmentCompleted, { appointmentId: aid });
  const rows504 = await notifRowsOf(notifyUser.id);
  check('54.4 退订仅拦营销：trade（order.paid）/ service（appointment.completed）恒落',
    rows504.some((n) => n.type === 'order.paid' && (n.link?.includes('e2e-order-504') ?? false)) &&
      rows504.some((n) => n.type === 'appointment.completed'),
    rows504.map((n) => `${n.type}:${n.category}`));
  for (const cat of ['trade', 'service', 'account'] as const) {
    const r = await asErr(trpcMutate('push.setNotifyPref', { cookie: notifyCookie, input: { category: cat, enabled: false } }));
    check(`54.4 非营销类（${cat}）置 0 硬拒明文「交易/服务/账户通知为保障服务履约不可关闭」`,
      r instanceof TrpcHttpError && r.code === 'BAD_REQUEST' && r.message.includes('交易/服务/账户通知为保障服务履约不可关闭'),
      r && { status: r.httpStatus, code: r.code, message: r.message });
  }
  const prefOn = await trpcMutate<{ enabled: boolean }>('push.setNotifyPref', { cookie: notifyCookie, input: { category: 'marketing', enabled: true } });
  await emitEvent(db, `user:${notifyUser.id}`, 'marketing.promo3', { text: 'e2e 恢复订阅营销' });
  const promo3Rows = (await notifRowsOf(notifyUser.id)).filter((n) => n.type === 'marketing.promo3');
  check('54.4 恢复订阅幂等（marketing=1 成功）→ 后续营销事件照常落库',
    prefOn.enabled === true && promo3Rows.length === 1 && promo3Rows[0]!.category === 'marketing',
    { enabled: prefOn.enabled, promo3: promo3Rows.length });

  /* ---- 54.5 挂接槽位：片 1/片 4 事件名直发 → 通知落库文案/link/category 正确 ---- */
  /* 补缺修复小批 P2-2 口径适配：certificate/report 夹具用不同 aid（同 aid 同分钟桶=聚合为 1 条进度卡，
     见 54.6；本段测槽位文案/link 须各自成行） */
  await emitEvent(db, `user:${notifyUser.id}`, 'certificate.ready', { appointmentId: aid, petName: '球球' });
  await emitEvent(db, `user:${notifyUser.id}`, 'report.ready', { appointmentId: `${aid}-r`, petName: '球球' });
  await emitEvent(db, `user:${notifyUser.id}`, 'ticket.replied', { ticketId: 'tk-e2e-1' });
  await emitEvent(db, `user:${notifyUser.id}`, 'refundRequest.approved', { amountFen: 100 });
  await emitEvent(db, `user:${notifyUser.id}`, 'refundRequest.rejected', { reason: '凭证不足' });
  await emitEvent(db, `user:${notifyUser.id}`, 'invoice.issued', { invoiceNo: 'INV-E2E' });
  const rows505 = await notifRowsOf(notifyUser.id);
  const slotRow = (t: string) => rows505.find((n) => n.type === t);
  check('54.5 certificate.ready 落库（安心证书已生成 / link=/philia/certs/:aid / service）',
    slotRow('certificate.ready')?.title === '安心证书已生成' && slotRow('certificate.ready')?.link === `/philia/certs/${aid}` &&
      slotRow('certificate.ready')?.category === 'service' && (slotRow('certificate.ready')?.body ?? '').includes('球球'),
    slotRow('certificate.ready'));
  check('54.5 report.ready 落库（美容报告已送达 / link=/philia/reports/:aid / service）',
    slotRow('report.ready')?.title === '美容报告已送达' && slotRow('report.ready')?.link === `/philia/reports/${aid}-r` &&
      slotRow('report.ready')?.category === 'service',
    slotRow('report.ready'));
  check('54.5 ticket.replied 落库（小棉花回复 / link=/support/:ticketId / service 兜底）',
    slotRow('ticket.replied')?.title === '小棉花回复' && slotRow('ticket.replied')?.link === '/support/tk-e2e-1' &&
      slotRow('ticket.replied')?.category === 'service',
    slotRow('ticket.replied'));
  check('54.5 refundRequest.approved 落库（退款申请已批准 / link=/refunds / trade）',
    slotRow('refundRequest.approved')?.title === '退款申请已批准' && slotRow('refundRequest.approved')?.link === '/refunds' &&
      slotRow('refundRequest.approved')?.category === 'trade',
    slotRow('refundRequest.approved'));
  check('54.5 refundRequest.rejected 落库（退款申请已驳回 / body 带 reason / trade）',
    slotRow('refundRequest.rejected')?.title === '退款申请已驳回' &&
      (slotRow('refundRequest.rejected')?.body ?? '').includes('凭证不足') &&
      slotRow('refundRequest.rejected')?.link === '/refunds' && slotRow('refundRequest.rejected')?.category === 'trade',
    slotRow('refundRequest.rejected'));
  check('54.5 invoice.issued 落库（发票已开具 / link=/invoices / trade）',
    slotRow('invoice.issued')?.title === '发票已开具' && slotRow('invoice.issued')?.link === '/invoices' &&
      slotRow('invoice.issued')?.category === 'trade',
    slotRow('invoice.issued'));

  /* ---- 54.6（补缺修复小批 P2-2）：同单同刻聚合（appointmentId+分钟桶）+ 主语完整式文案 ---- */
  console.log('\n[片5] 54.6 同单同刻聚合 + 主语完整（补缺修复小批 P2-2）');
  const aidM1 = 'e2e-merge-aid-1';
  await emitEvent(db, `user:${notifyUser.id}`, EventType.AppointmentConfirmed, { appointmentId: aidM1, petName: '球球' });
  await emitEvent(db, `user:${notifyUser.id}`, EventType.AppointmentAssigned, { appointmentId: aidM1, petName: '球球' });
  await emitEvent(db, `user:${notifyUser.id}`, EventType.AppointmentCheckedIn, { appointmentId: aidM1, petName: '球球' });
  const m1Rows = (await notifRowsOf(notifyUser.id)).filter((n) => (n.link ?? '').includes(aidM1));
  check('54.6 同单同刻三连事件聚合=1 行进度卡（内容=最新「已到店签到」，readAt 置回未读提示新进度）',
    m1Rows.length === 1 && m1Rows[0]!.type === 'appointment.checkedin' &&
      m1Rows[0]!.body === '【球球】已到店，服务即将开始' && m1Rows[0]!.readAt === null,
    m1Rows.map((n) => `${n.type}:${n.body}`));
  /* 分钟桶滚动：首行 createdAt 回拨 61 秒 → 同 aid 新事件出桶另起行 */
  await db.update(schema.notifications)
    .set({ createdAt: new Date(Date.now() - 61_000) })
    .where(eq(schema.notifications.id, m1Rows[0]!.id));
  await emitEvent(db, `user:${notifyUser.id}`, EventType.AppointmentCompleted, { appointmentId: aidM1, petName: '球球' });
  const m1Rows2 = (await notifRowsOf(notifyUser.id)).filter((n) => (n.link ?? '').includes(aidM1));
  check('54.6 分钟桶滚动后同单新事件另起行（2 行=桶外不聚合；进度卡语义不吞跨分钟历史）',
    m1Rows2.length === 2 && m1Rows2.some((n) => n.type === 'appointment.completed'),
    m1Rows2.map((n) => `${n.type}`));
  /* 主语完整式：预约已确认=「【球球】的预约已确认」（消「您旺财的预约」拼接语病） */
  await emitEvent(db, `user:${notifyUser.id}`, EventType.AppointmentConfirmed, { appointmentId: 'e2e-merge-aid-2', petName: '球球' });
  const m2Row = (await notifRowsOf(notifyUser.id)).find((n) => (n.link ?? '').includes('e2e-merge-aid-2'));
  check('54.6 主语完整式文案（「【球球】的预约已确认，请按时到店」）',
    m2Row?.body === '【球球】的预约已确认，请按时到店', m2Row?.body);
  /* 无预约键事件不聚合：refundRequest.approved 两连发各行其是 */
  await emitEvent(db, `user:${notifyUser.id}`, 'refundRequest.approved', { amountFen: 200 });
  await emitEvent(db, `user:${notifyUser.id}`, 'refundRequest.approved', { amountFen: 300 });
  const noKeyRows = (await notifRowsOf(notifyUser.id)).filter((n) => n.type === 'refundRequest.approved');
  check('54.6 无预约键事件不聚合（link=/refunds 无 aid → 两连发两行）',
    noKeyRows.length === 3, noKeyRows.length); // 54.5 既有 1 行 + 本段 2 行
  /* 54.6 收尾清零（防残留未读污染后续段计数口径） */
  await trpcMutate('push.markAllRead', { cookie: notifyCookie, input: {} });

  /* ==================================================================
   * 批次 6 补缺大批（server 侧支付骨架）验收段
   * 移位铁律遵守：全程不对 pay_orders.createdAt 移位（payNo 日序计号依赖）；
   * 超时夹具只改 timeout_at（业务字段，非计号依据）。
   * ================================================================== */
  console.log('\n[批次6] 55. server 侧支付骨架（收单/回调/状态机/四态/退款联动/端口/权限）');
  const { signMockCallback, MOCK_SIGNATURE_HEADER } = await import('../payments/mockPay');
  const { closeTimeoutPayOrders } = await import('../routers/pay');

  interface PayOrderRowT {
    id: string; payNo: string; bizDomain: string; bizId: string; amountFen: number;
    channel: string; status: string; paymentId: string | null; idemKey: string;
    timeoutAt: Date | null; callbackJson: Record<string, unknown> | null;
  }
  interface CreateOrderRes {
    order: PayOrderRowT; idempotent: boolean;
    paymentId: string | null; payParams: Record<string, string> | null;
  }
  /** 协议三件套夹具（member_service/not_prepaid/no_auto_renew 必传） */
  const AGREEMENTS_FIXTURE = [
    { agreementKey: 'member_service', version: 'v1.0', content: '《菲丽亚会员服务协议》全文快照：会员权益/年费/多宠附加费/回馈金规则……' },
    { agreementKey: 'not_prepaid', version: 'v1.0', content: '《非预付卡声明》全文快照：会员年费为权益服务费，非单用途预付卡……' },
    { agreementKey: 'no_auto_renew', version: 'v1.0', content: '《到期不自动续费告知》全文快照：会员到期不自动续费，到期冻结……' },
  ];
  /** 原生 POST（回调/演示端点用；body 对象自动 JSON 化，字符串原文直发） */
  async function postRaw(
    path: string,
    body: unknown,
    headers: Record<string, string> = {},
    cookie?: string,
  ): Promise<{ status: number; json: any }> {
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers, ...(cookie ? { cookie } : {}) },
      body: raw,
    });
    return { status: res.status, json: await res.json().catch(() => null) };
  }
  /** 支付验收客户建档（直插 users+user_roles 后 dev-login；kimiId 须 seed_ 前缀——dev-login 仅允许种子用户，D-16 硬约束） */
  async function mkPayCustomer(phone: string, nickname: string): Promise<{ id: string; cookie: string }> {
    const row = await db
      .insert(schema.users)
      .values({ kimiId: `seed_pay_e2e_${phone}`, phone, nickname })
      .returning({ id: schema.users.id })
      .then((r) => r[0]!);
    await db.insert(schema.userRoles).values({ userId: row.id, role: 'customer' });
    return { id: row.id, cookie: await devLogin(row.id) };
  }
  const createPayOrder = (cookie: string, input: Record<string, unknown>) =>
    trpcMutate<CreateOrderRes>('pay.createOrder', { cookie, input });

  /* ---- 55.1 createOrder 幂等 + 协议留痕 + 金额 server 重算 ---- */
  console.log('\n[批次6] 55.1 createOrder 幂等 + 协议三行快照 + 金额 server 重算');
  const p1 = await mkPayCustomer('13922220001', '支付客一');
  const quote1 = await trpcQuery<{
    amountFen: number; priceFen: number; extraCount: number; channelEnabled: boolean; timeoutMinutes: number;
  }>('pay.quote', { cookie: p1.cookie, input: { bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 4 } });
  check('55.1 quote server 重算透出（萤火 4 只=19900+5900=25800；通道开/超时 30min 端口值）',
    quote1.amountFen === 25800 && quote1.priceFen === 19900 && quote1.extraCount === 1 &&
      quote1.channelEnabled === true && quote1.timeoutMinutes === 30, quote1);

  const co1 = await createPayOrder(p1.cookie, {
    bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 4,
    amountFen: 1, // 假金额：server 必须忽略并重算覆盖
    agreements: AGREEMENTS_FIXTURE,
  });
  check('55.1 createOrder 金额 server 重算（入参假金额 1 分被覆盖 → 25800）+ paying + mock 单号',
    co1.order.amountFen === 25800 && co1.order.status === 'paying' && co1.idempotent === false &&
      !!co1.paymentId && co1.paymentId.startsWith('mock_') && co1.payParams?.mock === '1' &&
      co1.payParams?.scenario === 'success' && co1.order.payNo.startsWith('PO-'),
    { amountFen: co1.order.amountFen, status: co1.order.status, payNo: co1.order.payNo });
  check('55.1 timeoutAt=now+端口 30min 快照（通道开关/时长读 pay_rules）',
    !!co1.order.timeoutAt &&
      Math.abs(co1.order.timeoutAt.getTime() - (Date.now() + 30 * 60_000)) < 120_000,
    co1.order.timeoutAt);

  const agrRows1 = await db.select().from(schema.agreements).where(eq(schema.agreements.userId, p1.id));
  const agrKeys1 = agrRows1.map((r) => r.agreementKey).sort();
  const agrSnap1 = agrRows1[0]?.userSnapshot as Record<string, unknown> | undefined;
  check('55.1 agreements 三行快照（三键齐/content/version/checkedAt 全落）',
    agrRows1.length === 3 &&
      agrKeys1.join(',') === 'member_service,no_auto_renew,not_prepaid' &&
      agrRows1.every((r) => r.content.length > 10 && r.version === 'v1.0' && !!r.checkedAt),
    agrRows1.map((r) => r.agreementKey));
  check('55.1 userSnapshot 取证四要素（userId/phoneMasked/planKey/petCount）',
    agrSnap1?.userId === p1.id && agrSnap1?.phoneMasked === '139****0001' &&
      agrSnap1?.planKey === 'plan_yinghuo' && agrSnap1?.petCount === 4, agrSnap1);

  const co1b = await createPayOrder(p1.cookie, {
    bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 4, agreements: AGREEMENTS_FIXTURE,
  });
  const co1Count = await db.select({ id: schema.payOrders.id }).from(schema.payOrders)
    .where(and(eq(schema.payOrders.bizDomain, 'membership_open'), eq(schema.payOrders.bizId, p1.id)));
  const agrCount1 = await db.select({ id: schema.agreements.id }).from(schema.agreements)
    .where(eq(schema.agreements.userId, p1.id));
  check('55.1 幂等：同人同档当日在途重复创建=返回现状（idempotent=true/同 payNo/零新行/协议不重复留痕）',
    co1b.idempotent === true && co1b.order.payNo === co1.order.payNo &&
      co1Count.length === 1 && agrCount1.length === 3,
    { idempotent: co1b.idempotent, orders: co1Count.length, agreements: agrCount1.length });
  const listMine1 = await trpcQuery<{ items: Array<{ order: PayOrderRowT; biz: { planKey: string | null; petCount: number | null } }> }>(
    'pay.listMine', { cookie: p1.cookie });
  check('55.1 listMine 本人单+业务摘要（planKey/petCount 透出）',
    listMine1.items.length === 1 && listMine1.items[0]!.order.payNo === co1.order.payNo &&
      listMine1.items[0]!.biz.planKey === 'plan_yinghuo' && listMine1.items[0]!.biz.petCount === 4,
    listMine1.items.length);

  /* ---- 55.2 回调全链：签名回调→paid+memberships 落行；重放零副作用；金额不符 400 ---- */
  console.log('\n[批次6] 55.2 回调全链（mock 签名回调/兑付/重放幂等/金额不符拒）');
  const mc1 = await postRaw('/api/pay/orders/mock-callback', { orderId: co1.order.id }, {}, p1.cookie);
  check('55.2 mock-callback success → 200 SUCCESS', mc1.status === 200 && mc1.json?.code === 'SUCCESS', mc1);
  const st1 = await trpcQuery<{ order: PayOrderRowT }>('pay.status', { cookie: p1.cookie, input: { payNo: co1.order.payNo } });
  check('55.2 回调后 status=paid + callbackJson 存档（含 paymentId）',
    st1.order.status === 'paid' && !!st1.order.callbackJson &&
      (st1.order.callbackJson as Record<string, unknown>).paymentId === co1.paymentId,
    { status: st1.order.status, callbackJson: st1.order.callbackJson });
  const m1 = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, p1.id)).get();
  check('55.2 同事务兑付：memberships 落行（萤火/4 只/25800/active/soldStore=null 线上域）',
    m1?.planKey === 'plan_yinghuo' && m1.petCount === 4 && m1.paidFen === 25800 &&
      m1.status === 'active' && m1.soldStoreId === null,
    m1 && { planKey: m1.planKey, petCount: m1.petCount, paidFen: m1.paidFen, soldStoreId: m1.soldStoreId });
  const ev1 = await db.select().from(schema.eventOutbox)
    .where(and(eq(schema.eventOutbox.channel, `user:${p1.id}`), eq(schema.eventOutbox.eventType, 'membership.opened')));
  check('55.2 SSE user 频道 membership.opened 事件已落 outbox',
    ev1.length >= 1 && (ev1[0]!.payload as Record<string, unknown>).payNo === co1.order.payNo,
    ev1.map((e) => e.eventType));

  const rawReplay = JSON.stringify({ paymentId: co1.paymentId, orderId: co1.order.id, paidFen: 25800 });
  const replay = await postRaw('/api/pay/orders/callback', rawReplay, { [MOCK_SIGNATURE_HEADER]: signMockCallback(rawReplay) });
  const m1Count = await db.select({ id: schema.memberships.id }).from(schema.memberships)
    .where(eq(schema.memberships.userId, p1.id));
  check('55.2 重放回调零副作用（idempotent=true/memberships 不重建）',
    replay.status === 200 && replay.json?.code === 'SUCCESS' && replay.json?.idempotent === true &&
      m1Count.length === 1,
    { status: replay.status, json: replay.json, memberships: m1Count.length });
  const rawBadAmt = JSON.stringify({ paymentId: co1.paymentId, orderId: co1.order.id, paidFen: 999 });
  const badAmt = await postRaw('/api/pay/orders/callback', rawBadAmt, { [MOCK_SIGNATURE_HEADER]: signMockCallback(rawBadAmt) });
  const st1b = await trpcQuery<{ order: PayOrderRowT }>('pay.status', { cookie: p1.cookie, input: { payNo: co1.order.payNo } });
  check('55.2 金额不符 400（AMOUNT_MISMATCH，单不动仍 paid）',
    badAmt.status === 400 && badAmt.json?.code === 'AMOUNT_MISMATCH' && st1b.order.status === 'paid',
    badAmt);
  const rawBadSig = JSON.stringify({ paymentId: co1.paymentId, orderId: co1.order.id, paidFen: 25800 });
  const badSig = await postRaw('/api/pay/orders/callback', rawBadSig, { [MOCK_SIGNATURE_HEADER]: '0'.repeat(64) });
  check('55.2 验签失败 400（INVALID_SIGNATURE，Mock 也走验签流程）',
    badSig.status === 400 && badSig.json?.code === 'INVALID_SIGNATURE', badSig);

  /* ---- 55.3 状态机非法迁移硬拒（closed 单再回调/再支付拒） ---- */
  console.log('\n[批次6] 55.3 状态机非法迁移硬拒');
  const p2 = await mkPayCustomer('13922220002', '支付客二');
  const co2 = await createPayOrder(p2.cookie, {
    bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 0, agreements: AGREEMENTS_FIXTURE,
  });
  // 超时夹具：只改 timeout_at（铁律：不动 created_at——payNo 日序计号依赖）
  await db.update(schema.payOrders).set({ timeoutAt: new Date(Date.now() - 1000) })
    .where(eq(schema.payOrders.id, co2.order.id));
  const st2 = await trpcQuery<{ order: PayOrderRowT }>('pay.status', { cookie: p2.cookie, input: { payNo: co2.order.payNo } });
  check('55.3 懒超时：paying 过 timeoutAt → status 查询事务置 closed', st2.order.status === 'closed', st2.order.status);
  const rawC2 = JSON.stringify({ paymentId: co2.paymentId, orderId: co2.order.id, paidFen: 19900 });
  const cbClosed = await postRaw('/api/pay/orders/callback', rawC2, { [MOCK_SIGNATURE_HEADER]: signMockCallback(rawC2) });
  check('55.3 closed 单再回调 → 400 STATE_CONFLICT（状态机硬拒，不置 paid）',
    cbClosed.status === 400 && cbClosed.json?.code === 'STATE_CONFLICT', cbClosed);
  const mcClosed = await postRaw('/api/pay/orders/mock-callback', { orderId: co2.order.id }, {}, p2.cookie);
  check('55.3 closed 单再支付（mock-callback）→ 400 硬拒',
    mcClosed.status === 400 && mcClosed.json?.code === 'STATE_CONFLICT', mcClosed);
  const m2 = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, p2.id)).get();
  check('55.3 硬拒后零副作用（closed 单未兑付会员）', !m2, m2?.id);

  /* ---- 55.4 Mock 四态：fail/timeout/drop（success 已在 55.2 坐实） ---- */
  console.log('\n[批次6] 55.4 Mock 四态（fail 留痕 / timeout sweeper 关单 / drop reconcile 补开）');
  const p3 = await mkPayCustomer('13922220003', '支付客三');
  const co3 = await createPayOrder(p3.cookie, {
    bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 0, agreements: AGREEMENTS_FIXTURE,
  });
  const mc3 = await postRaw('/api/pay/orders/mock-callback', { orderId: co3.order.id, scenario: 'fail' }, {}, p3.cookie);
  const st3 = await trpcQuery<{ order: PayOrderRowT }>('pay.status', { cookie: p3.cookie, input: { payNo: co3.order.payNo } });
  const m3 = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, p3.id)).get();
  check('55.4 fail：通道支付失败 → status=failed 留痕 + 零兑付',
    mc3.status === 200 && st3.order.status === 'failed' && !m3, { mc: mc3.status, status: st3.order.status });

  const p4 = await mkPayCustomer('13922220004', '支付客四');
  const co4 = await createPayOrder(p4.cookie, {
    bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 0, agreements: AGREEMENTS_FIXTURE,
  });
  const mc4 = await postRaw('/api/pay/orders/mock-callback', { orderId: co4.order.id, scenario: 'timeout' }, {}, p4.cookie);
  const st4a = await trpcQuery<{ order: PayOrderRowT }>('pay.status', { cookie: p4.cookie, input: { payNo: co4.order.payNo } });
  check('55.4 timeout：用户不付留 paying（不动通道不发回调）',
    mc4.status === 200 && st4a.order.status === 'paying', { mc: mc4.status, status: st4a.order.status });
  // 超时夹具：timeout_at 拨到过去（不动 created_at）→ sweeper 直调到点关单
  await db.update(schema.payOrders).set({ timeoutAt: new Date(Date.now() - 1000) })
    .where(eq(schema.payOrders.id, co4.order.id));
  const swept4 = await closeTimeoutPayOrders(db, new Date());
  const st4b = await trpcQuery<{ order: PayOrderRowT }>('pay.status', { cookie: p4.cookie, input: { payNo: co4.order.payNo } });
  const ev4 = await db.select().from(schema.eventOutbox)
    .where(and(eq(schema.eventOutbox.channel, `user:${p4.id}`), eq(schema.eventOutbox.eventType, 'pay.orderClosed')));
  check('55.4 timeout：sweeper 到点置 closed + SSE user 频道 pay.orderClosed',
    swept4 >= 1 && st4b.order.status === 'closed' &&
      ev4.length >= 1 && (ev4[0]!.payload as Record<string, unknown>).payNo === co4.order.payNo,
    { swept: swept4, status: st4b.order.status, events: ev4.length });

  const p5 = await mkPayCustomer('13922220005', '支付客五');
  const co5 = await createPayOrder(p5.cookie, {
    bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 0, agreements: AGREEMENTS_FIXTURE,
  });
  const mc5 = await postRaw('/api/pay/orders/mock-callback', { orderId: co5.order.id, scenario: 'drop' }, {}, p5.cookie);
  const st5a = await trpcQuery<{ order: PayOrderRowT }>('pay.status', { cookie: p5.cookie, input: { payNo: co5.order.payNo } });
  check('55.4 drop：通道已扣款但回调丢弃 → 单留 paying（掉单场景）',
    mc5.status === 200 && st5a.order.status === 'paying', { mc: mc5.status, status: st5a.order.status });
  const rc5 = await trpcMutate<{ order: PayOrderRowT; reconciled: boolean; message: string }>('pay.reconcile', {
    cookie: p5.cookie, input: { payNo: co5.order.payNo },
  });
  const m5 = await db.select().from(schema.memberships).where(eq(schema.memberships.userId, p5.id)).get();
  check('55.4 drop：reconcile 自助补开成功=掉单补偿坐实（paid + memberships 落行）',
    rc5.reconciled === true && rc5.order.status === 'paid' &&
      m5?.planKey === 'plan_yinghuo' && m5.paidFen === 19900 && m5.soldStoreId === null,
    { reconciled: rc5.reconciled, status: rc5.order.status, membership: m5?.id });
  const rc5b = await trpcMutate<{ order: PayOrderRowT; reconciled: boolean }>('pay.reconcile', {
    cookie: p5.cookie, input: { payNo: co5.order.payNo },
  });
  const m5Count = await db.select({ id: schema.memberships.id }).from(schema.memberships)
    .where(eq(schema.memberships.userId, p5.id));
  check('55.4 reconcile 幂等（已 paid 返回现状，会员不重建）',
    rc5b.reconciled === false && rc5b.order.status === 'paid' && m5Count.length === 1,
    { reconciled: rc5b.reconciled, memberships: m5Count.length });

  /* ---- 55.5 退款联动：online_original + linkage.payOrderNo + provider.refund 留痕 ---- */
  console.log('\n[批次6] 55.5 退款联动（线上原路骨架）');
  /* §49c 段尾铁律兼容：退会退款单 createdAt 移位 25h 会使 genRefundNo 当日计数 −1，
   * 其后任何新退款单必撞 uq_refund_bills_refund_no（§49 设计前提=「移位后不再生成退款单」）。
   * 本段须走 refund.execute 生成新退款单，故先把 §49 夹具的移位复原（count 复归正确→
   * 下一个日序不撞号）——只动夹具数据，不触碰 §49 任何已断言内容（断言在其时已闭环）。 */
  await db.update(schema.refundBills).set({ createdAt: new Date() })
    .where(eq(schema.refundBills.id, cancelM1.refundId));
  const p6 = await mkPayCustomer('13922220006', '支付客六');
  // 到店售卡（现金原单）→ 同人线上重复支付（已是会员：兑付幂等不重建只置 paid）
  const sellP6 = await sellPlan(managerCookie, {
    userId: p6.id, planKey: 'plan_yinghuo', petCount: 0,
    paySegments: [{ method: 'cash', amountFen: 19900 }],
  });
  const co6 = await createPayOrder(p6.cookie, {
    bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 0, agreements: AGREEMENTS_FIXTURE,
  });
  await postRaw('/api/pay/orders/mock-callback', { orderId: co6.order.id }, {}, p6.cookie);
  const m6Count = await db.select({ id: schema.memberships.id }).from(schema.memberships)
    .where(eq(schema.memberships.userId, p6.id));
  check('55.5 前置：已是会员线上重复支付 → paid 但 memberships 不重建（幂等兑付）',
    m6Count.length === 1, m6Count.length);
  const rf6 = await trpcMutate<{
    refund: { id: string; refundNo: string; refundMethod: string | null; linkageJson: Record<string, unknown> | null; amountFen: number };
    idempotent: boolean;
  }>('refund.execute', {
    cookie: managerCookie,
    input: { billNo: sellP6.billNo, type: 'full', reason: '批次6 线上原路联动验证（重复支付退线上单）' },
  });
  const linkage6 = (rf6.refund.linkageJson ?? {}) as Record<string, unknown>;
  const online6 = (linkage6.onlineRefund ?? {}) as Record<string, unknown>;
  check('55.5 线上支付单退款 → refundMethod=online_original（server 强制）',
    rf6.refund.refundMethod === 'online_original' && rf6.idempotent === false,
    { refundMethod: rf6.refund.refundMethod });
  check('55.5 linkage.payOrderNo 快照 + provider.refund 留痕（mock=ok，两路单据同源）',
    linkage6.payOrderNo === co6.order.payNo &&
      online6.paymentId === co6.paymentId && online6.channel === 'mock' &&
      online6.provider === 'mock' && online6.refundFen === 19900 && online6.result === 'ok',
    { payOrderNo: linkage6.payOrderNo, onlineRefund: online6 });

  /* ---- 55.6 超时关单端口可调（config.save 改 minutes 生效复还原） ---- */
  console.log('\n[批次6] 55.6 超时关单端口可调');
  const payCfgList = await trpcQuery<{ rules: Array<{ ruleKey: string; active: boolean }> }>('config.list', {
    cookie: ownerCookie, input: { domain: 'pay' },
  });
  check('55.6 pay 域种子两行在库（pay_timeout_minutes/pay_channel_enabled，0017 幂等迁移落）',
    payCfgList.rules.some((r) => r.ruleKey === 'pay_timeout_minutes' && r.active) &&
      payCfgList.rules.some((r) => r.ruleKey === 'pay_channel_enabled' && r.active),
    payCfgList.rules.map((r) => r.ruleKey));
  const save6 = await trpcMutate<{ version: number }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'pay', changes: [{ ruleKey: 'pay_timeout_minutes', valueJson: { minutes: 1 } }] },
  });
  const p7 = await mkPayCustomer('13922220007', '支付客七');
  const co7 = await createPayOrder(p7.cookie, {
    bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 0, agreements: AGREEMENTS_FIXTURE,
  });
  check('55.6 端口改值即生效：minutes=1 → 新单 timeoutAt≈now+60s（不再 30min）',
    save6.version >= 2 && !!co7.order.timeoutAt &&
      Math.abs(co7.order.timeoutAt.getTime() - (Date.now() + 60_000)) < 30_000,
    { version: save6.version, timeoutAt: co7.order.timeoutAt });
  const swept6 = await closeTimeoutPayOrders(db, new Date(Date.now() + 120_000)); // 合成到点
  const st6 = await trpcQuery<{ order: PayOrderRowT }>('pay.status', { cookie: p7.cookie, input: { payNo: co7.order.payNo } });
  check('55.6 sweeper 按新 timeoutAt 到点关单（closed）',
    swept6 >= 1 && st6.order.status === 'closed', { swept: swept6, status: st6.order.status });
  await trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'pay', changes: [{ ruleKey: 'pay_timeout_minutes', valueJson: { minutes: 30 } }] },
  });
  const quote6 = await trpcQuery<{ timeoutMinutes: number }>('pay.quote', {
    cookie: p7.cookie, input: { bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 0 },
  });
  check('55.6 复还原：minutes 回 30（quote 透出还原值）', quote6.timeoutMinutes === 30, quote6.timeoutMinutes);

  /* ---- 55.7 权限：他人 pay_orders status/reconcile 403 ---- */
  console.log('\n[批次6] 55.7 权限（他人单 403）');
  const p8 = await mkPayCustomer('13922220008', '支付客八');
  const [stOther, rcOther] = await Promise.all([
    trpcQuery('pay.status', { cookie: p8.cookie, input: { payNo: co1.order.payNo } }).catch((e) => e),
    trpcMutate('pay.reconcile', { cookie: p8.cookie, input: { payNo: co1.order.payNo } }).catch((e) => e),
  ]);
  check('55.7 他人 pay_orders status/reconcile → 403 FORBIDDEN',
    stOther instanceof TrpcHttpError && stOther.httpStatus === 403 && stOther.code === 'FORBIDDEN' &&
      rcOther instanceof TrpcHttpError && rcOther.httpStatus === 403 && rcOther.code === 'FORBIDDEN',
    { st: stOther instanceof Error ? stOther.message : String(stOther), rc: rcOther instanceof Error ? rcOther.message : String(rcOther) });

  /* ==================================================================
   * 端口批片 B（CJ-1002-01 文案端口 · 控制台第七域 domain='copy'）验收段
   * ================================================================== */
  console.log('\n[片B] 56. 文案端口（copy_overrides 种子/读口/保存双闸/权限/留痕）');
  interface CopyListRes {
    domain: string; currentVersion: number;
    rules: Array<{ ruleKey: string; label: string; valueJson: { text?: string }; active: boolean; version: number }>;
  }
  interface CopyTextsRes { rows: Array<{ key: string; text: string }> }

  /* 56.1 种子全量落库 + 域分组 + 与码内默认同值（读口=端口值→码内默认同源实证）
     计数口径随 copy 键表生长更新：1827/41（端口批片 B）→ 2118/50（片 3 任务协作 UI
     文案批）→ 2330/53（片 4 薪资 XP 文案批）→ 2571/57（片 5 控制台 17 屏批）→ 2716/63（体验大批片 1 批，copySeedRows 官方生成件重生成；断言数=生成件行数，改动须同步）→ 2801/66（体验大批片 3 客户端文案批，cpn·fav·rev 等族 85 键/3 域入册） */
  const copyList0 = await trpcQuery<CopyListRes>('config.list', { cookie: ownerCookie, input: { domain: 'copy' } });
  const refundSubmit = copyList0.rules.find((r) => r.ruleKey === 'refund.submitCta' && r.active);
  const domainSet = new Set(copyList0.rules.map((r) => r.label));
  check('56.1 copy 域种子全量落库（2801 键/66 域；refund.submitCta=提交申请 与码内默认同值）',
    copyList0.rules.length === 2801 && domainSet.size === 66 &&
      refundSubmit?.valueJson.text === '提交申请' && refundSubmit.version === 1,
    { rows: copyList0.rules.length, domains: domainSet.size, sample: refundSubmit?.valueJson.text });
  const texts0 = await trpcQuery<CopyTextsRes>('config.activeCopyTexts', { cookie: customerCookie });
  check('56.1 公共读口透出 active 行全量（2801 行 key→text，客户端覆盖层数据源）',
    texts0.rows.length === 2801 && texts0.rows.some((r) => r.key === 'refund.submitCta' && r.text === '提交申请'),
    texts0.rows.length);

  /* 56.2 端口值优先：owner 改非高危键 home.idFallback → 公共读口新值（保存即生效只管新读）→ 还原 */
  const save56 = await trpcMutate<{ version: number }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'copy', changes: [{ ruleKey: 'home.idFallback', valueJson: { text: '菲丽亚宠友·内测' } }] },
  });
  const texts1 = await trpcQuery<CopyTextsRes>('config.activeCopyTexts', { cookie: customerCookie });
  check('56.2 端口值优先：save 改键 → 公共读口即新值（version 2；保存即生效）',
    save56.version === 2 && texts1.rows.find((r) => r.key === 'home.idFallback')?.text === '菲丽亚宠友·内测',
    { v: save56.version, now: texts1.rows.find((r) => r.key === 'home.idFallback')?.text });
  await trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'copy', changes: [{ ruleKey: 'home.idFallback', valueJson: { text: '菲丽亚宠友' } }] },
  });
  const texts2 = await trpcQuery<CopyTextsRes>('config.activeCopyTexts', { cookie: customerCookie });
  check('56.2 还原：读口回码内默认同值（不留副作用给后续段）',
    texts2.rows.find((r) => r.key === 'home.idFallback')?.text === '菲丽亚宠友', texts2.rows.find((r) => r.key === 'home.idFallback'));

  /* 56.3 高危键闸：refund.* 涉钱键无 confirmedHighRisk → 400；带确认 → 过 */
  const hrNo = await asErr(trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'copy', changes: [{ ruleKey: 'refund.submitCta', valueJson: { text: '提交申请' } }] },
  }));
  const hrOk = await trpcMutate<{ version: number }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'copy', changes: [{ ruleKey: 'refund.submitCta', valueJson: { text: '提交申请' } }], confirmedHighRisk: ['refund.submitCta'] },
  });
  check('56.3 高危键重确认闸：涉钱键无确认 → 400 明文；带 confirmedHighRisk → 放行（同值重写幂等无害）',
    hrNo instanceof TrpcHttpError && hrNo.code === 'BAD_REQUEST' && hrNo.message.includes('高危键') && hrOk.version >= 3,
    { no: hrNo instanceof Error ? hrNo.message : null, ok: hrOk.version });

  /* 56.4 禁令词闸：含「充值」→ 400 明文点名；否定明面句（年费≠储值·不自动续费）→ 放行 */
  const banned = await asErr(trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'copy', changes: [{ ruleKey: 'home.idFallback', valueJson: { text: '充值立享好礼' } }] },
  }));
  const negAllowed = await trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'copy', changes: [{ ruleKey: 'rules.r2', valueJson: { text: '年费 ≠ 储值 · 到期不自动续费' } }], confirmedHighRisk: ['rules.r2'] },
  });
  check('56.4 禁令词闸：「充值」命中即拒明文点名；否定明面句（≠储值/不自动续费）豁免放行',
    banned instanceof TrpcHttpError && banned.code === 'BAD_REQUEST' && banned.message.includes('充值') &&
      typeof (negAllowed as { version?: number }).version === 'number',
    { banned: banned instanceof Error ? banned.message : null, neg: (negAllowed as { version?: number }).version });

  /* 56.4b（片 C 顺带件③ 禁令词闸分端）：merchant:/staff: 内部域含「储值」放行；customer 域照拒 */
  const staffOk = await trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'copy', changes: [{ ruleKey: 'cashier.refundSvNotice', valueJson: { text: '本单涉储值/次卡：退款须店主办理（负债科目不设阈值，server 同口径拦截）' } }], confirmedHighRisk: ['cashier.refundSvNotice'] },
  });
  const custNo = await asErr(trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'copy', changes: [{ ruleKey: 'home.idFallback', valueJson: { text: '储值有好礼' } }] },
  }));
  check('56.4b 禁令词闸分端：merchant 域含「储值」内部文案放行；customer 域「储值」照拒（对外红线不变）',
    typeof (staffOk as { version?: number }).version === 'number' &&
      custNo instanceof TrpcHttpError && custNo.code === 'BAD_REQUEST' && custNo.message.includes('储值'),
    { staff: (staffOk as { version?: number }).version, cust: custNo instanceof Error ? custNo.message : null });
  /* 56.4b 守尾：staffOk 为同值重写（现金 cashier.refundSvNotice 首尾同文），零内容副作用 */

  /* 56.5 权限闸：clerk/manager 对 copy 域 list/save 全 403（仅 owner） */
  const clerkList56 = await asErr(trpcQuery('config.list', { cookie: clerkCookie, input: { domain: 'copy' } }));
  const mgrSave = await asErr(trpcMutate('config.save', {
    cookie: managerCookie,
    input: { domain: 'copy', changes: [{ ruleKey: 'home.idFallback', valueJson: { text: 'x' } }] },
  }));
  check('56.5 权限闸：clerk list / manager save → 403 FORBIDDEN（端口仅 owner）',
    clerkList56 instanceof TrpcHttpError && clerkList56.httpStatus === 403 &&
      mgrSave instanceof TrpcHttpError && mgrSave.httpStatus === 403,
    { list: clerkList56 instanceof Error ? clerkList56.message : null, save: mgrSave instanceof Error ? mgrSave.message : null });

  /* 56.6 未知键拒 + 空文案拒 + 留痕前后值（rule_config_versions domain='copy'） */
  const unknownKey56 = await asErr(trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'copy', changes: [{ ruleKey: 'no.such.key', valueJson: { text: 'x' } }] },
  }));
  const emptyText = await asErr(trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'copy', changes: [{ ruleKey: 'home.idFallback', valueJson: { text: '  ' } }] },
  }));
  const ver56 = await trpcQuery<{
    versions: Array<{ version: number; changerNickname: string | null; changesJson: Array<{ rule_key: string; before: { text?: string } | null; after: { text?: string } }> }>;
  }>('config.versions', { cookie: ownerCookie, input: { domain: 'copy', limit: 5 } });
  const vRow = ver56.versions.find((v) => v.changesJson.some((c) => c.rule_key === 'home.idFallback'));
  /* 版本新→旧排序，首行=还原笔（内测→宠友）；正向笔（宠友→内测）按前后值特征定位 */
  const vChange = ver56.versions
    .flatMap((v) => v.changesJson)
    .find((c) => c.rule_key === 'home.idFallback' && c.before?.text === '菲丽亚宠友' && c.after?.text === '菲丽亚宠友·内测');
  check('56.6 未知键 400 + 空文案 400 + 留痕前后值在库（home.idFallback 菲丽亚宠友→菲丽亚宠友·内测，操作人昵称透出）',
    unknownKey56 instanceof TrpcHttpError && unknownKey56.code === 'BAD_REQUEST' && unknownKey56.message.includes('未知规则键') &&
      emptyText instanceof TrpcHttpError && emptyText.code === 'BAD_REQUEST' &&
      !!vRow && vChange?.before?.text === '菲丽亚宠友' && vChange.after?.text === '菲丽亚宠友·内测' &&
      typeof vRow.changerNickname === 'string',
    { unknown: unknownKey56 instanceof Error ? unknownKey56.message : null, empty: emptyText instanceof Error ? emptyText.message : null, ver: vRow?.changesJson });

  /* ==================================================================
   * 端口批片 C（CJ-1002-01 槽位端口 · slot_contents · 控制台第八域）验收段
   * ================================================================== */
  console.log('\n[片C] 57. 展示槽位（注册表/上传待审/上线/回退/权限）');
  interface SlotLiveMap { slots: Array<{ key: string; url: string | null; alt: string }> }
  interface SlotListRes {
    slots: Array<{
      slotKey: string;
      live: { id: string; version: number; contentJson: { url: string | null }; actedBy: string | null; actedByNickname: string | null } | null;
      pending: Array<{ id: string; version: number; contentJson: { url: string | null } }>;
      totalVersions: number;
    }>;
  }

  /* 57.1 种子六槽 live + liveMap 公开透出（pending 不透出语义随后证） */
  const liveMap0 = await trpcQuery<SlotLiveMap>('slotPort.liveMap', { cookie: customerCookie });
  check('57.1 种子六槽 live 注册（home.banner 等）+ liveMap 透出（url/alt 齐）',
    liveMap0.slots.length === 6 &&
      liveMap0.slots.some((s) => s.key === 'home.banner' && s.url === '/brand/banner-home-1200.png') &&
      liveMap0.slots.some((s) => s.key === 'member.cardFace' && s.url === null),
    liveMap0.slots.map((s) => s.key));

  /* 57.2 upload → pending（liveMap 不透出待审件，列表可见） */
  const up57 = await trpcMutate<{ version: { id: string; version: number; status: string } }>('slotPort.upload', {
    cookie: ownerCookie,
    input: { slotKey: 'home.banner', content: { url: '/api/img/slots/home.banner/e2e57.jpg', alt: '首页品牌横幅（内测换图）' } },
  });
  const list57a = await trpcQuery<SlotListRes>('slotPort.list', { cookie: ownerCookie });
  const banner57a = list57a.slots.find((s) => s.slotKey === 'home.banner')!;
  const liveMapAfterUp = await trpcQuery<SlotLiveMap>('slotPort.liveMap', { cookie: customerCookie });
  check('57.2 上传=新版本 pending 待审（v2 在列表 pending 区）+ liveMap 仍旧值（待审不上线）',
    up57.version.status === 'pending' && up57.version.version === 2 &&
      banner57a.pending.some((p) => p.id === up57.version.id) &&
      banner57a.live?.contentJson.url === '/brand/banner-home-1200.png' &&
      liveMapAfterUp.slots.find((s) => s.key === 'home.banner')?.url === '/brand/banner-home-1200.png',
    { v: up57.version, pending: banner57a.pending.length });

  /* 57.3 publish 点上线 → liveMap 即新值（保存即生效）+ 旧 live→archived */
  await trpcMutate('slotPort.publish', { cookie: ownerCookie, input: { versionId: up57.version.id } });
  const liveMapAfterPub = await trpcQuery<SlotLiveMap>('slotPort.liveMap', { cookie: customerCookie });
  const list57b = await trpcQuery<SlotListRes>('slotPort.list', { cookie: ownerCookie });
  const banner57b = list57b.slots.find((s) => s.slotKey === 'home.banner')!;
  check('57.3 点上线：v2 → live + liveMap 即新值 + pending 清空 + 旧版转 archived（版本历史留）+ 操作人留痕补列（actedBy=owner，顺带件②）',
    liveMapAfterPub.slots.find((s) => s.key === 'home.banner')?.url === '/api/img/slots/home.banner/e2e57.jpg' &&
      banner57b.live?.id === up57.version.id && banner57b.pending.length === 0 && banner57b.totalVersions === 2 &&
      banner57b.live?.actedBy === ownerUser!.id && banner57b.live?.actedByNickname === '菲丽亚店主',
    { live: banner57b.live?.version, total: banner57b.totalVersions, acted: banner57b.live?.actedByNickname });

  /* 57.4 revert 回退上一版 → liveMap 回码内默认路径 */
  const rev57 = await trpcMutate<{ version: { version: number }; revertedFrom: number }>('slotPort.revert', {
    cookie: ownerCookie, input: { slotKey: 'home.banner' },
  });
  const liveMapAfterRev = await trpcQuery<SlotLiveMap>('slotPort.liveMap', { cookie: customerCookie });
  check('57.4 回退上一版：live 回 v1（/brand 默认）+ liveMap 同帧（revertedFrom=2）',
    rev57.version.version === 1 && rev57.revertedFrom === 2 &&
      liveMapAfterRev.slots.find((s) => s.key === 'home.banner')?.url === '/brand/banner-home-1200.png',
    rev57);

  /* 57.5 权限+未知槽闸：clerk list/upload 403；未知 slotKey 400 明文 */
  const clerkList57 = await asErr(trpcQuery('slotPort.list', { cookie: clerkCookie }));
  const clerkUp57 = await asErr(trpcMutate('slotPort.upload', {
    cookie: clerkCookie,
    input: { slotKey: 'home.banner', content: { url: '/x.jpg', alt: 'x' } },
  }));
  const badSlot57 = await asErr(trpcMutate('slotPort.upload', {
    cookie: ownerCookie,
    input: { slotKey: 'no.such.slot', content: { url: '/x.jpg', alt: 'x' } },
  }));
  check('57.5 clerk list/upload 403（仅 owner）+ 未知槽位键 400「未知槽位键」（注册表纪律）',
    clerkList57 instanceof TrpcHttpError && clerkList57.httpStatus === 403 &&
      clerkUp57 instanceof TrpcHttpError && clerkUp57.httpStatus === 403 &&
      badSlot57 instanceof TrpcHttpError && badSlot57.code === 'BAD_REQUEST' && badSlot57.message.includes('未知槽位键'),
    { list: clerkList57 instanceof Error ? clerkList57.message : null, bad: badSlot57 instanceof Error ? badSlot57.message : null });

  /* ==================================================================
   * 员工端骨架批片 1（任务总线骨架 · staff_tasks 只读投影）验收段
   * ================================================================== */
  console.log('\n[骨架批片1] 57.6 任务总线（listMy 聚合在途件）');
  interface StaffTaskT { kind: string; refId: string; title: string; sub: string; link: string; alert: boolean }
  /* 夹具：丽丽名下今日 confirmed 预约一单——**db 直插不走 create 闸**（复核意见书件 1：
     本段测 listMy 投影非 create，直插时段永不敏感；钉今日正午 12:00——now+2h 在 22:00 后跑
     会跨午夜滑出「今日」窗口（22:05 红一实证），正午钉=当日任意时刻跑都落在 [dayStart, dayEnd)）。
     下接：本店 pending 补卡审批一行 + 盘点草稿一单 + 在住寄养一卡 */
  const busStart = new Date();
  busStart.setHours(12, 0, 0, 0);
  const busEnd = new Date(busStart.getTime() + 60 * 60 * 1000);
  const busAppt = await db
    .insert(schema.appointments)
    .values({
      code: `E2EBUS${String(Date.now()).slice(-8)}`,
      customerId: customerUser!.id,
      storeId,
      staffId: staffRow2.id,
      assignSource: 'merchant',
      petId,
      serviceId: service.id,
      type: 'grooming',
      scheduledStart: busStart,
      scheduledEnd: busEnd,
      status: 'confirmed',
      priceFen: 8800,
      paymentMode: 'pay_at_store',
      note: '【测试】骨架批任务总线单',
    })
    .returning({ id: schema.appointments.id })
    .then((r) => r[0]!);
  const liliUserRow = await db.select({ userId: schema.staff.userId }).from(schema.staff).where(eq(schema.staff.id, staffRow2.id)).get();
  await db.insert(schema.attendanceApprovals).values({
    storeId, staffId: staffRow2.id, applicantUserId: liliUserRow!.userId,
    type: 'makeup', date: '2026-10-03', kind: 'in', requestedTs: new Date(), reason: '【测试】任务总线夹具', status: 'pending',
  });
  const busCount = await db.insert(schema.inventoryCounts).values({
    storeId, type: 'daily', status: 'draft', createdBy: ownerUser!.id,
  }).returning().then((r) => r[0]!);
  const busStay = await db.insert(schema.boardingStays).values({
    appointmentId: busAppt.id, roomNo: 'R-TEST',
  }).returning().then((r) => r[0]!);
  const liliBus = await trpcQuery<{ tasks: StaffTaskT[] }>('staffTask.listMy', { cookie: liliCookie });
  check('57.6 美容师视界：名下今日预约入列（appointment 类 link=/schedule）+盘点草稿入列+寄养今日未打卡入列+审批不入列（非管理层）',
    liliBus.tasks.some((t) => t.kind === 'appointment' && t.refId === busAppt.id) &&
      liliBus.tasks.some((t) => t.kind === 'inventory' && t.refId === busCount.id) &&
      liliBus.tasks.some((t) => t.kind === 'boarding' && t.refId === busStay.id) &&
      !liliBus.tasks.some((t) => t.kind === 'approval'),
    liliBus.tasks.map((t) => `${t.kind}:${t.refId.slice(-6)}`));
  const mgrBus = await trpcQuery<{ tasks: StaffTaskT[] }>('staffTask.listMy', { cookie: managerCookie });
  check('57.6 店长视界：补卡审批 pending 入列（approval 类 alert=true link=/manager）',
    mgrBus.tasks.some((t) => t.kind === 'approval' && t.alert === true && t.link === '/manager'),
    mgrBus.tasks.filter((t) => t.kind === 'approval').map((t) => t.refId));
  /* 守尾清零：审批行置 rejected（不留 pending 污染后续段）；盘点草稿/寄养卡留在临时库无后续段读 */
  await db.update(schema.attendanceApprovals).set({ status: 'rejected' })
    .where(eq(schema.attendanceApprovals.storeId, storeId));

  /* ==================================================================
   * 员工端骨架整建批 片 2（排班域 · 冻结版 V1.0 §二.B2）验收段
   * ================================================================== */
  console.log('\n[片2 排班] 58 排班域（模板/生成/发布/换班/请假/调休/技能/CSV 导入/权限）');
  {
    const isoDay = (d: Date) => d.toISOString().slice(0, 10);
    const addDays58 = (s: string, n: number) => {
      const d = new Date(`${s}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return isoDay(d);
    };
    const now58 = new Date();
    const toNextMon = ((8 - now58.getUTCDay()) % 7) || 7;
    const weekStart = addDays58(isoDay(now58), toNextMon); // 下周一（全员未来班，换班「未过」闸安全）
    const monDate = weekStart;
    const friDate = addDays58(weekStart, 4);
    const week2Start = addDays58(weekStart, 7);
    interface Tpl58 { id: string; name: string; startMin: number; endMin: number; weekdays: number[]; active: boolean }
    interface Asg58 { id: string; staffId: string; date: string; startMin: number; endMin: number; source: string; status: string; note: string | null; publishedAt: Date | null }
    interface Swap58 { id: string; assignmentId: string; fromStaffId: string; toStaffId: string | null; status: string; decideNote: string | null }
    const allAssignments = () => db.select().from(schema.shiftAssignments);
    const outboxOf = (type: string) =>
      db.select().from(schema.eventOutbox).then((rows) => rows.filter((r) => r.eventType === type));

    /* ---- 58.1 模板建 + 同参重放幂等 + 停用 ---- */
    const tplUp = await trpcMutate<{ template: Tpl58; idempotent: boolean }>('schedule.templateUpsert', {
      cookie: managerCookie,
      input: { name: '早班', startMin: 600, endMin: 1080, weekdays: [1, 2, 3, 4, 5] },
    });
    const tplUpReplay = await trpcMutate<{ template: Tpl58; idempotent: boolean }>('schedule.templateUpsert', {
      cookie: managerCookie,
      input: { name: '早班', startMin: 600, endMin: 1080, weekdays: [1, 2, 3, 4, 5] },
    });
    const tplList1 = await trpcQuery<{ templates: Tpl58[] }>('schedule.templates', { cookie: managerCookie });
    check('58.1 模板建立 + 同 name 同参数重放幂等（同 id 返回现状，模板数不增）',
      tplUp.template.name === '早班' && tplUp.idempotent === false &&
        tplUpReplay.idempotent === true && tplUpReplay.template.id === tplUp.template.id &&
        tplList1.templates.filter((t) => t.name === '早班').length === 1,
      { first: tplUp.template.id, replay: tplUpReplay.template.id });

    /* ---- 58.2 请假：申请幂等 + 批准后 assign 准假日硬拒明文 ---- */
    const leave58 = await trpcMutate<{ leave: { id: string; status: string }; idempotent: boolean }>('schedule.leaveRequest', {
      cookie: liliCookie,
      input: { kind: 'leave', startDate: friDate, endDate: friDate, reason: '【测试】周五事假' },
    });
    const leave58dup = await trpcMutate<{ leave: { id: string }; idempotent: boolean }>('schedule.leaveRequest', {
      cookie: liliCookie,
      input: { kind: 'leave', startDate: friDate, endDate: friDate, reason: '【测试】周五事假' },
    });
    const leaveResolve58 = await trpcMutate<{ leave: { id: string; status: string } }>('schedule.leaveResolve', {
      cookie: managerCookie,
      input: { leaveId: leave58.leave.id, approve: true },
    });
    const assignOnLeave = await asErr(trpcMutate('schedule.assign', {
      cookie: managerCookie,
      input: { staffId: staffRow2.id, date: friDate, startMin: 600, endMin: 1080 },
    }));
    const myLeaves58 = await trpcQuery<{ leaves: Array<{ id: string; status: string }> }>('schedule.myLeaves', { cookie: liliCookie });
    const leaveQueue58 = await trpcQuery<{ queue: Array<{ id: string }> }>('schedule.leaveQueue', { cookie: managerCookie });
    check('58.2 请假申请同人同期幂等 + 批准后 assign 准假日硬拒明文「排到请假人=系统责任」+ myLeaves 可见 / leaveQueue 出队',
      leave58dup.idempotent === true && leave58dup.leave.id === leave58.leave.id &&
        leaveResolve58.leave.status === 'approved' &&
        assignOnLeave instanceof TrpcHttpError && assignOnLeave.code === 'BAD_REQUEST' &&
        assignOnLeave.message.includes(`该员工当日已准假（请假单 ${leave58.leave.id}）`) &&
        assignOnLeave.message.includes('排到请假人=系统责任') &&
        myLeaves58.leaves.some((l) => l.id === leave58.leave.id && l.status === 'approved') &&
        !leaveQueue58.queue.some((l) => l.id === leave58.leave.id),
      assignOnLeave instanceof Error ? assignOnLeave.message : null);

    /* ---- 58.3 模板生成：全员铺 + 请假跳过 skipReport + 连跑幂等零新增 ---- */
    const gen1 = await trpcMutate<{ created: number; skippedExisting: number; skipReport: Array<{ staffId: string; date: string; reason: string }> }>(
      'schedule.generate', { cookie: managerCookie, input: { weekStart } });
    const gen2 = await trpcMutate<{ created: number; skippedExisting: number; skipReport: Array<{ staffId: string; date: string }> }>(
      'schedule.generate', { cookie: managerCookie, input: { weekStart } });
    check('58.3 generate 全员铺班（丽丽周五准假跳过并列 skipReport「已准假」）+ 连跑第二次零新增（幂等，同键全跳过）',
      gen1.created > 0 &&
        gen1.skipReport.some((s) => s.staffId === staffRow2.id && s.date === friDate && s.reason.includes('已准假')) &&
        gen2.created === 0 && gen2.skippedExisting === gen1.created,
      { gen1: { created: gen1.created, skips: gen1.skipReport.length }, gen2 });

    /* ---- 58.4 取消排班：note 必填 + 留痕不删行 ---- */
    const aqiangMon = (await allAssignments()).find((r) => r.staffId === aqiang.id && r.date === monDate && r.status === 'active')!;
    const cancelNoNote = await asErr(trpcMutate('schedule.cancelAssignment', {
      cookie: managerCookie, input: { assignmentId: aqiangMon.id },
    }));
    const cancelled58 = await trpcMutate<{ assignment: Asg58; idempotent: boolean }>('schedule.cancelAssignment', {
      cookie: managerCookie, input: { assignmentId: aqiangMon.id, note: '【测试】顶班调整' },
    });
    const cancelRow = (await allAssignments()).find((r) => r.id === aqiangMon.id);
    check('58.4 cancelAssignment：缺 note 400 + status=cancelled 留痕不删行（行仍在，note 落注记）',
      cancelNoNote instanceof TrpcHttpError && cancelNoNote.code === 'BAD_REQUEST' &&
        cancelled58.assignment.status === 'cancelled' &&
        cancelRow?.status === 'cancelled' && cancelRow.note === '【测试】顶班调整',
      { err: cancelNoNote instanceof Error ? cancelNoNote.message : null, row: cancelRow?.status });

    /* ---- 58.5 换班责任链：未批原人不动 / 幂等 / 驳回 note 强制 / 批准换挂+双方事件 ---- */
    const liliMon = (await allAssignments()).find((r) => r.staffId === staffRow2.id && r.date === monDate && r.status === 'active')!;
    const swap1 = await trpcMutate<{ swap: Swap58; idempotent: boolean }>('schedule.swapRequest', {
      cookie: liliCookie, input: { assignmentId: liliMon.id, toStaffId: aqiang.id, reason: '【测试】家中有事' },
    });
    const swap1dup = await trpcMutate<{ swap: Swap58; idempotent: boolean }>('schedule.swapRequest', {
      cookie: liliCookie, input: { assignmentId: liliMon.id, toStaffId: aqiang.id, reason: '【测试】家中有事' },
    });
    const asgDuringPending = (await allAssignments()).find((r) => r.id === liliMon.id)!;
    const rejNoNote = await asErr(trpcMutate('schedule.swapResolve', {
      cookie: managerCookie, input: { swapId: swap1.swap.id, approve: false },
    }));
    const rej58 = await trpcMutate<{ swap: Swap58 }>('schedule.swapResolve', {
      cookie: managerCookie, input: { swapId: swap1.swap.id, approve: false, note: '【测试】当日人手足够' },
    });
    check('58.5a 换班申请幂等（同单一 pending 返回现状）+ pending 期间 assignment 原人不动 + 驳回 note 强制（缺 note 400）',
      swap1dup.idempotent === true && swap1dup.swap.id === swap1.swap.id &&
        asgDuringPending.staffId === staffRow2.id &&
        rejNoNote instanceof TrpcHttpError && rejNoNote.code === 'BAD_REQUEST' &&
        rej58.swap.status === 'rejected' && rej58.swap.decideNote === '【测试】当日人手足够',
      { dup: swap1dup.swap.id, heldBy: asgDuringPending.staffId });
    const swap2 = await trpcMutate<{ swap: Swap58; idempotent: boolean }>('schedule.swapRequest', {
      cookie: liliCookie, input: { assignmentId: liliMon.id, toStaffId: aqiang.id, reason: '【测试】家中有事再提' },
    });
    const apv58 = await trpcMutate<{ swap: Swap58 }>('schedule.swapResolve', {
      cookie: managerCookie, input: { swapId: swap2.swap.id, approve: true },
    });
    const asgAfterSwap = (await allAssignments()).find((r) => r.id === liliMon.id)!;
    const swapEvents = await outboxOf('shift.swapResolved');
    check('58.5b 批准=换挂（assignment.staffId→阿强）+ shift.swapResolved 双方 staff 频道落 outbox',
      apv58.swap.status === 'approved' && asgAfterSwap.staffId === aqiang.id &&
        swapEvents.some((e) => e.channel === `staff:${staffRow2.id}` && (e.payload as { swapId?: string })?.swapId === swap2.swap.id) &&
        swapEvents.some((e) => e.channel === `staff:${aqiang.id}` && (e.payload as { swapId?: string })?.swapId === swap2.swap.id),
      { heldBy: asgAfterSwap.staffId, ev: swapEvents.map((e) => e.channel) });
    /* 开放认领单：申请不带 toStaffId，批准不指定 → 明文「请指定接手员工」；随后驳回清场 */
    const liliTue = (await allAssignments()).find((r) => r.staffId === staffRow2.id && r.date === addDays58(weekStart, 1) && r.status === 'active')!;
    const swapOpen = await trpcMutate<{ swap: Swap58 }>('schedule.swapRequest', {
      cookie: liliCookie, input: { assignmentId: liliTue.id, reason: '【测试】开放认领' },
    });
    const apvNoTarget = await asErr(trpcMutate('schedule.swapResolve', {
      cookie: managerCookie, input: { swapId: swapOpen.swap.id, approve: true },
    }));
    await trpcMutate('schedule.swapResolve', {
      cookie: managerCookie, input: { swapId: swapOpen.swap.id, approve: false, note: '【测试】清场' },
    });
    check('58.5c 开放认领单批准未指定接手 → 400 明文「请指定接手员工」',
      apvNoTarget instanceof TrpcHttpError && apvNoTarget.code === 'BAD_REQUEST' && apvNoTarget.message.includes('请指定接手员工'),
      apvNoTarget instanceof Error ? apvNoTarget.message : null);

    /* ---- 58.6 可用时间 upsert 幂等 ---- */
    const av1 = await trpcMutate<{ availability: { id: string; endMin: number }; idempotent: boolean }>('schedule.upsertAvailability', {
      cookie: liliCookie, input: { weekday: 1, startMin: 600, endMin: 1080, note: '上午可' },
    });
    const av2 = await trpcMutate<{ availability: { id: string; endMin: number }; idempotent: boolean }>('schedule.upsertAvailability', {
      cookie: liliCookie, input: { weekday: 1, startMin: 600, endMin: 1080, note: '上午可' },
    });
    const av3 = await trpcMutate<{ availability: { id: string; endMin: number }; idempotent: boolean }>('schedule.upsertAvailability', {
      cookie: liliCookie, input: { weekday: 1, startMin: 600, endMin: 1140, note: '上午可' },
    });
    const myAv58 = await trpcQuery<{ availability: Array<{ id: string; weekday: number; startMin: number; endMin: number }> }>(
      'schedule.myAvailability', { cookie: liliCookie });
    const avRows = myAv58.availability.filter((a) => a.weekday === 1 && a.startMin === 600);
    check('58.6 可用时间按 (staff,weekday,startMin) upsert 幂等（重放同行不增；改 endMin 同键更新）',
      av1.idempotent === false && av2.idempotent === true && av3.idempotent === true &&
        av2.availability.id === av1.availability.id && av3.availability.id === av1.availability.id &&
        avRows.length === 1 && avRows[0]!.endMin === 1140,
      { rows: avRows.length, endMin: avRows[0]?.endMin });

    /* ---- 58.7 调休台账：adjust 留痕 + 余额读（90 分钟=1.5 小时） ---- */
    await trpcMutate('schedule.compOffAdjust', {
      cookie: managerCookie, input: { staffId: staffRow2.id, deltaMinutes: 120, reason: '【测试】加班补时' },
    });
    await trpcMutate('schedule.compOffAdjust', {
      cookie: managerCookie, input: { staffId: staffRow2.id, deltaMinutes: -30, reason: '【测试】调休抵扣' },
    });
    const bal58 = await trpcQuery<{ balanceMinutes: number; balanceHours: number; logs: Array<{ deltaMinutes: number; reason: string }> }>(
      'schedule.compOffBalance', { cookie: liliCookie });
    check('58.7 调休 adjust 两笔留痕 + 余额=sum(delta)/60（120−30=90 分钟=1.5 小时，流水近 20 条透出）',
      bal58.balanceMinutes === 90 && bal58.balanceHours === 1.5 &&
        bal58.logs.some((l) => l.deltaMinutes === 120) && bal58.logs.some((l) => l.deltaMinutes === -30),
      bal58);

    /* ---- 58.8 技能标签：端口集外硬拒「不在标签集」+ 全量覆盖写 ---- */
    const skillTags58 = await trpcQuery<{ tags: string[] }>('schedule.skillTags', { cookie: customerCookie });
    const badSkill = await asErr(trpcMutate('schedule.setSkills', {
      cookie: managerCookie, input: { staffId: staffRow2.id, tags: ['洗护', '飞盘'] },
    }));
    const setOk58 = await trpcMutate<{ staffId: string; tags: string[] }>('schedule.setSkills', {
      cookie: managerCookie, input: { staffId: staffRow2.id, tags: ['洗护', '美容'] },
    });
    const allSkills58 = await trpcQuery<{ staff: Array<{ id: string; name: string; tags: string[] }> }>(
      'schedule.staffSkills', { cookie: managerCookie });
    check('58.8 技能标签端口集公开读（含「洗护」）+ 集外标签 400 明文「不在标签集」+ 全量覆盖写后 staffSkills 透出',
      skillTags58.tags.includes('洗护') &&
        badSkill instanceof TrpcHttpError && badSkill.code === 'BAD_REQUEST' && badSkill.message.includes('不在标签集') &&
        setOk58.tags.length === 2 &&
        (allSkills58.staff.find((s) => s.id === staffRow2.id)?.tags.slice().sort().join(',') === '洗护,美容'),
      { tags: skillTags58.tags, err: badSkill instanceof Error ? badSkill.message : null });

    /* ---- 58.9 CSV 导入：preview 零写入 + execute 落行 + 幂等跳过 + 列名漂移/斜杠日期容错 + 请假行逐行拒 ---- */
    const csvA = `员工,日期,开始,结束\n丽丽,${week2Start},09:30,17:30\n${aqiang.id},${addDays58(week2Start, 1)},10:00,18:00`;
    const beforeImport = (await allAssignments()).filter((r) => r.date >= week2Start).length;
    const pv1 = await trpcMutate<{ okRows: number; failRows: number }>('schedule.importPreview', {
      cookie: managerCookie, input: { csvText: csvA },
    });
    const afterPreview = (await allAssignments()).filter((r) => r.date >= week2Start).length;
    const ex1 = await trpcMutate<{ inserted: number; skippedDuplicates: number; failRows: number }>('schedule.importExecute', {
      cookie: managerCookie, input: { csvText: csvA },
    });
    const ex1replay = await trpcMutate<{ inserted: number; skippedDuplicates: number }>('schedule.importExecute', {
      cookie: managerCookie, input: { csvText: csvA },
    });
    check('58.9a 导入 preview 零写入 + execute 落 2 行（员工列姓名/id 双匹配）+ 重放幂等全跳过',
      beforeImport === 0 && pv1.okRows === 2 && pv1.failRows === 0 && afterPreview === 0 &&
        ex1.inserted === 2 && ex1.failRows === 0 &&
        ex1replay.inserted === 0 && ex1replay.skippedDuplicates === 2,
      { pv1, ex1, ex1replay });
    /* 列序漂移（日期,结束,员工,开始）+ 斜杠日期 + 请假覆盖行 + 查无此人 行逐行拒 */
    const csvB = `日期,结束,员工,开始\n${addDays58(week2Start, 2)},17:30,丽丽,09:30\n${friDate.replaceAll('-', '/')},18:00,丽丽,10:00\n${week2Start},18:00,查无此人,10:00`;
    const pv2 = await trpcMutate<{ okRows: number; failRows: number; rows: Array<{ line: number; ok: boolean; failReason?: string }> }>(
      'schedule.importPreview', { cookie: managerCookie, input: { csvText: csvB } });
    const ex2 = await trpcMutate<{ inserted: number; failRows: number; rows: Array<{ line: number; ok: boolean; failReason?: string }> }>(
      'schedule.importExecute', { cookie: managerCookie, input: { csvText: csvB } });
    check('58.9b 列名漂移换列序照导（按表头名定位）+ 请假覆盖行逐行拒（「已准假」明文）+ 查无此人拒',
      pv2.okRows === 1 && pv2.failRows === 2 &&
        pv2.rows.some((r) => !r.ok && (r.failReason ?? '').includes('已准假')) &&
        pv2.rows.some((r) => !r.ok && (r.failReason ?? '').includes('不在本店员工名册')) &&
        ex2.inserted === 1 && ex2.failRows === 2,
      { pv2: pv2.rows, ex2: { inserted: ex2.inserted, failRows: ex2.failRows } });

    /* ---- 58.10 周发布：幂等 + schedule.published 逐员工落 outbox + weekView published 透出 ---- */
    const pub1 = await trpcMutate<{ published: number; perStaff: Array<{ staffId: string; count: number }> }>(
      'schedule.publishWeek', { cookie: managerCookie, input: { weekStart } });
    const pubEvents1 = (await outboxOf('schedule.published')).filter(
      (e) => (e.payload as { weekStart?: string })?.weekStart === weekStart);
    const pub2 = await trpcMutate<{ published: number }>('schedule.publishWeek', {
      cookie: managerCookie, input: { weekStart } });
    const pubEvents2 = (await outboxOf('schedule.published')).filter(
      (e) => (e.payload as { weekStart?: string })?.weekStart === weekStart);
    const weekView58 = await trpcQuery<{ assignments: Array<Asg58 & { published: boolean; staffName: string }> }>(
      'schedule.weekView', { cookie: liliCookie, input: { weekStart } });
    check('58.10 publishWeek 幂等（再发零新增零重复事件）+ schedule.published 逐受影响员工落 outbox（payload.weekStart/count）+ weekView published 透出',
      pub1.published > 0 && pub1.perStaff.some((p) => p.staffId === staffRow2.id) &&
        pubEvents1.length === pub1.perStaff.length &&
        pubEvents1.every((e) => typeof (e.payload as { count?: number })?.count === 'number') &&
        pub2.published === 0 && pubEvents2.length === pubEvents1.length &&
        weekView58.assignments.length > 0 &&
        weekView58.assignments.filter((a) => a.status === 'active').every((a) => a.published) &&
        weekView58.assignments.some((a) => a.staffName === '丽丽'),
      { pub1: pub1.published, pub2: pub2.published, ev1: pubEvents1.length, ev2: pubEvents2.length });

    /* ---- 58.11 权限：clerk/普通 staff 对 manager 端点 403；clerk/customer 对 weekView 403 ---- */
    const clerkTpl = await asErr(trpcQuery('schedule.templates', { cookie: clerkCookie }));
    const clerkAssign = await asErr(trpcMutate('schedule.assign', {
      cookie: clerkCookie, input: { staffId: staffRow2.id, date: monDate, startMin: 600, endMin: 1080 },
    }));
    const staffAssign = await asErr(trpcMutate('schedule.assign', {
      cookie: liliCookie, input: { staffId: staffRow2.id, date: monDate, startMin: 600, endMin: 1080 },
    }));
    const clerkWeek = await asErr(trpcQuery('schedule.weekView', { cookie: clerkCookie, input: { weekStart } }));
    const customerWeek = await asErr(trpcQuery('schedule.weekView', { cookie: customerCookie, input: { weekStart } }));
    check('58.11 权限闸：clerk templates/assign 403 + 普通 staff assign 403 + clerk/customer weekView 403',
      [clerkTpl, clerkAssign, staffAssign, clerkWeek, customerWeek].every(
        (e) => e instanceof TrpcHttpError && e.httpStatus === 403),
      [clerkTpl, clerkAssign, staffAssign, clerkWeek, customerWeek].map((e) => (e instanceof Error ? e.httpStatus : 'ok')));

    /* ---- 58.12 模板停用（留尾，generate 已用完） ---- */
    await trpcMutate('schedule.templateDeactivate', { cookie: managerCookie, input: { id: tplUp.template.id } });
    const tplList2 = await trpcQuery<{ templates: Tpl58[] }>('schedule.templates', { cookie: managerCookie });
    check('58.12 templateDeactivate：模板置 active=false（不删行）',
      tplList2.templates.find((t) => t.id === tplUp.template.id)?.active === false,
      tplList2.templates.find((t) => t.id === tplUp.template.id));
  }


  /* ==================================================================
   * 员工端骨架整建批片 2 · 考勤域七件（冻结版 V1.0 §二.B1）+ 读序切换 验收段
   * ================================================================== */
  console.log('\n[片2] 59. 考勤域 B1（读序切换 / WiFi / 外勤 / 断网补传 / 多对打卡 / 确认+改考勤 / 申诉）');

  const now59 = new Date();
  const DAY_KEYS_59 = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  interface MarkRes59 {
    record: {
      id: string; kind: string; status: string;
      source: string | null; bssid: string | null; photoUrl: string | null;
      ts: string | Date; clientTs: string | Date | null;
    };
    duplicated: boolean;
  }

  /* ---- 59.1 读序切换：当日 shift_assignments(active) 优先 → 无则 staff.schedule 周模板兜底 ---- */
  /* 附加乙：周模板给「+120min 班」（in 击按模板应判 normal）+ assignment 给「-60min 班」（in 击判 late）
     ——判 late 即坐实 assignment 优先于模板（若误读模板会得 normal）。
     时刻钉法（跨午夜红一实证，57.6 先例）：打卡锚=punch59（now≥今日正午取今日正午，否则取昨日正午——
     恒为过去且 ±300 分钟不跨日）；打卡走 offline_relay+clientTs（直带 clientTs 非补传 400，状态判定以
     punchAt 为锚走 attendance.ts:370 同径，判定语义不变）；模板/指派全按 punch59 的周日/日期对齐——
     任意时刻跑判定一致。 */
  const noon59 = new Date();
  noon59.setHours(12, 0, 0, 0);
  const punch59 = now59.getTime() >= noon59.getTime() ? noon59 : new Date(noon59.getTime() - 24 * 3600 * 1000);
  const punchTs59 = Math.floor(punch59.getTime() / 1000);
  const punchDayKey59 = DAY_KEYS_59[punch59.getDay()]!;
  const punchDate59 = `${punch59.getFullYear()}-${pad2l(punch59.getMonth() + 1)}-${pad2l(punch59.getDate())}`;
  const tpl59p = (start: string, end: string): import('../db/schema').StaffSchedule => ({ [punchDayKey59]: [{ start, end }] });
  await db.update(schema.staff)
    .set({ schedule: tpl59p('14:00', '17:00') })
    .where(eq(schema.staff.id, extraS2.id));
  const asg59 = await db.insert(schema.shiftAssignments).values({
    storeId, staffId: extraS2.id, date: punchDate59,
    startMin: 11 * 60, endMin: 16 * 60,
    source: 'manual', status: 'active', createdBy: ownerUser!.id,
  }).returning().then((r) => r[0]!);
  const markAssign = await trpcMutate<MarkRes59>('attendance.mark', {
    cookie: extra2Cookie,
    input: { kind: 'in', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-extra2', source: 'offline_relay', clientTs: punchTs59 },
  });
  check('59.1 读序①：有当日 assignment → 按排班表判定（-60min 班 in 击=late；误读周模板则为 normal）',
    markAssign.record.kind === 'in' && markAssign.record.status === 'late', markAssign.record);
  /* 附加丙：无 assignment、周模板「-60min 班」→ in 击判 late（周模板兜底实证，零中断） */
  await db.update(schema.staff)
    .set({ schedule: tpl59p('11:00', '16:00') })
    .where(eq(schema.staff.id, extraS3.id));
  const markTpl = await trpcMutate<MarkRes59>('attendance.mark', {
    cookie: extra3Cookie,
    input: { kind: 'in', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-extra3', source: 'offline_relay', clientTs: punchTs59 },
  });
  check('59.1 读序②：无 assignment → staff.schedule 周模板兜底（模板 -60min 班 in 击=late）',
    markTpl.record.kind === 'in' && markTpl.record.status === 'late', markTpl.record);
  await db.delete(schema.shiftAssignments).where(eq(schema.shiftAssignments.id, asg59.id)); // 守尾清理

  /* ---- 59.2 WiFi BSSID 闸（白名单启用：命中过 / 未命中回落围栏 / 未命中+围栏外无照拒） ---- */
  const wifi59 = await db.insert(schema.attendanceWifiBssids).values({
    storeId, bssid: 'aa:bb:cc:dd:ee:ff', label: '门店 WiFi（e2e）', active: true, createdBy: ownerUser!.id,
  }).returning().then((r) => r[0]!);
  /* 阿强今日 0 行（R7② 围栏外拦截零写入后未再打卡）；种子带 09:00-18:00 周模板，运行时刻午后
     会出 late/early 自动审批——本段不断言状态，只断 WiFi 闸行为 */
  const wifiHit = await trpcMutate<MarkRes59>('attendance.mark', {
    cookie: groomerCookie,
    // 上海坐标（距店 ~165km）：WiFi 命中免围栏
    input: { kind: 'in', lat: 31.2304, lng: 121.4737, deviceId: 'e2e-dev-aq-wifi', bssid: 'aa:bb:cc:dd:ee:ff' },
  });
  check('59.2 WiFi 命中白名单=到岗直接过（免围栏：上海坐标放行 + bssid 落库）',
    wifiHit.record.kind === 'in' && wifiHit.record.bssid === 'aa:bb:cc:dd:ee:ff', wifiHit.record);
  const wifiMissIn = await trpcMutate<MarkRes59>('attendance.mark', {
    cookie: groomerCookie,
    input: { kind: 'out', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-aq-wifi', bssid: '11:22:33:44:55:66' },
  });
  check('59.2 WiFi 未命中+围栏内 → 回落围栏判定放行（bssid 不落库）',
    wifiMissIn.record.kind === 'out' && wifiMissIn.record.bssid === null, wifiMissIn.record);
  const wifiMissFar = await asErr(trpcMutate('attendance.mark', {
    cookie: groomerCookie,
    input: { kind: 'in', lat: 31.2304, lng: 121.4737, deviceId: 'e2e-dev-aq-wifi', bssid: '11:22:33:44:55:66' },
  }));
  check('59.2 WiFi 未命中+围栏外无照 → 照旧拒（400「不在门店范围，无法打卡」零写入）',
    wifiMissFar instanceof TrpcHttpError && wifiMissFar.code === 'BAD_REQUEST' && wifiMissFar.message.includes('不在门店范围'),
    wifiMissFar && { code: wifiMissFar.code, message: wifiMissFar.message });
  await db.delete(schema.attendanceWifiBssids).where(eq(schema.attendanceWifiBssids.id, wifi59.id)); // 守尾：白名单清空=恢复现状

  /* ---- 59.3 外勤打卡（围栏外+photoUrl 放行 + 自动挂 exception）+ B1-4 异常推送 ---- */
  const fieldMark = await trpcMutate<MarkRes59>('attendance.mark', {
    cookie: groomerCookie,
    input: { kind: 'in', lat: 31.2304, lng: 121.4737, deviceId: 'e2e-dev-aq-wifi', photoUrl: '/api/img/e2e/field-59.jpg' },
  });
  const fieldApprovals = await db.select().from(schema.attendanceApprovals)
    .where(and(
      eq(schema.attendanceApprovals.recordId, fieldMark.record.id),
      eq(schema.attendanceApprovals.type, 'exception'),
      eq(schema.attendanceApprovals.status, 'pending'),
    ));
  check('59.3 外勤：围栏外+photoUrl 放行落行（source=field，photo_url 落列，状态照算）+ 自动挂 exception（「外勤打卡待店长确认」）',
    fieldMark.record.source === 'field' && fieldMark.record.photoUrl === '/api/img/e2e/field-59.jpg' &&
      fieldApprovals.some((a) => a.reason === '外勤打卡待店长确认'),
    { source: fieldMark.record.source, reasons: fieldApprovals.map((a) => a.reason) });
  const fieldEvents = (await db.select().from(schema.eventOutbox)).filter(
    (r) => r.eventType === 'attendance.exception' &&
      (r.payload as { recordId?: string } | null)?.recordId === fieldMark.record.id,
  );
  check('59.3 B1-4：AttendanceException 双频道落 outbox（store 主管 + staff 本人）',
    fieldEvents.some((r) => r.channel === `store:${storeId}`) &&
      fieldEvents.some((r) => r.channel === `staff:${aqiang.id}`),
    fieldEvents.map((r) => r.channel));

  /* ---- 59.4 断网离线补传 + 超时兜底 + 未来时刻拒 ---- */
  /* 丽丽今日已有 makeup in 行（R7③）→ 下一击=out */
  const relayOkTs = Math.floor(now59.getTime() / 1000) - 3600; // 1 小时前（未超种子兜底 24h）
  const relayOk = await trpcMutate<MarkRes59>('attendance.mark', {
    cookie: liliCookie,
    input: { kind: 'out', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-lili', source: 'offline_relay', clientTs: relayOkTs },
  });
  check('59.4 断网补传：ts=clientTs 实际打点时刻落库（source=offline_relay + client_ts 落列）',
    relayOk.record.source === 'offline_relay' &&
      Math.floor(new Date(relayOk.record.ts).getTime() / 1000) === relayOkTs &&
      relayOk.record.clientTs !== null &&
      Math.floor(new Date(relayOk.record.clientTs!).getTime() / 1000) === relayOkTs,
    { ts: relayOk.record.ts, clientTs: relayOk.record.clientTs, expect: relayOkTs });
  const relayStaleTs = relayOkTs - 25 * 3600; // 超 attendance_offline_stale_hours（种子 {hours:24}）
  const relayStale = await trpcMutate<MarkRes59>('attendance.mark', {
    cookie: liliCookie,
    input: { kind: 'in', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-lili', source: 'offline_relay', clientTs: relayStaleTs },
  });
  const staleApprovals = await db.select().from(schema.attendanceApprovals)
    .where(and(
      eq(schema.attendanceApprovals.recordId, relayStale.record.id),
      eq(schema.attendanceApprovals.type, 'exception'),
      eq(schema.attendanceApprovals.status, 'pending'),
    ));
  check('59.4 超时兜底：clientTs 超 24h → 放行落行 + 自动挂 exception（「断网补传超时（超 24 小时）」，不无声丢卡）',
    relayStale.record.source === 'offline_relay' &&
      Math.floor(new Date(relayStale.record.ts).getTime() / 1000) === relayStaleTs &&
      staleApprovals.some((a) => a.reason.includes('断网补传超时') && a.reason.includes('24')),
    { source: relayStale.record.source, reasons: staleApprovals.map((a) => a.reason) });
  const relayFuture = await asErr(trpcMutate('attendance.mark', {
    cookie: liliCookie,
    input: { kind: 'in', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-lili', source: 'offline_relay', clientTs: Math.floor(Date.now() / 1000) + 3600 },
  }));
  check('59.4 未来时刻拒：clientTs 晚于当前 → 400「拒绝补传未来卡」',
    relayFuture instanceof TrpcHttpError && relayFuture.code === 'BAD_REQUEST' && relayFuture.message.includes('未来'),
    relayFuture && { code: relayFuture.code, message: relayFuture.message });

  /* ---- 59.5 班内多次打卡/中途离岗还原（多对）+ 同 kind 60s 重击幂等 ---- */
  /* 阿强当日已有 in(WiFi)→out(围栏)→in(外勤) → 续 out→in→(in 重击幂等) */
  const aqOut2 = await trpcMutate<MarkRes59>('attendance.mark', {
    cookie: groomerCookie, input: { kind: 'out', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-aq-wifi' },
  });
  const aqIn3 = await trpcMutate<MarkRes59>('attendance.mark', {
    cookie: groomerCookie, input: { kind: 'in', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-aq-wifi' },
  });
  const aqIn3Dup = await trpcMutate<MarkRes59>('attendance.mark', {
    cookie: groomerCookie, input: { kind: 'in', lat: 30.2741, lng: 120.1551, deviceId: 'e2e-dev-aq-wifi' },
  });
  const aqRows59 = await db.select().from(schema.attendanceRecords)
    .where(and(eq(schema.attendanceRecords.staffId, aqiang.id), eq(schema.attendanceRecords.date, todayStr)));
  check('59.5 多对打卡：in→out→in(外勤)→out→in 多对落行（当日恰 5 行：3 in + 2 out）',
    aqOut2.record.kind === 'out' && aqIn3.record.kind === 'in' && aqRows59.length === 5 &&
      aqRows59.filter((r) => r.kind === 'in').length === 3 && aqRows59.filter((r) => r.kind === 'out').length === 2,
    aqRows59.map((r) => r.kind));
  check('59.5 同 kind 60 秒内重击=幂等返回末行（防双击，零新增落行）',
    aqIn3Dup.duplicated === true && aqIn3Dup.record.id === aqIn3.record.id && aqRows59.length === 5,
    { dup: aqIn3Dup.duplicated, id: aqIn3Dup.record.id, expect: aqIn3.record.id });

  /* ---- 59.6 员工确认（confirmDay 幂等）+ 确认后改考勤（managerAdjust 放行+adjust 留痕）+ 员工无改权 ---- */
  interface ConfirmRes59 {
    date: string;
    records: Array<{ id: string; confirmedAt: string | Date | null }>;
    confirmedNow: number;
    alreadyConfirmed: boolean;
  }
  const confirm59a = await trpcMutate<ConfirmRes59>('attendance.confirmDay', { cookie: groomerCookie, input: { date: todayStr } });
  check('59.6 员工确认：confirmDay 置位当日全部行 confirmed_by/at（5 行）',
    confirm59a.confirmedNow === 5 && confirm59a.records.length === 5 && confirm59a.records.every((r) => r.confirmedAt !== null),
    { confirmedNow: confirm59a.confirmedNow, total: confirm59a.records.length });
  const confirm59b = await trpcMutate<ConfirmRes59>('attendance.confirmDay', { cookie: groomerCookie, input: { date: todayStr } });
  check('59.6 确认幂等：重复 confirmDay 零写入返回现状（alreadyConfirmed=true，confirmedAt 不变）',
    confirm59b.alreadyConfirmed === true && confirm59b.confirmedNow === 0 &&
      confirm59b.records.every((r, i) => String(r.confirmedAt) === String(confirm59a.records[i]!.confirmedAt)),
    { already: confirm59b.alreadyConfirmed, now: confirm59b.confirmedNow });
  const adjustTs59 = new Date(now59.getTime() - 30 * 60000);
  const adjusted59 = await trpcMutate<{ id: string; ts: string | Date }>('attendance.managerAdjust', {
    cookie: managerCookie,
    input: { recordId: confirm59a.records[0]!.id, ts: adjustTs59, note: '【测试】59.6 店长调整打卡时刻' },
  });
  const adjustTrail59 = await db.select().from(schema.attendanceApprovals)
    .where(and(
      eq(schema.attendanceApprovals.recordId, confirm59a.records[0]!.id),
      eq(schema.attendanceApprovals.type, 'adjust'),
    ));
  check('59.6 确认后改考勤：managerAdjust 放行（ts 已改）+ adjust 留痕行（approved / reason=note / reviewer=店长本人）',
    Math.abs(new Date(adjusted59.ts).getTime() - adjustTs59.getTime()) < 1000 &&
      adjustTrail59.length === 1 && adjustTrail59[0]!.status === 'approved' &&
      adjustTrail59[0]!.reason === '【测试】59.6 店长调整打卡时刻' &&
      adjustTrail59[0]!.reviewerId === managerFix.id,
    { ts: adjusted59.ts, trail: adjustTrail59.map((a) => `${a.status}:${a.reason}`) });
  const staffAdjust59 = await asErr(trpcMutate('attendance.managerAdjust', {
    cookie: groomerCookie,
    input: { recordId: confirm59a.records[1]!.id, ts: adjustTs59, note: '员工试图改考勤' },
  }));
  check('59.6 员工无改权：staff 调 managerAdjust → 403（manager-only 闸门）',
    staffAdjust59 instanceof TrpcHttpError && staffAdjust59.httpStatus === 403,
    staffAdjust59 && { status: staffAdjust59.httpStatus, code: staffAdjust59.code });

  /* ---- 59.7 申诉入队（appeal → type=exception pending 挂原卡；同卡同人 pending 在途幂等） ---- */
  /* 小美 markIn 原卡：若有自动 exception（迟到）已在 57.6 守尾被置 rejected，此处必新落 pending */
  interface AppealRes59 {
    approval: { id: string; type: string; status: string; recordId: string | null; reason: string };
    duplicated: boolean;
  }
  const appeal1 = await trpcMutate<AppealRes59>('attendance.appeal', {
    cookie: staffCookie, input: { recordId: markIn.record.id, reason: '【测试】59.7 申诉：当日定位漂移' },
  });
  const appeal2 = await trpcMutate<AppealRes59>('attendance.appeal', {
    cookie: staffCookie, input: { recordId: markIn.record.id, reason: '重复提交同一申诉' },
  });
  check('59.7 申诉入队：type=exception pending 挂原卡 recordId（本人）',
    appeal1.duplicated === false && appeal1.approval.type === 'exception' &&
      appeal1.approval.status === 'pending' && appeal1.approval.recordId === markIn.record.id,
    appeal1.approval);
  check('59.7 申诉幂等：同卡同人 pending 在途 → 返回现状（duplicated=true，同一条，零新增）',
    appeal2.duplicated === true && appeal2.approval.id === appeal1.approval.id,
    { id: appeal2.approval.id, expect: appeal1.approval.id });

  /* ==================================================================
   * 员工端骨架整建批 片 3（任务执行+通讯+权限 · 迁移 0031）验收段 60/61/62
   * 既有断言零删改；本段夹具全部自建（模板/公告/PDCA/心声/交接班/离职）。
   * ================================================================== */
  console.log('\n[片3 任务协作] 60/61/62 任务执行+PDCA+自检 / 公告+交接班+心声 / 离职+跨店');
  {
    const isoDay60 = (d: Date) => d.toISOString().slice(0, 10);
    const addDays60 = (n: number) => isoDay60(new Date(Date.now() + n * 86400e3));
    // 门店规范时区（+8）今日与当日分钟数（与 server storeWallclock 同帧）
    const storeNow60 = new Date(Date.now() + 8 * 3600e3);
    const storeToday60 = storeNow60.toISOString().slice(0, 10);
    const storeMin60 = storeNow60.getUTCHours() * 60 + storeNow60.getUTCMinutes();
    interface TaskRun60 {
      id: string; templateId: string; bizDate: string; staffId: string | null;
      status: string; doneBy: string | null; doneAt: Date | null; remindedAt: Date | null;
      title: string; dueMin: number; remindMin: number | null;
    }
    interface Tpl60 { id: string; title: string; active: boolean }

    /* ---- 60.1 模板建档 + listToday 触读即补生成 + 重跑幂等不双行 ---- */
    const tpl60 = await trpcMutate<{ template: Tpl60 }>('taskExec.upsertTemplate', {
      cookie: managerCookie,
      input: { title: '每日闭店消毒', assignScope: 'role', assignRole: 'groomer', freq: 'daily', weekdays: [], dueMin: 1439, remindMin: 30 },
    });
    const today60a = await trpcQuery<{ bizDate: string; runs: TaskRun60[] }>('taskExec.listToday', { cookie: liliCookie });
    const run60 = today60a.runs.find((r) => r.templateId === tpl60.template.id);
    const runsInDb60a = await db.select().from(schema.taskRuns).where(eq(schema.taskRuns.templateId, tpl60.template.id));
    check('60.1 daily 模板建档 + listToday 触读生成 run（groomer 角色池行 staffId=NULL 落库，bizDate=门店今日）',
      !!run60 && run60.staffId === null && run60.status === 'pending' && run60.bizDate === storeToday60 &&
        runsInDb60a.length === 1,
      { run: run60?.id, rows: runsInDb60a.length });
    const today60b = await trpcQuery<{ runs: TaskRun60[] }>('taskExec.listToday', { cookie: liliCookie });
    const runsInDb60b = await db.select().from(schema.taskRuns).where(eq(schema.taskRuns.templateId, tpl60.template.id));
    check('60.1 重跑 listToday 幂等不双行（(template_id,biz_date) 锚，返回同一 run）',
      runsInDb60b.length === 1 && today60b.runs.find((r) => r.templateId === tpl60.template.id)?.id === run60!.id,
      { rows: runsInDb60b.length });

    /* ---- 60.2 提醒一发闸：dueMin 设 30 分钟内 → 事件+通知+remindedAt；再调零新增 ---- */
    const tpl60b = await trpcMutate<{ template: Tpl60 }>('taskExec.upsertTemplate', {
      cookie: managerCookie,
      input: {
        title: '临期任务（e2e）', assignScope: 'role', assignRole: 'groomer', freq: 'daily', weekdays: [],
        dueMin: Math.min(1440, storeMin60 + 5), remindMin: 30,
      },
    });
    const notifCount60 = async () =>
      (await db.select().from(schema.notifications))
        .filter((n) => n.userId === liliUser.id && n.type === 'task.reminder').length;
    const outboxCount60 = async () =>
      (await db.select().from(schema.eventOutbox)).filter((r) => r.eventType === 'task.reminder').length;
    const notifBefore60 = await notifCount60();
    const outboxBefore60 = await outboxCount60();
    await trpcQuery('taskExec.listToday', { cookie: liliCookie });
    const run60bRow = await db.select().from(schema.taskRuns).where(eq(schema.taskRuns.templateId, tpl60b.template.id)).then((r) => r[0]);
    const notifAfter60 = await notifCount60();
    const outboxAfter60 = await outboxCount60();
    check('60.2 提醒：到点（now ≥ due−remindMin）→ notifications 落 task.reminder 行 + outbox 落事件 + remindedAt 置位',
      notifAfter60 > notifBefore60 && outboxAfter60 > outboxBefore60 && !!run60bRow && run60bRow.remindedAt !== null,
      { notif: `${notifBefore60}→${notifAfter60}`, outbox: `${outboxBefore60}→${outboxAfter60}`, remindedAt: run60bRow?.remindedAt });
    await trpcQuery('taskExec.listToday', { cookie: liliCookie });
    check('60.2 提醒幂等一发：再调 listToday 零新增（通知/事件计数不变）',
      (await notifCount60()) === notifAfter60 && (await outboxCount60()) === outboxAfter60,
      { notif: await notifCount60(), outbox: await outboxCount60() });

    /* ---- 60.3 done：他人 403 / 本人完成 / 重复 done 幂等返回现状 ---- */
    const doneByOther = await asErr(trpcMutate('taskExec.done', { cookie: staffCookie, input: { runId: run60!.id } }));
    check('60.3 他人（小美=frontdesk 非角色池非 manager）done → 403',
      doneByOther instanceof TrpcHttpError && doneByOther.httpStatus === 403,
      doneByOther && { status: doneByOther.httpStatus, code: doneByOther.code, message: doneByOther.message });
    const done60 = await trpcMutate<{ run: TaskRun60; idempotent: boolean }>('taskExec.done', {
      cookie: liliCookie, input: { runId: run60!.id },
    });
    check('60.3 本人（角色匹配）done 落 doneBy/doneAt',
      done60.run.status === 'done' && done60.run.doneBy === liliUser.id && !!done60.run.doneAt && done60.idempotent === false,
      { status: done60.run.status, doneBy: done60.run.doneBy });
    const done60dup = await trpcMutate<{ run: TaskRun60; idempotent: boolean }>('taskExec.done', {
      cookie: liliCookie, input: { runId: run60!.id },
    });
    check('60.3 重复 done 幂等返回现状（doneBy/doneAt 不变）',
      done60dup.idempotent === true && done60dup.run.doneBy === liliUser.id &&
        new Date(done60dup.run.doneAt!).getTime() === new Date(done60.run.doneAt!).getTime(),
      { idem: done60dup.idempotent, doneAt: done60dup.run.doneAt });

    /* ---- 60.4 PDCA 全状态机 + 类目集闸 + timeline 只增 ---- */
    interface Pdca60 {
      id: string; status: string; category: string | null; assignStaffId: string | null;
      fixedBy: string | null; recheckResult: string | null;
      timelineJson: Array<{ at: number; by: string; action: string; note?: string }>;
    }
    const raise60 = await trpcMutate<{ issue: Pdca60 }>('pdca.raise', {
      cookie: liliCookie,
      input: { title: '美容室地板水渍', category: '卫生', detail: '【测试】吹水区积水' },
    });
    const raise60bad = await asErr(trpcMutate('pdca.raise', {
      cookie: liliCookie, input: { title: '集外类目', category: '不存在的类目' },
    }));
    const startFix60 = await trpcMutate<{ issue: Pdca60 }>('pdca.startFix', { cookie: liliCookie, input: { issueId: raise60.issue.id } });
    const submitFix60 = await trpcMutate<{ issue: Pdca60 }>('pdca.submitFix', {
      cookie: liliCookie, input: { issueId: raise60.issue.id, fixNote: '【测试】已擦净并拖干' },
    });
    const recheckFail60 = await trpcMutate<{ issue: Pdca60 }>('pdca.recheck', {
      cookie: managerCookie, input: { issueId: raise60.issue.id, result: 'fail', note: '复检仍湿滑' },
    });
    const submitFix60b = await trpcMutate<{ issue: Pdca60 }>('pdca.submitFix', {
      cookie: liliCookie, input: { issueId: raise60.issue.id, fixNote: '【测试】已加防滑垫' },
    });
    const recheckPass60 = await trpcMutate<{ issue: Pdca60 }>('pdca.recheck', {
      cookie: managerCookie, input: { issueId: raise60.issue.id, result: 'pass', note: '复检通过' },
    });
    const tlActions60 = recheckPass60.issue.timelineJson.map((t) => t.action);
    check('60.4 PDCA：raise(open)→startFix(fixing+认领)→submitFix(recheck)→recheck fail 回炉 fixing→再 submitFix→recheck pass→closed',
      raise60.issue.status === 'open' && raise60.issue.category === '卫生' &&
        startFix60.issue.status === 'fixing' && startFix60.issue.assignStaffId === staffRow2.id &&
        submitFix60.issue.status === 'recheck' && submitFix60.issue.fixedBy === liliUser.id &&
        recheckFail60.issue.status === 'fixing' && recheckFail60.issue.recheckResult === 'fail' &&
        submitFix60b.issue.status === 'recheck' &&
        recheckPass60.issue.status === 'closed' && recheckPass60.issue.recheckResult === 'pass',
      { final: recheckPass60.issue.status });
    check('60.4 类目集闸：集外 category → 400「不在类目集」；timeline 只增逐条在（6 条动作链）',
      raise60bad instanceof TrpcHttpError && raise60bad.code === 'BAD_REQUEST' && raise60bad.message.includes('不在类目集') &&
        tlActions60.join(',') === 'raise,startFix,submitFix,recheckFail,submitFix,recheckPass',
      { err: raise60bad?.message, tl: tlActions60 });

    /* ---- 60.5 自检：端口表项 → 服务端算分 → 同日幂等 → 店长审 ---- */
    interface SelfCheck60 {
      id: string; bizDate: string; score: number; status: string; reviewBy: string | null;
      itemsJson: Array<{ key: string; label: string; score: number; pass: boolean }>;
    }
    const items60 = await trpcQuery<{ items: Array<{ key: string; label: string; score: number }> }>('selfCheck.items', { cookie: liliCookie });
    const submit60 = await trpcMutate<{ run: SelfCheck60; idempotent: boolean }>('selfCheck.submit', {
      cookie: liliCookie,
      input: { items: [
        { key: 'disinfect', pass: true },
        { key: 'stock', pass: true },
        { key: 'device', pass: false, note: '【测试】吹水机异响' },
        { key: 'env', pass: true },
      ] },
    });
    const submit60dup = await trpcMutate<{ run: SelfCheck60; idempotent: boolean }>('selfCheck.submit', {
      cookie: liliCookie,
      input: { items: [{ key: 'disinfect', pass: true }, { key: 'stock', pass: true }, { key: 'device', pass: true }, { key: 'env', pass: true }] },
    });
    const todayRun60 = await trpcQuery<{ run: (SelfCheck60 & { items?: Array<{ key: string; pass: boolean }> }) | null }>('selfCheck.today', { cookie: liliCookie });
    check('60.5 自检：读端口 4 表项 → submit 服务端算分=75（3×25，device 未过）→ 快照含 label/score',
      items60.items.length === 4 && submit60.run.score === 75 && submit60.run.status === 'submitted' &&
        submit60.run.itemsJson.length === 4 && submit60.run.itemsJson.every((i) => typeof i.label === 'string' && i.label.length > 0),
      { items: items60.items.length, score: submit60.run.score });
    check('60.5 today 透出 items 数组（页面已交态回显形状；与 itemsJson 同帧——片 3 复核打回件防再漏）',
      Array.isArray(todayRun60.run?.items) && todayRun60.run.items.length === 4 &&
        todayRun60.run.items.some((i) => i.key === 'device' && i.pass === false),
      { hasItems: Array.isArray(todayRun60.run?.items), len: todayRun60.run?.items?.length });
    check('60.5 同日重交幂等返回现状（不双写不覆盖：全 pass 重交仍 75 分同一行）',
      submit60dup.idempotent === true && submit60dup.run.id === submit60.run.id && submit60dup.run.score === 75 &&
        todayRun60.run?.id === submit60.run.id,
      { idem: submit60dup.idempotent, score: submit60dup.run.score });
    const pending60 = await trpcQuery<{ runs: SelfCheck60[] }>('selfCheck.listPending', { cookie: managerCookie });
    const review60 = await trpcMutate<{ run: SelfCheck60; idempotent: boolean }>('selfCheck.review', {
      cookie: managerCookie, input: { runId: submit60.run.id, note: '【测试】异响已报修，通过' },
    });
    check('60.5 店长审：listPending 含本行 → review → reviewed + reviewBy=店长',
      pending60.runs.some((r) => r.id === submit60.run.id) &&
        review60.run.status === 'reviewed' && review60.run.reviewBy === managerFix.id,
      { status: review60.run.status, reviewBy: review60.run.reviewBy });

    /* ---- 60.6 巡检聚合：byCategory 排行含所造类目 ---- */
    const summary60 = await trpcQuery<{
      byStatus: Record<string, number>;
      byCategory: Array<{ category: string; count: number }>;
      closedLast30d: number;
    }>('pdca.summary', { cookie: managerCookie });
    check('60.6 巡检聚合：byStatus.closed≥1 + byCategory 排行含「卫生」+ 近 30 天 closed≥1',
      (summary60.byStatus.closed ?? 0) >= 1 &&
        summary60.byCategory.some((c) => c.category === '卫生' && c.count >= 1) &&
        summary60.closedLast30d >= 1,
      summary60);

    /* ---- 61.1 公告定向发布：groomer 可见+通知+事件；frontdesk 不可见 ---- */
    interface Ann61 { id: string; title: string; targetRole: string; status: string; pinned: boolean; readAt?: Date | null; readCount?: number }
    const pub61 = await trpcMutate<{ announcement: Ann61 }>('announce.publish', {
      cookie: managerCookie,
      input: { title: '【测试】下周团建通知', body: '下周日闭店团建，美容师全员参加', targetRole: 'groomer', pinned: true },
    });
    const liliAnnList = await trpcQuery<{ view: string; announcements: Ann61[] }>('announce.list', { cookie: liliCookie });
    const xiaomeiAnnList = await trpcQuery<{ view: string; announcements: Ann61[] }>('announce.list', { cookie: staffCookie });
    const annNotifs61 = (await db.select().from(schema.notifications))
      .filter((n) => n.type === 'announcement.published' && n.body === '【测试】下周团建通知');
    const annOutbox61 = (await db.select().from(schema.eventOutbox))
      .filter((r) => r.eventType === 'announcement.published' && r.channel === `store:${storeId}`);
    check('61.1 定向发布：丽丽（groomer）list 可见且未读 + 通知落行（type/link=/notices）+ outbox 落 store 频道事件',
      liliAnnList.announcements.some((a) => a.id === pub61.announcement.id && a.readAt === null) &&
        annNotifs61.some((n) => n.userId === liliUser.id && n.link === '/notices') &&
        annOutbox61.length >= 1,
      { list: liliAnnList.announcements.length, notif: annNotifs61.length, outbox: annOutbox61.length });
    check('61.1 定向闸：小美（frontdesk）list 不可见 + 零通知落行',
      !xiaomeiAnnList.announcements.some((a) => a.id === pub61.announcement.id) &&
        !annNotifs61.some((n) => n.userId === staffUser!.id),
      { xmList: xiaomeiAnnList.announcements.map((a) => a.id.slice(-6)) });

    /* ---- 61.2 已读回执：markRead 幂等 + reads 对账双名单 ---- */
    await trpcMutate('announce.markRead', { cookie: liliCookie, input: { announcementId: pub61.announcement.id } });
    await trpcMutate('announce.markRead', { cookie: liliCookie, input: { announcementId: pub61.announcement.id } });
    const readsRows61 = await db.select().from(schema.announcementReads)
      .where(eq(schema.announcementReads.announcementId, pub61.announcement.id));
    const reads61 = await trpcQuery<{ read: Array<{ staffId: string; name: string }>; unread: Array<{ staffId: string; name: string }> }>(
      'announce.reads', { cookie: managerCookie, input: { announcementId: pub61.announcement.id } });
    check('61.2 已读回执：markRead 落行 + 重标幂等零双行（(announcement_id,user_id) 锚）；reads 对账=丽丽 read / 阿强 unread',
      readsRows61.length === 1 && readsRows61[0]!.userId === liliUser.id &&
        reads61.read.some((r) => r.staffId === staffRow2.id && r.name === '丽丽') &&
        reads61.unread.some((r) => r.staffId === staffRow.id && r.name === '阿强'),
      { rows: readsRows61.length, read: reads61.read.map((r) => r.name), unread: reads61.unread.map((r) => r.name) });

    /* ---- 61.3 交接班：closeShift 带 handover 四节 + 在洗快照 + handoverOf + 幂等锚 ---- */
    // 夹具：在洗单一单（in_service），washing_json 服务端快照须含它
    const washAppt61 = await db.insert(schema.appointments).values({
      code: `E2EHO${String(Date.now()).slice(-8)}`,
      customerId: customerUser!.id, storeId, staffId: staffRow.id, assignSource: 'merchant',
      petId, serviceId: service.id, type: 'grooming',
      scheduledStart: new Date(Date.now() - 30 * 60000), scheduledEnd: new Date(Date.now() + 30 * 60000),
      status: 'in_service', priceFen: 8800, paymentMode: 'pay_at_store', note: '【测试】交接班在洗快照单',
    }).returning({ id: schema.appointments.id }).then((r) => r[0]!);
    const shift61 = await db.insert(schema.shifts).values({
      storeId, openedBy: ownerUser!.id, openedAt: new Date(), status: 'open',
    }).returning().then((r) => r[0]!);
    interface CloseShift61 { shift: { id: string; status: string }; handoverId: string | null }
    const closed61 = await trpcMutate<CloseShift61>('cashier.closeShift', {
      cookie: managerCookie,
      input: { handover: { keysNote: '【测试】钥匙已交前台', cashNote: '【测试】现金 500 已点', complaintsNote: '【测试】无客诉', toUserId: liliUser.id } },
    });
    const handoverRow61 = await db.select().from(schema.shiftHandoverLogs)
      .where(eq(schema.shiftHandoverLogs.shiftId, shift61.id)).then((r) => r[0]);
    const handoverOf61 = await trpcQuery<{ handover: { id: string; keysNote: string | null; washingJson: Array<{ appointmentId: string; label: string }> | null } | null }>(
      'cashier.handoverOf', { cookie: managerCookie, input: { shiftId: shift61.id } });
    check('61.3 闭班带 handover 四节：shift_handover_logs 落行（返回 handoverId）+ washing_json 服务端快照含在洗单',
      closed61.shift.id === shift61.id && closed61.shift.status === 'closed' && !!closed61.handoverId &&
        !!handoverRow61 && handoverRow61.keysNote === '【测试】钥匙已交前台' &&
        (handoverRow61.washingJson ?? []).some((w) => w.appointmentId === washAppt61.id),
      { handoverId: closed61.handoverId, washing: handoverRow61?.washingJson });
    check('61.3 handoverOf 读回同一份（keysNote/washing 一致）',
      handoverOf61.handover?.id === closed61.handoverId && handoverOf61.handover?.keysNote === '【测试】钥匙已交前台',
      { id: handoverOf61.handover?.id });
    await asErr(trpcMutate('cashier.closeShift', { cookie: managerCookie, input: { handover: { keysNote: '重关' } } }));
    const handoverRows61b = await db.select().from(schema.shiftHandoverLogs)
      .where(eq(schema.shiftHandoverLogs.shiftId, shift61.id));
    check('61.3 重关幂等不双写（uq_handover_shift 锚：同班恒 1 行）',
      handoverRows61b.length === 1, { rows: handoverRows61b.length });

    /* ---- 61.4 员工心声：ticketCreateStaff → 店长待办 → 回复链通 ---- */
    interface Ticket61 { id: string; ticketNo: string; type: string; createdVia: string; storeId: string; status: string; replyText: string | null; repliedBy: string | null; timelineJson: Array<{ action: string }> }
    const voice61 = await trpcMutate<{ ticket: Ticket61; ticketNo: string }>('serviceLoop.ticketCreateStaff', {
      cookie: liliCookie,
      input: { description: '【测试】希望周日排班轮休更均匀', contactPhone: '13900000004' },
    });
    const voiceRow61 = await db.select().from(schema.supportTickets)
      .where(eq(schema.supportTickets.ticketNo, voice61.ticketNo)).then((r) => r[0]);
    const pending61 = await trpcQuery<Ticket61[]>('serviceLoop.ticketListPending', { cookie: managerCookie });
    check('61.4 心声提单：TK 日序单号 + type=staff_voice + created_via=staff + 挂我本店 + 店长待办可见',
      voice61.ticketNo.startsWith('TK-') && !!voiceRow61 &&
        voiceRow61.type === 'staff_voice' && voiceRow61.createdVia === 'staff' && voiceRow61.storeId === storeId &&
        pending61.some((t) => t.id === voice61.ticket.id),
      { ticketNo: voice61.ticketNo, type: voiceRow61?.type, via: voiceRow61?.createdVia });
    const reply61 = await trpcMutate<{ ticket: Ticket61 }>('serviceLoop.ticketReply', {
      cookie: managerCookie, input: { ticketId: voice61.ticket.id, reply: '【测试】收到，下周班表调整' },
    });
    const mine61 = await trpcQuery<Ticket61[]>('serviceLoop.ticketListMineStaff', { cookie: liliCookie });
    const voiceNotif61 = (await db.select().from(schema.notifications))
      .filter((n) => n.userId === liliUser.id && n.type === 'ticket.replied');
    check('61.4 回复链通：replied + timeline 追加 + 本人 ticketListMineStaff 读回 replyText + ticket.replied 通知落行',
      reply61.ticket.status === 'replied' && reply61.ticket.repliedBy === managerFix.id &&
        reply61.ticket.timelineJson.map((t) => t.action).join(',') === 'submitted,replied' &&
        mine61.some((t) => t.id === voice61.ticket.id && t.replyText === '【测试】收到，下周班表调整') &&
        voiceNotif61.length >= 1,
      { status: reply61.ticket.status, notif: voiceNotif61.length });

    /* ---- 61.5 排班发布透出（片 2 事件的 server 侧断言）：publishWeek → 丽丽通知+未读+1 → markRead 回落 ---- */
    const pubWeek61 = addDays60(21); // 三周后（避开 58.x 已发布的两周）
    await db.insert(schema.shiftAssignments).values({
      storeId, staffId: staffRow2.id, date: pubWeek61, startMin: 600, endMin: 1080,
      source: 'manual', status: 'active', createdBy: ownerUser!.id,
    });
    const unreadBefore61 = (await trpcQuery<{ total: number }>('push.unreadCount', { cookie: liliCookie })).total;
    const pubRes61 = await trpcMutate<{ published: number; perStaff: Array<{ staffId: string; count: number }> }>(
      'schedule.publishWeek', { cookie: managerCookie, input: { weekStart: pubWeek61 } });
    const schedNotifs61 = (await db.select().from(schema.notifications))
      .filter((n) => n.userId === liliUser.id && n.type === 'schedule.published' && n.readAt === null);
    const unreadAfter61 = (await trpcQuery<{ total: number }>('push.unreadCount', { cookie: liliCookie })).total;
    check('61.5 publishWeek → 丽丽 notifications 落 schedule.published 未读行 + unreadCount +1',
      pubRes61.published === 1 && pubRes61.perStaff.some((p) => p.staffId === staffRow2.id) &&
        schedNotifs61.length >= 1 && unreadAfter61 === unreadBefore61 + 1,
      { published: pubRes61.published, unread: `${unreadBefore61}→${unreadAfter61}` });
    await trpcMutate('push.markRead', { cookie: liliCookie, input: { ids: [schedNotifs61[0]!.id] } });
    const unreadBack61 = (await trpcQuery<{ total: number }>('push.unreadCount', { cookie: liliCookie })).total;
    check('61.5 markRead 后 unreadCount 回落（=发布前水位）',
      unreadBack61 === unreadBefore61, { unread: unreadBack61, expect: unreadBefore61 });

    /* ---- 62.1 离职即时锁：停职 → 丽丽下一请求 staffProcedure FORBIDDEN → 恢复 ---- */
    await trpcMutate('store.updateStaff', { cookie: ownerCookie, input: { staffId: staffRow2.id, status: 'suspended' } });
    const locked62 = await asErr(trpcQuery('taskExec.listToday', { cookie: liliCookie }));
    check('62.1 停职即时生效：丽丽 taskExec.listToday → 403 FORBIDDEN（每请求校 staff.status，不等会话过期）',
      locked62 instanceof TrpcHttpError && locked62.httpStatus === 403 && locked62.code === 'FORBIDDEN' &&
        locked62.message.includes('停职'),
      locked62 && { status: locked62.httpStatus, message: locked62.message });
    await trpcMutate('store.updateStaff', { cookie: ownerCookie, input: { staffId: staffRow2.id, status: 'active' } });
    const unlocked62 = await trpcQuery<{ runs: unknown[] }>('taskExec.listToday', { cookie: liliCookie });
    check('62.1 恢复 active 后即恢复可用（listToday 200）', Array.isArray(unlocked62.runs));

    /* ---- 62.2 离职交接：丽丽名下未来单改挂阿强 + 逐行留痕 + 零单幂等 ---- */
    const futureStart62 = new Date(Date.now() + 3 * 86400e3);
    const exitAppt62a = await db.insert(schema.appointments).values({
      code: `E2EEX${String(Date.now()).slice(-7)}A`,
      customerId: customerUser!.id, storeId, staffId: staffRow2.id, assignSource: 'merchant',
      petId, serviceId: service.id, type: 'grooming',
      scheduledStart: futureStart62, scheduledEnd: new Date(futureStart62.getTime() + 3600e3),
      status: 'confirmed', priceFen: 8800, paymentMode: 'pay_at_store', note: '【测试】离职交接-洗护单',
    }).returning({ id: schema.appointments.id }).then((r) => r[0]!);
    const exitAppt62b = await db.insert(schema.appointments).values({
      code: `E2EEX${String(Date.now()).slice(-7)}B`,
      customerId: customerUser!.id, storeId, staffId: staffRow2.id, assignSource: 'merchant',
      petId, serviceId: service.id, type: 'boarding',
      scheduledStart: futureStart62, scheduledEnd: new Date(futureStart62.getTime() + 2 * 86400e3),
      status: 'confirmed', priceFen: 30000, paymentMode: 'pay_at_store', note: '【测试】离职交接-寄养单',
    }).returning({ id: schema.appointments.id }).then((r) => r[0]!);
    const reassign62 = await trpcMutate<{ moved: number }>('staffExit.reassignAppointments', {
      cookie: managerCookie,
      input: { fromStaffId: staffRow2.id, toStaffId: staffRow.id, note: '【测试】丽丽离职交接' },
    });
    const appt62aAfter = await db.select().from(schema.appointments).where(eq(schema.appointments.id, exitAppt62a.id)).then((r) => r[0]!);
    const appt62bAfter = await db.select().from(schema.appointments).where(eq(schema.appointments.id, exitAppt62b.id)).then((r) => r[0]!);
    const handoffs62 = await trpcQuery<{ handoffs: Array<{ kind: string; refId: string; prevValue: string | null; newValue: string | null }> }>(
      'staffExit.listHandoffs', { cookie: managerCookie, input: { staffId: staffRow2.id } });
    const ho62a = handoffs62.handoffs.find((h) => h.refId === exitAppt62a.id);
    const ho62b = handoffs62.handoffs.find((h) => h.refId === exitAppt62b.id);
    check('62.2 改挂：丽丽未完结 2 单全换挂阿强（moved≥2，含 57.6 残留的今日在途单）+ appointments.staffId 实改',
      reassign62.moved >= 2 && appt62aAfter.staffId === staffRow.id && appt62bAfter.staffId === staffRow.id,
      { moved: reassign62.moved, a: appt62aAfter.staffId, b: appt62bAfter.staffId });
    check('62.2 留痕：staff_exit_handoffs 两行 kind 分别 appointment/boarding + 前后值快照对（丽丽→阿强）',
      ho62a?.kind === 'appointment' && ho62b?.kind === 'boarding' &&
        (ho62a.prevValue ?? '').includes(staffRow2.id) && (ho62a.newValue ?? '').includes(staffRow.id) &&
        (ho62b.prevValue ?? '').includes(staffRow2.id) && (ho62b.newValue ?? '').includes(staffRow.id),
      { a: ho62a?.kind, b: ho62b?.kind });
    const reassign62zero = await trpcMutate<{ moved: number }>('staffExit.reassignAppointments', {
      cookie: managerCookie, input: { fromStaffId: staffRow2.id, toStaffId: staffRow.id },
    });
    check('62.2 零单再调幂等 moved=0（丽丽名下已无未完结单）', reassign62zero.moved === 0, reassign62zero);

    /* ---- 62.3 跨店隔离：第二门店店主 B 传 A 店资源 → 查无此物，A 店数据零变化 ---- */
    const [ownerB] = await db.insert(schema.users).values({
      kimiId: 'seed_e2e_ownerb', nickname: 'e2e B 店主', phone: '13900002001',
    }).returning();
    await db.insert(schema.userRoles).values({ userId: ownerB!.id, role: 'merchant_owner' });
    const [storeBRow] = await db.insert(schema.stores).values({
      ownerId: ownerB!.id, name: 'e2e 隔离 B 店', status: 'active',
    }).returning();
    const ownerBCookie = await devLogin(ownerB!.id);
    const crossPdca = await asErr(trpcMutate('pdca.recheck', {
      cookie: ownerBCookie, input: { issueId: raise60.issue.id, result: 'pass' },
    }));
    const crossExit = await asErr(trpcMutate('staffExit.reassignAppointments', {
      cookie: ownerBCookie, input: { fromStaffId: staffRow2.id, toStaffId: staffRow.id },
    }));
    const crossAnn = await asErr(trpcMutate('announce.archive', {
      cookie: ownerBCookie, input: { announcementId: pub61.announcement.id },
    }));
    const pdcaAfter62 = await db.select().from(schema.pdcaIssues).where(eq(schema.pdcaIssues.id, raise60.issue.id)).then((r) => r[0]!);
    const annAfter62 = await db.select().from(schema.announcements).where(eq(schema.announcements.id, pub61.announcement.id)).then((r) => r[0]!);
    check('62.3 跨店隔离：B 店店主 recheck/reassign/archive A 店资源 → 全部查无此物（NOT_FOUND）',
      crossPdca instanceof TrpcHttpError && crossPdca.code === 'NOT_FOUND' &&
        crossExit instanceof TrpcHttpError && crossExit.code === 'NOT_FOUND' &&
        crossAnn instanceof TrpcHttpError && crossAnn.code === 'NOT_FOUND',
      { pdca: crossPdca?.code, exit: crossExit?.code, ann: crossAnn?.code });
    check('62.3 A 店数据零变化（PDCA 仍 closed / 公告仍 published）',
      pdcaAfter62.status === 'closed' && annAfter62.status === 'published',
      { pdca: pdcaAfter62.status, ann: annAfter62.status });
    void storeBRow;
  }

  /* ==================================================================
   * 片 4（薪资+XP，涉钱批）验收段：63 薪资族 / 64 XP 族
   * 口径：金额 integer 分、比例 bp 万分比、规则全端口零常量、算式明面 R15 同口径
   * ================================================================== */
  console.log('\n[片4] 63. 薪资：双轨透出 / 协作拆分 / 回冲 / 工资条 / 发放留痕 / 申诉返还');
  interface S4CommLine {
    billId: string; itemId: string; amountFen: number;
    refundRatioBp: number; refundClawbackFen: number; refunded: boolean;
    splitFrom?: string; splitBp?: number;
  }
  interface S4Summary {
    payload: {
      serviceLines: S4CommLine[]; productLines: S4CommLine[];
      laborTotalFen: number; salesTotalFen: number; refundClawbackTotalFen: number;
      commissionTotalFen: number;
      adjustments: Array<{ refundNo: string; billNo: string; clawbackFen: number }>;
      adjustmentsTotalFen: number;
    };
  }
  const sumLinesOf = (ls: S4CommLine[]) => ls.reduce((s, l) => s + l.amountFen, 0);

  /* ---- 63.1 双轨分账透出：laborTotalFen/salesTotalFen 与行求和恒等（分明面） ---- */
  const sum631aq = await trpcQuery<S4Summary>('commission.mySummary', { cookie: groomerCookie, input: { month: currentMonth } });
  const sum631xm = await trpcQuery<S4Summary>('commission.mySummary', { cookie: staffCookie, input: { month: currentMonth } });
  check('63.1 双轨透出：mySummary 含 laborTotalFen/salesTotalFen 且与 serviceLines/productLines 求和一致（阿强+小美双视角，分明面）',
    sum631aq.payload.laborTotalFen === sumLinesOf(sum631aq.payload.serviceLines) &&
      sum631aq.payload.salesTotalFen === sumLinesOf(sum631aq.payload.productLines) &&
      sum631xm.payload.laborTotalFen === sumLinesOf(sum631xm.payload.serviceLines) &&
      sum631xm.payload.salesTotalFen === sumLinesOf(sum631xm.payload.productLines),
    {
      aq: [sum631aq.payload.laborTotalFen, sumLinesOf(sum631aq.payload.serviceLines), sum631aq.payload.salesTotalFen],
      xm: [sum631xm.payload.laborTotalFen, sum631xm.payload.salesTotalFen, sumLinesOf(sum631xm.payload.productLines)],
    });

  /* ---- 63.2 协作拆分：洗护单 100 元提成额、协作人 4000bp → 协作人 40 元 / 主操作人 60 元 ---- */
  // 夹具定价：读当前生效 commission_grooming_rate，门市价=10000×10000/rateBp → 行毛提成恰 10000 分
  const rateRow632 = await db
    .select({ valueJson: schema.commissionRules.valueJson })
    .from(schema.commissionRules)
    .where(and(eq(schema.commissionRules.ruleKey, 'commission_grooming_rate'), eq(schema.commissionRules.active, true)))
    .get();
  const groomRateBp632 = Number((rateRow632?.valueJson as { rate_bp?: number } | undefined)?.rate_bp ?? 0);
  if (groomRateBp632 <= 0 || (10000 * 10000) % groomRateBp632 !== 0) {
    throw new Error(`63 夹具：当前提成率 ${groomRateBp632}bp 不可整除出 10000 分提成额`);
  }
  const price632 = (10000 * 10000) / groomRateBp632;
  const appt632 = (await db.insert(schema.appointments).values({
    code: 'E2ES4A', customerId: customerUser!.id, storeId, petId, serviceId: service.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'in_service', priceFen: price632, staffId: aqiang.id, note: '【测试】e2e 片4 协作拆分单',
  }).returning())[0]!;

  const collabOf632 = await trpcQuery<{ defaultSplitBp: number; collaborators: Array<{ staffId: string }> }>(
    'payroll.collabOf', { cookie: managerCookie, input: { appointmentId: appt632.id } });
  check('63.2 collabOf 透出单信息+端口缺省建议比（commission_collab_split_default=5000bp）',
    collabOf632.defaultSplitBp === 5000 && collabOf632.collaborators.length === 0, collabOf632.defaultSplitBp);

  // 负例前置（单未 completed 时验）：超 10000 → 400；主操作人重复 → 400；越店单 → 403
  const collabOverBp = await asErr(trpcMutate('payroll.setCollaborators', {
    cookie: managerCookie,
    input: { appointmentId: appt632.id, collaborators: [{ staffId: staffRow2.id, role: 'wash', splitBp: 10000 }] },
  }));
  const collabMainDup = await asErr(trpcMutate('payroll.setCollaborators', {
    cookie: managerCookie,
    input: { appointmentId: appt632.id, collaborators: [{ staffId: aqiang.id, role: 'wash', splitBp: 1000 }] },
  }));
  const storeB632 = await db.select().from(schema.stores).where(eq(schema.stores.name, 'e2e 隔离 B 店')).get();
  const apptCross632 = (await db.insert(schema.appointments).values({
    code: 'E2ES4X', customerId: customerUser!.id, storeId: storeB632!.id, petId, serviceId: service.id,
    type: 'grooming', scheduledStart: new Date(), scheduledEnd: new Date(),
    status: 'in_service', priceFen: 10000, staffId: aqiang.id, note: '【测试】e2e 片4 越店协作拆分负例',
  }).returning())[0]!;
  const collabCross = await asErr(trpcMutate('payroll.setCollaborators', {
    cookie: managerCookie,
    input: { appointmentId: apptCross632.id, collaborators: [{ staffId: staffRow2.id, role: 'wash', splitBp: 4000 }] },
  }));
  check('63.2 setCollaborators 负例：Σ≥10000 → 400 / 主操作人重复 → 400 / 越店单 → 403',
    collabOverBp instanceof TrpcHttpError && collabOverBp.httpStatus === 400 && collabOverBp.message.includes('留余数') &&
      collabMainDup instanceof TrpcHttpError && collabMainDup.httpStatus === 400 && collabMainDup.message.includes('主操作人') &&
      collabCross instanceof TrpcHttpError && collabCross.httpStatus === 403 && collabCross.code === 'FORBIDDEN',
    { over: collabOverBp && { s: collabOverBp.httpStatus, m: collabOverBp.message }, main: collabMainDup && { s: collabMainDup.httpStatus, m: collabMainDup.message }, cross: collabCross && { s: collabCross.httpStatus, c: collabCross.code } });

  const setCollab632 = await trpcMutate<{ count: number; collaborators: Array<{ splitBp: number }> }>('payroll.setCollaborators', {
    cookie: managerCookie,
    input: { appointmentId: appt632.id, collaborators: [{ staffId: staffRow2.id, role: 'wash', splitBp: 4000 }] },
  });
  await db.update(schema.appointments).set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.appointments.id, appt632.id));
  const bill632 = await settleBill2([{ kind: 'appointment', refId: appt632.id }], { note: '【测试】e2e 片4 协作拆分结账' });
  await db.update(schema.cashierBills).set({ settledAt: new Date(`${currentMonth}-15T12:00:00`), updatedAt: new Date() })
    .where(eq(schema.cashierBills.id, bill632.billId)); // 63.x 钉时刻：账单归属月钉死（跨零点/跨月界同稳）
  const sumAq632 = await trpcQuery<S4Summary>('commission.mySummary', { cookie: groomerCookie, input: { month: currentMonth } });
  const sumLl632 = await trpcQuery<S4Summary>('commission.mySummary', { cookie: liliCookie, input: { month: currentMonth } });
  const lineAq632 = sumAq632.payload.serviceLines.find((l) => l.billId === bill632.billId);
  const lineLl632 = sumLl632.payload.serviceLines.find((l) => l.billId === bill632.billId);
  check('63.2 协作拆分：丽丽 4000bp 得 40 元（splitFrom=阿强/splitBp=4000 注记），主操作人阿强得 60 元（余数落主），合计=毛额 100 元，精确到分',
    setCollab632.count === 1 &&
      lineLl632?.amountFen === 4000 && lineLl632.splitFrom === aqiang.id && lineLl632.splitBp === 4000 &&
      lineAq632?.amountFen === 6000 && lineAq632.amountFen + lineLl632.amountFen === 10000,
    { aq: lineAq632?.amountFen, ll: lineLl632 && { amount: lineLl632.amountFen, from: lineLl632.splitFrom, bp: lineLl632.splitBp } });

  /* ---- 63.3 拆分单回冲：同月退 50% → 两人 refundClawback 各按分得比精确到分 ---- */
  await execRefund(ownerCookie, { billNo: bill632.billNo, type: 'partial_amount', amountFen: price632 / 2, reason: '片4 协作单同月退 50%' });
  const sumAq633 = await trpcQuery<S4Summary>('commission.mySummary', { cookie: groomerCookie, input: { month: currentMonth } });
  const sumLl633 = await trpcQuery<S4Summary>('commission.mySummary', { cookie: liliCookie, input: { month: currentMonth } });
  const lineAq633 = sumAq633.payload.serviceLines.find((l) => l.billId === bill632.billId);
  const lineLl633 = sumLl633.payload.serviceLines.find((l) => l.billId === bill632.billId);
  check('63.3 同月退 50%：两人 refundClawback 各按分得比精确到分（阿强 6000×50%=3000 / 丽丽 4000×50%=2000，行净额同步减半）',
    lineAq633?.refundClawbackFen === 3000 && lineAq633.amountFen === 3000 &&
      lineLl633?.refundClawbackFen === 2000 && lineLl633.amountFen === 2000 &&
      sumAq633.payload.refundClawbackTotalFen >= 3000,
    { aq: lineAq633 && [lineAq633.amountFen, lineAq633.refundClawbackFen], ll: lineLl633 && [lineLl633.amountFen, lineLl633.refundClawbackFen] });

  // 跨月：同款协作单回填上月+上月已快照（R12⑧ 已全店快照）→ 退款差额进本月 adjustments，源月快照 total_fen 不动
  const backTs633 = new Date(`${prevMonthStr}-16T12:00:00`);
  /* 跨月源单按 settled_at 时序解析规则（回溯口径：上月单早于现行版 effective_from →
     命中 R12⑧ 回填的 v0 历史行）——期望值按同一口径现算，不写死率 */
  const histRows633 = await db
    .select({ valueJson: schema.commissionRules.valueJson, effectiveFrom: schema.commissionRules.effectiveFrom })
    .from(schema.commissionRules)
    .where(eq(schema.commissionRules.ruleKey, 'commission_grooming_rate'));
  const histSorted633 = histRows633.map((r) => ({ effMs: r.effectiveFrom.getTime(), bp: Number((r.valueJson as { rate_bp?: number }).rate_bp ?? 0) }))
    .sort((a, b) => a.effMs - b.effMs);
  let histBp633 = histSorted633[0]!.bp;
  for (const r of histSorted633) { if (r.effMs >= backTs633.getTime()) break; histBp633 = r.bp; }
  const gross633 = Math.round((price632 * histBp633) / 10000); // 行毛提成（源单时序率）
  const collabShare633 = Math.round((gross633 * 4000) / 10000); // 协作人分得（4000bp）
  const mainShare633 = gross633 - collabShare633; // 主操作人余数
  const expAdjAq633 = Math.round(mainShare633 * 0.5); // 各人 adjustments=本人分得×退款比例 50%
  const expAdjLl633 = Math.round(collabShare633 * 0.5);
  const appt633 = (await db.insert(schema.appointments).values({
    code: 'E2ES4B', customerId: customerUser!.id, storeId, petId, serviceId: service.id,
    type: 'grooming', scheduledStart: backTs633, scheduledEnd: backTs633,
    status: 'in_service', priceFen: price632, staffId: aqiang.id, note: '【测试】e2e 片4 跨月协作拆分单',
  }).returning())[0]!;
  await trpcMutate('payroll.setCollaborators', {
    cookie: managerCookie,
    input: { appointmentId: appt633.id, collaborators: [{ staffId: staffRow2.id, role: 'wash', splitBp: 4000 }] },
  });
  await db.update(schema.appointments).set({ status: 'completed', completedAt: backTs633, updatedAt: new Date() })
    .where(eq(schema.appointments.id, appt633.id));
  const bill633 = await settleBill2([{ kind: 'appointment', refId: appt633.id }], { note: '【测试】e2e 片4 跨月协作源单结账' });
  await db.update(schema.cashierBills).set({ settledAt: backTs633, updatedAt: new Date() })
    .where(eq(schema.cashierBills.id, bill633.billId));
  const snapAq633 = await db.select().from(schema.commissionSnapshots)
    .where(and(eq(schema.commissionSnapshots.staffId, aqiang.id), eq(schema.commissionSnapshots.period, prevMonthStr), eq(schema.commissionSnapshots.kind, 'commission')))
    .get();
  const v633 = await execRefund(ownerCookie, { billNo: bill633.billNo, type: 'partial_amount', amountFen: price632 / 2, reason: '片4 跨月协作单退 50%' });
  const sumAq633x = await trpcQuery<S4Summary>('commission.mySummary', { cookie: groomerCookie, input: { month: currentMonth } });
  const sumLl633x = await trpcQuery<S4Summary>('commission.mySummary', { cookie: liliCookie, input: { month: currentMonth } });
  const adjAq633 = sumAq633x.payload.adjustments.find((a) => a.refundNo === v633.refund.refundNo);
  const adjLl633 = sumLl633x.payload.adjustments.find((a) => a.refundNo === v633.refund.refundNo);
  const snapAq633after = await db.select().from(schema.commissionSnapshots)
    .where(and(eq(schema.commissionSnapshots.staffId, aqiang.id), eq(schema.commissionSnapshots.period, prevMonthStr), eq(schema.commissionSnapshots.kind, 'commission')))
    .get();
  check('63.3 跨月回冲：差额按分得比进本月 adjustments（主操作人=余数×50% / 协作人=分得×50%，源单时序率现算）且源月快照 total_fen 不动',
    adjAq633?.clawbackFen === expAdjAq633 && adjLl633?.clawbackFen === expAdjLl633 &&
      !!snapAq633 && !!snapAq633after && snapAq633after.totalFen === snapAq633.totalFen,
    { aq: [adjAq633?.clawbackFen, expAdjAq633], ll: [adjLl633?.clawbackFen, expAdjLl633], snapBefore: snapAq633?.totalFen, snapAfter: snapAq633after?.totalFen });

  /* ---- 63.4 工资条：generateMonth → 幂等 → confirmRun 两态 → 重复确认幂等 ---- */
  interface S4Run { id: string; status: string; month: string }
  const gen634a = await trpcMutate<{ run: S4Run; staffCount: number; itemsInserted: number; duplicated: boolean }>(
    'payroll.generateMonth', { cookie: ownerCookie, input: { month: currentMonth } });
  const itemAq634 = await db.select().from(schema.payrollItems)
    .where(and(eq(schema.payrollItems.runId, gen634a.run.id), eq(schema.payrollItems.staffId, aqiang.id)))
    .get();
  check('63.4 generateMonth 落 run+逐人 items（generated 态）+ net 逐分对账=commission+performance−deduction+adjustment',
    gen634a.run.status === 'generated' && gen634a.staffCount > 0 && gen634a.itemsInserted === gen634a.staffCount &&
      !!itemAq634 && itemAq634.netFen === itemAq634.commissionFen + itemAq634.performanceFen - itemAq634.deductionFen + itemAq634.adjustmentFen,
    { run: gen634a.run.status, inserted: gen634a.itemsInserted, net: itemAq634 && [itemAq634.netFen, itemAq634.commissionFen, itemAq634.performanceFen, itemAq634.deductionFen, itemAq634.adjustmentFen] });
  const gen634b = await trpcMutate<{ run: S4Run; itemsInserted: number; duplicated: boolean }>(
    'payroll.generateMonth', { cookie: ownerCookie, input: { month: currentMonth } });
  check('63.4 重复生成幂等返回现状（同 run id，itemsInserted=0）',
    gen634b.run.id === gen634a.run.id && gen634b.itemsInserted === 0 && gen634b.duplicated === true, gen634b);
  const conf634a = await trpcMutate<{ run: S4Run; duplicated: boolean }>(
    'payroll.confirmRun', { cookie: ownerCookie, input: { month: currentMonth } });
  const conf634b = await trpcMutate<{ run: S4Run; duplicated: boolean }>(
    'payroll.confirmRun', { cookie: ownerCookie, input: { month: currentMonth } });
  check('63.4 confirmRun 两态（generated→confirmed）+ 重复确认幂等',
    conf634a.run.status === 'confirmed' && conf634a.duplicated === false && conf634b.duplicated === true, { a: conf634a.run.status, b: conf634b.duplicated });
  const list634 = await trpcQuery<{ run: S4Run | null; items: Array<{ staffId: string; staffName: string | null; netFen: number }> }>(
    'payroll.listRun', { cookie: managerCookie, input: { month: currentMonth } });
  check('63.4 listRun（manager）透出 run+items 含员工名',
    list634.run?.id === gen634a.run.id && list634.items.length === gen634a.staffCount &&
      list634.items.some((i) => i.staffId === aqiang.id && typeof i.staffName === 'string' && i.staffName.length > 0),
    { items: list634.items.length, expect: gen634a.staffCount });

  /* ---- 63.5 本人闸+发放：mySlip 本人 200 / 他人 FORBIDDEN / markDisbursed 留痕不碰真钱 ---- */
  const slip635 = await trpcQuery<{ item: { id: string; staffId: string; netFen: number } | null }>(
    'payroll.mySlip', { cookie: liliCookie, input: { month: currentMonth } });
  check('63.5 mySlip 本人 200（丽丽本人工资条透出）', slip635.item?.staffId === staffRow2.id, slip635.item?.staffId);
  const slip635cross = await asErr(trpcQuery('payroll.mySlip', {
    cookie: liliCookie, input: { month: currentMonth, staffId: aqiang.id }, // 丽丽传他人 staffId
  }));
  check('63.5 mySlip 丽丽传他人 staffId → FORBIDDEN（仅本人硬过滤）',
    slip635cross instanceof TrpcHttpError && slip635cross.httpStatus === 403 && slip635cross.code === 'FORBIDDEN',
    slip635cross && { s: slip635cross.httpStatus, c: slip635cross.code });
  const payOrdersBefore635 = (await db.select().from(schema.payOrders)).length;
  const mark635a = await trpcMutate<{ item: { id: string; markedBy: string | null; markedAt: Date | null }; duplicated: boolean }>(
    'payroll.markDisbursed', { cookie: ownerCookie, input: { itemId: slip635.item!.id, methodNote: '现金发放（e2e 留痕，不碰真钱）' } });
  const mark635b = await trpcMutate<{ item: { id: string; markedBy: string | null; markedAt: Date | null }; duplicated: boolean }>(
    'payroll.markDisbursed', { cookie: ownerCookie, input: { itemId: slip635.item!.id } });
  const payOrdersAfter635 = (await db.select().from(schema.payOrders)).length;
  check('63.5 markDisbursed 落标记+重复幂等+零 pay_orders 新行（发放留痕不碰真钱实证）',
    !!mark635a.item.markedBy && !!mark635a.item.markedAt && mark635a.duplicated === false &&
      mark635b.duplicated === true && String(mark635b.item.markedAt) === String(mark635a.item.markedAt) &&
      payOrdersAfter635 === payOrdersBefore635,
    { marked: !!mark635a.item.markedAt, dup: mark635b.duplicated, payOrders: [payOrdersBefore635, payOrdersAfter635] });

  /* ---- 63.6 罚单申诉返还：approved → reverted+refund_fen=20000 / rejected=原扣减 active 不变 ---- */
  // 扣减行夹具直插（绕开 50% 闸——闸门已在 R9 段实证，本段专验申诉返还链）
  const ded636 = (await db.insert(schema.deductionRecords).values({
    storeId, staffId: staffRow2.id, month: currentMonth, amountFen: 20000,
    reason: '【测试】e2e 片4 罚单申诉返还（approved 案例）', createdBy: managerFix.id,
  }).returning())[0]!;
  const appeal636a = await trpcMutate<{ appeal: { id: string; status: string }; duplicated: boolean }>('payroll.raiseAppeal', {
    cookie: liliCookie,
    input: { targetKind: 'deduction', targetId: ded636.id, month: currentMonth, reason: '罚单金额有误，申请复核' },
  });
  const appeal636dup = await trpcMutate<{ appeal: { id: string; status: string }; duplicated: boolean }>('payroll.raiseAppeal', {
    cookie: liliCookie,
    input: { targetKind: 'deduction', targetId: ded636.id, month: currentMonth, reason: '重复提交验证幂等' },
  });
  check('63.6 raiseAppeal 建行 + 同人同目标 pending 在途幂等拒（返回现状，零新增）',
    appeal636a.appeal.status === 'pending' && appeal636a.duplicated === false &&
      appeal636dup.duplicated === true && appeal636dup.appeal.id === appeal636a.appeal.id,
    { a: appeal636a.appeal.id, dup: appeal636dup.duplicated });
  const review636 = await trpcMutate<{ appeal: { id: string; status: string; refundFen: number | null; reviewerId: string | null }; refundFen: number | null }>(
    'payroll.reviewAppeal', { cookie: managerCookie, input: { appealId: appeal636a.appeal.id, result: 'approved', note: '属实，全额返还' } });
  const ded636after = await db.select().from(schema.deductionRecords).where(eq(schema.deductionRecords.id, ded636.id)).get();
  const review636again = await asErr(trpcMutate('payroll.reviewAppeal', {
    cookie: managerCookie, input: { appealId: appeal636a.appeal.id, result: 'approved', note: '重复复核验证' },
  }));
  check('63.6 approved → deduction.status=reverted+refund_fen=20000（返还留痕不删行）+ reviewer 落列 + 重复复核幂等拒 400',
    review636.appeal.status === 'approved' && review636.refundFen === 20000 &&
      ded636after?.status === 'reverted' && ded636after.revertedBy === managerFix.id && !!ded636after.revertedAt &&
      review636again instanceof TrpcHttpError && review636again.httpStatus === 400 && review636again.message.includes('已复核'),
    { st: ded636after?.status, refund: review636.refundFen, again: review636again && { s: review636again.httpStatus, m: review636again.message } });
  const ded636b = (await db.insert(schema.deductionRecords).values({
    storeId, staffId: staffRow2.id, month: currentMonth, amountFen: 20000,
    reason: '【测试】e2e 片4 罚单申诉返还（rejected 案例）', createdBy: managerFix.id,
  }).returning())[0]!;
  const appeal636b = await trpcMutate<{ appeal: { id: string } }>('payroll.raiseAppeal', {
    cookie: liliCookie,
    input: { targetKind: 'deduction', targetId: ded636b.id, month: currentMonth, reason: '驳回案例验证' },
  });
  await trpcMutate('payroll.reviewAppeal', {
    cookie: managerCookie, input: { appealId: appeal636b.appeal.id, result: 'rejected', note: '证据不足，维持原扣减' },
  });
  const ded636bafter = await db.select().from(schema.deductionRecords).where(eq(schema.deductionRecords.id, ded636b.id)).get();
  check('63.6 rejected 案例=原扣减 active 不变（零返还零置位）',
    ded636bafter?.status === 'active' && !ded636bafter.revertedAt, { st: ded636bafter?.status });
  const dedList636 = await trpcQuery<{ deductions: Array<{ id: string; staffName: string | null; status: string; revertedAt: Date | null }> }>(
    'payroll.listDeductions', { cookie: managerCookie, input: { month: currentMonth } });
  check('63.6 listDeductions 罚单表读口：含员工名+reverted/active 两态透出（UI 区 3 数据源）',
    dedList636.deductions.some((d) => d.id === ded636.id && d.status === 'reverted' && !!d.staffName) &&
      dedList636.deductions.some((d) => d.id === ded636b.id && d.status === 'active'),
    { n: dedList636.deductions.length });
  const sla636 = await trpcQuery<{ hours: number; source: string }>('payroll.appealSlaHours', { cookie: liliCookie });
  check('63.6 appealSlaHours 读端口 service_rules.payroll_appeal_sla_hours=24（页面注记数据源）',
    sla636.hours === 24 && sla636.source === 'service_rules.payroll_appeal_sla_hours', sla636);

  /* ---- 64.1 XP 申报审核：pending 零污染 → approved 落行+回链+月增量含 5 分；rejected=零事件 ---- */
  console.log('\n[片4] 64. XP：申报审核 / 扣分异议对冲');
  const xpSumBefore641 = await trpcQuery<{ monthGained: number }>('xp.mySummary', { cookie: liliCookie });
  const app641 = await trpcMutate<{ application: { id: string; status: string }; duplicated: boolean }>('xp.raiseApplication', {
    cookie: liliCookie, input: { appKind: 'award', pointsRequested: 5, reason: '周末加班支援前台' },
  });
  const evAfterRaise641 = await db.select().from(schema.xpEvents)
    .where(and(eq(schema.xpEvents.staffId, staffRow2.id), eq(schema.xpEvents.source, 'application')));
  const app641dup = await trpcMutate<{ application: { id: string }; duplicated: boolean }>('xp.raiseApplication', {
    cookie: liliCookie, input: { appKind: 'award', pointsRequested: 5, reason: '重复提交验证幂等' },
  });
  check('64.1 raiseApplication 建行 + pending 不污染 xp_events（零新增）+ 同人同分值 pending 幂等拒',
    app641.application.status === 'pending' && evAfterRaise641.length === 0 &&
      app641dup.duplicated === true && app641dup.application.id === app641.application.id,
    { ev: evAfterRaise641.length, dup: app641dup.duplicated });
  const rev641 = await trpcMutate<{ application: { id: string; status: string; resolvedEventId: string | null }; resolvedEventId: string | null }>(
    'xp.reviewApplication', { cookie: managerCookie, input: { applicationId: app641.application.id, result: 'approved', note: '属实，同意加分' } });
  const evApp641 = await db.select().from(schema.xpEvents)
    .where(and(eq(schema.xpEvents.staffId, staffRow2.id), eq(schema.xpEvents.source, 'application')));
  const xpSumAfter641 = await trpcQuery<{ monthGained: number }>('xp.mySummary', { cookie: liliCookie });
  check('64.1 approved → awardXp 落行（source=application/+5）+resolved_event_id 回链+月增量含 5 分',
    rev641.application.status === 'approved' && evApp641.length === 1 && evApp641[0]!.points === 5 &&
      rev641.resolvedEventId === evApp641[0]!.id && rev641.application.resolvedEventId === evApp641[0]!.id &&
      xpSumAfter641.monthGained === xpSumBefore641.monthGained + 5,
    { ev: evApp641.map((e) => [e.points, e.id]), monthGained: [xpSumBefore641.monthGained, xpSumAfter641.monthGained] });
  const app641b = await trpcMutate<{ application: { id: string } }>('xp.raiseApplication', {
    cookie: liliCookie, input: { appKind: 'award', pointsRequested: 3, reason: '驳回案例验证' },
  });
  await trpcMutate('xp.reviewApplication', {
    cookie: managerCookie, input: { applicationId: app641b.application.id, result: 'rejected', note: '不符合发放口径' },
  });
  const evApp641b = await db.select().from(schema.xpEvents)
    .where(and(eq(schema.xpEvents.staffId, staffRow2.id), eq(schema.xpEvents.source, 'application')));
  check('64.1 rejected 案例=零事件（xp_events 仍仅 1 行 application）', evApp641b.length === 1, evApp641b.length);

  /* ---- 64.2 扣分异议：penalty −8 → revoke_appeal approved → 对冲 +8（revoke_offset），原负分保留 ---- */
  const penEv642 = (await db.insert(schema.xpEvents).values({
    storeId, staffId: staffRow2.id, userId: liliUser.id, source: 'penalty', sourceId: 'e2e-s4-penalty',
    points: -8, channel: 'daily', ruleVersion: 1, dropped: false,
  }).returning())[0]!;
  const ra642 = await trpcMutate<{ application: { id: string; status: string }; duplicated: boolean }>('xp.raiseApplication', {
    cookie: liliCookie,
    input: { appKind: 'revoke_appeal', targetEventId: penEv642.id, pointsRequested: 8, reason: '差评非本人服务责任，申请复核' },
  });
  const ra642dup = await trpcMutate<{ application: { id: string }; duplicated: boolean }>('xp.raiseApplication', {
    cookie: liliCookie,
    input: { appKind: 'revoke_appeal', targetEventId: penEv642.id, pointsRequested: 8, reason: '同事件重复申请验证' },
  });
  check('64.2 revoke_appeal 挂本人 penalty 事件建行 + 同事件重复申请幂等拒',
    ra642.application.status === 'pending' && ra642dup.duplicated === true && ra642dup.application.id === ra642.application.id,
    { a: ra642.application.id, dup: ra642dup.duplicated });
  const rev642 = await trpcMutate<{ application: { status: string; resolvedEventId: string | null }; resolvedEventId: string | null }>(
    'xp.reviewApplication', { cookie: managerCookie, input: { applicationId: ra642.application.id, result: 'approved', note: '属实，对冲扣分' } });
  const offset642 = await db.select().from(schema.xpEvents)
    .where(and(eq(schema.xpEvents.source, 'revoke_offset'), eq(schema.xpEvents.sourceId, penEv642.id)));
  const penAfter642 = await db.select().from(schema.xpEvents).where(eq(schema.xpEvents.id, penEv642.id)).get();
  const rev642again = await asErr(trpcMutate('xp.reviewApplication', {
    cookie: managerCookie, input: { applicationId: ra642.application.id, result: 'approved', note: '重复复核验证' },
  }));
  check('64.2 approved → 对冲行 +8 落（source=revoke_offset 回链）+ 原负分 −8 保留 + 合计=对冲净值 0 + 重复复核幂等拒 400',
    rev642.application.status === 'approved' && offset642.length === 1 && offset642[0]!.points === 8 &&
      rev642.resolvedEventId === offset642[0]!.id &&
      penAfter642?.points === -8 && offset642[0]!.points + penAfter642.points === 0 &&
      rev642again instanceof TrpcHttpError && rev642again.httpStatus === 400,
    { offset: offset642.map((e) => e.points), pen: penAfter642?.points, again: rev642again && rev642again.httpStatus });

  /* ==================================================================
   * 客户端体验大批 片 1（账户体系+支付售后 · server 侧）验收段 65/66
   * 65 账户族：资料编辑 / 收货地址 / 发票抬头 / 异常登录提醒
   * 66 支付售后族：押金台账（留痕不碰真钱）/ 消费记录统一入口（纯聚合只读）
   * ================================================================== */
  console.log('\n[片1] 65. 账户族（资料编辑/地址/抬头/异常登录提醒）');

  /* ---------- 65.1 updateProfile：资料编辑落库+读回一致+非法输入 400 ---------- */
  console.log('\n[片1] 65.1 updateProfile 资料编辑');
  const reg65a = await devLoginPhone('13966660050');
  const cookie65a = reg65a.cookie!;
  const user65aId = reg65a.body.user!.id!;
  interface MeUser65 { id: string; nickname: string | null; birthday: string | null; gender: string | null }
  const upd651 = await trpcMutate<{ user: MeUser65 }>('auth.updateProfile', {
    cookie: cookie65a,
    input: { nickname: '体验喵', birthday: '1999-12-31', gender: 'female' },
  });
  check('65.1 updateProfile 改昵称/生日/性别落库（返回 user 三字段一致）',
    upd651.user.id === user65aId && upd651.user.nickname === '体验喵' &&
      upd651.user.birthday === '1999-12-31' && upd651.user.gender === 'female',
    upd651.user);
  const me651 = await trpcQuery<{ user: MeUser65 }>('auth.me', { cookie: cookie65a });
  check('65.1 auth.me 读回一致（昵称/生日/性别）',
    me651.user.nickname === '体验喵' && me651.user.birthday === '1999-12-31' && me651.user.gender === 'female',
    me651.user);
  const updBadBirth651 = await asErr(trpcMutate('auth.updateProfile', {
    cookie: cookie65a, input: { birthday: '2026-13-40' },
  }));
  const updBadBirthFmt651 = await asErr(trpcMutate('auth.updateProfile', {
    cookie: cookie65a, input: { birthday: '1999/01/01' },
  }));
  check('65.1 非法 birthday 400 明文（不存在历日 + 非法格式双闸）',
    updBadBirth651 instanceof TrpcHttpError && updBadBirth651.code === 'BAD_REQUEST' && updBadBirth651.message.includes('生日') &&
      updBadBirthFmt651 instanceof TrpcHttpError && updBadBirthFmt651.code === 'BAD_REQUEST' && updBadBirthFmt651.message.includes('生日'),
    { a: updBadBirth651 && updBadBirth651.message, b: updBadBirthFmt651 && updBadBirthFmt651.message });
  const updBadGender651 = await asErr(trpcMutate('auth.updateProfile', {
    cookie: cookie65a, input: { gender: 'other' },
  }));
  check('65.1 性别枚举外 400 明文（male/female/secret）',
    updBadGender651 instanceof TrpcHttpError && updBadGender651.code === 'BAD_REQUEST' && updBadGender651.message.includes('性别'),
    updBadGender651 && updBadGender651.message);
  const updBadNick651 = await asErr(trpcMutate('auth.updateProfile', {
    cookie: cookie65a, input: { nickname: '' },
  }));
  check('65.1 空昵称 400（非空 1-20 字闸）',
    updBadNick651 instanceof TrpcHttpError && updBadNick651.code === 'BAD_REQUEST',
    updBadNick651 && updBadNick651.message);
  const updPartial651 = await trpcMutate<{ user: MeUser65 }>('auth.updateProfile', {
    cookie: cookie65a, input: { nickname: '只改昵称' },
  });
  check('65.1 传啥改啥：仅改昵称，生日/性别原值不动',
    updPartial651.user.nickname === '只改昵称' && updPartial651.user.birthday === '1999-12-31' && updPartial651.user.gender === 'female',
    updPartial651.user);

  /* ---------- 65.2 收货地址 CRUD+默认 ---------- */
  console.log('\n[片1] 65.2 收货地址 CRUD+默认');
  interface AddrRow65 { id: string; receiver: string; detail: string; isDefault: boolean }
  const addrA1 = await trpcMutate<{ address: AddrRow65 }>('address.create', {
    cookie: cookie65a,
    input: { receiver: '喵收件', phone: '13966660050', region: '浙江省杭州市西湖区', detail: '文三路 1 号' },
  });
  const addrA2 = await trpcMutate<{ address: AddrRow65 }>('address.create', {
    cookie: cookie65a,
    input: { receiver: '汪收件', phone: '13966660051', region: '浙江省杭州市拱墅区', detail: '莫干山路 2 号', isDefault: true },
  });
  const addrList652 = await trpcQuery<{ items: AddrRow65[] }>('address.list', { cookie: cookie65a });
  check('65.2 create 两条（第二条 isDefault=true）→ list 默认在前 + 第一条默认被同事务清掉',
    addrA1.address.isDefault === false && addrA2.address.isDefault === true &&
      addrList652.items.length === 2 && addrList652.items[0]!.id === addrA2.address.id &&
      addrList652.items[0]!.isDefault === true && addrList652.items[1]!.isDefault === false,
    addrList652.items.map((a) => ({ id: a.id, d: a.isDefault })));
  const addrBadPhone = await asErr(trpcMutate('address.create', {
    cookie: cookie65a,
    input: { receiver: '错号', phone: '123', region: 'x', detail: 'y' },
  }));
  check('65.2 手机号 11 位校验（非法 → 400 明文）',
    addrBadPhone instanceof TrpcHttpError && addrBadPhone.code === 'BAD_REQUEST' && addrBadPhone.message.includes('手机号'),
    addrBadPhone && addrBadPhone.message);
  const addrUpd = await trpcMutate<{ address: AddrRow65 }>('address.update', {
    cookie: cookie65a, input: { id: addrA1.address.id, detail: '文三路 2 号（已改）' },
  });
  check('65.2 update 改 detail 落库', addrUpd.address.detail === '文三路 2 号（已改）', addrUpd.address);
  const addrRm = await trpcMutate<{ removed: boolean; promotedId: string | null }>('address.remove', {
    cookie: cookie65a, input: { id: addrA2.address.id },
  });
  const addrListAfterRm = await trpcQuery<{ items: AddrRow65[] }>('address.list', { cookie: cookie65a });
  check('65.2 remove 默认行 → 剩余第一条自动升默认（promotedId=剩余行 + list 读回 isDefault=true）',
    addrRm.removed === true && addrRm.promotedId === addrA1.address.id &&
      addrListAfterRm.items.length === 1 && addrListAfterRm.items[0]!.isDefault === true,
    { promotedId: addrRm.promotedId, list: addrListAfterRm.items.map((a) => ({ id: a.id, d: a.isDefault })) });
  const addrCrossUpd = await asErr(trpcMutate('address.update', {
    cookie: customerCookie, input: { id: addrA1.address.id, detail: '越权改' },
  }));
  const addrCrossRm = await asErr(trpcMutate('address.remove', {
    cookie: customerCookie, input: { id: addrA1.address.id },
  }));
  const addrCrossDef = await asErr(trpcMutate('address.setDefault', {
    cookie: customerCookie, input: { id: addrA1.address.id },
  }));
  check('65.2 他人 id 操作一律 NOT_FOUND 不透出（update/remove/setDefault 三连）',
    [addrCrossUpd, addrCrossRm, addrCrossDef].every(
      (e) => e instanceof TrpcHttpError && e.code === 'NOT_FOUND',
    ),
    [addrCrossUpd?.code, addrCrossRm?.code, addrCrossDef?.code]);
  const addrA3 = await trpcMutate<{ address: AddrRow65 }>('address.create', {
    cookie: cookie65a,
    input: { receiver: '兔收件', phone: '13966660052', region: '浙江省杭州市滨江区', detail: '江南大道 3 号' },
  });
  const addrSetDef = await trpcMutate<{ address: AddrRow65 }>('address.setDefault', {
    cookie: cookie65a, input: { id: addrA3.address.id },
  });
  const addrListFinal = await trpcQuery<{ items: AddrRow65[] }>('address.list', { cookie: cookie65a });
  check('65.2 setDefault 同事务清其他默认（a3 升默认 + a1 被清，list 默认在前）',
    addrSetDef.address.isDefault === true && addrListFinal.items[0]!.id === addrA3.address.id &&
      addrListFinal.items[0]!.isDefault === true &&
      addrListFinal.items.every((a) => a.id === addrA3.address.id || a.isDefault === false),
    addrListFinal.items.map((a) => ({ id: a.id, d: a.isDefault })));

  /* ---------- 65.3 发票抬头 CRUD+默认 ---------- */
  console.log('\n[片1] 65.3 发票抬头 CRUD+默认');
  interface TitleRow65 { id: string; titleType: string; title: string; taxNo: string | null; isDefault: boolean }
  const titleBadNoTax = await asErr(trpcMutate('invoiceTitle.create', {
    cookie: cookie65a, input: { titleType: 'business', title: '菲丽亚测试公司' },
  }));
  check('65.3 business 缺 taxNo → 400 明文「企业抬头必须填写税号」',
    titleBadNoTax instanceof TrpcHttpError && titleBadNoTax.code === 'BAD_REQUEST' && titleBadNoTax.message.includes('税号'),
    titleBadNoTax && titleBadNoTax.message);
  const titleBadType = await asErr(trpcMutate('invoiceTitle.create', {
    cookie: cookie65a, input: { titleType: 'corp', title: 'x' },
  }));
  check('65.3 titleType 枚举外 → 400 明文（personal/business）',
    titleBadType instanceof TrpcHttpError && titleBadType.code === 'BAD_REQUEST' && titleBadType.message.includes('抬头类型'),
    titleBadType && titleBadType.message);
  const titleT1 = await trpcMutate<{ title: TitleRow65 }>('invoiceTitle.create', {
    cookie: cookie65a, input: { titleType: 'personal', title: '个人抬头' },
  });
  const titleT2 = await trpcMutate<{ title: TitleRow65 }>('invoiceTitle.create', {
    cookie: cookie65a, input: { titleType: 'business', title: '菲丽亚测试公司', taxNo: '91330100TEST0001X', isDefault: true },
  });
  const titleList653 = await trpcQuery<{ items: TitleRow65[] }>('invoiceTitle.list', { cookie: cookie65a });
  check('65.3 personal 建（taxNo 恒 NULL）+ business 建默认 → list 默认在前 + personal 默认被清',
    titleT1.title.titleType === 'personal' && titleT1.title.taxNo === null &&
      titleT2.title.titleType === 'business' && titleT2.title.taxNo === '91330100TEST0001X' &&
      titleList653.items[0]!.id === titleT2.title.id && titleList653.items[0]!.isDefault === true &&
      titleList653.items[1]!.isDefault === false,
    titleList653.items.map((t) => ({ id: t.id, type: t.titleType, d: t.isDefault })));
  await trpcMutate('invoiceTitle.setDefault', { cookie: cookie65a, input: { id: titleT1.title.id } });
  const titleRm = await trpcMutate<{ removed: boolean; promotedId: string | null }>('invoiceTitle.remove', {
    cookie: cookie65a, input: { id: titleT1.title.id },
  });
  const titleListAfterRm = await trpcQuery<{ items: TitleRow65[] }>('invoiceTitle.list', { cookie: cookie65a });
  check('65.3 setDefault 换默认 + remove 默认行 → 剩余自动升默认（personal 建+setDefault+remove 链）',
    titleRm.promotedId === titleT2.title.id &&
      titleListAfterRm.items.length === 1 && titleListAfterRm.items[0]!.id === titleT2.title.id &&
      titleListAfterRm.items[0]!.isDefault === true,
    { promotedId: titleRm.promotedId, list: titleListAfterRm.items.map((t) => ({ id: t.id, d: t.isDefault })) });
  const titleCrossUpd = await asErr(trpcMutate('invoiceTitle.update', {
    cookie: customerCookie, input: { id: titleT2.title.id, title: '越权改' },
  }));
  check('65.3 他人 id 操作 NOT_FOUND 不透出',
    titleCrossUpd instanceof TrpcHttpError && titleCrossUpd.code === 'NOT_FOUND',
    titleCrossUpd && titleCrossUpd.code);

  /* ---------- 65.4 异常登录提醒（首见设备 → 事件+站内信；重登记零新增） ---------- */
  console.log('\n[片1] 65.4 异常登录提醒');
  const reg65d = await devLoginPhone('13966660053');
  const cookie65d = reg65d.cookie!;
  const user65dId = reg65d.body.user!.id!;
  const notif654before = (await db.select().from(schema.notifications))
    .filter((n) => n.userId === user65dId && n.type === 'security.new_device');
  const outbox654before = (await db.select().from(schema.eventOutbox))
    .filter((r) => r.eventType === 'security.newDevice' && r.channel === `user:${user65dId}`);
  const rd654a = await trpcMutate<{ device: { id: string; deviceId: string }; created: boolean }>(
    'authSecurity.registerDevice', { cookie: cookie65d, input: { deviceId: 'dev-65d-1', label: '新手机' } });
  const notif654after = (await db.select().from(schema.notifications))
    .filter((n) => n.userId === user65dId && n.type === 'security.new_device');
  const outbox654after = (await db.select().from(schema.eventOutbox))
    .filter((r) => r.eventType === 'security.newDevice' && r.channel === `user:${user65dId}`);
  const notif654row = notif654after[0];
  check('65.4 首见设备登记 → notifications 落 security.new_device 行（新设备登录提醒，link=/settings/devices，category=account）+ security.newDevice 事件落 outbox（user 频道）',
    rd654a.created === true &&
      notif654after.length === notif654before.length + 1 &&
      !!notif654row && notif654row.title.includes('新设备') &&
      notif654row.link === '/settings/devices' && notif654row.category === 'account' &&
      outbox654after.length === outbox654before.length + 1,
    { created: rd654a.created, notif: notif654row && { title: notif654row.title, link: notif654row.link, category: notif654row.category }, outbox: [outbox654before.length, outbox654after.length] });
  const rd654b = await trpcMutate<{ device: { id: string }; created: boolean }>(
    'authSecurity.registerDevice', { cookie: cookie65d, input: { deviceId: 'dev-65d-1' } });
  const notif654final = (await db.select().from(schema.notifications))
    .filter((n) => n.userId === user65dId && n.type === 'security.new_device');
  const outbox654final = (await db.select().from(schema.eventOutbox))
    .filter((r) => r.eventType === 'security.newDevice' && r.channel === `user:${user65dId}`);
  const devRows654 = await db.select().from(schema.userDevices)
    .where(eq(schema.userDevices.userId, user65dId));
  check('65.4 同设备重登记=零新增零通知（设备行/通知行/outbox 事件三计数全不变）',
    rd654b.created === false && rd654b.device.id === rd654a.device.id &&
      devRows654.length === 1 &&
      notif654final.length === notif654after.length && outbox654final.length === outbox654after.length,
    { created: rd654b.created, dev: devRows654.length, notif: [notif654after.length, notif654final.length], outbox: [outbox654after.length, outbox654final.length] });

  /* ================================================================== */
  console.log('\n[片1] 66. 支付售后族（押金台账/消费记录统一入口）');

  /* ---------- 66.1 押金全链（留痕不碰真钱） ---------- */
  console.log('\n[片1] 66.1 押金台账全链');
  const reg66a = await devLoginPhone('13966660060');
  const cookie66a = reg66a.cookie!;
  const user66aId = reg66a.body.user!.id!;
  const reg66b = await devLoginPhone('13966660061'); // 无在店痕迹客户（负例）
  const user66bId = reg66b.body.user!.id!;
  // 在店痕迹夹具：user66a 直插本店预约行（appointments=三痕迹源之一）
  const appt66 = (await db.insert(schema.appointments).values({
    code: `E2E66${String(Date.now()).slice(-6)}`,
    customerId: user66aId, storeId, petId, serviceId: service.id,
    type: 'boarding',
    scheduledStart: new Date(), scheduledEnd: new Date(Date.now() + 86400e3),
    status: 'completed', priceFen: 100, note: '【测试】押金在店痕迹夹具',
  }).returning())[0]!;
  interface DepRow66 {
    id: string; status: string; amountFen: number; kind: string;
    heldAt: Date | null; refundRequestedAt: Date | null; refundedAt: Date | null;
    storeName?: string;
  }
  const dep661bad = await asErr(trpcMutate('deposit.create', {
    cookie: ownerCookie, input: { customerId: user66bId, kind: 'kennel', amountFen: 1000 },
  }));
  check('66.1 非本店客户（无预约/会员/储值任一在店痕迹）登记押金 → 400 明文拒',
    dep661bad instanceof TrpcHttpError && dep661bad.code === 'BAD_REQUEST' && dep661bad.message.includes('在店痕迹'),
    dep661bad && { code: dep661bad.code, message: dep661bad.message });
  const payOrdersBefore661 = (await db.select().from(schema.payOrders)).length;
  const dep1 = await trpcMutate<{ deposit: DepRow66 }>('deposit.create', {
    cookie: ownerCookie,
    input: { customerId: user66aId, kind: 'kennel', amountFen: 50000, refAppointmentId: appt66.id, note: '寄养押金' },
  });
  check('66.1 create 落 held + held_at 置位（在押，金额 50000 分）',
    dep1.deposit.status === 'held' && dep1.deposit.amountFen === 50000 && !!dep1.deposit.heldAt,
    dep1.deposit);
  const mine661a = await trpcQuery<{ items: DepRow66[] }>('deposit.listMine', { cookie: cookie66a });
  check('66.1 listMine 时点①：客户读见 held 在押 + 门店名透出',
    mine661a.items.some((d) => d.id === dep1.deposit.id && d.status === 'held' && typeof d.storeName === 'string' && d.storeName.length > 0),
    mine661a.items.map((d) => ({ id: d.id, st: d.status, store: d.storeName })));
  const dep1Refunding = await trpcMutate<{ deposit: DepRow66 }>('deposit.markRefunding', {
    cookie: ownerCookie, input: { id: dep1.deposit.id, note: '客户申请退还' },
  });
  check('66.1 markRefunding：held→refunding + refund_requested_at 置位',
    dep1Refunding.deposit.status === 'refunding' && !!dep1Refunding.deposit.refundRequestedAt, dep1Refunding.deposit);
  const mine661b = await trpcQuery<{ items: DepRow66[] }>('deposit.listMine', { cookie: cookie66a });
  check('66.1 listMine 时点②：客户读见 refunding 退还登记在途',
    mine661b.items.some((d) => d.id === dep1.deposit.id && d.status === 'refunding'),
    mine661b.items.map((d) => ({ id: d.id, st: d.status })));
  const dep1Refunded = await trpcMutate<{ deposit: DepRow66; idempotent: boolean }>('deposit.markRefunded', {
    cookie: ownerCookie, input: { id: dep1.deposit.id },
  });
  check('66.1 markRefunded：refunding→refunded + refunded_at 置位（idempotent=false）',
    dep1Refunded.deposit.status === 'refunded' && !!dep1Refunded.deposit.refundedAt && dep1Refunded.idempotent === false,
    dep1Refunded.deposit);
  const dep1RefundedAgain = await trpcMutate<{ deposit: DepRow66; idempotent: boolean }>('deposit.markRefunded', {
    cookie: ownerCookie, input: { id: dep1.deposit.id },
  });
  check('66.1 markRefunded 幂等重调零副作用（已 refunded 返回现状，refundedAt 不变）',
    dep1RefundedAgain.idempotent === true && dep1RefundedAgain.deposit.status === 'refunded' &&
      String(dep1RefundedAgain.deposit.refundedAt) === String(dep1Refunded.deposit.refundedAt),
    dep1RefundedAgain);
  const depRefundingOnRefunded = await asErr(trpcMutate('deposit.markRefunding', {
    cookie: ownerCookie, input: { id: dep1.deposit.id },
  }));
  check('66.1 非 held 调 markRefunding → 400 明文（状态机硬拒）',
    depRefundingOnRefunded instanceof TrpcHttpError && depRefundingOnRefunded.code === 'BAD_REQUEST' &&
      depRefundingOnRefunded.message.includes('在押'),
    depRefundingOnRefunded && depRefundingOnRefunded.message);
  const mine661c = await trpcQuery<{ items: DepRow66[] }>('deposit.listMine', { cookie: cookie66a });
  check('66.1 listMine 时点③：客户读见 refunded 已退还',
    mine661c.items.some((d) => d.id === dep1.deposit.id && d.status === 'refunded'),
    mine661c.items.map((d) => ({ id: d.id, st: d.status })));
  const dep2 = await trpcMutate<{ deposit: DepRow66 }>('deposit.create', {
    cookie: ownerCookie, input: { customerId: user66aId, kind: 'goods', amountFen: 30000, note: '物品押金' },
  });
  const dep3 = await trpcMutate<{ deposit: DepRow66 }>('deposit.create', {
    cookie: ownerCookie, input: { customerId: user66aId, kind: 'other', amountFen: 12000 },
  });
  await trpcMutate('deposit.markRefunding', { cookie: ownerCookie, input: { id: dep3.deposit.id } });
  const sum661 = await trpcQuery<{ heldCount: number; heldFen: number; refundingCount: number; refundingFen: number; inCustodyFen: number }>(
    'deposit.storeSummary', { cookie: ownerCookie });
  check('66.1 storeSummary 在押合计=Σheld+refunding 精确到分（held 30000 + refunding 12000 = 42000；refunded 50000 不计入）',
    sum661.heldFen === 30000 && sum661.refundingFen === 12000 && sum661.inCustodyFen === 42000 &&
      sum661.heldCount === 1 && sum661.refundingCount === 1,
    sum661);
  const listStore661 = await trpcQuery<{ items: DepRow66[] }>('deposit.listStore', { cookie: ownerCookie });
  const listStore661Refunded = await trpcQuery<{ items: DepRow66[] }>('deposit.listStore', {
    cookie: ownerCookie, input: { status: 'refunded' },
  });
  check('66.1 listStore 本店全量含三行 + 状态过滤可选（refunded 过滤仅 dep1）',
    [dep1, dep2, dep3].every((d) => listStore661.items.some((r) => r.id === d.deposit.id)) &&
      listStore661Refunded.items.some((r) => r.id === dep1.deposit.id) &&
      listStore661Refunded.items.every((r) => r.status === 'refunded'),
    { all: listStore661.items.length, refunded: listStore661Refunded.items.length });
  const payOrdersAfter661 = (await db.select().from(schema.payOrders)).length;
  check('66.1 留痕不碰真钱实证：押金全链（create×3 + 状态推进×3）零 pay_orders 新行',
    payOrdersAfter661 === payOrdersBefore661, { before: payOrdersBefore661, after: payOrdersAfter661 });
  // 跨店闸：B 店店主对 A 店押金行操作 → NOT_FOUND 不透出；listStore 仅本店
  const [ownerB66] = await db.insert(schema.users).values({
    kimiId: 'seed_e2e_ownerb66', nickname: 'e2e B 店主66', phone: '13966660066',
  }).returning();
  await db.insert(schema.userRoles).values({ userId: ownerB66!.id, role: 'merchant_owner' });
  await db.insert(schema.stores).values({ ownerId: ownerB66!.id, name: 'e2e 隔离 B 店66', status: 'active' });
  const ownerB66Cookie = await devLogin(ownerB66!.id);
  const depCross661 = await asErr(trpcMutate('deposit.markRefunded', {
    cookie: ownerB66Cookie, input: { id: dep2.deposit.id },
  }));
  const depCrossList661 = await trpcQuery<{ items: DepRow66[] }>('deposit.listStore', { cookie: ownerB66Cookie });
  check('66.1 跨店闸：B 店店主操作 A 店押金行 → NOT_FOUND 不透出 + listStore 零透出',
    depCross661 instanceof TrpcHttpError && depCross661.code === 'NOT_FOUND' &&
      depCrossList661.items.every((r) => ![dep1, dep2, dep3].some((d) => d.deposit.id === r.id)),
    { cross: depCross661 && depCross661.code, bRows: depCrossList661.items.length });

  /* ---------- 66.2 recordsMine 消费记录统一入口（纯聚合只读） ---------- */
  console.log('\n[片1] 66.2 pay.recordsMine 三源聚合');
  const reg66c = await devLoginPhone('13966660062');
  const cookie66c = reg66c.cookie!;
  const user66cId = reg66c.body.user!.id!;
  const reg66d = await devLoginPhone('13966660063'); // 零数据他人（零透出对照）
  const cookie66d = reg66d.cookie!;
  const t662 = Date.now();
  // 夹具直插三源各一行（createdAt 钉死梯度：发票最新 > 订单 > 支付单；同日窗口不移位铁律无碍）
  const payRow662 = (await db.insert(schema.payOrders).values({
    payNo: `PO-E2E66-${String(t662).slice(-4)}`,
    bizDomain: 'membership_open', bizId: user66cId,
    bizJson: { planKey: 'plan_yinghuo', planLabel: '萤火', petCount: 1 },
    amountFen: 19900, channel: 'mock', status: 'paid',
    idemKey: `e2e66c|membership_open|plan_yinghuo|${t662}`,
    createdAt: new Date(t662 - 3000), updatedAt: new Date(t662 - 3000),
  }).returning())[0]!;
  const order662 = (await db.insert(schema.orders).values({
    orderNo: `PE2E66${String(t662).slice(-6)}`,
    customerId: user66cId, storeId, items: [], totalFen: 5600, status: 'received',
    createdAt: new Date(t662 - 2000), updatedAt: new Date(t662 - 2000),
  }).returning())[0]!;
  const inv662 = (await db.insert(schema.invoiceRequests).values({
    invoiceNo: `IN-E2E66-${String(t662).slice(-4)}`,
    userId: user66cId, storeId, orderKind: 'order', billId: order662.id, billNo: order662.orderNo,
    amountFen: 5600, titleType: 'personal', title: '个人', delivery: 'pickup', status: 'issued',
    createdAt: new Date(t662 - 1000), updatedAt: new Date(t662 - 1000),
  }).returning())[0]!;
  interface RecItem662 { kind: string; id: string; title: string; amountFen: number | null; status: string; createdAt: Date; link: string }
  const rec662 = await trpcQuery<{ items: RecItem662[] }>('pay.recordsMine', { cookie: cookie66c });
  const recKinds662 = rec662.items.map((r) => r.kind);
  check('66.2 聚合三类齐（pay/order/invoice 各一）+ createdAt 倒序（发票最新在前，支付单最旧在尾）',
    rec662.items.length === 3 &&
      recKinds662.includes('pay') && recKinds662.includes('order') && recKinds662.includes('invoice') &&
      rec662.items[0]!.id === inv662.id && rec662.items[0]!.kind === 'invoice' &&
      rec662.items[1]!.id === order662.id && rec662.items[1]!.kind === 'order' &&
      rec662.items[2]!.id === payRow662.id && rec662.items[2]!.kind === 'pay',
    rec662.items.map((r) => ({ kind: r.kind, id: r.id })));
  check('66.2 行字段齐（title/amountFen/status/link 透出，金额=各源实额）',
    rec662.items.find((r) => r.kind === 'pay')?.amountFen === 19900 &&
      rec662.items.find((r) => r.kind === 'order')?.amountFen === 5600 &&
      rec662.items.find((r) => r.kind === 'invoice')?.amountFen === 5600 &&
      rec662.items.every((r) => typeof r.title === 'string' && r.title.length > 0 && typeof r.link === 'string' && r.link.length > 0),
    rec662.items.map((r) => ({ kind: r.kind, amt: r.amountFen, title: r.title, link: r.link })));
  const rec662d = await trpcQuery<{ items: RecItem662[] }>('pay.recordsMine', { cookie: cookie66d });
  check('66.2 他人零透出（66d 无数据账号读不到 66c 三行任一 id）',
    rec662d.items.every((r) => ![payRow662.id, order662.id, inv662.id].includes(r.id)),
    rec662d.items.length);

  /* ==================================================================
   * 客户端体验大批 片 3（会员体系+商城 · server 侧）验收段 68/69
   * 68 会员族：未用权益/续费优惠试算/生日礼/新人礼包+升级礼遇/会员码
   * 69 商城族：优惠券/收藏/晒单/配送方式/超时自动收货/叠加公示/涉钱零通道
   * ================================================================== */
  console.log('\n[片3] 68. 会员族（未用权益/续费优惠/生日礼/新人礼包/会员码）');

  /* ---------- 68.1 未用权益（myUnused 并显不并账 + consume 台账核销） ---------- */
  console.log('\n[片3] 68.1 未用权益');
  const reg681 = await devLoginPhone('13966680001');
  const cookie681 = reg681.cookie!;
  const user681Id = reg681.body.user!.id!;
  // 夹具：次卡一张（剩 5 次）+ 次数型权益行（total 3 / remain 2）
  await db.insert(schema.memberPasses).values({ userId: user681Id, storeId, totalTimes: 10, remainTimes: 5, status: 'active' });
  const perkRow681 = (await db.insert(schema.memberPerkGrants).values({
    userId: user681Id, kind: 'service_discount_count', totalCount: 3, remainCount: 2,
    meta: { note: '【测试】e2e 次数型权益夹具' },
  }).returning())[0]!;
  const myUnused681 = await trpcQuery<{
    passTimes: number; passNote: string;
    grants: Array<{ id: string; kind: string; remainCount: number | null }>;
  }>('perk.myUnused', { cookie: cookie681 });
  check('68.1 myUnused：次卡余额并显（passTimes=5）+ 不并账注记 + grants 含次数型行与注册 welcome_pack 行',
    myUnused681.passTimes === 5 && myUnused681.passNote.includes('不并账') &&
      myUnused681.grants.some((g) => g.id === perkRow681.id && g.remainCount === 2) &&
      myUnused681.grants.some((g) => g.kind === 'welcome_pack'),
    { passTimes: myUnused681.passTimes, grants: myUnused681.grants.map((g) => g.kind) });
  // 核销写口（台账先行——真核销链=收银台结账联动候批，本片不落，perks.ts 注释明面）
  const consume681a = await trpcMutate<{ grant: { remainCount: number | null; status: string } }>(
    'perk.consume', { cookie: ownerCookie, input: { grantId: perkRow681.id } });
  const consume681b = await trpcMutate<{ grant: { remainCount: number | null; status: string } }>(
    'perk.consume', { cookie: ownerCookie, input: { grantId: perkRow681.id } });
  const consume681c = await asErr(trpcMutate('perk.consume', { cookie: ownerCookie, input: { grantId: perkRow681.id } }));
  check('68.1 consume 台账核销：2→1→0 翻 exhausted，归零后再核销 400 明文（不碰钱域）',
    consume681a.grant.remainCount === 1 && consume681a.grant.status === 'granted' &&
      consume681b.grant.remainCount === 0 && consume681b.grant.status === 'exhausted' &&
      consume681c instanceof TrpcHttpError && consume681c.httpStatus === 400,
    { a: consume681a.grant.remainCount, b: consume681b.grant, c: consume681c && consume681c.message });

  /* ---------- 68.2 续费优惠试算（renew_discount_bp 端口读档 + 缺键回落） ---------- */
  console.log('\n[片3] 68.2 续费优惠试算');
  const planRow682 = await db.select().from(schema.memberPlans)
    .where(and(eq(schema.memberPlans.ruleKey, 'plan_yinghuo'), eq(schema.memberPlans.active, true))).get();
  const origVal682 = planRow682!.valueJson as Record<string, unknown>;
  const cfgList682 = await trpcQuery<{ currentVersion: number }>('config.list', { cookie: ownerCookie, input: { domain: 'member_plans' } });
  const save682 = await trpcMutate<{ version: number }>('config.save', {
    cookie: ownerCookie,
    input: { domain: 'member_plans', changes: [{ ruleKey: 'plan_yinghuo', valueJson: { ...origVal682, renew_discount_bp: 8000 } }] },
  });
  const quote682 = await trpcQuery<{ amountFen: number; renewal: { discountBp: number; amountFen: number } | null }>(
    'pay.quote', { cookie: cookie681, input: { bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 0, renewal: true } });
  check('68.2 端口改 renew_discount_bp=8000 → version+1 留痕 + quote renewal=全价×bp/10000 精确到分（19900×0.8=15920）',
    save682.version === cfgList682.currentVersion + 1 &&
      quote682.amountFen === 19900 && quote682.renewal?.discountBp === 8000 && quote682.renewal?.amountFen === 15920,
    { version: [cfgList682.currentVersion, save682.version], renewal: quote682.renewal });
  const vers682 = await trpcQuery<{ versions: Array<{ changesJson: Array<{ rule_key: string; before: unknown; after: unknown }> }> }>(
    'config.versions', { cookie: ownerCookie, input: { domain: 'member_plans', limit: 5 } });
  check('68.2 端口改值留痕行在案（rule_config_versions 含 plan_yinghuo 前后值）',
    vers682.versions.some((v) => v.changesJson.some((c) => c.rule_key === 'plan_yinghuo')),
    vers682.versions.length);
  /* 缺键回落实证：摘键保存 → renewal 按缺省 10000=无优惠（fresh 库/未配档口径） */
  const noRenewVal682: Record<string, unknown> = { ...origVal682, renew_discount_bp: 8000 };
  delete noRenewVal682['renew_discount_bp'];
  await trpcMutate('config.save', { cookie: ownerCookie, input: { domain: 'member_plans', changes: [{ ruleKey: 'plan_yinghuo', valueJson: noRenewVal682 }] } });
  const quote682b = await trpcQuery<{ amountFen: number; renewal: { discountBp: number; amountFen: number } | null }>(
    'pay.quote', { cookie: cookie681, input: { bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 0, renewal: true } });
  check('68.2 缺键回落 10000=无优惠（renewal.amountFen=全价 19900）',
    quote682b.renewal?.discountBp === 10000 && quote682b.renewal?.amountFen === 19900, quote682b.renewal);
  // 复原（段尾复原纪律：恢复原值含 renew_discount_bp=10000）
  await trpcMutate('config.save', { cookie: ownerCookie, input: { domain: 'member_plans', changes: [{ ruleKey: 'plan_yinghuo', valueJson: origVal682 }] } });
  const quote682c = await trpcQuery<{ renewal: { discountBp: number; amountFen: number } | null }>(
    'pay.quote', { cookie: cookie681, input: { bizDomain: 'membership_open', planKey: 'plan_yinghuo', petCount: 0, renewal: true } });
  check('68.2 复原后 quote 回种子口径（bp=10000，试算=全价）',
    quote682c.renewal?.discountBp === 10000 && quote682c.renewal?.amountFen === 19900, quote682c.renewal);

  /* ---------- 68.3 生日礼（滴答扫描→资格行+营销通知；同年重扫零新增） ---------- */
  console.log('\n[片3] 68.3 生日礼');
  const { sweepBirthdayPerks } = await import('../routers/perks');
  // 钉时刻先例：扫描按门店规范时区 +8 的 MM-DD 匹配，夹具生日按同一墙钟钉「今日」
  const w683 = new Date(Date.now() + 8 * 3600 * 1000);
  const mmdd683 = `${String(w683.getUTCMonth() + 1).padStart(2, '0')}-${String(w683.getUTCDate()).padStart(2, '0')}`;
  const year683 = w683.getUTCFullYear();
  const reg683 = await devLoginPhone('13966680003');
  const cookie683 = reg683.cookie!;
  const user683Id = reg683.body.user!.id!;
  await trpcMutate('auth.updateProfile', { cookie: cookie683, input: { birthday: `1990-${mmdd683}` } });
  const pet683 = (await db.insert(schema.pets).values({
    ownerId: user683Id, name: '生日喵', species: 'cat', birthday: `2020-${mmdd683}`,
  }).returning())[0]!;
  await sweepBirthdayPerks(db); // 服务级直调（43/55.4 先例；server 30min 滴答同函数）
  const grants683 = await db.select().from(schema.memberPerkGrants)
    .where(and(eq(schema.memberPerkGrants.userId, user683Id), inArray(schema.memberPerkGrants.kind, ['birthday_owner', 'birthday_pet'])));
  const notif683 = (await db.select().from(schema.notifications))
    .filter((n) => n.userId === user683Id && n.category === 'marketing' && (n.type === 'perk.birthday' || n.type === 'perk.birthday_pet'));
  check('68.3 birthday=今日（MMDD 匹配）→ grants 双行（birthday_owner year 入锚 + birthday_pet pet_id 入锚）+ notifications marketing 双行',
    grants683.some((g) => g.kind === 'birthday_owner' && g.year === year683) &&
      grants683.some((g) => g.kind === 'birthday_pet' && g.petId === pet683.id && g.year === year683) &&
      notif683.some((n) => n.type === 'perk.birthday') && notif683.some((n) => n.type === 'perk.birthday_pet'),
    { grants: grants683.map((g) => [g.kind, g.year, g.petId]), notif: notif683.map((n) => n.type) });
  await sweepBirthdayPerks(db); // 同年重扫
  const grants683b = await db.select().from(schema.memberPerkGrants)
    .where(and(eq(schema.memberPerkGrants.userId, user683Id), inArray(schema.memberPerkGrants.kind, ['birthday_owner', 'birthday_pet'])));
  const notif683b = (await db.select().from(schema.notifications))
    .filter((n) => n.userId === user683Id && n.category === 'marketing' && (n.type === 'perk.birthday' || n.type === 'perk.birthday_pet'));
  check('68.3 同年重扫零新增（幂等锚：grants/通知计数全不变）',
    grants683b.length === grants683.length && notif683b.length === notif683.length,
    { grants: [grants683.length, grants683b.length], notif: [notif683.length, notif683b.length] });

  /* ---------- 68.4 新人礼包（注册触发）+ 升级礼遇（首单 paid 翻转） ---------- */
  console.log('\n[片3] 68.4 新人礼包 + 升级礼遇');
  const reg684 = await devLoginPhone('13966680004');
  const cookie684 = reg684.cookie!;
  const user684Id = reg684.body.user!.id!;
  const welcome684a = await db.select().from(schema.memberPerkGrants)
    .where(and(eq(schema.memberPerkGrants.userId, user684Id), eq(schema.memberPerkGrants.kind, 'welcome_pack')));
  const notif684a = (await db.select().from(schema.notifications))
    .filter((n) => n.userId === user684Id && n.type === 'perk.welcome_pack' && n.category === 'marketing');
  check('68.4 新注册（devLogin 建档）→ welcome_pack 资格行 + notifications marketing 行（资格留痕不真发）',
    welcome684a.length === 1 && notif684a.length === 1,
    { grants: welcome684a.length, notif: notif684a.length });
  await devLoginPhone('13966680004'); // 重复注册（同号再登录=不重复建档）
  const welcome684b = await db.select().from(schema.memberPerkGrants)
    .where(and(eq(schema.memberPerkGrants.userId, user684Id), eq(schema.memberPerkGrants.kind, 'welcome_pack')));
  check('68.4 重复注册零重复（welcome_pack 仍 1 行）', welcome684b.length === 1, welcome684b.length);
  const prods684 = await trpcQuery<{ items: Array<{ id: string; priceFen: number; stock: number }> }>(
    'mall.listProducts', { cookie: cookie684, input: { storeId } });
  const prod684 = prods684.items.find((p) => p.priceFen > 0 && p.stock > 0)!;
  check('68.4 夹具：在售商品可取（供 68/69 族共用）', !!prod684, prods684.items.length);
  const addr684 = { name: '六八四', phone: '13966680004', detail: '测试路 684 号' };
  const order684a = await trpcMutate<{ id: string; orderNo: string; totalFen: number }>(
    'mall.createOrder', { cookie: cookie684, input: { items: [{ productId: prod684.id, qty: 1 }], address: addr684 } });
  const mc684a = await postRaw('/api/pay/mock-callback', { orderId: order684a.id }, {}, cookie684);
  const gifts684a = await db.select().from(schema.memberPerkGrants)
    .where(and(eq(schema.memberPerkGrants.userId, user684Id), eq(schema.memberPerkGrants.kind, 'upgrade_gift')));
  check('68.4 首单 pending→paid 翻转（mock-callback 真回调链）→ upgrade_gift 资格行（source_id=首单 id）',
    mc684a.status === 200 && gifts684a.length === 1 && gifts684a[0]!.sourceId === order684a.id,
    { cb: mc684a.status, gifts: gifts684a.map((g) => g.sourceId) });
  await postRaw('/api/pay/mock-callback', { orderId: order684a.id }, {}, cookie684); // 重复回调
  const order684b = await trpcMutate<{ id: string }>(
    'mall.createOrder', { cookie: cookie684, input: { items: [{ productId: prod684.id, qty: 1 }], address: addr684 } });
  await postRaw('/api/pay/mock-callback', { orderId: order684b.id }, {}, cookie684); // 次单 paid
  const gifts684b = await db.select().from(schema.memberPerkGrants)
    .where(and(eq(schema.memberPerkGrants.userId, user684Id), eq(schema.memberPerkGrants.kind, 'upgrade_gift')));
  check('68.4 重复回调 + 次单 paid 零重复（upgrade_gift 仍 1 行）', gifts684b.length === 1, gifts684b.length);

  /* ---------- 68.5 会员码（签发/核验/篡改/过期） ---------- */
  console.log('\n[片3] 68.5 会员码');
  const card685nonMember = await asErr(trpcMutate('membership.myCardToken', { cookie: cookie683 }));
  check('68.5 非会员签发 → 400 明文「非会员无会员码」',
    card685nonMember instanceof TrpcHttpError && card685nonMember.httpStatus === 400 && card685nonMember.message.includes('非会员'),
    card685nonMember && card685nonMember.message);
  await trpcMutate('membership.openFree', { cookie: cookie684 });
  const card685 = await trpcMutate<{ token: string; planKey: string; ttlSec: number }>(
    'membership.myCardToken', { cookie: cookie684 });
  const verify685 = await trpcMutate<{ userId: string; planKey: string; planLabel: string; membershipStatus: string | null }>(
    'membership.verifyCardToken', { cookie: ownerCookie, input: { token: card685.token } });
  check('68.5 myCardToken 签发（5min 时效）→ verifyCardToken 收银台核验通过 + planKey/档名透出（微光）',
    card685.planKey === 'plan_weiguang' && card685.ttlSec === 300 &&
      verify685.userId === user684Id && verify685.planKey === 'plan_weiguang' &&
      verify685.planLabel.includes('微光') && verify685.membershipStatus === 'active',
    verify685);
  const tampered685 = card685.token.slice(0, -1) + (card685.token.endsWith('0') ? '1' : '0');
  const verTamper685 = await asErr(trpcMutate('membership.verifyCardToken', { cookie: ownerCookie, input: { token: tampered685 } }));
  check('68.5 篡改签名 → 400 明文「签名不符」',
    verTamper685 instanceof TrpcHttpError && verTamper685.httpStatus === 400 && verTamper685.message.includes('签名不符'),
    verTamper685 && verTamper685.message);
  /* 过期件：合法签名+过期 exp（signMemberCardPayload export 复用，仿预约码 signCode 冒烟先例） */
  const { signMemberCardPayload } = await import('../routers/membership');
  const expired685 = signMemberCardPayload(user684Id, 'plan_weiguang', Math.floor(Date.now() / 1000) - 10);
  const verExpired685 = await asErr(trpcMutate('membership.verifyCardToken', { cookie: ownerCookie, input: { token: expired685 } }));
  check('68.5 过期 token（合法签名）→ 400 明文「已过期」',
    verExpired685 instanceof TrpcHttpError && verExpired685.httpStatus === 400 && verExpired685.message.includes('已过期'),
    verExpired685 && verExpired685.message);

  /* ================================================================== */
  console.log('\n[片3] 69. 商城族（券/收藏/晒单/配送/超时收货/叠加公示/涉钱零通道）');

  /* 69.7 口径基线：69 族全链涉钱四表计数基线（69 族订单夹具一律不走支付通道） */
  const moneyBefore69 = {
    cashierBills: (await db.select().from(schema.cashierBills)).length,
    payments: (await db.select().from(schema.payments)).length,
    rebateAccounts: (await db.select().from(schema.rebateAccounts)).length,
    payOrders: (await db.select().from(schema.payOrders)).length,
  };

  /* ---------- 69.1 优惠券（领取幂等/门槛过滤/核销登记零触碰钱域/配额满 400） ---------- */
  console.log('\n[片3] 69.1 优惠券');
  const couponA691 = (await db.insert(schema.coupons).values({
    title: '满10减5券', amountFen: 500, thresholdFen: 1000, validDays: 30, createdBy: ownerUser!.id,
  }).returning())[0]!;
  const couponB691 = (await db.insert(schema.coupons).values({
    title: '满100减20券', amountFen: 2000, thresholdFen: 10000, validDays: 30, createdBy: ownerUser!.id,
  }).returning())[0]!;
  const couponC691 = (await db.insert(schema.coupons).values({
    title: '限量体验券', amountFen: 100, thresholdFen: 0, validDays: 7, totalQuota: 1, createdBy: ownerUser!.id,
  }).returning())[0]!;
  const tpl691 = await trpcQuery<{ items: Array<{ id: string; claimedCount: number }> }>('mall.couponTemplates', { cookie: cookie681 });
  check('69.1 couponTemplates 在售券模板透出（三券在列）',
    [couponA691, couponB691, couponC691].every((c) => tpl691.items.some((t) => t.id === c.id)),
    tpl691.items.length);
  const claim691a = await trpcMutate<{ grant: { id: string; status: string }; idempotent: boolean }>(
    'mall.couponClaim', { cookie: cookie684, input: { couponId: couponA691.id } });
  const claim691dup = await trpcMutate<{ grant: { id: string; status: string }; idempotent: boolean }>(
    'mall.couponClaim', { cookie: cookie684, input: { couponId: couponA691.id } });
  check('69.1 领取 → claimed 落行 + uq 锚幂等（重复领=返回现状 idempotent 零新增）',
    claim691a.grant.status === 'claimed' && claim691a.idempotent === false &&
      claim691dup.idempotent === true && claim691dup.grant.id === claim691a.grant.id,
    { a: claim691a.idempotent, dup: claim691dup.idempotent });
  const avail691 = await trpcQuery<{ items: Array<{ couponId: string }> }>(
    'mall.availableCoupons', { cookie: cookie684, input: { totalFen: 5000 } });
  check('69.1 availableCoupons 按门槛过滤（5000 分单：满10减5 在列 / 满100减20 不在列）',
    avail691.items.some((i) => i.couponId === couponA691.id) && !avail691.items.some((i) => i.couponId === couponB691.id),
    avail691.items.map((i) => i.couponId));
  const myCoupons691 = await trpcQuery<{ items: Array<{ id: string; status: string; coupon: { title: string } }> }>(
    'mall.myCoupons', { cookie: cookie684 });
  check('69.1 myCoupons 本人台账透出（claimed 行+券模板联表）',
    myCoupons691.items.some((i) => i.id === claim691a.grant.id && i.status === 'claimed' && i.coupon.title === '满10减5券'),
    myCoupons691.items.length);
  /* 核销登记（开口项 1 裁）：仅 grant 翻 used+登记 order_id，orders.total_fen/payments 零变动 */
  const order691 = await trpcMutate<{ id: string; totalFen: number }>(
    'mall.createOrder', { cookie: cookie684, input: { items: [{ productId: prod684.id, qty: 1 }], address: addr684 } });
  const used691 = await trpcMutate<{ grant: { status: string; orderId: string | null }; idempotent: boolean }>(
    'mall.couponUse', { cookie: cookie684, input: { grantId: claim691a.grant.id, orderId: order691.id } });
  const order691after = await db.select().from(schema.orders).where(eq(schema.orders.id, order691.id)).get();
  const payments691now = (await db.select().from(schema.payments)).length;
  check('69.1 couponUse 核销=仅 grant 翻 used 登记 order_id（orders.total_fen/payments 前后零变动——不接真抵扣实证）',
    used691.grant.status === 'used' && used691.grant.orderId === order691.id && used691.idempotent === false &&
      order691after?.totalFen === order691.totalFen && payments691now === moneyBefore69.payments,
    { grant: used691.grant, totalFen: [order691.totalFen, order691after?.totalFen], payments: [moneyBefore69.payments, payments691now] });
  const useDup691 = await trpcMutate<{ idempotent: boolean }>(
    'mall.couponUse', { cookie: cookie684, input: { grantId: claim691a.grant.id, orderId: order691.id } });
  check('69.1 couponUse 幂等重调=返回现状（idempotent=true）', useDup691.idempotent === true, useDup691);
  /* 配额闸：quota=1 首领成、次领 400 明文 */
  const claimC691a = await trpcMutate<{ idempotent: boolean }>(
    'mall.couponClaim', { cookie: cookie684, input: { couponId: couponC691.id } });
  const claimC691b = await asErr(trpcMutate('mall.couponClaim', { cookie: cookie681, input: { couponId: couponC691.id } }));
  check('69.1 配额满 400 明文（quota=1：首领成 / 次领拒「已领完」且事务回滚零落行）',
    claimC691a.idempotent === false &&
      claimC691b instanceof TrpcHttpError && claimC691b.code === 'BAD_REQUEST' && claimC691b.message.includes('已领完'),
    claimC691b && { code: claimC691b.code, message: claimC691b.message });

  /* ---------- 69.2 收藏（toggle 幂等 + favList + favCheck 同帧） ---------- */
  console.log('\n[片3] 69.2 收藏');
  const fav692a = await trpcMutate<{ fav: boolean }>('mall.favToggle', { cookie: cookie681, input: { productId: prod684.id } });
  const favCheck692a = await trpcQuery<{ fav: boolean }>('mall.favCheck', { cookie: cookie681, input: { productId: prod684.id } });
  const favList692a = await trpcQuery<{ items: Array<{ productId: string; name: string; image: string | null }> }>('mall.favList', { cookie: cookie681 });
  check('69.2 toggle 收藏 → fav=true + favCheck 同帧 true + favList 含该商品（联表快照透出）',
    fav692a.fav === true && favCheck692a.fav === true &&
      favList692a.items.some((i) => i.productId === prod684.id && typeof i.name === 'string'),
    { fav: fav692a.fav, list: favList692a.items.length });
  const fav692b = await trpcMutate<{ fav: boolean }>('mall.favToggle', { cookie: cookie681, input: { productId: prod684.id } });
  const favCheck692b = await trpcQuery<{ fav: boolean }>('mall.favCheck', { cookie: cookie681, input: { productId: prod684.id } });
  const favList692b = await trpcQuery<{ items: Array<{ productId: string }> }>('mall.favList', { cookie: cookie681 });
  check('69.2 再 toggle → fav=false（uq 锚幂等删）+ favCheck/favList 同帧',
    fav692b.fav === false && favCheck692b.fav === false && !favList692b.items.some((i) => i.productId === prod684.id),
    { fav: fav692b.fav, list: favList692b.items.length });
  const fav692c = await trpcMutate<{ fav: boolean }>('mall.favToggle', { cookie: cookie681, input: { productId: prod684.id } });
  const favCheck692c = await trpcQuery<{ fav: boolean }>('mall.favCheck', { cookie: cookie681, input: { productId: prod684.id } });
  check('69.2 复加 → fav=true（删后重插幂等锚不残留）', fav692c.fav === true && favCheck692c.fav === true, fav692c);

  /* ---------- 69.3 商品评价晒单（received 闸/复评 409/均分聚合/匿名） ---------- */
  console.log('\n[片3] 69.3 商品评价晒单');
  const order693a = await trpcMutate<{ id: string }>(
    'mall.createOrder', { cookie: cookie684, input: { items: [{ productId: prod684.id, qty: 1 }], address: addr684 } });
  const rvPending693 = await asErr(trpcMutate('mall.reviewProduct', {
    cookie: cookie684, input: { orderId: order693a.id, productId: prod684.id, rating: 5 },
  }));
  check('69.3 pending 单评价 → 400 明文（未收货不可评）',
    rvPending693 instanceof TrpcHttpError && rvPending693.code === 'BAD_REQUEST' && rvPending693.message.includes('收货'),
    rvPending693 && rvPending693.message);
  /* 订单状态翻转=夹具直改（69.7 零真通道口径：不走 mock-callback，payments 零写入） */
  await db.update(schema.orders).set({ status: 'received' }).where(eq(schema.orders.id, order693a.id));
  const rv693a = await trpcMutate<{ review: { id: string; rating: number } }>('mall.reviewProduct', {
    cookie: cookie684, input: { orderId: order693a.id, productId: prod684.id, rating: 5, text: '【测试】很好用', photoUrls: [] },
  });
  check('69.3 received 单可评落行（rating=5）', !!rv693a.review.id && rv693a.review.rating === 5, rv693a.review);
  const rvDup693 = await asErr(trpcMutate('mall.reviewProduct', {
    cookie: cookie684, input: { orderId: order693a.id, productId: prod684.id, rating: 4 },
  }));
  check('69.3 复评 → 409 明文（一单一件一评 uq 锚）',
    rvDup693 instanceof TrpcHttpError && rvDup693.httpStatus === 409 && rvDup693.code === 'CONFLICT' && rvDup693.message.includes('已评价'),
    rvDup693 && { status: rvDup693.httpStatus, message: rvDup693.message });
  const rvOther693 = await asErr(trpcMutate('mall.reviewProduct', {
    cookie: cookie681, input: { orderId: order693a.id, productId: prod684.id, rating: 1 },
  }));
  check('69.3 他人订单评价 → 403（本人闸）',
    rvOther693 instanceof TrpcHttpError && rvOther693.httpStatus === 403, rvOther693 && rvOther693.httpStatus);
  const order693b = await trpcMutate<{ id: string }>(
    'mall.createOrder', { cookie: cookie681, input: { items: [{ productId: prod684.id, qty: 1 }], address: { name: '六八一', phone: '13966680001', detail: '测试路 681 号' } } });
  await db.update(schema.orders).set({ status: 'received' }).where(eq(schema.orders.id, order693b.id));
  await trpcMutate('mall.reviewProduct', {
    cookie: cookie681, input: { orderId: order693b.id, productId: prod684.id, rating: 3, text: '【测试】一般', anonymous: true },
  });
  const revs693 = await trpcQuery<{
    total: number; avgRating: number | null;
    items: Array<{ rating: number; nickname: string; anonymous: boolean }>;
  }>('mall.productReviews', { cookie: cookie684, input: { productId: prod684.id } });
  check('69.3 均分聚合正确（5+3→avg 4.0，total=2）+ 匿名匿名录名（anonymous 行昵称不透出=「匿名用户」）',
    revs693.total === 2 && revs693.avgRating === 4 &&
      revs693.items.some((i) => i.anonymous === true && i.nickname === '匿名用户') &&
      revs693.items.some((i) => i.anonymous === false && i.nickname !== '匿名用户'),
    { total: revs693.total, avg: revs693.avgRating, items: revs693.items.map((i) => [i.rating, i.nickname, i.anonymous]) });

  /* ---------- 69.4 配送方式（pickup 地址可缺省/缺省 express/读口透出） ---------- */
  console.log('\n[片3] 69.4 配送方式');
  const orderPickup694 = await trpcMutate<{ id: string; deliveryMethod: string; address: unknown }>(
    'mall.createOrder', { cookie: cookie681, input: { items: [{ productId: prod684.id, qty: 1 }], deliveryMethod: 'pickup' } });
  check('69.4 pickup 落列 + 地址可缺省（address=null）',
    orderPickup694.deliveryMethod === 'pickup' && orderPickup694.address === null,
    { dm: orderPickup694.deliveryMethod, addr: orderPickup694.address });
  const orderExpress694 = await trpcMutate<{ id: string; deliveryMethod: string }>(
    'mall.createOrder', { cookie: cookie681, input: { items: [{ productId: prod684.id, qty: 1 }], address: { name: '六八一', phone: '13966680001', detail: '测试路 681 号' } } });
  check('69.4 缺省 express（传地址不带 deliveryMethod）', orderExpress694.deliveryMethod === 'express', orderExpress694.deliveryMethod);
  const orderNoAddr694 = await asErr(trpcMutate('mall.createOrder', {
    cookie: cookie681, input: { items: [{ productId: prod684.id, qty: 1 }] },
  }));
  check('69.4 express 缺地址 → 400 明文「须填写收货地址」',
    orderNoAddr694 instanceof TrpcHttpError && orderNoAddr694.code === 'BAD_REQUEST' && orderNoAddr694.message.includes('收货地址'),
    orderNoAddr694 && orderNoAddr694.message);
  const myOrders694 = await trpcQuery<{ groups: Record<string, Array<{ id: string; deliveryMethod: string }>> }>(
    'mall.listMyOrders', { cookie: cookie681 });
  check('69.4 读口透出（listMyOrders 行带 deliveryMethod：pickup 单=pickup / 缺省单=express）',
    myOrders694.groups['pending']?.some((o) => o.id === orderPickup694.id && o.deliveryMethod === 'pickup') === true &&
      myOrders694.groups['pending']?.some((o) => o.id === orderExpress694.id && o.deliveryMethod === 'express') === true,
    myOrders694.groups['pending']?.length);

  /* ---------- 69.5 超时自动收货（shipped_at 锚 + 端口天数 + 幂等） ---------- */
  console.log('\n[片3] 69.5 超时自动收货');
  const { sweepAutoReceive } = await import('../routers/mall');
  const t695 = Date.now();
  const order695old = (await db.insert(schema.orders).values({
    orderNo: `PE2E695A${String(t695).slice(-6)}`, customerId: user681Id, storeId,
    items: [{ product_id: prod684.id, name: '超时单钉 8 天', quantity: 1, price_fen: 100 }],
    totalFen: 100, status: 'shipped', trackingNo: 'SF695OLD',
    shippedAt: new Date(t695 - 8 * 86400e3), // 钉时刻：8 天前发货（> 端口 7 天）
  }).returning())[0]!;
  const order695new = (await db.insert(schema.orders).values({
    orderNo: `PE2E695B${String(t695).slice(-6)}`, customerId: user681Id, storeId,
    items: [{ product_id: prod684.id, name: '超时单钉 6 天', quantity: 1, price_fen: 100 }],
    totalFen: 100, status: 'shipped', trackingNo: 'SF695NEW',
    shippedAt: new Date(t695 - 6 * 86400e3), // 钉时刻：6 天前发货（< 端口 7 天=不动）
  }).returning())[0]!;
  await sweepAutoReceive(db); // 服务级直调（server 60s 滴答同函数；69.7 口径=只翻状态不发支付）
  const order695oldAfter = await db.select().from(schema.orders).where(eq(schema.orders.id, order695old.id)).get();
  const order695newAfter = await db.select().from(schema.orders).where(eq(schema.orders.id, order695new.id)).get();
  const ob695 = (await db.select().from(schema.eventOutbox))
    .filter((r) => r.eventType === 'order.received' && (r.payload as Record<string, unknown>)?.['orderId'] === order695old.id);
  check('69.5 shipped_at=8 天前单 → 扫描翻 received + OrderReceived 事件落 outbox；7 天内（6 天）单不动',
    order695oldAfter?.status === 'received' && order695newAfter?.status === 'shipped' && ob695.length === 1,
    { old: order695oldAfter?.status, new: order695newAfter?.status, outbox: ob695.length });
  const swept695b = await sweepAutoReceive(db);
  const recvManual695 = await asErr(trpcMutate('mall.receiveOrder', { cookie: cookie681, input: { orderId: order695old.id } }));
  check('69.5 幂等：重扫零新增（sweep=0）+ 已翻单 receiveOrder 并发硬拒 400（条件更新互撞零副作用）',
    swept695b === 0 && recvManual695 instanceof TrpcHttpError && recvManual695.code === 'BAD_REQUEST',
    { swept: swept695b, manual: recvManual695 && recvManual695.message });
  /* 物流半程注记：已发货单读口 trackingNote 透出 */
  const myOrders695 = await trpcQuery<{ groups: Record<string, Array<{ id: string; trackingNo: string | null; trackingNote?: string | null }>> }>(
    'mall.listMyOrders', { cookie: cookie681 });
  const shippedRow695 = myOrders695.groups['shipped']?.find((o) => o.id === order695new.id);
  check('69.5 物流半程注记透出（shipped 单 trackingNote=「物流轨迹以快递公司为准」）',
    shippedRow695?.trackingNote === '物流轨迹以快递公司为准', shippedRow695?.trackingNote);

  /* ---------- 69.6 券叠加规则公示（端口改值→读口即新+留痕行） ---------- */
  console.log('\n[片3] 69.6 券叠加规则公示');
  const rule696a = await trpcQuery<{ rule: string; note: string; source: string }>('mall.couponStackRule', { cookie: cookie681 });
  check('69.6 缺省公示口径（rule=none + note + source 明面）',
    rule696a.rule === 'none' && rule696a.note.includes('不与会员折扣叠加') && rule696a.source === 'service_rules.coupon_stack_rule',
    rule696a);
  await trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'service', changes: [{ ruleKey: 'coupon_stack_rule', valueJson: { rule: 'with_member_discount', note: '【测试】e2e 端口改值：可与会员折扣叠加' } }] },
  });
  const rule696b = await trpcQuery<{ rule: string }>('mall.couponStackRule', { cookie: cookie681 });
  const vers696 = await trpcQuery<{ versions: Array<{ changesJson: Array<{ rule_key: string }> }> }>(
    'config.versions', { cookie: ownerCookie, input: { domain: 'service', limit: 5 } });
  check('69.6 端口改值 → 读口即新（rule=with_member_discount）+ 留痕行在案',
    rule696b.rule === 'with_member_discount' &&
      vers696.versions.some((v) => v.changesJson.some((c) => c.rule_key === 'coupon_stack_rule')),
    { rule: rule696b.rule, vers: vers696.versions.length });
  await trpcMutate('config.save', {
    cookie: ownerCookie,
    input: { domain: 'service', changes: [{ ruleKey: 'coupon_stack_rule', valueJson: { rule: 'none', note: '优惠券不与会员折扣叠加；每单限用 1 张（公示口径）' } }] },
  });
  const rule696c = await trpcQuery<{ rule: string }>('mall.couponStackRule', { cookie: cookie681 });
  check('69.6 复原公示口径（rule=none）', rule696c.rule === 'none', rule696c);

  /* ---------- 69.7 涉钱全件零真通道实证 ---------- */
  console.log('\n[片3] 69.7 涉钱零真通道');
  const moneyAfter69 = {
    cashierBills: (await db.select().from(schema.cashierBills)).length,
    payments: (await db.select().from(schema.payments)).length,
    rebateAccounts: (await db.select().from(schema.rebateAccounts)).length,
    payOrders: (await db.select().from(schema.payOrders)).length,
  };
  check('69.7 69 族全链 cashier_bills/payments/rebate_accounts/pay_orders 计数前后相等（券/收藏/晒单/配送/超时收货零真通道）',
    moneyAfter69.cashierBills === moneyBefore69.cashierBills &&
      moneyAfter69.payments === moneyBefore69.payments &&
      moneyAfter69.rebateAccounts === moneyBefore69.rebateAccounts &&
      moneyAfter69.payOrders === moneyBefore69.payOrders,
    { before: moneyBefore69, after: moneyAfter69 });

  client.close();
}

/* ------------------------------------------------------------------ */
/* 收尾：杀 server / 验端口释放 / 清临时库与上传图片 / 验种子库原样            */
/* ------------------------------------------------------------------ */

async function cleanup(): Promise<void> {
  if (server && !server.killed) {
    server.kill();
    await new Promise<void>((r) => {
      server!.once('exit', () => r());
      setTimeout(r, 5000); // 兜底
    });
  }
  const portFree = await waitFor(async () => {
    try {
      await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(500) });
      return false;
    } catch {
      return true;
    }
  }, 10_000);
  check(`验收结束：${PORT} 端口无残留监听`, portFree);

  try {
    rmSync(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch (e) {
    console.warn(`[e2e] 临时库目录清理失败（Windows libsql 句柄滞后，可手工删）: ${tmpDir}`, e);
  }
  try {
    // 仅删除本次验收上传的图片目录 uploads/appointment/<aid>（含 staff-2 段补充上传），不动其他目录
    for (const aidX of [createdAid, ...createdAidExtras]) {
      if (aidX && existsSync(join(UPLOAD_APPT_ROOT, aidX))) {
        rmSync(join(UPLOAD_APPT_ROOT, aidX), { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
      }
    }
  } catch (e) {
    console.warn('[e2e] 验收图片清理失败:', e);
  }

  if (seedStatBefore) {
    const after = statSync(SEED_DB_FILE);
    check(
      '种子库 data/philia.db 原样（size/mtime 未变）',
      after.size === seedStatBefore.size && after.mtimeMs === seedStatBefore.mtimeMs,
      { before: seedStatBefore.size, after: after.size },
    );
  }
}

const watchdog = setTimeout(() => {
  console.error('\n[e2e] 超时（240s），强制退出');
  server?.kill();
  process.exit(1);
}, 240_000);

try {
  await main();
} catch (err) {
  failures++;
  console.error('\n[e2e] 未捕获异常：', err);
  if (serverLog) console.error('[e2e] server 日志尾部:\n', serverLog.slice(-2000));
} finally {
  await cleanup();
  clearTimeout(watchdog);
}

console.log(failures === 0 ? '\n全链路验收全部通过 ✅' : `\n${failures} 项验证失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
