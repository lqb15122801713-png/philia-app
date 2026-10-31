# PD-113 客端正式产品脸接入内测 code

## 缺陷与根因

`BETA_GATE_REQUIRED`：现网正式 `/login` 仅填手机号提交返回 401，主脸无 code 字段可补。共享 API 与服务端本已支持 `code?`，正式 `LoginPage` 未提供字段且未传参。

## 最小改动

- `apps/customer/src/pages/LoginPage.tsx`：新增可见 code 输入；调用既有 `devLoginByPhone(..., code.trim() || undefined)`。
- `apps/customer/src/copy/login.ts`：新增两条独立 login copy。
- 两条既有测试覆盖字段存在与 API 接线。
- 选择“主脸可填 code”，不做 staging 豁免，不改服务端、路由、权限或其他端。

## 新鲜验证

- 开工现网：仅手机号 POST＝401 `BETA_GATE_REQUIRED`；浏览器无 code 字段。
- TDD RED：定向 `2 pass／2 fail`；全套含新回归 `28 pass／2 fail`，仅目标断言红。
- 最终客户端单测：`30/30`，fail=0。
- 触及文件 ESLint：exit 0。
- 全量客户 ESLint：既有 `65 errors／4 warnings`，`INC-PREEXISTING-LINT`；触及文件不在红单。
- 三端根 `npm run build`：exit 0。
- 受控破红：撤掉 code 传参后 `3 pass／1 fail` 命中目标断言；已还原并重建。
- `git diff --check`：exit 0。

## 候选浏览器辅助证据（非现网、非交付 HIT PASS）

- 客包 `index-CC3b67HP.js`，≠`index-iJmx2uv4.js`；bytes=1,429,098；SHA-256=`eb203328a52adb3954436ce19c284e46104a820fbb1d37a99496fed32d977370`。
- 本地候选，**非 tip 包、未部署**；localhost 仅作辅助证据。
- 未登录根 `/` 与直访 `/login` 均为正式产品脸，不落 `/dev-login`；code 字段可见，无演示账号／账号 ID 卡。
- 产品脸手机号＋code 提交：真实 staging POST 200，落地 `/home`；最终重建与实走包文件名／SHA-256 完全一致。
- 快照与机械明细见 `evidence/pd113-client-beta-gate/`。

## 边界与下一步

mig 故意空留，零 schema、未占文件。未重开 PD-101；未并 DESIGN／UNREAD／售卡／关单；未扩员／商／商城；未抢 PD-106；未动 PD-108／110；未重冻已销号。零真支付、未碰 `01M5EQVF`。

PR 只开不合；交付 HIT 候异窗 PR Verifier＋码质审。合部后须核 Merge SHA＝Deployed SHA、DEPLOY／HEALTH 与现网客包。

— 不写验收通过
