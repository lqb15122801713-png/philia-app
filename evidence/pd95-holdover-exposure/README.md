# PD-95 · 员工寄养板待换外露收口卷宗

- 基线：`main@7a37c6c333aeeb7e8b4f160eed54f95d946e553d`
- WORKTREE：`E:\KIMI code\pd95-holdover-exposure`
- BRANCH：`feat/pd95-holdover-exposure`
- 缺陷：`HANGOVER-待换-VISIBLE-ON-BOARDING`／`AE-STAFF-R56-04`
- 改动端：**仅员工端**。客户端未改；按冻令允许的单端交付，不申领客户端 home／mall／orders 或空袋／空结算结果。
- 迁移：零 schema、零 migration；**0136 故意空留**，未占文件；未触 `0117`／`0119`／`0122–0134`（含已用 `0133`／`0134`）。

## 根因与最小产品改动

1. `BoardingPetCard.tsx` 在 `pet.avatarUrl` 为空时主动渲染 16:10 假照片框与硬编码“待换”。现改为有图保留原 16:10 真头像，无图使用紧凑宠物档案条，保留宠物名首字、寄养类型、宠物与日期信息，不以空白框冒充照片。
2. `StayInfoCard.tsx` 在 `roomNo` 为空时硬编码“待分配”。现住且原页面提供 `onEdit` 时，改为“登记房间”原生按钮，直接复用同一原入住编辑回路；只读历史单保留中性的“房间 未登记”，不伪造入口，也不靠整行消失消字。已有房号保持原展示。
3. `BoardingCheckinPage.tsx` 仅同步两处宠物卡条件布局注释，无行为改动。
4. 新增 `boardingExposure.test.tsx` 五条真实 SSR 组件回归，覆盖无图、真头像与 16:10、在住登记入口、只读历史未登记、已有房号。

未改客户、商家、server、schema、迁移、相册、驾舱、传感器、日结、关店、死单；未重开 PD-89／91／92／93／94；未跨店造种；未碰夹具 `01M5EQVF`；未直改库。

## 更深不更大

- 谁在压力下点：小美开寄养板，担心把内部待补素材／待排房状态外露给客户侧压力；客户侧在本单不改，不冒领其结果。
- 拦：N/A（本单为外露收口，不是误点闸）。在住缺房号时给真实登记入口，而非新增写闸。
- 撤：进入原入住登记表单后可“取消”返回，不保存、不提交。
- 不扩相册、不绑驾舱；不以 DUP／REUSE／标题差／无字消失冒充收口。

## RED → GREEN 与审查补钉

- 首跑 `unit-red.txt`：2／5，三条预期失败分别钉住无图“待换”、在住“待分配”、只读“待分配”；真实头像与已有房号对照原本通过。
- 首次 GREEN `unit-green.txt`：5／5。
- 独立 reviewer 初审：无 Critical；一项 Important＝只读历史空房号整行隐藏会丢事实；三项 Minor＝历史夹具语义／永久点击回归缺口／真头像 16:10 断言缺口。
- 补钉 RED `review-fix-red.txt`：4／5，只读历史单缺少“未登记”事实；补钉 GREEN `review-fix-green.txt`：5／5。
- 同步处理 Minor 中的历史夹具（`checkoutAt` 非空）与真头像 16:10 断言；同步两处旧注释。
- 最终 `unit-final.txt`：PD-95 5／5；`regression-merchant-final.txt`：商家 10／10。

复跑命令：

```bash
node server/node_modules/tsx/dist/cli.mjs --tsconfig apps/staff/tsconfig.app.json --test apps/staff/src/components/boarding/boardingExposure.test.tsx
node server/node_modules/tsx/dist/cli.mjs --tsconfig apps/merchant/tsconfig.app.json --test apps/merchant/src/pages/appointmentDetail.utils.test.ts apps/merchant/src/components/mall-admin/format.test.ts apps/merchant/src/components/dashboard/utils.test.ts apps/merchant/src/components/cashier/model.test.ts
```

## 最终浏览器走测（本地候选，不是现网 HIT）

- 包：`index-_s_wlKE7.js`；SHA-256 `207564bd2e0701d7b59d785605e9fabc4839e392c287861fe2fba4212388c64b`。
- 入口：真实 `/boarding/:id/checkin` 页面＋同源生产 dist＋显式只读 mock tRPC；无 localhost HIT 结论。
- 移动 400px 首帧：紧凑档案条与“登记房间”可见；无“待换”／“待分配”。
- 移动键盘 Enter 与桌面指针分别进入原表单；“保存登记信息”在场；分别取消后回到“登记房间”，保存钮消失。
- 未点保存、每日打卡、退房；`businessMutations=0`、`unknownProcedures=0`。浏览器自动 `push.subscribe` 共 94 次均被 mock 阻断并单列，未建立真实订阅，未混入业务零写结论。
- 证据：`local-browser-result.json`、`local-browser-network.json`、`shots/01-boarding-compact.png`、`shots/02-room-register-form.png`。

| 帧 | 内容 | MD5 | SHA-256 |
|---|---|---|---|
| `01-boarding-compact.png` | 400px 紧凑档案＋登记入口 | `f706310a945060bae814e1aeafc40fcd` | `08f1fec18d8a73c3f5536e3d1c7dbce57b023ec963bc943d3ab9209c8bba29c3` |
| `02-room-register-form.png` | 390px 原入住表单＋保存／取消 | `53fd58200db919ba58b6f833b3526c8f` | `bb9789c4db5f32ee7b9ba1903552a6061835c9e3c9dc92a0f9a0a48e0c307893` |

两帧 MD5／SHA-256 均不同，采集于最终包；不是 `10≡17 DUP`，未跨 tip REUSE。哈希只证明文件不同，交互结论另由 DOM 等待与网络记录支撑。

## 构建、lint 与基线遗留

- `npm run build`：最终 customer／merchant／staff 三端 exit 0；完整输出 `build-final.txt`。
- 本窗两个组件＋测试定向 ESLint：exit 0；`git diff --check`：exit 0。
- 全量 staff lint `lint-staff-full-final.txt`：仍为基线 25 errors／1 warning，位于未改旧实现；未借本窗整端清理。
- customer＋B7 `regression-customer-b7-final.txt`：28／29；唯一红项仍为 `scripts/b7-service-timeline-page.test.tsx:82` 期待旧文案“入口来自预约成功「查看服务过程」”，与本窗员工改动无关。
- server typecheck `server-typecheck-final.txt`：仍为 `server/src/db/pd66EvidenceFixture.ts` 12 个 TS1375（无 import／export 却使用顶层 `await`）；本窗 server 零改动。
- 以上旧债如实保留，不作全量绿色声明，也不扩进 PD-95。

## 交付 HIT 表（现网与候选分开）

| 原缺陷／门槛 | 证据 | 状态 |
|---|---|---|
| 员工寄养板“待换”外露 | 无图改紧凑档案条；PD-95 5／5；最终首帧与 DOM 观察 | 本地候选可证；现网待合部后核 |
| 房间“待分配”外露 | 在住“登记房间”复用原 onEdit；只读历史保留“未登记”；进入／取消双路径 | 本地候选可证；现网待合部后核 |
| 禁 `10≡17 DUP`／REUSE | 最终两帧 MD5 `f706310a…`≠`53fd5820…`，SHA-256 亦不同；最终包网络记录 | 非 DUP；未跨 tip REUSE |
| 禁无字冒充清 | 无图仍显示宠物与寄养信息；只读历史仍显示“房间 未登记”；非整行隐藏 | 本地候选可证 |
| 客户端门槛 | 客户端产品源码零改动；未执行客户端收口走测 | 不申领；客 dist 无需换新 |
| 现网员工 js | `live-baseline-bundle.json`：`http://120.53.102.45:7203` 实读 `index-CCVd9COk.js`，734065 bytes，SHA-256 `5a1bc9c7b92e04fe44f0e06e1ad7bd0419c4c908e4c0b373fcf549e05f0e6d53` | 与冻结基线一致 |
| 新员工 js | `index-_s_wlKE7.js`，SHA-256 `207564bd2e0701d7b59d785605e9fabc4839e392c287861fe2fba4212388c64b` | **异于 `index-CCVd9COk.js`；本地候选，非 tip 包** |
| 合部同源 tip 现网包／HIT | 本窗不合、不部署；localhost／mock 不领 HIT | **待合部部署后执行；本卷不写 HIT 结论** |

## 审查遗留 Minor（不扩本窗）

- 页面级 completed／overdue 不传 `onEdit` 的永久自动化未新增；本次已审页面 guard，并以历史组件夹具覆盖组件分支。
- 新按钮的永久浏览器自动点击回归未新增；本次保留 SSR 回归与 Desktop 双路径实走记录，未引入新测试依赖。
- 极窄视口与超长 `roomLabel` 未扩展采样；本次为 400px／390px 移动视口，未外推所有文本长度。

## Rulings

- 单端交付：冻令明确允许，故仅员工端，客户端不冒领；若误判，客户端 STILL OPEN 仍存在，需另令处理。
- 只读历史采用“未登记”而非隐藏：保留事实且不给不可编辑记录伪造动作；若误判，历史员工会看到中性缺房号信息而非空行。
- 未合未部时不领同源 tip HIT：只交付现网基线、候选包与本地可观测证据；若误判，现网 HIT 仍须在合部部署后补做。

PR 只开不合；本卷为施工与候选证据，不写验收结论。
