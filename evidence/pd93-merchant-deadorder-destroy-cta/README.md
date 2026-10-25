# PD-93 · 商家端死单只读态＋销毁 CTA 真面

- 基线：`main@73b5e82f005ee52fde5af54e48eb9aa2790a692e`／DEPLOY `20261024153113`
- WT：`E:\KIMI code\pd93-merchant-deadorder-destroy-cta`
- 分支：`feat/pd93-merchant-deadorder-destroy-cta`
- 范围：`DEAD_ORDER_ID_NOT_SEEN`／AE-MERCHANT-R33-01；`DESTROY_CTA_NOT_SEEN`／AE-MERCHANT-R33-02
- 迁移：零 schema、零迁移文件，`0134 故意空留`；未占 `0117／0119／0122–0132`
- 对照现网商家 dist（冻令与入池登记）：`index-B18kiVeF.js`

## 根因与最小产品改动

| 原缺陷 | 基线根因与证据 | 本分支产品改动 | 本地证据状态 |
|---|---|---|---|
| YKNXD2 字面未见，无法评价只读灰态 | `OrdersPage` 用旧显示层过滤器把死单从三队列整行剔除；`baseline-dead-result.json`＝`DEAD_ORDER_ID_NOT_SEEN actual=false`；`shots/baseline/dead/01-orders.png` 只见对照单 | 原队列与计数保留死单；`OrderCard` 只读分支落 `P261022YKNXD2`、`死单 · 只读`、原生 disabled 发货／退款；正常订单仍走原发货层 | `after-dead-result.json` 11/11；`shots/after/dead/01-orders.png`；现网待合部后核 |
| 效期空态未见销毁 CTA，无法开闸或测撤 | CTA 仅挂在 `expiryBoard` 非空行；空态与已隔离批次没有可开的销毁面；`baseline-destroy-result.json`＝`DESTROY_CTA_NOT_SEEN actual=false` | 效期区标题侧始终有 `销毁登记`；独立层可选已隔离批次，展示目标／状态／数量清零后果；cancel 关闭；候选读取与批次区商品筛选解耦 | `after-destroy-result.json` 16/16；`shots/after/destroy/02-destroy-confirm.png`、`03-cancel-closed.png`；现网待合部后核 |

产品文件仅限：

- `apps/merchant/src/components/mall-admin/OrderCard.tsx`
- `apps/merchant/src/components/mall-admin/format.ts`／`format.test.ts`
- `apps/merchant/src/pages/OrdersPage.tsx`
- `apps/merchant/src/pages/InventoryPage.tsx`
- `apps/merchant/src/copy/inventory.ts`
- `apps/merchant/src/components/staff-admin/ui.tsx`（可选 `ariaLabel`，仅销毁层传入；其他调用方默认不变）

未改服务端、订单履约／库存落地态、schema、发货层、关店、日结、周 pill、驾舱、端口、外露、入口族、员工端、核销／打印／导出／供应商。

## 更深不更大

- **谁在压力下点**：店主在死单外露／发货压力下需要明确禁发禁退；在效期行旁找销毁时怕误扣库。
- **拦**：死单只读灰态＋原生 disabled；销毁独立确认层先显示批次、隔离状态与数量清零后果，目标／非空白事由／隔离条件不齐时禁确认。
- **撤**：销毁 cancel 有真实点击与 `dialog=0` 记录；未点最终销毁确认。正常订单发货层仅开／撤，不点最终发货确认。
- **候选筛选复核**：批次区筛到无关商品后，销毁层仍从独立未筛选读口取得目标；`review-red-destroy-result.json` 先红，`after-destroy-result.json` 转绿。

## 验证记录

| 项 | 命令／证据 | 结果 |
|---|---|---|
| 基线单测 | 商家目录 `npx tsx --test src/pages/appointmentDetail.utils.test.ts src/components/mall-admin/format.test.ts src/components/dashboard/utils.test.ts src/components/cashier/model.test.ts` | 10/10；从仓库根目录直接跑会有 `@/` 别名解析差异，商家目录为标准运行位置 |
| 新死单判定 RED→GREEN | `npx tsx --test src/components/mall-admin/format.test.ts`；随后同命令复跑 | 基线缺 `isDeadOrderReadOnly` 时 0/2；产品改动后 2/2 |
| 基线页面 RED | `PD93_PHASE=baseline PD93_SCENARIO=dead node --experimental-websocket evidence/pd93-merchant-deadorder-destroy-cta/dead-order-destroy-cta.mjs`；`PD93_SCENARIO=destroy` 同理 | 分别按 `DEAD_ORDER_ID_NOT_SEEN`、`DESTROY_CTA_NOT_SEEN` 预期失败 |
| 修改后页面 | 同脚本 `PD93_PHASE=after`，`PD93_SCENARIO=dead／destroy／destroy-a11y` | dead 11/11；destroy 16/16；a11y 2/2；无未捕获页面异常 |
| 撤与零写 | `after-*-result.json` | cancel `acted+closed`；`shipCalls=[]`、`destroyCalls=[]`、`quarantineCalls=[]`；未真发／未真销毁／未真隔离 |
| Desktop 内置浏览器 | 敏慧店长（Mock）走 `/orders`→`/inventory` | YKNXD2／死单只读可见；发货与退款均 disabled；销毁层选已隔离批次、填非空白事由但不提交；cancel 后 dialog count=0 |
| 单元回归 | 上述四文件完整商家单测命令 | 最终 10/10 |
| 定向 lint | 六个原产品／测试文件执行 `npx eslint` | 0 error／0 warning；共享 `staff-admin/ui.tsx` 的既有两条 only-export-components 不在新增三行 |
| 全量 lint | 商家 `npm run lint` | 既有 47 errors／5 warnings，位于未扩修面；不借本窗清理其他页面 |
| 构建 | 根 `npm run build` | customer／merchant／staff 均完成；最终商家 JS `index-wv31ao1w.js` |
| diff 卫生 | `git diff --check` | 无输出、无空白错误 |
| 独立复核 | 两轮只读 code review | 首轮 Important＝候选受批次筛选耦合；独立查询与补证后，复审无遗留 Critical／Important |

## 最终本地候选包（非现网）

- 文件：`apps/merchant/dist/assets/index-wv31ao1w.js`
- SHA-256：`59fb983bfae76a1a1decad0f6c740e62f2eb0d9a71cf8599fcd6db6b2bffa151`
- `dist/index.html` 同源引用该文件；文件名异于 `index-B18kiVeF.js`，但本地构建差异本身不充当现网 HIT。
- 基线本地构建曾得 `index-B8zXBmuD.js`；最终以本文件记录的修改后完整三端构建为准。

## HIT 边界

| 必核项 | 本卷宗状态 |
|---|---|
| 现网 js／是否同源 tip 包 | 冻令与入池登记记录现网基线 `index-B18kiVeF.js`／tip `73b5e82`；本窗未另起 HIT 例程 |
| 合后新 js 异于 B18kiVeF | 本地候选 `index-wv31ao1w.js` 已满足文件名差异；**非 tip 现网包**，合后现网名待核 |
| 死单字面＋灰态／销毁 CTA＋撤路 | 本地 mock 与 Desktop 证据齐全；现网待合部后核，localhost 不领 HIT 结论 |
| 未真发／未真销毁 | 本地全程成立；未连接真实履约／库存写链，未点最终确认；现网零写 |

未启动未贴出的 HIT 例程；未合、未部；未查 USAGE；未碰夹具 `01M5EQVF`；未跨店造种；未直改库；本地浏览器与 mock 服务测后已关闭。以上均为施工与候选证据记录，不领最终验收结论。
