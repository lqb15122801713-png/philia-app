# 走查P2修复批（D-35~D-38 · PD-18）卷宗 · evidence/walkthrough-p2-d35

- 开工令：产品-1013-走查P2修复批（任务书=冻结版 V1.0，老板 10-13「签P2开工」；D-37 开口已裁=人话不可用收口+禁裸 404/403）
- 档位：K2（无新钱域状态机；D-35 日结 UI 抽核谨慎）；单片四件（片内序 D-36→D-35→D-37→D-38）
- 基线：生产 main@`8f7b299b`（codeload 钉 sha；走查修复批 D-29~D-34 已收口尖）
- 分支：feat/walkfix-p2-d35（PR 只开不合，base=main）；本卷宗=evidence/walkthrough-p2-d35

## 一、四件明细

| 件 | 面 | 改动 | 实证 |
|---|---|---|---|
| D-36 客户端员工种子软绕收紧 | apps/customer DevLoginPage | 错端角色（staff/groomer/frontdesk/merchant_*）会话卡摘除「进入首页」软口；明示出口卡不赖 endHint 瞬态（已知拓扑跳端后重访也补卡）；客户角色软口照存（回归在案） | 实尺 T1a/T1b（无「进入首页」+明示卡 :7203/:7202）+T1c（客户照存） |
| D-35 日结冻结班次区明示 | merchant CashierClosePage + DayClosePanels + copy 键 | ShiftCard 增 dayFrozen（真冻结态=listDayCloses 当日 frozen 行驱动）→ 班次区明示徽「今日已日结 · 账目已冻结」与「开班中」并存；D-29 钱域口径零改动 | 实尺 T2（徽+banner 同帧）；e2e 100 族（D-29 守卫）每跑照绿 |
| D-37 寄养去打卡裸 404/403 | staff BoardingCheckinPage + copy 两键改值 | 摸点坐实：待办源=任务总线 staffTask.listMy（在住缺今日日志出卡）；页=异常卡人话化「当前不可打卡」+可回退（返回任务台），技术错误文不再透出；SSE 挂接闸到详情加载成功（归属 403 噪声归零）。实体在=链路本可达（真单旅程帧在卷） | 实尺 T3a（真单全旅程：入住信息+今日打卡表单）/T3b（无实体=人话卡+回退） |
| D-38 偏好三处 | customer AppointmentDetailPage / AppointmentsPage / mall copy | ① 改约历史去重复拼接箭头（同日=时刻点单箭「→」，跨日寄养=「改至」分隔，区间箭保留=住宿语义）② 预约列表无参默认落「第一个有内容的签」（显式 ?tab= 优先；全空/加载中兜底 confirmed=S4 口径不降）③ 商城配送槽位写准注记（「配送方式 · 结算页可选」/「快递 / 同城 / 自提 · 内测期免运费 · 时效属后期端口」，原「——」「即将点亮」退役） | 实尺 T4a/T4b/T5/T6 |

## 二、迁移申报（键入码必随迁移）

- `server/drizzle/0079_walkthrough_p2_d35.sql`（journal idx 79）：copy 键 **1 增**（cashier.shiftFrozenBadge）+ **4 键改值**（boarding.error.title/fallbackDesc 人话化 + mall.deliveryTitle/deliverySub 写准注记）；幂等（INSERT NOT EXISTS 守卫 / UPDATE active=1 行，0071 范式）；键值=生成件 copySeedRows.ts 单源逐字。
- 生成件重生成 4221+seed 手补 1=**4222**（72 域不变）；e2e 计数断言四处同步（56.1×2/76.3/98.2）+双链注释追加；e2e 101 族锁 0079 落库逐字。
- staging 件（_backfill_staging.sql）用后已删，未入卷。

## 三、闸门表（栈=7130 客户 / 7131 商家 / 7132 员工 preview + 7200 API，CORS 显式三端；库=p2-gate.db 新库 migrate+seed，0079 实证落库 4222 键）

| 闸门 | 结果 | 件 |
|---|---|---|
| server typecheck | 绿 | typecheck.log |
| 全仓 build 零参版 / 栈版（VITE_API_BASE=7200） | 双绿 | build-gate.log / build-stack.log |
| e2e 连跑 | 三绿（1009 断言/跑；100 族 D-29 守卫+101 族 0079 落库全绿；另 1 红=ECONNRESET 环境件早夭，净场复跑即绿） | e2e-green-1/2/3.log + e2e-env-econnreset-note.log |
| nav 闭环 | 125 路由 · 死胡同 0 · 弱 0 · 豁免 6（零新路由） | nav.log / nav.json |
| smoke-routes | 109/109 通过 | smoke-routes.log / smoke-routes.json |
| smoke-deploy | 全部通过 | smoke-deploy.log |
| 实尺截图 | 九帧 SHOTS_ALL_GREEN（15 项断言） | shots/ + shots.log + shots/checks.json |

## 四、实尺截图清单（shots/）

1. T1a-staff-no-soft-bypass.png —— 员工种子（小美）客户端登录：会话卡仅剩「退出登录」+员工端明示卡（:7203）
2. T1b-merchant-no-soft-bypass.png —— 店主种子：无「进入首页」+商家端明示卡（:7202）
3. T2-shift-frozen-badge.png —— 日结页班次区「今日已日结 · 账目已冻结」徽与「开班中」并存+D-29 明示卡同帧
4. T3a-boarding-checkin-reachable.png —— 寄养去打卡真单全旅程（在店寄养·入住信息·今日打卡喂食/遛狗/照片表单·办理退房）
5. T3b-boarding-unavailable.png —— 无实体=「当前不可打卡」人话卡+返回任务台（页面零 404/403 裸字样）
6. T4a-reschedule-single-arrow.png —— 同日洗护改约=时刻点单箭（10月13日 14:00→16:00）
7. T4b-reschedule-range-gai-zhi.png —— 跨日寄养改约=「改至」分隔（区间箭 2 枚=住宿区间语义）
8. T5-appointments-default-pending.png —— 纯 pending 客户无参进列表=默认落「待确认」签+单卡在屏
9. T6-mall-delivery-slot.png —— 商城配送槽位写准注记（结算页可选/内测期免运费/时效属后期端口）

## 五、候裁明面（四件照实报）

1. D-36 只收 dev-login 会话卡软口；**直输 URL 带错端会话访问 /home 路侧不拦**（客户端路由层无角色闸=既有口径，登记候裁是否加闸）。
2. D-37 采「明示不可用」收口（老板已裁够收口）；真单链路实证可达（T3a），未改任务总线/归属闸任何口径。
3. D-38.3 新文案为施工方按 PD-15 写准注记口径拟稿（「结算页可选/免运费/后期端口」）——**文案定稿=产品侧**，改稿=改 copy 键值（改参不改码）。
4. 其余「即将点亮」槽位键（slot.soon / bk.multiPetSlot / me.slotSoon 等）=范围外未动（不扩批）。

## 六、纪律自查

零新依赖 ｜ 迁移幂等+申报（0079 一件） ｜ 键入码必随迁移 ｜ LF ｜ 注释零 `*/` 序列 ｜ 大文件自采 ｜ 禁令自报=零触 ｜ D-31 开关未碰（仍关） ｜ D-34 生产库坐标未动 ｜ 真支付/真退款零触 ｜ 不判美 ｜ 闸门栈 7130-7132+7200（CORS 显式） ｜ 收摊必净（netstat 实证 PORTS_ALL_CLEAR） ｜ 口头零效力 ｜ PR 只开不合、禁合禁部。
