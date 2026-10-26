# PD-100 r2｜slots／copy 人话键窄修卷宗

状态：本地候选证据，候交付 HIT→异会话双审→Cursor→合后复测-R。PR 只开不合；不部署；不正式销 PD-100；不写验收通过。

## 范围

- 基线：`015a4ca8e262c9a5aad662fa1ec3a23c77aab0ee`；DEPLOY 对照 `20261026214133`。
- WT：`E:/KIMI code/pd100-slots-copy-keys-r2`；BR：`feat/pd100-slots-copy-keys-r2`。
- 产品改动仅 `apps/merchant/src/pages/SlotPortPage.tsx` 与 `CopyConfigPage.tsx`。
- slots：卡片、预览、下线确认共用版本内容既有人话 `alt`，不再把 `slotKey` 当标题。
- copy：列表、留痕、保存确认共用 `position／screen` 人话标签；`rowByKey` Map 避免数千行下平方级查找。
- API 形状、内部 key、上传／审批／版本流、schema 均未改；本窗无 mig／0146 故意空留。

## 最终钉档

| 项 | 值 |
|---|---|
| 商家候选 JS | `index-_dA59x8G.js` |
| SHA-256 | `83dcb273559a3820f51b018b3d918f9553aece1a78b316ae5e54b70ff1110c06` |
| 必须异于 | `index-BxXrf5jN.js`、`index-sf4Mp8sz.js`（成立） |
| 最终构建 | `final-build.txt`：exit 0，1958 modules |
| 全量商家单测 | `final-unit.txt`：19/19 PASS |
| 全量 lint | `final-full-lint.txt`：**INC**，既有 47 errors／5 warnings，不伪报全绿 |
| 目标 lint | `final-targeted-lint.txt`：**INC**，与 `baseline-targeted-lint.txt` 同一既有 1 error／1 warning |

## 浏览器证据（真 dist＋单店合成 GET）

- 修复前：`baseline-readings.json`、`baseline-slots.png`、`baseline-copy.png`——slots 的 `home.banner`／`login.hero.staff`／`mall.hero` 与 copy 的 `about.agreements`／`staff.title` 可见。
- 关窗反证：`negative-control-readings.json`——临时返回内部 key 后再次 FAIL；还原 diff 哈希对齐，红态未提交。
- 最终：`final-readings.json`、`final-slots.png`、`final-copy.png`——人话标题与留痕可见，`keynameExposed=false`，`skeletonHeavy=false`。
- 最终快照：slots `text-eb518ec0…`／`visual-023b4bf6…`；copy `text-69667d48…`／`visual-b8149261…`。相同像素附件复用不影响新快照 ID 的时序证据。
- `final-mock-state.json`：`unknown=[]`、`blockedMutations=[]`；未触真实门店、真实数据库或夹具 `01M5EQVF`，未造第二店。
- 未验证项：保存确认／紧急下线的后台点击未形成可靠状态迁移，不写这些交互的 PASS。

## PASS 面不回退旁证

本修未触监控、YKNXD2、灰链、驾舱、日结、客员端源码。`final-unit.txt` 中监控可读状态、YKNXD2 只读章与灰态 disabled／透明度测试均 PASS；这只是未回退旁证，不冒充合后现网复测-R。

## 更多证据

- `validation.json`：命令、退出码、范围与禁项机读汇总。
- `mock-preview.mjs`：本地只读合成服务；除 `push.subscribe` 外写调用一律拦截记录。
- 令前 `package-lock.json` 漂移保存在 `stash@{0}`，未混入提交。

更深不更大：店主在 `/settings/slots` 与 `/settings/copy` 直接看到业务名称而不是工程键；没有新增页面、营销文案、审美主刀或 NOTE 堆叠。撤法是不换 tip、不拿 REUSE／邻帧冒充、不用注释改动冒充产品修复，而是回滚这两个展示读口。
