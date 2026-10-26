# PD-100 商家端监控／双端口骨架＋YKNXD2 专帧（含原 PD-102）

## 范围

只改商家端指定面：

- 监控：全等待不再以灰骨架冒充内容；部分等待保留已到达卡片。
- 展示素材／界面文案：等待与留痕改为真实可读状态；页题和矩阵列改人话，矩阵不再外露源码脚注。
- 商城订单：移除无条件旧「读口待补」脚注；YKNXD2 专帧直接显示单号与只读章。
- 死单发货／退款：保持功能闸关闭，原生 disabled＋无链接箭头＋灰底虚线＋删除线；文字对比约 4.82:1。

未碰驾舱待收款、日结、关店／发货功能闸、死单功能闸、客端、员端、schema、`01M5EQVF` 或真实钱路径。**0141 故意空留；原 PD-102 并入本 PR；不占 0142／0143／0144。**

## 证据

卷宗：`evidence/pd100-merchant-skeleton-ports-yknxd2/`

- 最终候选：`index-BFrSLK_B.js`，sha256 `6547e36f0e3ab5ac81e3c21b5bfe3383707c313178bba7eb4d183b98248db960`。
- 现网只读：`index-sf4Mp8sz.js`；本地 untouched 基线：`index-Bh5WsuOY.js`；三者身份不同。
- 最终单测＋既有回归：**19/19 PASS**。
- 最终商家构建：exit 0。
- 最终 10 帧均在此最终包重采并逐张复核；含监控／双端口等待与内容、YKNXD2 专帧、矩阵和禁点近景。
- YKNXD2 发货／退款实点均 `ELEMENT_NOT_INTERACTABLE`；`pendingDialogs=[]`、`businessMutations=[]`。
- 负控：故意放回灰骨架产生 4 个预期 FAIL，移除后 19/19 PASS 且无残留 diff。
- 未用 REUSE、`hits:[]`、`reuseInodes=0`、换 tip 或邻帧字面维持冒充清项。

## 验证命令

```bash
# cwd apps/merchant
node ../../server/node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.app.json --test \
  src/pages/pd100Presentation.test.tsx \
  src/pages/appointmentDetail.utils.test.ts \
  src/components/mall-admin/format.test.ts \
  src/components/dashboard/utils.test.ts \
  src/components/cashier/model.test.ts

npm run build:merchant
npm run lint -w @philia/merchant
```

## 已知基线／限制

- 全量 lint **INC**：untouched 基线已是 47 errors／5 warnings；最终数量完全相同。触及文件定向 lint 也同为 1 error／1 warning（`CopyConfigPage` 既有项）；新增文件 lint exit 0。未扩修越界错误。
- 新语义 copy 键用于防止旧生产覆盖复活工程话术；旧键保留。新键尚未登记为店主可编辑配置，未占迁移、未直改库，后续开放编辑须另令。
- 部分到达由真实组件 SSR 证明；`httpBatchLink` 同批等待不以 mock 伪造。浏览器取全等待与加载完成两种真实状态。
- 独立 `loop-code-review`／严审码质未在本写码窗执行，挂交付 HIT 后异窗。

**PR 只开不合；未部署；Merge SHA／Deployed SHA=N/A；交付 HIT 待核。**
