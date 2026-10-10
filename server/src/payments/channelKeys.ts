/**
 * 支付通道配置键与凭据形状（产品-1010 片 1）——叶子件（零 import），供
 * provider.ts（解析）/ routers/payChannel.ts（端口）/ routers/configRules.ts（掩码+拒口）三方共引，
 * 不反向依赖任何一件（防循环）。
 */

/** pay_rules 键：切换闸端口参数 {provider: PayChannel}（轻量无密；全局单份 storeId=NULL） */
export const PAY_CHANNEL_PROVIDER_RULE_KEY = 'pay_channel_provider';

/** pay_rules 键：通道凭据高危件（真值只存 active 行 server-only；任何读口/留痕全掩码） */
export const PAY_CHANNEL_CREDENTIALS_RULE_KEY = 'pay_channel_credentials';

/** 通道凭据形状（微信四件 ⇄ WECHAT_* 既有四件；支付宝三件 ⇄ ALIPAY_* 既有三件） */
export interface PayChannelCredentials {
  wechat?: { appid?: string; mchid?: string; serial?: string; apiV3Key?: string };
  alipay?: { appid?: string; privateKey?: string; publicKey?: string };
}

/** 密钥掩码（永不明文回显统一口径）：有值=****+末 4 位；未配置/空=null */
export function maskSecretLast4(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s ? `****${s.slice(-4)}` : null;
}

/** 凭据掩码镜像形状（端口 get / config.list / versions 留痕共用） */
export interface PayChannelCredentialsMasked {
  wechat: { appid: string | null; mchid: string | null; serial: string | null; apiV3Key: string | null } | null;
  alipay: { appid: string | null; privateKey: string | null; publicKey: string | null } | null;
}

/** 凭据→掩码镜像（真值不出 server；null=该通道未配置） */
export function maskPayChannelCredentials(c: PayChannelCredentials | null | undefined): PayChannelCredentialsMasked {
  return {
    wechat: c?.wechat
      ? {
          appid: maskSecretLast4(c.wechat.appid),
          mchid: maskSecretLast4(c.wechat.mchid),
          serial: maskSecretLast4(c.wechat.serial),
          apiV3Key: maskSecretLast4(c.wechat.apiV3Key),
        }
      : null,
    alipay: c?.alipay
      ? {
          appid: maskSecretLast4(c.alipay.appid),
          privateKey: maskSecretLast4(c.alipay.privateKey),
          publicKey: maskSecretLast4(c.alipay.publicKey),
        }
      : null,
  };
}
