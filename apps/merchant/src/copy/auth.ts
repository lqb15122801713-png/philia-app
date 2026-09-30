/**
 * 登录域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：DevLoginPage（/login · /dev-login 同组件）。
 * 纪律：经营性文案（wordmark/屏题宣言/协议小字/内测环境明面说明）一律经本表取值，
 * 组件内零硬编码；文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名冻结不改。
 * 数值不进本表：会话有效期等口径数字随文本冻结（本页为内测登录闸，无端口数据源）。
 */

export const AUTH_COPY = {
  'auth.wordmark': 'PHILIA · 商家端',
  'auth.manifestoA': '店里的每一件小事，',
  'auth.manifestoB': '都值得被认真对待',
  'auth.subtitle': '菲丽亚宠物 · 门店经营后台（内测）',
  'auth.enterCta': '进入门店',
  'auth.agreement': '登录即同意《商家内测协议》· 遇到问题联系 philia 小助手',
  'auth.gateNotice': '内测环境需先在下方输入口令',
  'auth.seedEmpty': '未拉到店主种子用户，请重跑 server 的 db:seed，或手动输入 userId',
  'auth.devNote':
    '仅开发环境：dev-login 仅允许种子用户（kimi_id 以 seed_ 前缀），会话 cookie 有效期 7 天。 非商家账号登录后会被引导回本页切换。',
} as const;

export type AuthCopyKey = keyof typeof AUTH_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function au(key: AuthCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = AUTH_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
