# 卷宗 · PD-78-client-code-token（A窗 · 点验件，非验收）

> 基线 main@a73f02b（a73f02b2b7cc1fdb2f92398f640946546a7d4ec0）· 分支 feat/pd78-client-code-token · K3 MAX · 2026-10-22
> 迁移实占 **0118**（idx 118，`server/drizzle/0118_member_card_token.sql`，令牌表 `member_card_tokens` 必占；未撞 0114–0117／0119／0120）

## 令牌格式（PD-78 口径）

- 出示串：`mc1.<nonce>.<hmac_sha256_hex(nonce)>`（全长 91 = 4+22+1+64）。
  - `nonce` = `randomBytes(16).toString('base64url')`（128bit 随机，22 字符）——不透明引用，串内**零明文载荷**（无 userId/plan，base64 逐段只解出随机字节）。
  - 签名 = HMAC-SHA256(nonce)，密钥 `MEMBER_CARD_SECRET` 环境变量覆盖（仓内仅内测缺省常量，纪律同 IMG_SECRET／BOOKING_CODE_SECRET）；**密钥未入前端**。
- 服务端表 `member_card_tokens`：`nonce PK → user_id / store_scope / exp / used / iat`（+全表统一 created_at/updated_at）。
- **TTL = 90s**（`MEMBER_CARD_TTL_SEC = 90`）；前端到期前 15s 链式续签 + 到期兜底重刷。
- 核销四闸：结构（`^mc1\.[A-Za-z0-9_-]{22}\.[0-9a-f]{64}$`）→ HMAC 常时间比对 → 表内 nonce（未用+未过期，**原子 UPDATE … SET used=1 WHERE used=0** 防重放）→ store_scope 归属（NULL=全店通用，非 NULL 须=核销店；范围外拒且不烧令牌）。
- 失败统一明文「会员码无效或已被使用，请客户重新出示」（扫码端不泄细节）；内部日志只记 `jti=nonce 前缀(8)` + 结果码（ok/replay/expired/bad_signature/bad_format/unknown_nonce/store_scope），不落明文令牌／userId 对。
- **旧明文码立即失效**：旧格式 `base64url(uid|plan|exp).sig` 不过结构闸即拒（含合法旧式签名的伪造件亦拒，运行期实证见 02）。
- 不做整段 API 加密（未扩）。

## 验收口径逐条点验

| # | 断言 | 证据 | 状态 |
|---|---|---|---|
| 1 | 抓包／DOM／base64 解码均无法得到 userId／plan | 02-runtime-probe.txt（真签发件逐段 base64url 解码=随机字节，含 userId?false／含 plan?false）；04-dom-served-code.md（伺服件 data-token=0、membercard-token 整串位=0、复制整串=0）；05（DOM 文本快照两帧无令牌串）＋ shots/001 | 已点验 |
| 2 | 过期令牌（>90s）核销 → 拒 | e2e 68.5「过期令牌（合法签名+表内 exp 已过）→ 400 统一拒」✓（07-e2e-full.txt L962）；运行期 06-expired-reject.txt（400 统一拒 + 日志 result=expired） | 已点验 |
| 3 | 他人令牌（另一账号／错店）→ 拒 | e2e 68.5「错店归属（store_scope≠核销店）→ 400 统一拒且令牌不烧」✓（07 L964）；归属=服务端表绑定 userId，客端无可改字段（02 签发/核销透出对照） | 已点验 |
| 4 | 同一令牌二次核销 → 拒（重放） | e2e 68.5 重放 ✓（07 L960）；运行期 02「验收4」400 统一拒 | 已点验 |
| 5 | 正常令牌核销链通 | e2e 68.5 签发+核验透出 ✓（07 L958）＋ 85.5 扫码闭环入单 ✓（07 L1221）；运行期 02「验收5」透出 userId/planKey/档名/active | 已点验 |
| 6 | 旧明文码立即失效 | e2e 68.5「合法旧式签名亦 400 统一拒」✓（07 L963）；运行期 02「验收6」400 统一拒 | 已点验 |
| 7 | 服务端日志 rg 无明文 token／userId 对 | 03-log-redaction.md（日志行仅 jti 前缀+结果码；完整 nonce/签名/mc1./双方 userId rg 计数全 0） | 已点验 |

## 前端面（AE-CLIENT-R4-01 回炉）

- `MemberCodeVisual.tsx`：QR img / 条码 svg 撤 `data-token`（DOM 属性面不再可抽完整令牌）。
- `MemberCardPage.tsx`：撤码下 sr-only 整串 span（`membercard-token`）与「复制码」整串复制钮（含 execCommand 回退路径）；码下只余码图形+「到店出示给店员扫描」。
- `useMemberCardToken.ts`：5min 固定轮询 → 以服务端透出 expiresAt 为准，到期前 15s 链式续签 + 到期兜底重刷（05 帧 B 实证倒计时跨 75s 不归零）。

## 测试

- server `tsc --noEmit`：本窗改动文件零错误（仅基线遗留 pd66EvidenceFixture.ts 12 错，PD-66 同源未动）。
- 全量 e2e（E2E_PORT=7418，07-e2e-full.txt）：**1046 ✓ / 4 ✗**——4 红皆基线遗留（57.1 槽位种子 live 计数／74.11 到期 cohort 日期钉／77.2 PD-72 自带 wnav.dockMe 文案钉／81.4 效期日期钉），与 PD-75 卷宗所记基线同四件，本窗零触其子系统。
- customer / merchant `npm run build`（tsc -b + vite build）：双绿。
- 迁移 0118 实落：dev 库 migrate 后 `member_card_tokens` 表结构 PRAGMA 实证（nonce PK / user_id NN / store_scope / exp NN / used NN / iat NN）。

## touched files

- server：`src/routers/membership.ts`（片 3 签发/核验重写）、`src/db/schema.ts`（memberCardTokens 表）、`drizzle/0118_member_card_token.sql`、`drizzle/meta/_journal.json`（idx 118）、`src/__tests__/e2e.ts`（68.5 族重写）
- apps/customer：`pages/MemberCardPage.tsx`、`components/member/useMemberCardToken.ts`、`components/member/MemberCodeVisual.tsx`
- 卷宗：本目录全件
- 未触：商家端 UI（ScanVerifyCard 零改动，失败统一口径直接吃 server 明文）、整段 API 加密（不扩）、其他迁移号。

## 自清记录

- dev server 7200 / vite 7118 均已停（端口复核无残留监听；7100/7101 为他窗进程未动）。
- dev 种子库已重置（migrate+seed 重跑：users=6／memberships=0／member_card_tokens=0，探针期产生的演示会员档与令牌行清零）。
- e2e 临时库首次清理 EBUSY（Windows libsql 句柄滞后，e2e 自带提示），已手工删 `C:\Users\lqb15\AppData\Local\Temp\philia-e2e-k3ZVzn`；施工 scratch（.runtime）已删。
- 本机 7102 端口曾有别窗员工端陈旧 Service Worker 残影致实证改道 7118（server CORS_ORIGINS 环境变量放行，未改代码）——记录备查。

## 禁令自查

不写验收通过／PR 只开不合／不合部不部署；签名密钥未入前端与新增仓库明文（rg 证据见交付回执）；无 JWT 明文 userId/plan；未碰夹具 01M5EQVFSQCFZYXB6FB945DSQB；未跨店造种（错店面用「不存在店 ID 直插令牌行」伪造件，未造门店种子）；钱全 mock；迁移实占 0118；测完自清。
