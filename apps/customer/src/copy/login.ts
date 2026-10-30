import { withCopyOverrides } from '@philia/shared';

const LOGIN_COPY_TABLE = {
  'login.manifestoA': '守护每一次',
  'login.manifestoB': '被',
  'login.manifestoEm': '照顾',
  'login.manifestoC': '的时刻。',
  'login.tagline': 'PHILIA · 洗护 / 美容 / 寄养',
  'login.loading': '加载中…',
  'login.phoneTitle': '手机号登录 / 注册',
  'login.phoneBody': '输入手机号即登录；首次使用将自动注册（新客建档）。',
  'login.phoneLabel': '手机号',
  'login.phonePlaceholder': '11 位手机号',
  'login.gateLabel': '内测口令（code）',
  'login.gatePlaceholder': '内测环境必填',
  'login.submit': '手机号登录',
  'login.pending': '登录中…',
  'login.failed': '登录失败，请稍后重试',
  'login.footerAgree': '登录即同意',
  'login.footerUser': '《用户协议》',
  'login.footerAnd': '与',
  'login.footerPrivacy': '《隐私政策》',
} as const;

export const LOGIN_COPY = withCopyOverrides(LOGIN_COPY_TABLE);

export type LoginCopyKey = keyof typeof LOGIN_COPY;

export function lc(key: LoginCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = LOGIN_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
