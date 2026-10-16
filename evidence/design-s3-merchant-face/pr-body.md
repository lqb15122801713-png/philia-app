# 片3-商家收银 VI 对齐（A1→A6 · 产品-1015 换皮 · 任务书冻结版 V1.0 · 头子已准 10-16）

> **PR 只开不合**：合＋部署＝产品经理走 ROG；A 窗禁合禁部。施工方自报全绿≠验收通过；验收＝产品侧对照 Ready＋现网。
> 基线：生产 main@`f0299e7333dda450d73d54b16eb027db4690021f` ｜ 卷宗：`evidence/design-s3-merchant-face` ｜ 模型：**已用 K3 MAX**

## 令围落点（同片序 A1→A6）

- **A1 · W-00 登录（READY 203:14）**：卡面/字段/发丝线全令牌化（bg-card／bg-canvas／rounded-control／`rgba(44,40,34,x)`）；字色 ink 令牌族；柠檬主钮旧称注释→cream（本屏 cream 唯一）；种子登录/口令门真链路零触。随齐：守卫两件爪印→IdCard（Ready §4，片2 同族）。
- **A2 · W-02 台账／W-03 详情（203:39／203:125）**：行/详情/竖向步进/Toast/ConfirmDialog/MonitorTimeline 旧墨 alpha→ink 令牌族＋装饰 alpha 基底换代 `rgba(59,46,36,x)→rgba(44,40,34,x)`；danger→bg-destructive 令牌。
- **A3 · W-04 监控 Hub（203:211）**：卡面/badge/洗底令牌化；**IA 零触**（45 分阈值/强制完成/僵尸预警原样，不借机重做 IA）。
- **A4 · W-05 寄养（203:297）**：M3/台账/容量日历令牌化；寄养打卡件爪印→BedDouble。
- **A5 · W-06 收银／W-07 日结／W-08 退款（203:383／203:469／203:555）**：收银全家 17 件令牌换代（旧淡金→cream、深棕→ink 收敛、#FFFDF6→card、#FAF8F2→canvas、#F1E8D4→sunken、字色 ink 族）；**Folio／PayChips／Redline 明面在场**；三本账四分列／日结冻结·反结账／退款 draft-executed-settled／店间隔离零触。
- **A6 · 手机五槽（198:374／203:5219／198:445／203:5365／203:5480）**：五槽共享件令牌化（色值层面，布局/密度/IA 零触）；dock 五槽零触。
- **u3 骨架族（index.css）**：panel/tbl/st/chipf/stat/kv/field/stepv 禁色清零（dark 域不随动=片0 注记）。
- **端口轻批**：晨报题/引言（wsk.postcard*＋dash.postcard*，数字来自账）与异常卡模板句（wsk.alertEmpty/alertGo）＝既有键在种子库，A4 端口零新键。

## 闸门（全绿才交付）

- 三端 build ✅ exit=0；server typecheck ✅ exit=0（server 零改动照跑自证）
- smoke-routes／check-nav-closure／e2e-nav-check：见卷宗 gates 日志
- 实尺十三帧全绿（真链路：真登录/真下单/真核销/真结单/真退款），脚本随卷可复跑
- lint（自查项）：存量 47 错 5 警；旗标行∩本片 diff hunk＝0（机器交叉核对，**本片零新增**）

## 非目标守界

钱权／L2／日盘门槛／服务时长／监控 45 分（PIN）零触；不判美；监控不重做 IA；icon 库全量／真图终摄／五槽外手机屏／片0·1·2·4 未触；零新依赖零新迁移零服务端改动；未点完成／完成任务／归档／中断；勿碰 CJ 与选品系统窗。

## 边界报备（详见卷宗 README §五）

Figma 帧不可直读（同片1/2 口径，施工对照=READY＋已合部工艺，听裁）；共享件断点副作用仅色值层面；深棕收敛同员工端片0 注；未装配旧件按保留口径未动；dock「我的」暂驻 /settings 维持片0 壳口径；PayChips=PaySheet 支付段 chips 族明面；等宽轨现网 JetBrains Mono 未换代。
