# PD-113 客端 BETA_GATE 卷宗

缺陷码：`BETA_GATE_REQUIRED`。基线 `426f422e4d95b9fa9f3ccf67d1f4ff65f45dfa8f`／DEPLOY `20261030174617`／客包 `index-iJmx2uv4.js`。**mig 故意空留**，零 schema、未占迁移文件。

## 根因与选择

- 现网正式 `/login` 仅手机号提交返回 401 `BETA_GATE_REQUIRED`，页面没有口令／code 字段；同一 API 带正确 code 的响应为 200。
- 共享 `devLoginByPhone(baseUrl, phone, code?)` 与服务端已支持 code；正式 `LoginPage` 未渲染字段且未传第三参。
- 选择令内“**主脸可见可填口令／code**”方案，不做 staging 闸豁免，不改服务端权限。正式页新增一个 code 输入并接入既有 API；空 code 仍按原契约省略，兼容无闸本地环境。
- 未改 `/login` 路由、未落 `/dev-login`、未加演示账号／账号 ID 卡，未做换皮。

## 证据

| 项 | 新鲜结果 |
|---|---|
| 现网开工自验 | 仅手机号 POST＝401 `BETA_GATE_REQUIRED`；浏览器 alert 同文；无 code 输入；`live-before.txt` |
| 初始 RED | 定向 `2 pass／2 fail`：缺 `product-login-code`、未传 code |
| 全套含新回归初始跑 | `28 pass／2 fail`，仅两条 PD-113 断言红 |
| 还原后全套单测 | `30/30`，fail=0；`unit-final.txt` |
| 触及文件 ESLint | exit 0；`lint-targeted.txt` |
| 全量客户 ESLint | exit 1，既有 `65 errors／4 warnings`；`INC-PREEXISTING-LINT`；触及文件不在红单；`lint-full.txt` |
| 三端根构建 | `npm run build` exit 0；`build-final.txt` |
| 关闭前破红 | 暂时撤掉 code 传参，`3 pass／1 fail` 命中 PD-113 接线断言；已还原；`controlled-break.txt` |
| `git diff --check` | exit 0 |

## 候选与浏览器辅助实证（非现网、非交付 HIT PASS）

- 候选客包：`index-CC3b67HP.js`；1,429,098 bytes；SHA-256 `eb203328a52adb3954436ce19c284e46104a820fbb1d37a99496fed32d977370`；≠`index-iJmx2uv4.js`。
- 候选为本地构建，**非 tip 包、未部署**。localhost:7143 仅回环预览转发真实 staging API，只作辅助证据，不冒充交付 HIT PASS。
- 直访 `/login`：正式产品脸；可见手机号与“内测口令（code）”输入；无演示账号／账号 ID 卡；快照 `text-ad5367df-abb8-42c5-b03b-ab2908600e7a`／`elements-7aab55d2-b8a5-4d37-bb68-cb61f645fd7a`。
- 未登录根 `/`：最终 `/login`，不落 `/dev-login`；快照 `text-cdc2723e-d77c-4626-a46a-90c4917c152c`。
- 产品脸填手机号＋code 点「手机号登录」：staging POST 200，最终 `/home`；首页快照 `text-52dc6aec-2041-4614-8d27-0e16e86b3a1e`；代理状态见 `preview-log.txt`。
- 最终重建后客包文件名／字节／SHA-256 与上述实走包一致。
- 测试后已通过产品 UI 登出，关闭两个浏览器页并停止预览服务。

## 边界

未重开 PD-101 换皮；未并 DESIGN／UNREAD／售卡／关单；未扩员／商／商城／相册／底栏消息；未抢 PD-106；未动 PD-108／110；未重冻 105／107／109／111／112。零真支付、未碰 `01M5EQVF`、未造第二店、未开第二窗。

安装：标准 `npm ci` 在嵌套 postinstall 子进程找不到 `node`，与 PD-101 已记录 Windows 问题一致；按仓内既有等价流程执行 `npm ci --ignore-scripts`＋`npm --prefix server ci --ignore-scripts`，安装 688＋110 packages，未改脚本或 lockfile。安装输出的既有 audit 漏洞未扩面处理。

交付 HIT 候异窗 PR Verifier／码质审；PR 只开不合，合前禁部。合部后仍须同源 tip／DEPLOY／现网客包复核。

— 不写验收通过
