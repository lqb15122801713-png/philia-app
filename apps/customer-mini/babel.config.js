// Taro 4 + React 18 编译预设（babel-preset-taro 为 Taro 4 官方包名）
module.exports = {
  presets: [
    [
      'taro',
      {
        framework: 'react',
        ts: true,
        compiler: 'webpack5',
      },
    ],
  ],
};
