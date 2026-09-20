# 员工端 2.0（R7~R10）施工设计底稿（K3 内部单一事实源）

> 依据：《批次-员工端2.0任务书-冻结版V1.1》+ 附件一 XP 参数（老板已签）+《提成规则表 V1.3》（老板已拍）+ 权限矩阵 V1.1。
> 本文把冻结口径翻译成字段级施工规格。数值一律落配置表（commission_rules / xp_rules），代码只读表，不落常量。

## 〇、既有基座（勘探实证）

- 栈：Hono4 + tRPC11 + Drizzle + libsql/SQLite；server 不在 workspaces；端口 7200。
- RBAC：`staffProcedure / merchantProcedure / merchantManagerProcedure / merchantOwnerProcedure`（server/src/trpc.ts）；SessionUser{id, roles[], staffId?, storeId?}。
- 既有可挂点：`cashier_bills.operatorId`（接待人默认同源）、`products.stock+category`、`appointments.rating/review` + `appointment.review` mutation（幂等）、event_outbox `emitEvent` 事务内写、seed 1 店 3 员工（小美 frontdesk / 阿强 丽丽 groomer）。
- 缺口（报备在案）：学习中心/考试域不存在 → XP 学习通道 server 全量支持（source=exam、每级每月限 1 次、不占日上限），考试中心本体不建，段位-考试资格挂钩在 XP 档案页明示不做死按钮；安心包回收登记不存在 → 本批只做效期预警只读列表（任务书口径即"本批只读展示"）。
- 禁令：零新依赖（jsqr 已在 apps/staff，扫码复用 QrScanner）；地理定位用浏览器原生 API（非 npm 依赖）。禁令 grep：#FFAAA5 / text-white / 渐变（diff 增量口径）。
- 约定：ULID 主键；金额 integer 分；时间 integer Unix 秒；日期 text YYYY-MM-DD；全表 created_at/updated_at；事件常量双端同步（server/src/realtime/events.ts + packages/shared/src/constants/events.ts）。

## 一、九域迁移字段级规格

### 1. 考勤（R7）
`attendance_records`：id / store_id→stores / staff_id→staff / user_id→users / date(YYYY-MM-DD) / kind('in'|'out') / ts(int ts) / lat real / lng real / distance_m int / status('normal'|'late'|'early') / makeup int01（补卡标记） / device_id text / flagged int01（防代打标记） / created_at / updated_at。
- 缺卡不落行（无行即缺卡）；打卡时按 staff.schedule 周模板比对班次，容差 10min；围栏=门店经纬度 300m，围栏外 server 拒写（不写异常）。
- 防代打：同 device_id 同日不同 user_id 打卡账号数>2 → 该批记录 flagged=1（只标记不阻断）。

`attendance_approvals`（异常审批+补卡双流）：id / store_id / staff_id / applicant_user_id / type('exception'|'makeup') / record_id→attendance_records 可空（异常申诉挂原卡） / date / kind('in'|'out'，补卡申请目标) / requested_ts int 可空（补卡填的实际上下班时间） / reason text（必填） / status('pending'|'approved'|'rejected') / reviewer_id→users / reviewed_at int / review_note text / created_at / updated_at。
- 补卡限当月 + 每人≤3 次/月（常量 MAKEUP_MONTHLY_LIMIT=3，注释标"任务书称可配置"，本批代码常量+报备）；审批通过→插入 makeup=1 的 attendance_records 行（status=normal）并回链。

### 2. 库存流水（R8 地基）
`stock_movements`：id / store_id / product_id→products / source_type('cashier'|'reversal'|'count'|'disinfection'|'manual') / source_id text（来源单号） / delta int（正负） / before_stock int / after_stock int / operator_id→users / note text / created_at / updated_at。
- 收银扣减与反结账回补：既有逻辑不动，增流水写入（事务内）。

### 3. 盘点（R8）
`inventory_counts`：id / store_id / type('daily'|'weekly'|'blind') / status('draft'|'counted'|'confirmed'|'posted'|'rejected') / created_by→users / confirmed_by→users 可空 / confirmed_at / posted_at / created_at / updated_at。
`inventory_count_items`：id / count_id→inventory_counts / product_id / system_stock int（建单时账面快照） / actual_stock int 可空（实盘） / created_at / updated_at。
- 确认（merchantManagerProcedure）事务内：按差异生成 stock_movements（source_type='count'，来源=盘点单 id）+ 更新 products.stock + status→posted；驳回→rejected（退回重盘=可重新 counted）。confirm 前零库存写入。
- 单价≥100 日盘：按 products.price_fen≥10000 过滤生成盘点项（建单参数 kind）。周盘=全量。
- 安心包：products.category='care_package' 单独成类；新增列 `expires_at` int 可空 + `is_disinfection_supply` int01；效期≤30 天预警查询（店长视图+员工端安心包页只读）；消毒步完成→本店 is_disinfection_supply=1 商品各扣 1 落流水（source_type='disinfection'，source_id=appointment_step id）。

### 4. 提成（R9）
`commission_rules`：id / version int / rule_key text / label text / value_json text（比例 bp、定额分、拆分、门槛全在此） / effective_from int ts / active int01 / created_by→users / created_at / updated_at。初始 version=1 全表种子（V1.3 全行，含售卡定额 5/10/20 元、活体 5%-10% 备用、P4 预留行 active=0）。
- 计提=只读计算：服务单 completed 时点/商品售卡=支付成功时点，按 effective_from 取规则版本算；已快照月份读快照，差额进当月"调整项"。
`commission_snapshots`：id / store_id / staff_id / period text（'YYYY-MM' 或 'YYYY-Qn'） / kind('commission'|'performance') / payload_json text（分列池：美容师绩效池/前台绩效池两行不合并） / total_fen int / rule_version int / created_at / updated_at；unique(staff_id,period,kind)。每月 1 日 02:00 快照（server 定时器幂等）；季度绩效同 15 日口径快照。
`deduction_records`：id / store_id / staff_id / month text / amount_fen int / reason text（必填） / created_by / created_at / updated_at。插入闸门：当月累计≤当月绩效 50%，超限 server 拒绝"已达当月扣减上限"；只扣绩效不扣提成。

### 5. 绩效档位（R9-B）
`performance_grades`：id / store_id / staff_id / quarter text 'YYYY-Qn' / grade('S'|'A'|'B'|'C'|'D') / grader_id→users（老板或授权店长） / note / created_at / updated_at；unique(staff_id,quarter)。系数 1.2/1.0/0.8/0.5/0 落 commission_rules（rule_key=perf_coeff_*）。

### 6. 接待人域（R9-C）
- `cashier_bills` ADD `receptionist_id` text 可空 →users；迁移回填=operator_id（默认=开单人）。
- `reception_logs`：id / bill_id→cashier_bills / old_receptionist_id 可空 / new_receptionist_id / changed_by→users / note / created_at / updated_at。
- 核销改挂：核销端点（pass/appointment 核销处）接受可选 receptionistId，变更写 reception_logs（前后值）；无接待人（IS NULL）的洗美单在前台绩效聚合中硬排除。

### 7. XP（R10）
`xp_events`：id / store_id / staff_id / user_id / source('attendance'|'service'|'review'|'exam'|'referral'|'cover'|'penalty') / source_id text / points int（±） / channel('daily'|'learning') / rule_version int / dropped int01（日上限超限丢弃留痕，dropped=1 不计分） / created_at / updated_at。
- 日上限 60：仅 channel='daily'；学习通道（exam）单列不占；超限写入 dropped=1。拉新 referral：server 拒写+明示"随会员游戏化批开通"（防假功能第三态禁止）。
- 防刷：同客户对员工当日好评只计 1 次（查 reviews）；考试每级每月 1 次（查 xp_events source=exam source_id 级）。
`xp_levels`（月度结算）：id / store_id / staff_id / month / start_xp / gained_xp / end_xp / level_before / level_after / retained int01 / created_at / updated_at；unique(staff_id,month)。每月 1 日结算：月增量≥保级线保级，不足降一级，累计不清零。
`xp_rules`：结构同 commission_rules（version/rule_key/label/value_json/effective_from/active）。种子=附件一：六来源分值（5/2/6/3/30/50/80/15/-8）、日上限 60、段位门槛（0/300/900/2000/4000）、保级线（150/300/500/700）、考试月限 1、好评日限 1。
- 榜单：查询层裁剪（前三+自己+前一名），前端拿不到全榜；三店榜仅 owner。

### 8. 评价（R10 最小评价域）
`reviews`：id / appointment_id→appointments unique / store_id / customer_id→users / staff_id→staff（操作美容师） / rating int 1-5 / text 可空（≤140 字，一句话） / anonymous int01 / created_at / updated_at。
- 既有 appointment.review mutation 扩展：幂等不变，增写 reviews 行 + 触发 XP（5 星+6/4 星+3/≤2 星 −8 扣分不扣款）+ ≤2 星 emit 店长频道差评提示事件。输入加 anonymous 可选。
- 员工端本人评价列表端点（staffProcedure，仅本人）。

### 9. 规则配置版本（R9-F 端口）
`rule_config_versions`：id / domain('commission'|'xp') / version int / changed_by→users / changes_json text（每 key 前后值数组） / created_at / updated_at。
- 保存=事务：旧 active 行失效（effective 截止）→新行 active=1 version+1 effective_from=now + versions 行；重确认在前端（D 套）；仅 merchantOwnerProcedure；新规只管生效后的单不回溯。

### 附带列
- `staff` ADD `grade` text 可空（G0..G4/P0..P3/P4，提成/绩效档位判定用；种子：丽丽 G2、阿强 G1、小美 P1）。
- `products` ADD `expires_at` int 可空、`is_disinfection_supply` int01 默认 0。

## 二、事件新增（双端同步）
AttendanceMarked / AttendanceApprovalResolved / StockCounted / StockConfirmed / ReviewSubmitted / XpAwarded / ConfigVersionSaved → emitEvent 模式事务内写。

## 三、页面/路由清单（全部需双表申报：smoke-routes.mjs + check-nav-closure.mjs）
员工端（staff-dock 常显或 PageHeader 返回）：/attendance（打卡+本人记录+补卡申请）、/inventory（盘点任务+执行）、/pay（提成绩效页）、/xp（XP+榜+规则一句话）、/reviews（本人评价）、/manager（店长视图：取消审批/日结确认/考勤异常+补卡审批/差评提示/退款审批=补丁②拦截"退款功能随专项批开通"零写入）。Dock 视密度调整申报。
商家端：/settings/rules（规则配置管理，owner-only，ClerkRouteGuard 白名单外+页内 isOwner 闸门+manager 403 由 server 硬拒）。
客户端：预约详情评价区增 anonymous 开关（既有挂点，无新路由）。

## 四、端点闸门映射
- 考勤打卡/补卡申请：staffProcedure；月表导出：merchantOwnerProcedure；异常/补卡审批：merchantManagerProcedure（本店）——但任务书定店长审批在员工端店长视图，店长在员工端身份=staff 角色+staff.role 判定（seed 无店长员工 → 店长视图入口对 staff 端用户按 store 归属+merchant_manager 角色放行；server 端点用"本店店长或老板"断言）。
- 盘点建单/录入：staffProcedure（店员执行）；确认/驳回：店长或老板；老板全店查看。
- 提成/绩效/XP/评价列表：staffProcedure + 仅本人硬过滤（employeeId=ctx.user，越权传参拒绝）。
- 扣减录入：店长或老板（必填原因）。
- 绩效档位录入：老板或授权店长。
- 规则配置读写：merchantOwnerProcedure（clerk+manager 403 e2e 实证）。

## 五、e2e 增补清单（§七）
打卡两击 / 补卡流 / 盘点红字店长确认才入账 / 提成仅本人越权拒绝 / 扣减 50% 超限拒绝 / XP 榜尾不可达 / 考试 XP 不受日上限 / 评价提交≤30 秒 / 接待人域（默认=开单人/核销改挂留痕前后值/无接待人不计入/同源双计两池分列） / 配置端口（owner 改参留痕版本化/新参只影响新单/clerk+manager 403）。
smoke-deploy 增：库存流水三类来源（cashier/reversal/count 或 disinfection）写入验证+前后值正确。

## 六、疑点报备（已裁默认，PR 中显式列）
1. 学习中心/考试域不存在：学习通道 server 全量建，考试中心本体不建，段位-考试资格挂钩页面明示不悬空。
2. 安心包回收登记不存在：本批只做效期预警只读（任务书 R8④ 本批口径）。
3. 补卡月限次数：代码常量 3（注释标可配置），配置端口 V1.3 范围=提成+XP 不含考勤参数。
4. 次卡售卡/寄养提成：默认不计（任务书§九写死）。
