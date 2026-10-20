# PD46／CJ-1018-12 · 全端升档 U7 商家手机 · 卷宗

- 分支：`feat/pd46-u7-phone`｜基线：main@`dd0417a0`（`dd0417a02a63f775bc90abdf9dbb190ca5f8475e`，含 PD-42）
- 模型：已用 K3 MAX｜窗：「全端升档-U7-商家手机」
- 权威：figma bro 定稿＋Ready／Figma `ot5SBoqhKAw2UIZRVFzhel`；VI `193:2`；依据 `figma-bro-B10-商家手机断点补帧_2026-10-18.md`＋`figma-bro-B10b-商家手机W09-W16补帧_2026-10-18.md`
- 本卷宗只证「施工完成并对照自查」；**不写验收通过**、不判美；验收归产品 ROG／头子点验。
- 范围：只销 U7（五槽壳＋B10 高频六屏＋B10b W-09～W-16 八屏）；未塞 B7／PD-40／`209:*`／选品／PD-39／C4–C6 桌面入口／U1～U6 深脸；未合并未部署。

## 一、施工面（逐屏对照 · 390×844 phone-v57）

### 五槽壳（对照 `198:374／203:5219／198:445／203:5365／203:5480`）

| 槽 | 落点 | 施工 |
|---|---|---|
| 总览 | `/dashboard` | B10b dock 映射归槽（`/orders` `/products` 同槽）；M3 连锁/单店 9 处 11px→12px |
| 门店 | `/appointments` | 台账表+骨架表进 `u3-noscrollx overflow-x-auto`＋`min-w-[860px]`；副行/来源签 11→12 |
| 收银 | `/cashier` | 既有单栏三 tab 保留；**红线明面带钉在收款面板下（手机态新增，`212:220` 口径）** |
| 报表 | `/finance` | 月度台账表进横滑容器＋`min-w-[820px]`；「收款 ›」11→12＋触控 ≥36 |
| 我的 | **`/me`（新建，`203:5480`）** | **身份卡（店名 serif＋角色签＋账号）＋经营/账本/系统三组入口（owner 加见运营后台端＋三端口）**；dock 第五槽自 `/settings` 过渡口径改落 `/me` |

### B10 高频六屏 ·phone-v57（`212:*`）

| 屏 | Node | 施工 |
|---|---|---|
| 驾驶舱 | `212:2` | 见上「总览」；WAlert＋M3＋合计条＋今日预约＋晨报卡逐块实测 |
| 预约台账 | `212:73` | 见上「门店」；筛选 chips＋满台账表 |
| 监控 Hub | `212:144` | 卡列实测 390 单列（预警卡＋服务中六步卡）；页头三滤签折行 |
| 收银台强化 | `212:220` | 单栏三 tab＋红线明面带（无充值入口/年费≠储值/四分列对账/扣次非现金） |
| 日结 | `212:291` | 四分列＋日结表单＋日结单列表；行内 5 钮触控 `max-xl:min-h-[36px]` |
| 退款 | `212:362` | DRAFT→EXECUTED 表＋口径卡（涉储值锁死）；actions 折行＋3 钮触控 |

### B10b 低频八屏 ·phone-v57（`213:*`）

| 屏 | Node | Dock | 施工 |
|---|---|---|---|
| W-09 商城订单 | `213:2` | 总览 | 回馈金仅抵商品口径明面在；「发货 ›」触控 ≥36 |
| W-10 商品 | `213:84` | 总览 | 低库存红字/日盘档列在；删除钮触控 ≥36；提示 11→12 |
| W-11 会员·次卡 | `213:166` | 门店 | 持卡表进横滑容器＋`min-w-[820px]`；8 处 11→12；充次/记录钮 ≥36 |
| W-12 员工 | `213:248` | 我的 | 在职表进横滑容器＋`min-w-[860px]`；3 钮 ≥36；考勤注/权限卡实测 |
| W-13 报表 | `213:330` | 报表 | KPI 四格＋月结快照＋D1–D9 目录＋台账实测（深于五槽简报） |
| W-14 权限矩阵 | `213:412` | 我的 | **WMatrix <lg 改分区卡列渲染（非桌面缩略糊图）**；锁死区红签在 |
| W-15 门店设置 | `213:494` | 门店 | 营业时间行折行；「编辑 ›」≥36；hint 槽全抬 12 |
| W-16 运营后台 | `213:576` | 我的 | 口视图 <lg 纵排整宽（目录上/内核下）；危险区实测；渲染文案无「开发者」（`cadm.pageTitle=运营后台端`） |

### 语言包 `212:755`
【可退／仅参考】——本片未以其冒充任何逐屏对照；W-09～W-16 全部按 `213:*` 逐屏施工。

### phone-v57 基样（全片共用 · `styles/console.css` 媒体块 max-width:1279.5px）
- 可读文字全量 ≥12px：`.text-caption-xs`→12；wsk 件族（top注/total格/postcard行值/list副/pill/capcal/redline/matrix/cports/cpub/clog/fdot/hd注/note）＋u3 件族（aside/th/st/stat cap·d/todo小字/kv cap/field lb/stepv小字）全抬；dock 签 10.5→12。
- `.wsk-cports` 整宽；`.wsk-list .it` ≥44；WMatrix 手机卡 `.mrole/.mrow`。
- ≥xl 桌面零改动（媒体块圈定；U6 桌面另片不挡）。
- MainScaffold：<lg 页头纵排＋actions 折行；SearchInput 手机满宽 ≥lg 回 224px。

## 二、验证（CDP 实测 · 390×844）

- 脚本：`scripts/design-upgrade-u7-merchant-phone-check.mjs`（CDP 无头 Edge，390×844 移动视口）；夹具 `server/scripts/u7-demo-phone.ts`（本地 dev 库直写，单号前缀 `U7D%` 幂等；**不走预约提交/支付/退款流程**）。
- 运行：`node --experimental-websocket scripts/design-upgrade-u7-merchant-phone-check.mjs`（前置：server dev＋merchant vite；`MERCHANT_URL`／`API_BASE` 可覆盖默认 7101/7200）。
- 结果：**104/104 通过**（`u7-results.json`／`gates/browser-check.log`）：
  - dock 五槽标签冻结「总览/门店/收银/报表/我的」＋激活 cream 短划实测 `rgb(242,220,140)`＋无爪印；
  - 15 屏结构块齐（含 W-06 购物车 tab 红线明面、W-16 口视图端口目录＋危险区两个二态）；
  - 每屏四闸：可读副文全量 ≥12px／爪印=0／cream 主钮 ≤2／页面零横向溢出；
  - dock 激活归属逐屏＝B10b 映射（W-09/10→总览、W-11/15→门店、W-12/14/16→我的、W-13→报表）；
  - 全程无真付／真退／提交预约／开会员请求（网络留痕 0 命中）。
- 截图：`u7-w01-cockpit / w02-ledger / w04-monitor / w06-cashier(+cart) / w07-dayclose / w08-refund / w09-orders / w10-products / w11-pass / w12-staff / w13-reports / w14-perms / w15-settings / w16-ops(+port) / w00-me.png`，均 390×844。

## 三、固定闸门

| 闸门 | 结果 | 证据 |
|---|---|---|
| 三端 `npm run build`（customer+merchant+staff） | exit 0 | `gates/build-all.log` |
| server `npm run typecheck` | exit 0 | `gates/server-typecheck.log` |
| 浏览器专项（CDP） | **104/104** | `gates/browser-check.log`／`u7-results.json` |
| merchant 全量 ESLint | exit 1（仓库既有 12 错 1 警） | `gates/merchant-lint.log` |
| 本片文件定向 ESLint vs 基线同文件集 | **13 = 13（零新增）** | `gates/merchant-lint-u7-files.log`／`gates/merchant-lint-baseline-same-files.log` |

## 四、禁区遵守

未做：真付／真退／提交预约／开会员真通道／真加购结账；B7／PD-40／`209:*`／选品／PD-39；C4–C6 桌面入口（归 U6）；U1～U6 深脸；桌面断点翻案（全部手机态改动经媒体块／lg:／max-xl: 圈定）；A 合／部；验收通过字样；判美；用 `212:755` 冒充逐屏；服务端迁移（零新迁移）；新增依赖（零）。真图未齐处沿用既有浅色占位，无爪印冒充。

## 五、开口项（诚实报备 · 非伪装通过）

1. **dock 第五槽生产文案**：码内默认＝「我的」，本片新建 dev 库端口值亦「我的」；生产库 `copy_overrides` active 行 `wnav.dockMe` 若为历史「设置」（迁移 0049 旧口径，槽位已自 `/settings` 迁 `/me`），翻牌「我的」须产品侧走文案端口／另批迁移（本片零新迁移不动 server；server e2e 77.2 旧断言「设置」随翻牌另批更新）。
2. **W-16 嵌入内核**（RulesConfigPage／SlotPortPage／CanvasPortBody 等 owner-only 高级层 10 种）本体未逐个手机化——`213:576` 对照面＝hub＋目录＋发布流＋危险区（已实测）；内核容器已整宽 min-w-0 不撑破 390。
3. **触控残留**：MonitorHub 僵尸桶「强制完成」（PD-22 既有，约 33px）与 CashMovePanel 表单控件（约 35px）未纳入本片行内钮 ≥36 圈定；如需全量 ≥36 另批。
4. **证据环境**：7200 端口被他树占用，点验用本树 server（PORT=7207＋CORS_ORIGINS 放行）＋vite `VITE_API_BASE` 指向本树 server；代码零改动适配，仅运行参数。
5. 真图（Dock／rail 线性 icon 终库、页头摄影槽）维持既有占位口径，终验前换品牌线性库（Ready §5 挂账项）。

## 六、复跑

```bash
cd server && npm run db:migrate && npm run db:seed && npx tsx scripts/u7-demo-phone.ts
PORT=7207 CORS_ORIGINS="http://localhost:7104" npm run dev   # server
cd apps/merchant && VITE_API_BASE=http://localhost:7207 npx vite --port 7104 --strictPort
MERCHANT_URL=http://localhost:7104 API_BASE=http://localhost:7207 node --experimental-websocket scripts/design-upgrade-u7-merchant-phone-check.mjs
```

本卷宗是施工方自报证据，不替代产品侧后续复核。

— KimiCode A 窗 · 2026-10-20 · K3 MAX
