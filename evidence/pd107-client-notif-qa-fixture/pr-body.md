## PD-107 范围

- 仅处理客户端 `/notifications` 及铃／「我的→消息」同源列表的历史服务通知。
- 标题、正文中的 `【QA夹具豆豆】` 及等价 `QA夹具` 前缀在 React 展示边界收敛为客户可读的 `豆豆`，保留改期、派单、到店签到等真实服务进度。
- 不扩预约表单宠名、支付协议、PWA、底栏消息席、员通知密度、商驾舱／日结／慢读或相册；零 server／schema／锁文件改动。

## 根因与产品 diff

`NotifyCenterPage` 原先直接渲染接口返回的 `item.title`／`item.body`。本批复用 `customerPresentation` 的夹具标记规则，新增通知文本清理，并只接入这两个读口。

产品码仅 2 文件（11 增 3 删）；新增真实页面回归 `notifyPresentation.test.tsx`。未改种子或数据库。

## 新鲜证据

- 基线：`e890fa401f6bf649109379c198254905f7126cdd`／DEPLOY `20261027001820`／现网 `index-C2YJDxM1.js`。
- 现网对照帧 `baseline-live-notifications.png`：改期、派单、签到等 10 处 `【QA夹具豆豆】`。
- 候选 `index-CJu1diFP.js`：1424040 bytes，SHA-256 `10af6c545686f82b19f52fce185f55ab9ddeaf1a1ede15ca6ac98fd5d99ca2ca`；名称与字节均不同于现网，HTTP 与本地构建一致，不是 tip 包。
- 直达、铃入口、我的入口完整文档快照：17 条服务通知中夹具前缀 0；改期／派单／签到分别显示“豆豆的预约时间已调整…／豆豆的预约已安排服务人员／豆豆已到店…”。见 `browser-evidence.json` 与三张候选帧。
- 初始真实页面回归 0/1（原缺陷复现）；受控移除清理行为再次 0/1；还原后客户端全套 12/12，fail=0。
- `npm run build`：customer／merchant／staff 均 exit 0；触及文件定向 eslint exit 0；`git diff --check` exit 0。
- 全量客户 lint 仍为基线既有 65 errors／4 warnings，未伪报全绿，也未扩修范围外旧债。

卷宗：`evidence/pd107-client-notif-qa-fixture/`（结构化核验、包字节、DOM／像素、测试与构建原木、只读预览记录）。

## 边界与交付状态

- mig **0147 故意空留**；未占 0117／0119／0122–0146，未抢 PD-106。
- 未碰夹具 `01M5EQVF`，未造第二店，未直改库，未使用 USAGE，未安装 Action。
- 未用 REUSE／假 CLEARED／相册结论冒充消息面证据；涉钱无操作。
- 「我的」链接以内建浏览器键盘 Enter 走通；两次指针点击未跳转记为工具交互异常，不冒充 touch PASS，未顺手改路由。
- PR 只开不合；合前禁部。当前为本地候选，候交付 HIT＋异窗监理；现网仍 `PENDING_MERGE_DEPLOY`。
- 合部另闸：Merge SHA＝Deployed SHA＝TIP-DEPLOY tip 全，DEPLOY／HEALTH×4 同轮新鲜。
