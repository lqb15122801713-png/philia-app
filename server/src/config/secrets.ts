/**
 * 生产环境密钥闸门（v1.1 批次1 · P0-1）
 *
 * 背景：三处 HMAC 密钥在代码里带硬编码 dev 缺省值（仅供本地开发/冒烟）：
 * - SESSION_SECRET       会话 cookie 签名（auth/session.ts，缺省 'philia-dev-secret'）
 * - BOOKING_CODE_SECRET  核销二维码签名（routers/appointment.ts，缺省 'philia-dev-booking-code-secret'）
 * - IMG_SECRET           签名图片 URL（storage/sign.ts，缺省 'philia-dev-img-secret-do-not-use-in-prod'）
 *
 * 红线：生产构建（NODE_ENV=production）任一项未注入环境变量、或值仍等于 dev
 * 缺省值 → assertSecretsConfigured() 启动即抛错并一次性列出全部缺失项，
 * 绝不带公开缺省密钥上生产（缺省密钥即在源码中，全站凭据/二维码/图片签名可伪造）。
 *
 * 由 src/index.ts 启动处调用（与 assertPaymentConfig 同位置，且先于它执行，
 * 保证报错文案首先暴露密钥缺失而非支付配置）。
 * 开发/测试模式（无 NODE_ENV=production）直接放行，dev 缺省值合法。
 */

interface SecretRule {
  /** 环境变量名 */
  env: string;
  /** 该密钥在使用点的硬编码 dev 缺省值（改使用点缺省值时须同步本表） */
  devDefault: string;
  /** 用途说明（报错文案用） */
  usage: string;
}

const SECRET_RULES: SecretRule[] = [
  {
    env: 'SESSION_SECRET',
    devDefault: 'philia-dev-secret',
    usage: '会话 cookie HMAC 签名（auth/session.ts）',
  },
  {
    env: 'BOOKING_CODE_SECRET',
    devDefault: 'philia-dev-booking-code-secret',
    usage: '核销二维码 HMAC 签名（routers/appointment.ts getCode/verifyCode）',
  },
  {
    env: 'IMG_SECRET',
    devDefault: 'philia-dev-img-secret-do-not-use-in-prod',
    usage: '签名图片 URL HMAC（storage/sign.ts）',
  },
];

/** 各密钥当前问题：'unset' 未设置 / 'dev-default' 仍为 dev 缺省值 / null 正常 */
function secretProblem(rule: SecretRule): 'unset' | 'dev-default' | null {
  const value = process.env[rule.env];
  if (!value || !value.trim()) return 'unset';
  if (value === rule.devDefault) return 'dev-default';
  return null;
}

/**
 * 生产密钥闸门。非生产环境直接通过；
 * 生产环境下任一密钥缺失/仍为 dev 缺省值 → 抛出列出全部缺失项的 Error。
 */
export function assertSecretsConfigured(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const problems = SECRET_RULES.map((rule) => ({ rule, problem: secretProblem(rule) })).filter(
    (r) => r.problem !== null,
  );
  if (problems.length === 0) return;
  const lines = problems.map(
    ({ rule, problem }) =>
      `  - ${rule.env}（${problem === 'unset' ? '未设置' : '仍为 dev 缺省值'}）：${rule.usage}`,
  );
  throw new Error(
    `[secrets] 生产环境（NODE_ENV=production）检测到 ${problems.length} 个密钥未正确配置，拒绝启动：\n` +
      `${lines.join('\n')}\n` +
      '请通过环境变量注入强随机密钥（三者均不得使用源码内置 dev 缺省值）后重启。',
  );
}
