/**
 * knip 配置（闸门两件之一 · CJ-1008-06/任务-A窗-1008-闸门加两件）
 * 扫面=死代码/未用文件/未用导出/未用依赖；零基线建档（baselines/knip-baseline.json），
 * 之后增量必零新增（scripts/gate-knip.mjs 比对闸门）。
 * 覆盖：根（scripts/*）+apps/*+packages/*（npm workspaces）+server（非 workspace 直挂）。
 */
/** @type {import('knip').KnipConfig} */
module.exports = {
  workspaces: {
    '.': {
      entry: ['scripts/**/*.{js,mjs,mts}'],
      project: ['scripts/**/*.{js,mjs,mts}'],
    },
    'apps/*': {
      entry: ['src/main.tsx', 'src/vite-env.d.ts'],
      project: ['src/**/*.{ts,tsx}'],
    },
    'packages/*': {
      entry: ['src/index.ts'],
      project: ['src/**/*.{ts,tsx}'],
    },
    server: {
      entry: ['src/index.ts', 'src/db/migrate.ts', 'src/db/seed.ts', 'src/__tests__/e2e.ts'],
      project: ['src/**/*.ts'],
    },
  },
  ignore: ['**/dist/**', '**/dist-probe/**', '**/node_modules/**'],
  /* drizzle.config.ts 在 server 自带依赖链（drizzle-kit 不在根解析面）——插件探测关闭，配置件不入扫面 */
  drizzle: false,
  /* 既有口径白名单（非死代码，框架/工具链约定件）：
     vite PWA virtual 模块/环境类型声明/CSS 副作用引用/尾牙构建脚本内嵌 */
  ignoreDependencies: ['kimi-plugin-inspect-react'],
  ignoreExportsUsedInFile: true,
};
