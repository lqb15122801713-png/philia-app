# U2 收口 · 花架子侦测（逐按钮真实链路 + 零新接口核对）

> 铁律：界面上出现的功能必须真实做出来且三端互通。本表逐按钮核对落点；接口核对=diff 全程零新增 server 过程调用。

## 登录 /dev-login

| 控件 | 链路 | 证据 |
|---|---|---|
| 手机号一键登录（柠檬） | 滚动到账号选择区（dev-login 内测等价链路，无手机号能力不造假） | H/dev-login.png |
| 口令入内测 | 展开口令门 → dev-seed-users?code= 真链路（401/403 分支实装） | H/after-login.png |
| 种子账号卡（小美/阿强/丽丽） | devLogin() → cookie 会话 → /today | e2e：登录后 /today + dock 核销台 ✓ |
| 手动输入 userId | 同 devLogin 兜底 | 代码在案 |
| 进入任务台/退出登录（已登录态） | navigate / logout 真链路 | ✓ |

## 任务台 groomer /today

| 控件 | 链路 | 证据 |
|---|---|---|
| 头像（薄荷环） | → /me | ✓ |
| 周横条 6 chip | 纯展示（规格书：仅当前周不可翻页） | B/today.png |
| 全天行寄养卡「去打卡 ›」 | → /boarding/:id/checkin（真实入住/打卡页） | B/today.png |
| 服务中块点击 | 就地浮层展开服务卡（六步进度=serviceStep.list 真值） | B/today-live-expanded.png |
| 点轴外收回 | pointerdown 外点收回 | e2e PASS |
| 「继续服务 · 第 N 步」 | → /execute/:id | e2e：路径实证 ✓ |
| 统计行 | 纯展示无按钮（规格书口径） | B/today#bottom.png |

## 任务台 frontdesk /today

| 控件 | 链路 | 证据 |
|---|---|---|
| 扫码核销 · 到店登记 | QrScanner 懒加载 → appointment.checkin → nextRoute 跳转 | C/today.png（e2e 由既有契约覆盖） |
| 待办·寄养入住「入住 ›」 | → /boarding/:id/checkin（checkinStay 真链路） | C/today.png |
| 待办·改期回退「去确认 ›」 | 员工端无 confirm 权限（merchantProcedure）→ toast 指明商家端审批（真实反馈，非假动作；疑点 U2-5 报产品侧） | 代码在案 |
| 轴块 | 只读（核销状态+员工名），并行对半分列 | 数据缺口见疑点 U2-1 |

## 六步执行 /execute/:id

| 控件 | 链路 | 证据 |
|---|---|---|
| 返回 ‹ | → /today | ✓ |
| ＋拍照/相册虚线槽 | input capture → IndexedDB 队列 → upload → addPhotos（弱网退避） | D-sse/staff-detail-uploaded.png |
| 照片右上 × | 二次确认 → deletePhoto 真删 | 代码在案（沿 B1 链路） |
| 缩略图点击 | PhotoViewer 大图 | ✓ |
| 吸底主钮（未满） | toast「还差 N 张」真实回响，不误确认 | D/execute_*.png |
| 吸底主钮（已满/末步） | confirmStep → 翻步/庆祝页 → /today | e2e：翻步 417ms ✓ |
| SSE watch=aid | step_updated/flagged/reopened/completed/cancelled 全接线 | 客户端 458ms 同步实证 ✓ |

## 寄养打卡 /boarding/:id/checkin

| 控件 | 链路 | 证据 |
|---|---|---|
| 喂食 segment | 本地态 → dailyLog meals（N×正餐映射，服务端 food 必填口径） | E/boarding-after-submit.png |
| 遛狗 −/＋ | stepper 0–99 | ✓ |
| ＋拍照 | uploadImage → boarding/<aid>/daily/<date> | ✓ |
| 提交今日打卡 | boarding.dailyLog UPSERT 幂等 | e2e：同日再提交=更新不重复 PASS |
| 历史照片缩略 | PhotoViewer | ✓ |
| 办理退房 | 内联二次确认 → boarding.checkout | 代码在案（沿 B3-5 链路） |
| 修改入住信息 | CheckinForm 编辑态 → checkinStay 幂等更新 | 沿旧链路 ✓ |

## 历史 /history ＆ 我的 /me

| 控件 | 链路 |
|---|---|
| 历史单条卡 | 只读（listForStaff 真值，评分/金额/取消来源均真） |
| 我的排班 | 就地展开周模板只读（setSchedule 权限在商家端，不造假编辑） |
| 我的评价 | → /history（真实落点） |
| 寄养负责中 | → /today（全天行打卡入口） |
| 帮助与规范 / 设置 | 就地展开真实内容（规范文案 / SSE 与通知权限实况） |
| 退出登录 | logout → 清缓存 → /dev-login |

## 零新接口核对

diff 全程未新增任何 server 过程；前端聚合仅两处（规格书 §2 注授权 + §7 注）：
1. 全天行寄养「今日打卡态」= boarding.stayForStaff.logs 存在性比对（规格书 §2 注）；
2. /me 绩效=listForStaff 自算 + 打卡数=stayForStaff 聚合（疑点 U2-2/U2-3 在案）；
3. 待开工块疫苗签=appointment.get pet.vaccineValidUntil（现成 publicProcedure）。

## 待裁定疑点（随 PR 报产品侧，未擅自取舍）

- **U2-1**：规格书所印 `listTodayForStore`（frontdesk 全店轴）服务端不存在；员工可读口径=
  `listTodayForStaff`（本人单+未指派 pending/confirmed）→ frontdesk 轴看不到他人已指派单，
  试样 frontdesk 全店轴（含并行对半分列）在当前接口权限下无法取真值。施工=listTodayForStaff 承接+待办列全真。
- **U2-2**：`staffList`（绩效聚合）为 merchantProcedure，员工端 /me 绩效改用 listForStaff 前端自算（同口径）。
- **U2-3**：「本月寄养打卡数」无员工可读聚合接口 → 本月 boarding 单 × stayForStaff 前端聚合（N 小可行）。
- **U2-4**：待开工块来源签「客户指定」无数据支撑（assignSource 仅 auto/merchant/null）→ 沿用 S4 统一口径（自动派单/商家改派）。
- **U2-5**：待办「改期回退待确认·去确认」在员工端无 confirm 权限与详情页 → 现 toast 指明商家端审批（待裁定落点）。
- **U2-6**：规格书「过程照实时同步给家长」——服务端 step_updated 仅在 confirmStep 发射（addPhotos 不发事件），
  家长端照片增量在翻步时到达（server 冻结不碰，家长页 60s 轮询/回前台对齐已覆盖单张增量）。
