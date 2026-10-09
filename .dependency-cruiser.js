/**
 * dependency-cruiser 配置（闸门两件之二 · CJ-1008-06/任务-A窗-1008-闸门加两件）
 *
 * 业务域结构写成规则（机器闸=可维护红线的结构面）：
 * - no-circular：循环依赖=抛错（全域）；
 * - 三端（apps/customer|merchant|staff）不引 server 内部、端与端不直引（共享走 packages/*）；
 * - packages/* 不上引 apps/server（下沉方向单向）；
 * - server 不引 apps/*；
 * - 既有违例=零（本配置入库即基线，新增违例=闸门红）。
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: '循环依赖=抛错（CJ-1008-01 可改性硬闸）',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'app-no-server-internals',
      comment: '三端不得引用 server 内部（客户端只走 API/共享包）',
      severity: 'error',
      from: { path: '^apps/[^/]+/src' },
      to: { path: '^server/' },
    },
    {
      name: 'app-no-cross-app',
      comment: '端与端不直引（跨端共享一律走 packages/*）',
      severity: 'error',
      from: { path: '^apps/([^/]+)/src' },
      to: { path: '^apps/(?!\\1/)' },
    },
    {
      name: 'package-no-upstream',
      comment: 'packages/* 不上引 apps/server（下沉方向单向）',
      severity: 'error',
      from: { path: '^packages/[^/]+/src' },
      to: { path: '^(apps|server)/' },
    },
    {
      name: 'server-no-apps',
      comment: 'server 不引 apps/*（服务端自含）',
      severity: 'error',
      from: { path: '^server/src' },
      to: { path: '^apps/' },
    },
  ],
  options: {
    includeOnly: '^(apps|packages|server)/src',
    doNotFollow: { path: 'node_modules' },
    /* @philia/shared 等 workspace 包 main/exports 直指 .ts 源——依赖里的 TS 也要预编译解析 */
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],
      mainFields: ['module', 'main'],
    },
  },
};
