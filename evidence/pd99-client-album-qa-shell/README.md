# PD-99 · 客户端服务相册去 QA 半壳＋跨面 QA 名收敛 · 候选卷宗

- 窗：`PD-99-client-album-qa-shell`
- WT：`E:\KIMI code\pd99-client-album-qa-shell`
- 分支：`feat/pd99-client-album-qa-shell`
- 基线：`42bb0f67945fe774f2c22d098fed185a0a0929a5`／DEPLOY `20261026160104`
- 现网对照：`index-CfOqIr5Q.js`／SHA-256 `bf13238091fa9c4cf211cd38a23de31bb302397076893600cef1f510db669d4d`
- 候选：`http://127.0.0.1:7299`（仅本地候选，**不是 tip 包，不冒领现网结论**）
- mig：**0140 故意空留**；零 schema；未占 0117／0119／0122–0139；不占 PD-98 的 0139
- 结构化核验：`validation.json`；开工传感器：`opening-sensor.json`

## 1. 根因与最小产品 diff

只读接口证明三册完成单直接返回 `QA夹具豆豆`，照片是普通签名 JPG，文件像素本身为蓝底 `QA□□ STEP photo`，不是 SVG／URL 字面可过滤的占位。首页服务条、预约列表与预约详情也直接渲染同一宠物名。

最小策略：QA 夹具相册不成册，普通真实相册继续显示；宠物名在客户端显示边界去掉夹具前缀。没有替换为假“真实服务照片”，没有改接口数据或图片文件。

产品码仅 5 文件、20 增 4 删：

- `apps/customer/src/lib/customerPresentation.ts`：精确识别 `QA夹具` 前缀并输出客户可读名。
- `apps/customer/src/pages/MomentsPage.tsx`：QA 夹具相册不进入 `Album[]`；无真实相册时沿用诚实空态。
- `apps/customer/src/pages/HomePage.tsx`：首页服务中条同名收敛。
- `apps/customer/src/pages/AppointmentsPage.tsx`：预约列表同名收敛。
- `apps/customer/src/pages/AppointmentDetailPage.tsx`：预约详情与改期／取消入口同名收敛。

回归：`apps/customer/src/pages/qaPresentation.test.tsx`，使用真实页面、实际 `albumFeed → Album[]` 转换与 Query 缓存渲染；混合一册普通真实照片，防止把正常内容一并误删。

## 2. 原缺陷 → 证据 → 状态（本地候选）

| 原缺陷／门槛 | 基线证据 | 候选证据 | 状态 |
|---|---|---|---|
| 林晓 R44 FAIL · 服务相册 QA 半壳 | 现网 DOM 三卡；`baseline-album-*.jpg` 为蓝底 `QA□□ STEP photo 1/2/4` | `final-moments.png`：QA 卡与蓝块均未渲染，显示诚实空态 | 本地候选覆盖；现网待合部 |
| `AE-CLIENT-R43-01` · 相册半壳＋跨面渗漏 | `baseline-moments.png`＋只读 `albumFeed`：3 册 QA 完成单 | 同批接口数据下 QA 相册不成册；混合回归保留普通真实照片 | 本地候选覆盖；不以 REUSE／换 tip 充证 |
| 首页服务中条同源 OBS | 现网首页 DOM 露 `QA夹具豆豆` | `final-home.png`：显示 `豆豆 · 基础洗护（小型犬）` | 本地候选覆盖；现网待合部 |
| 预约列表／详情同源名 | 源码直接渲染 `item.petName`／`d.pet.name` | `final-appointments.png` 27 行无夹具前缀；`final-appointment-detail-crop.png` 宠物名 `豆豆` | 本地候选覆盖；未扩冲突闸 |
| 新客 dist 必须异于 `CfOqIr5Q` | 现网包 SHA `bf132380…` | `index-CvbMRlL3.js`，SHA `863af2d2…`，名称与内容均不同 | 满足候选门槛；不是 tip 包 |

## 3. 候选 js 与现网／基线新字节

| 包 | 文件名 | bytes | SHA-256 | 说明 |
|---|---|---:|---|---|
| 现网对照 | `index-CfOqIr5Q.js` | 1413044 | `bf13238091fa9c4cf211cd38a23de31bb302397076893600cef1f510db669d4d` | 2026-10-26 19:18 +08:00 重新下载；HEALTH 7200–7203＝200×4 |
| 本机基线构建 | `index-DQdVze0c.js` | — | `46e17e34aedf64fc86c97239e643c6605b6f1224377be80ffef93ad969747d1a` | 未改产品码时构建；不拿本机差异冒充产品变化 |
| 最终本地候选 | `index-CvbMRlL3.js` | 1423549 | `863af2d29590ace26455bd685bb16118283a0d7be6dc1241db576cba53b88fbe` | HTTP 下载与本地字节一致；不是 tip 包 |

## 4. 验证记录

| 闸 | 命令／证据 | 结果 |
|---|---|---|
| 目标 RED | `red-qa-presentation.txt` | 5/5 RED：QA 卡、QA-only 成册、首页／列表／详情夹具名均复现 |
| 目标 GREEN | `green-qa-presentation.txt` | 5/5 PASS，fail=0 |
| 最终原生单测 | `final-unit-all.txt` | 9/9 PASS，fail=0（PD-99 新 5＋既有 4） |
| 三端构建 | `npm run build`；`final-build-all.txt` | customer／merchant／staff 均 exit 0；客户产出 `index-CvbMRlL3.js` |
| 其他定向 lint | `lint-targeted-other.txt` | exit 0 |
| 触及旧债文件 lint | `lint-targeted-baseline-existing.txt` | 4 个基线既有错误；本批未扩修 |
| 全量客户 lint | `final-lint-customer.txt` | 前后均 65 errors／4 warnings；不宣称全量 lint 绿 |
| B7 既有套件 | `final-b7-existing.txt` | 16 PASS／1 个基线既有 FAIL；不借本批扩修 |
| 破坏检查 | `mutation-red-inverted-filter.txt` | 临时反转过滤：2/5 RED；还原后最终 9/9 PASS、三端构建复绿、候选 SHA 不变 |
| diff 卫生 | `git diff --check` | exit 0 |
| 代理写保护 | `POST /trpc/appointment.cancel` | HTTP 405；未进入上游，未执行状态变更 |

测试装配日志也保留：共享组件经典 JSX 运行时需要测试全局 React；Query 必须先注册再执行页面原始 queryFn。未把这些装配错误冒充产品红。

## 5. 环境红与边界（不掩盖）

- Windows 根 `npm ci` 的嵌套 `postinstall` 递归失败；改用根 `npm ci --ignore-scripts`＋`npm --prefix server ci` 等价锁定安装（688＋110 packages），未改 lockfile／产品脚本。
- 本地 `main`／`origin/main` 缓存不指向派令 tip，GitHub fetch 网络失败；本窗只锚派令完整 SHA，不宣称取得新鲜远端 main 证据。
- 全量客户 lint 与 B7 各保留基线红，交付 HIT 表必须显式列出，不能以其他绿项抵销。
- 零 server／schema／预约状态／支付改动；未造第二店；未碰 `01M5EQVF`；未直改库；未查 USAGE；未安装 Action；未开第三窗。
- 预约详情原帧含核销码，**未入卷**；只保留排除 QR／人工码的 `final-appointment-detail-crop.png`。
- 更深不更大：客户急看服务相册时，不再撞 QA 半壳；拦＝QA 相册不成册＋真实相册保留＋同名收敛；撤＝证据不足就保留未关闭，不用 REUSE、空命中、PD-97 或换 tip 冒充清零。
- 当前状态：**本地候选证据齐，交付 HIT 待产品核；异窗监理由头子在交付 HIT 后接手。现网仍 `PENDING_MERGE_DEPLOY`。**
- 合部另闸：Merge SHA＝Deployed SHA＝TIP-DEPLOY tip 全，DEPLOY／HEALTH×4 同轮新鲜；本卷不领取该结论。

## 6. BLOCK1 打回补钉 · 完成态详情服务相册

Cursor 指出 `appointment.serviceAlbum` 绕开 QA 闸，Moments 滤册不能替代详情清。复核确认 `albumRawSteps` 原样进入图片网格，完成态仍露蓝底 STEP photo。

- 修改 `AppointmentDetailPage.tsx`：同一 `isQaFixturePetName` 判断原始宠物名；QA 时 `albumSteps=[]`，相册块只显示既有 `albumNoPhoto`＝“无需照片”；普通真实照片仍走原网格。
- 新 RED：`block1-red-qa-presentation.txt`＝6 PASS／1 FAIL；GREEN：`block1-green-qa-presentation.txt`＝7/7；最终全套 `block1-unit-all.txt`＝11/11。
- 完成态实帧：`block1-completed-album.png`，页面状态＝已完成，相册＝无需照片；DOM 检查 `STEP=0`、`QA夹具=0`。普通真实服务照片由独立对照用例保留。
- 新候选：`index-Cfv2yXYL.js`，SHA-256 `207f903e5164b760260dfb56ae61b5402e3f6a89724d4d11703349dfa39c594e`，同时异于 `CvbMRlL3` 与 `CfOqIr5Q`；HTTP 与本地字节一致，仍不是 tip 包。
- `npm run build` 三端 exit 0；全量 lint 仍为基线 65 errors／4 warnings；B7 仍为基线 16 PASS／1 FAIL；未扩 NOTE 跨面、未碰 `01M5EQVF`、未合未部。
