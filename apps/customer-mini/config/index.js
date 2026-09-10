/**
 * Philia 客户端小程序 · Taro 编译配置（批次 7.1 任务 A）
 *
 * - webpack5 编译器，prebundle 关闭（NutUI Taro 组件在预打包下易出运行时差异，稳妥起见关闭）
 * - weapp-tailwindcss：UnifiedWebpackPluginV5 同时挂 weapp / h5 两端 webpackChain，
 *   Tailwind 类名沿用三端口径，VI token 由 tailwind.config.js 引
 *   packages/config/tailwind-preset.js（相对路径 require，色值零改动）
 * - H5 dev 端口固定 7103（避开三端 7100-7102 与 server 7200）
 */
const { UnifiedWebpackPluginV5 } = require('weapp-tailwindcss/webpack');

/** weapp-tailwindcss 插件挂载（两端同参数；v4 导出名 UnifiedWebpackPluginV5） */
const attachWeappTailwind = (chain) => {
  chain.merge({
    plugin: {
      'weapp-tailwindcss': {
        plugin: UnifiedWebpackPluginV5,
        args: [{ appType: 'taro' }],
      },
    },
  });
};

const config = {
  projectName: 'philia-customer-mini',
  date: '2026-9-7',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  // 双产物分目录落盘（weapp → dist/weapp，h5 → dist/h5），互不覆盖便于并存验收
  outputRoot: process.env.TARO_ENV === 'h5' ? 'dist/h5' : 'dist/weapp',
  plugins: [],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {},
  },
  framework: 'react',
  compiler: {
    type: 'webpack5',
    prebundle: { enable: false },
  },
  cache: { enable: false },
  logger: { quiet: false, stats: true },
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: {
        enable: false,
        config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' },
      },
      tailwindcss: { enable: true, config: {} },
    },
    webpackChain: attachWeappTailwind,
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    devServer: { port: 7103, host: 'localhost' },
    output: {
      filename: 'js/[name].[hash:8].js',
      chunkFilename: 'js/[name].[chunkhash:8].js',
    },
    miniCssExtractPluginOption: {
      ignoreOrder: true,
      filename: 'css/[name].[hash].css',
      chunkFilename: 'css/[name].[chunkhash].css',
    },
    postcss: {
      autoprefixer: { enable: true, config: {} },
      pxtransform: { enable: true, config: {} },
      cssModules: {
        enable: false,
        config: { namingPattern: 'module', generateScopedName: '[name]__[local]___[hash:base64:5]' },
      },
      tailwindcss: { enable: true, config: {} },
    },
    webpackChain: attachWeappTailwind,
  },
};

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'));
  }
  return merge({}, config, require('./prod'));
};
