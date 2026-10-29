# PD-109 · 客户端预约 pill 去 QA 夹具前缀＋客读宠名单点收口 · 候选卷宗

- 窗：`PD-109-client-qa-fixture-prefix`
- WT：`E:\KIMI code\pd109-client-qa-fixture-prefix`
- 分支：`feat/pd109-client-qa-fixture-prefix`
- PR：#206 https://github.com/lqb15122801713-png/philia-app/pull/206（OPEN，只开不合）
- 基线：`67c867fc522d8b29fc4e08a3e4e340b4e5f25910`／DEPLOY `20261029110235`
- mig：**0148 故意空留**；零 schema；未占 0117／0119／0122–0147；未抢 PD-106／108／110
- 状态：本地候选证据齐，PR #206 OPEN 候交付 HIT；现网 `PENDING_MERGE_DEPLOY`，不作正式销项或现网结论。

## 1. 根因与产品 diff

现网基线实际复现 `/booking/grooming` 宠 pill「QA夹具豆豆」，DOM `text-9ee88950…` 与新截图 `baseline-live-booking-grooming.png` 同证。根因是既有 `customerPetName`／`customerNotificationText` 只接入部分页面，默认洗护预约页、成功回显、共享选宠器及其他客读出口仍有原始名字旁路；并非缺少清理规则。

单点仍为 `apps/customer/src/lib/customerPresentation.ts`：`customerPetName` 复用 PD-107 的同一文本清理链，新增【QA夹具…】独立宠名覆盖；未新建第二套 util、正则或依赖。19 个客户端产品文件仅在最终展示调用点接入，保留原始 `petId`、提交参数、编辑表单初始值、Query 数据和 `isQaFixturePetName` 内部判定。

主路径：
- `GroomingSinglePage.tsx`：预约 pill、预约选宠半屏。
- `BookingSuccessPage.tsx`：成功页两处回显。
- `ActivePetSwitcher.tsx`：全局 pill、半屏、头像 alt／首字。
- `NotifyCenterPage` 与 `AppointmentDetailPage` 既有 PD-107／PD-99 接法不变，回归未回退。

其余客读出口同样只接展示层：共享 `PetPicker`／`PetCardBlock`／寄养提示、Dock、宠物档案与健康档案、证书、服务过程／完成提示、首页面板与相册。未扩员工端、商家端、商城骨架、日结、支付协议、PWA、首页堆叠或 INJECT-。

## 2. 原缺陷 → 新证据 → 状态

| 原缺陷／门槛 | 基线证据 | 候选证据 | 状态 |
|---|---|---|---|
| 林晓 R47 FAIL·L `PET_PILL_QA_FIXTURE_PREFIX` | 现网 pill「QA夹具豆豆」；新 DOM＋PNG | 同一上游只读数据下 pill「豆豆」；`candidate-booking-grooming.png`；DOM QA=0 | 本地候选覆盖；现网待合部 |
| 盲测客 R46 STILL OPEN 同锚 | 入池记录＋本窗现网复现 | 预约 pill、预约半屏、全局半屏均 QA=0 | 本地候选覆盖；不冒充复测-R |
| 预约流回显 | 成功页原样输出由 SSR 红灯复现 | 成功页两处「豆豆」；`qaPresentation.test.tsx` | 本地候选覆盖 |
| 消息三入口回退 | PD-107 基线已有清理 | 直达／铃／我的三份新 DOM 各 17 条服务消息 QA=0；普通「豆豆」保留 | 未回退 PD-107 |
| 预约详情／列表 | PD-99 已接统一名 | 新列表与详情 DOM「宠物 豆豆」；QA=0 | 未回退 PD-99 |
| 单点函数 | 括号名红灯、预约 pill／成功／切换器红灯 | 带前缀／括号／普通名／空名单测；共享组件 8 项测试 | 候选覆盖 |
| 候选客 dist ≠ `index-BI3bcUo1.js` | 现网 `index-BI3bcUo1.js`；本机基线 `index-B8VZWDwO.js` | `index-DJcalQcW.js`，名称与字节均不同 | 满足候选门槛；不是 tip 包 |

结构化证据：`validation.json`、`bundle-evidence.txt`、`browser-evidence.json`、`single-source-grep.txt`。

## 3. 包与真实页面

| 件 | 文件名／SHA-256 | 说明 |
|---|---|---|
| 现网客包 | `index-BI3bcUo1.js`／`4fe57f6249ba4e2ae5d7f0554a376bd2d281bf7848f5508aac8508127d018401` | 本窗新下载；现网 HTML 仍指此包；HEALTH 7200–7203＝200×4 |
| 本机基线包 | `index-B8VZWDwO.js`／`38038beddd90538733a8d0065aed5ff89e9245e5dd7b0d524e700a73d23efca7` | 未改产品码时构建；不拿本机差异冒充产品变化 |
| 最终候选 | `index-DJcalQcW.js`／`bd1612f451b40ad220fe531fd881b99cdb7a12b92a12af58dd990f84ba6ed00c` | 1424505 bytes；HTTP 与本地字节一致；破红还原后同名同 SHA |
| 预约 pill | `candidate-booking-grooming.png`／`6694a74954e9e2338b374144b6c5c3d23b065452dff15856c181194601673d28` | 新采集，pill「豆豆」 |
| 预约选宠半屏 | `candidate-pet-sheet.png`／`eca7c6337e9f5e38b4f077a6b4d160a4b111f2e5b218a1a42e5af203e45f6a08` | 键盘 Enter 真开半屏，QA=0 |
| 消息直达 | `candidate-notifications-direct.png`／`83e60b572c793a8856ab565710a03854c0035f4140429f02f93e6beb44a2ee9f` | 本窗新采集；与 PD-107 候选同像素是同 UI，非旧帧 REUSE |

预览为本地候选静态包＋同一上游只读数据，`tipPackage=false`，不把 localhost 当现网 PASS。自动发出的 `membership.myCardToken`／`push.subscribe` POST 均被只读代理 405 拦在上游前；未创建／取消预约、未支付、未点已读／删除／编辑／切换宠物。

## 4. 验证记录

| 闸 | 命令／证据 | 结果 |
|---|---|---|
| 基线单测 | `tsx --test` 既有 5 文件；`baseline-unit-all.txt` | 12/12，fail=0 |
| 初始 RED | `initial-red-pet-presentation.txt` | 4 个预期失败：括号名、预约 pill、成功页、切换器 |
| 共享面 RED | `initial-red-shared-pet-surfaces.txt` | 7 个预期失败；完整服务过程另在 `red-full-service-process.txt` 证 1 红 |
| 最终单测 | 7 个既有／新增文件；`final-after-mutation-unit-all.txt` | **26/26，fail=0** |
| 定向 lint | 21 个触及文件；`final-after-mutation-targeted-lint.txt` | exit 0 |
| 既存 lint | `targeted-lint-appointment-live-preexisting.txt` | 同一文件基线已有 `set-state-in-effect`×1；新增依赖警告已清零 |
| 全量客户 lint | `baseline-lint-customer.txt`／`final-full-lint-customer.txt` | 前后均 65 errors／4 warnings；`INC-PREEXISTING-LINT`，不宣称全绿 |
| 客户端构建 | `final-after-mutation-build-customer.txt` | exit 0；`index-DJcalQcW.js` |
| 三端根构建 | `npm run build`；`final-build-all.txt` | customer／merchant／staff 均 exit 0 |
| 单点 grep | `single-source-grep.txt` | QA 规则只在 `customerPresentation.ts`；生产码旧散落匹配＝0；无嵌套清理 |
| 关闭前破红 | `mutation-red-unfiltered.txt`：临时令 `customerPetName` 原样返回 | 15 个预期失败；随即还原，最终 26/26、构建复绿、候选 SHA 不变 |
| diff 卫生 | `git diff --check` | exit 0 |

依赖环境：Windows 根 `npm ci` 在嵌套 `postinstall` 递归失败；改为根 `npm ci --ignore-scripts`＋`server npm ci --ignore-scripts`，安装 688＋110 packages；锁文件与产品脚本未改。审计报告只报读，未执行自动修依赖。

## 5. 边界与更深不更大

- 谁在压力下点：客户慌着约洗护、选宠时撞「QA夹具豆豆」，会把正式产品当成内测壳。
- 拦：所有客读宠名最终展示统一走 `customerPetName`；通知整句继续走同文件的 PD-107 清理链，保留真实宠名。
- 撤／防点错：先红后绿、受控破红再还原；禁 REUSE、假 CLEARED、`hits:[]`、换 tip、只改种子或只改库。
- 未碰 `01M5EQVF`，未造第二店，未直改库，未查 USAGE，未安装 Action，未开第二窗。
- 未扩员／商／审美／PD-108／PD-110／INJECT-；页面中其他历史夹具文案不借本刀扩张。
- 内建浏览器指针点击 pill 未打开半屏，已用真实键盘 Enter 走通；不冒充触控 PASS。预约详情和全局半屏的截图调用曾返回 `PAGE_NOT_READY`，只引用成功取得的 DOM，不虚构截图。

当前 PR #206 OPEN、只开不合，候交付 HIT。合部另闸为 Merge SHA＝Deployed SHA＝TIP-DEPLOY tip 全，DEPLOY／HEALTH×4 同轮新鲜；本卷不领取该结论。
