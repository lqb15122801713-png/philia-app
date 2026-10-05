/**
 * 部署配置环境化（批次 6 · 任务 B：消灭硬编码）
 *
 * 收口的部署期环境变量（读取点统一在本文件，便于与 .env.example 逐行核对）：
 * - CORS_ORIGINS     跨域白名单（逗号分隔，含协议与端口，如
 *                    https://app.example.com,https://m.example.com）。
 *                    开发期（NODE_ENV≠production）未设置时保留三端 dev 端口缺省值
 *                    （DEV_ORIGINS，7100/7101/7102，含 localhost 与 127.0.0.1）；
 *                    production 必须显式配置，缺失即启动报错（不留硬编码白名单上生产）。
 * - PUBLIC_BASE_URL  公共 base URL（如 https://philia.example.com），对外手册/冒烟脚本/
 *                    反代对齐用；production 必须显式配置且为合法 http(s) URL。
 * - BETA_GATE_CODE   内测口令（批次 6 拍板 2：dev-login 口令门）。设置后
 *                    POST /api/auth/dev-login 与 GET /api/auth/dev-seed-users 均须携带
 *                    正确 code（body 或 query），错误 → 401/403（见 auth/devLogin.ts）。
 *                    production 未设置 → 启动报错（生产不留后门）；
 *                    NODE_ENV≠production 未设置 → 维持现状开放（本地开发不添堵）。
 *
 * 风格与 config/secrets.ts、payments/provider.ts 一致：生产缺关键变量 →
 * assertDeployConfig() 启动即抛错并一次性列出全部缺失项，绝不静默默认。
 * 由 src/index.ts 启动处调用（assertSecretsConfigured 之后、assertPaymentConfig 之前）。
 */

/** 开发期三端 dev 端口（客户/商家/员工），允许携带会话 cookie 跨域 */
export const DEV_ORIGINS = [
  'http://localhost:7100',
  'http://localhost:7101',
  'http://localhost:7102',
  // 批次 7.1：customer-mini H5 预览端口（Taro devServer / 静态预览），仅开发期缺省白名单
  'http://localhost:7103',
  'http://127.0.0.1:7100',
  'http://127.0.0.1:7101',
  'http://127.0.0.1:7102',
  'http://127.0.0.1:7103',
];

const isProduction = () => process.env.NODE_ENV === 'production';

/** 微信小程序 AppID（批次 7.1 任务 B；未设置返回 null，staging/dev 可空走 mock） */
export function getWechatMiniAppId(): string | null {
  const raw = process.env.WECHAT_MINI_APPID;
  return raw && raw.trim() ? raw.trim() : null;
}

/** 微信小程序 AppSecret（同上） */
export function getWechatMiniSecret(): string | null {
  const raw = process.env.WECHAT_MINI_SECRET;
  return raw && raw.trim() ? raw.trim() : null;
}

/**
 * 微信小程序登录 mock 旁路（批次 7.1 任务 B）：设置后 POST /api/auth/wechat-mini
 * 跳过 code2session 直接以该 openid 查/建用户（无真实 AppID 也能跑通链路）。
 * ⚠️ production 下该变量存在即拒绝启动（见 assertDeployConfig）。
 */
export function getWechatMiniMockOpenid(): string | null {
  const raw = process.env.WECHAT_MINI_MOCK_OPENID;
  return raw && raw.trim() ? raw.trim() : null;
}

/** 解析 CORS_ORIGINS：逗号分隔、去空白、去空项；未设置返回 null */
function parseCorsOrigins(): string[] | null {
  const raw = process.env.CORS_ORIGINS;
  if (!raw || !raw.trim()) return null;
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return origins.length > 0 ? origins : null;
}

/**
 * CORS 白名单（createApp 装配 cors 中间件时调用）：
 * - CORS_ORIGINS 已设置 → 用显式配置；
 * - 未设置且非生产 → 三端 dev 端口缺省值（本地开发不添堵）；
 * - 未设置且生产 → 抛错（与 assertDeployConfig 同口径，双保险：
 *   正常启动路径 assertDeployConfig 先拦截；此处兜底 createApp 被独立使用时也不漏）。
 */
export function getCorsOrigins(): string[] {
  const origins = parseCorsOrigins();
  if (origins) return origins;
  if (isProduction()) {
    throw new Error(
      '[deploy] 生产环境（NODE_ENV=production）未配置 CORS_ORIGINS（逗号分隔的跨域白名单），' +
        '拒绝装配 CORS 中间件：生产不允许沿用三端 dev 端口硬编码缺省值。',
    );
  }
  return DEV_ORIGINS;
}

/** 公共 base URL：未设置返回 null（开发期允许缺省） */
export function getPublicBaseUrl(): string | null {
  const raw = process.env.PUBLIC_BASE_URL;
  return raw && raw.trim() ? raw.trim() : null;
}

/** 内测口令：未设置返回 null（开发期开放；生产由 assertDeployConfig 强制） */
export function getBetaGateCode(): string | null {
  const raw = process.env.BETA_GATE_CODE;
  return raw && raw.trim() ? raw.trim() : null;
}

/**
 * 部署配置生产闸门。非生产环境直接通过；
 * 生产环境缺 CORS_ORIGINS / PUBLIC_BASE_URL / BETA_GATE_CODE 任一项 →
 * 抛出列出全部缺失项的 Error（同款风格见 assertSecretsConfigured）。
 */
export function assertDeployConfig(): void {
  if (!isProduction()) return;
  const problems: string[] = [];
  if (!parseCorsOrigins()) {
    problems.push(
      '  - CORS_ORIGINS（未设置）：跨域白名单，逗号分隔完整 origin（如 https://app.example.com,https://m.example.com）；生产不允许沿用 dev 端口缺省值',
    );
  }
  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) {
    problems.push(
      '  - PUBLIC_BASE_URL（未设置）：公共 base URL（如 https://philia.example.com），部署手册/冒烟脚本/反代对齐用',
    );
  } else if (!/^https?:\/\/.+/.test(baseUrl)) {
    problems.push(
      `  - PUBLIC_BASE_URL（取值非法："${baseUrl}"）：需为合法 http(s) URL`,
    );
  }
  if (!getBetaGateCode()) {
    problems.push(
      '  - BETA_GATE_CODE（未设置）：内测口令门（批次 6 拍板 2）——dev-login / dev-seed-users 凭口令放行；生产不得留无门槛后门',
    );
  }
  // 批次 7.1 任务 B：微信小程序登录生产闸门——mock 旁路变量存在即拒启动；AppID/Secret 必配
  if (getWechatMiniMockOpenid()) {
    problems.push(
      '  - WECHAT_MINI_MOCK_OPENID（已设置）：微信登录 mock 旁路仅供开发/内测，production 下该变量存在即拒绝启动——请移除该变量并配置真实 WECHAT_MINI_APPID/SECRET',
    );
  }
  if (!getWechatMiniAppId()) {
    problems.push(
      '  - WECHAT_MINI_APPID（未设置）：微信小程序 AppID，POST /api/auth/wechat-mini 走 code2session 必需',
    );
  }
  if (!getWechatMiniSecret()) {
    problems.push(
      '  - WECHAT_MINI_SECRET（未设置）：微信小程序 AppSecret，POST /api/auth/wechat-mini 走 code2session 必需',
    );
  }
  if (problems.length === 0) return;
  throw new Error(
    `[deploy] 生产环境（NODE_ENV=production）检测到 ${problems.length} 项部署配置缺失/非法，拒绝启动：\n` +
      `${problems.join('\n')}\n` +
      '请通过环境变量显式注入上述配置后重启（清单与注释见仓库 .env.example）。',
  );
}

/**
 * staging 内测缺配提醒（批次 6 产品侧裁定书 #1 ②）。
 * staging 是 VPS 内测的合法运行口径（MockPayProvider 放行，见 provider.ts），
 * 但 secrets/deploy 生产闸门均不触发——关键变量未显式注入时会静默沿用源码
 * dev 缺省值。启动时逐项 console.warn（不阻断），引导按 .env.example 补齐；
 * 变量一旦显式设置即生效（与 NODE_ENV 无关），补齐后提醒自然消失。
 */
export function warnStagingConfig(): void {
  if (process.env.NODE_ENV !== 'staging') return;
  /** dev 缺省值清单（与各使用点保持一致；改使用点缺省值时须同步） */
  const DEV_DEFAULTS: Record<string, string> = {
    SESSION_SECRET: 'philia-dev-secret',
    BOOKING_CODE_SECRET: 'philia-dev-booking-code-secret',
    IMG_SECRET: 'philia-dev-img-secret-do-not-use-in-prod',
    MOCK_PAY_SECRET: 'philia-dev-mock-pay-secret',
  };
  const problems: string[] = [];
  for (const [env, devDefault] of Object.entries(DEV_DEFAULTS)) {
    const v = process.env[env];
    if (!v?.trim()) problems.push(`  - ${env}（未设置，正沿用源码 dev 缺省密钥）`);
    else if (v === devDefault) problems.push(`  - ${env}（值等于源码 dev 缺省密钥）`);
  }
  if (!parseCorsOrigins()) problems.push('  - CORS_ORIGINS（未设置，正沿用三端 dev 端口缺省白名单）');
  if (!getPublicBaseUrl()) problems.push('  - PUBLIC_BASE_URL（未设置）');
  if (!getBetaGateCode()) problems.push('  - BETA_GATE_CODE（未设置，dev-login 无口令门——内测机等同后门）');
  // 批次 7.1：staging 可空走 mock，但 mock 旁路激活状态必须显式可见
  if (getWechatMiniMockOpenid()) {
    problems.push('  - WECHAT_MINI_MOCK_OPENID（已设置，wechat-mini 登录正走 mock 旁路——拿到真实 AppID/Secret 后应移除）');
  } else if (!getWechatMiniAppId() || !getWechatMiniSecret()) {
    problems.push('  - WECHAT_MINI_APPID/SECRET（未设置且未开 mock 旁路，wechat-mini 登录将 503）');
  }
  if (problems.length === 0) {
    console.log('[deploy] NODE_ENV=staging（内测口径）：关键配置均已显式注入 ✓');
    return;
  }
  console.warn(
    `[deploy] NODE_ENV=staging（内测口径）检测到 ${problems.length} 项配置未显式注入（不阻断启动，但内测机强烈建议补齐）：\n` +
      `${problems.join('\n')}\n` +
      '[deploy] 按 .env.example 逐项注入后重启即可消除本提醒。',
  );
}
