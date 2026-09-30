/**
 * 开发登录页（devlogin）域文案键表（copy key 一期硬约定 · 纪律同 components/member/copy.ts）
 *
 * 覆盖：DevLoginPage /dev-login（L-01 宣言档之外的页面文案——宣言三段已入
 * components/member/copy.ts 的 l1.* 键，本表不重复收录）。
 * 文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，键名小写点分、冻结不改。
 *
 * 数值不进本表：错误详情等到渲染层插值（{var} 模板）。
 */

export const DEVLOGIN_COPY = {
  'devlogin.tagline': 'PHILIA · 洗护 / 美容 / 寄养',
  'devlogin.primaryCta': '手机号一键登录',
  'devlogin.gateLink': '口令入内测 ›',
  /* 口令门卡 */
  'devlogin.gateTitle': '内测环境需要口令',
  'devlogin.gateBody': '请输入内测口令后加载可登录账号；无口令或口令错误将无法登录。',
  'devlogin.gateHint': '口令通过后在上方选择账号一键登录。',
  /* D-16 手机号自助开户卡 */
  'devlogin.phoneTitle': '手机号登录 / 注册',
  'devlogin.phoneBody': '输入手机号即登录；首次使用将自动注册（新客建档）。',
  /* 种子账号区 */
  'devlogin.seedTitle': '选择种子用户登录',
  'devlogin.devOnly': '仅开发环境 · 生产环境请移除',
  'devlogin.seedFail': '种子用户拉取失败（网络连接失败：{error}）——请检查网络或确认 server 已启动；若是口令问题请用上方口令门',
  'devlogin.seedEmpty': '未拉到种子用户，请重跑 server 的 db:seed，或手动输入 userId',
  /* 手动输入区 */
  'devlogin.manualTitle': '手动输入 userId',
  'devlogin.manualBody': '重跑 server 的 db:seed 后用户 ID 会变化，可在 server 库中查 users 表后粘贴到这里。',
  'devlogin.seedNote': '提示：种子用户一键登录 + 口令门内手机号自助开户（D-16：新号自动注册 customer）； 会话 cookie 有效期 7 天。',
  /* 底部协议小字 */
  'devlogin.footerA': '登录即同意《用户协议》与《隐私政策》',
  'devlogin.footerB': '内测期间口令由门店发放',
} as const;

export type DevloginCopyKey = keyof typeof DEVLOGIN_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function dc(key: DevloginCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = DEVLOGIN_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
