-- PD-78 客端码／令牌安全（0118，本窗实占；令牌表必占）：
--   会员码从「base64 明文 uid|plan|exp + HMAC」伪 JWT 改为不透明引用令牌——
--   出示串=mc1.<nonce>.<hmac_sha256(nonce)>，userId/适用店/时效/已用全部落服务端本表；
--   核销=验 HMAC + exp + 原子置 used（防重放）+ store_scope 归属校验，失败统一拒。
-- 幂等：CREATE TABLE/INDEX IF NOT EXISTS 一次性，重放零副作用。
CREATE TABLE IF NOT EXISTS `member_card_tokens` (
  `nonce` text PRIMARY KEY,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `store_scope` text,
  `exp` integer NOT NULL,
  `used` integer DEFAULT 0 NOT NULL,
  `iat` integer NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_member_card_tokens_user` ON `member_card_tokens` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_member_card_tokens_exp` ON `member_card_tokens` (`exp`);
