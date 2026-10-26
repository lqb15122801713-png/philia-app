# PD-100 商家端监控／双端口／YKNXD2 卷宗

- 窗：`PD-100-merchant-skeleton-ports-yknxd2`（含原 PD-102；同 mig0141／同 PR）
- 分支：`feat/pd100-merchant-skeleton-ports-yknxd2`
- 基线：`42bb0f67945fe774f2c22d098fed185a0a0929a5`／DEPLOY `20261026160104`
- 最终产品提交：`999cd8da7f7011ccee15ae52f3224ba7a1d15701`（卷宗另提交；交付分支 tip 以 PR 实时值为准）
- mig：**0141 故意空留**；无 schema、无迁移文件、无 journal 变更；不占 0142／0143／0144，亦不撞 0117／0119／0122–0140。
- 交付状态：**施工证据已落卷，交付 HIT／异窗监理待核**；未合并、未部署。

## 1. 包身份（现网只读 vs 最终候选）

| 项 | 文件名 | sha256／说明 |
|---|---|---|
| 现网商包（只读 `http://120.53.102.45:7202`） | `index-sf4Mp8sz.js` | `1b29ff27499c05b463c9e7322243967be7e6ff74507245566654868962ec6ada`；HTTP 200，1669355 bytes |
| 本地 untouched 基线构建 | `index-Bh5WsuOY.js` | 用于识别“换个旧缓存就冒充新候选” |
| 最终候选（本 WT 真 build） | `index-BFrSLK_B.js` | `6547e36f0e3ab5ac81e3c21b5bfe3383707c313178bba7eb4d183b98248db960` |

最终候选同时异于现网与本地基线；`mock-state.json` 记录最终包的全部帧已重采。localhost 只用于候选验证，不冒称现网结果。

## 2. 缺陷→产品改动→独立新证

| 原缺陷 | 产品源码改动 | 本候选新证 | 施工侧状态 |
|---|---|---|---|
| AE-MERCHANT-R36-03 监控全骨架（帧15） | `MonitorHubPage` 不再以任一 pending 遮掉整页；全等待为可读状态卡，部分等待保留已到达卡片 | `shots/01-monitor-content.png`（真实洗护／寄养卡）；`shots/07-monitor-loading.png`（等待无灰骨架）；SSR 部分到达测试 | 候选证据齐，HIT 待核 |
| AE-MERCHANT-R36-05 双端口骨架＋矩阵端口列（14／16／05） | `SlotPortPage`／`CopyConfigPage` 等待及留痕改可读状态；页题改「展示素材／界面文案」；矩阵列同步人话、移除源码脚注 | `shots/02-slot-content.png`、`03-copy-content.png`、`06-matrix-human-labels.png`、`08-slot-loading.png`、`09-copy-loading.png`；旧覆盖注入 SSR 测试 | 候选证据齐，HIT 待核 |
| AE-MERCHANT-R36-02 YKNXD2 专帧骨架＋读口脚注（11） | `OrdersPage` 等待改可读状态；无条件旧回馈金脚注从产品渲染移除，旧 override 不能复活 | `shots/04-yknxd2-readonly.png`（专帧直接见单号＋只读章）；`shots/10-orders-loading.png`；`shots/05-yknxd2-disabled-detail.png` | 候选证据齐，HIT 待核 |
| AE-MERCHANT-R36-06 死单灰链可误点（09／10） | 仅 `readOnly` 分支：原生 disabled、无 `onClick`、无 `›`、灰底虚线＋删除线＋不透明；文字色阶 `.68`，实际灰底对比约 4.82:1 | 元素状态 `disabled`；发货／退款实点均 `ELEMENT_NOT_INTERACTABLE`；`pendingDialogs=[]`；`businessMutations=[]` | 候选证据齐，HIT 待核；功能闸未重开 |

补充：R36-07 仅处理与本窗 YKNXD2 读口脚注相交部分；未扩售卡、日结、驾舱火现、INJECT 或其他挂账。

## 3. 原生验证（新鲜输出在卷）

| 检查 | 结果 | 证据文件 |
|---|---|---|
| 基线既有单测 | 10/10 PASS | `baseline-unit.txt` |
| 最终专项＋既有单测 | **19/19 PASS，fail=0** | `final-contrast-green.txt`、`negative-control-restored-green.txt` |
| 最终商家 `tsc -b && vite build` | exit 0；产 `index-BFrSLK_B.js` | `final-build.txt` |
| 全量商家 lint | **INC：与 untouched 基线同为 47 errors／5 warnings**；不是全绿 | `baseline-lint.txt`、`final-full-lint.txt` |
| 触及文件定向 lint | 与基线同为 1 error／1 warning（`CopyConfigPage` 既有 effect 项）；未新增 | `baseline-targeted-lint.txt`、`final-targeted-lint.txt` |
| 新增 `ContentStatus`／专项测试 lint | exit 0 | `candidate-new-files-lint.txt` |
| `git diff --check` | 无输出 | 最终命令记录 |
| 负控 | 故意放回 `animate-pulse` → 4 个预期 FAIL；移除 → 19/19 PASS；无产品 diff 残留 | `negative-control-intentional-red.txt`、`negative-control-restored-green.txt` |
| 对比度补充 TDD | `.62` 断言先 FAIL；改 `.68` 后 19/19 PASS | `final-contrast-red.txt`、`final-contrast-green.txt` |

标准测试命令（cwd `apps/merchant`）：

```bash
node ../../server/node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.app.json --test \
  src/pages/pd100Presentation.test.tsx \
  src/pages/appointmentDetail.utils.test.ts \
  src/components/mall-admin/format.test.ts \
  src/components/dashboard/utils.test.ts \
  src/components/cashier/model.test.ts
```

构建命令：`npm run build:merchant`。最终构建包含 1958 modules，只有既有 chunk-size 提示；不以该提示冒充错误。

## 4. 浏览器与 mock 纪律

- Desktop 内置浏览器，`desktop-1280`，最终 PNG 均 1280×800；逐张 `ReadMediaFile` 复核，非只查文件名。
- 最终候选由 `apps/merchant/dist` 直接伺服；单店合成只读 mock，注入旧「文案端口／槽位端口／读口待补」覆盖以模拟严苛生产条件。
- 所有查询暂停均可释放，最终 `holdTarget=none`、`unknown=[]`、`businessMutations=[]`；安全订阅仅 `push.subscribe`，其他写请求默认拒绝。
- YKNXD2 发货／退款均实际尝试点击，浏览器因 disabled 拒绝；无弹层、无跳转、无业务写请求。正常订单下一行仍保留既有发货入口，未点击其写路径。
- 部分到达证据来自真实组件 SSR：`httpBatchLink` 同批响应会一起等待，不能用暂停单过程的方式伪造浏览器部分到达；浏览器只取全等待与加载完成两种真实状态。
- 测后 `browserTabs=0`、mock server stopped、端口连接关闭；未触 `01M5EQVF`，未跨店／第三店造种，未直改库，未使用真实钱路径。

## 5. REUSE／清零口径

- 本卷没有使用 REUSE、`hits:[]`、`reuseInodes=0`、换 tip 或邻帧字面维持冒充任何本债收敛。
- 基线 R36 帧仅用于复现缺陷；所有候选帧均在最终 `index-BFrSLK_B.js` 下重新采集。少数静态画面与上轮像素相同是自然渲染结果，未以 MD5 相同或不同单独推导清项。
- 未把本地 dist hash 变化单独当收敛；四证同时包含源码行为、SSR 断言、最终包 DOM／禁点和最终像素。
- 不写 `CLEARED`／验收性结论；当前只交候选证据，等交付 HIT 与异窗监理。

## 6. 维护注记／未跑项

- 新语义键 `copyport.managementTitle`、`slotport.managementTitle`、`mtx.colCopyManagement`、`mtx.colSlotManagement` 用于阻止旧生产覆盖复活工程话术；旧键保留给其他调用方。新键尚未登记为店主可编辑配置，**不占 mig／不直改库**；后续如需开放编辑须另令登记。
- 全量 lint 的 47 errors／5 warnings 是基线既有面，未在本窗扩修；`CopyConfigPage` 的 1 error／1 warning 也在 untouched 基线已存在。
- 既有 `SlotPreview` 图片未显式声明 width／height、槽位编辑输入缺 name／autocomplete，属本窗范围外的既有项，未借本窗扩改。
- 未跑现网合部 HEALTH／Merge SHA／Deployed SHA：本窗禁合禁部，这些字段只能留 `N/A`，不得提前写绿。
- 独立 `loop-code-review`／严审码质未在本写码窗执行，挂交付 HIT 后异窗。
- Windows 原始 `npm ci` 三次复现嵌套 postinstall／Node 路径问题；按仓内 PD-97 已记录的等价流程（根锁文件安装后，server 目录完整 `npm ci`）恢复，未改 lockfile 或产品脚本，最终单测与构建均实际执行。

## 7. 更深不更大

- 谁在压力下点：店主慌看监控、双端口和死单，等待时怕看到空壳，压力下怕把灰链当可点动作。
- 拦：真实等待状态＋已到达内容不消失＋专帧直接见只读行＋原生禁点、删除线与足够对比度；点错由浏览器与产品状态共同拦。
- 撤：失败／空态保留原出口与重试；测试可通过精确回退负控恢复，不能用邻帧、REUSE 或旧候选冒充现网清项。
- 未扩：驾舱待收款 78、日结 PARTIAL、关店／发货功能闸、死单功能闸、客相册、员 locale、跨店造种与真实钱路径均未触碰。
