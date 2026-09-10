/**
 * 小程序全局配置（批次 7.1 任务 A）
 * - TabBar：标准 4 栏（首页/预约/商城/我的）。现有 PWA 客户端为五栏凸起
 *   （左2 + philia 凸起 + 右2），小程序无凸起按钮 → 按任务书先实现 4 栏占位，
 *   简化方案差异已列存疑清单报产品侧。
 * - 色值全部取自 VI v1.1 token（tailwind-preset 同值）：canvas #F6F1E3 /
 *   ink #4A3B2E / ink-secondary #8A796B / card #FFFFFF / brand-primary-pressed #E8AD02
 */
export default {
  pages: [
    'pages/home/index',
    'pages/booking/index',
    'pages/mall/index',
    'pages/me/index',
    'pages/login/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#F6F1E3',
    navigationBarTitleText: '菲丽亚宠物 Philia',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F6F1E3',
  },
  tabBar: {
    color: '#8A796B',
    selectedColor: '#E8AD02',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/home/index', text: '首页' },
      { pagePath: 'pages/booking/index', text: '预约' },
      { pagePath: 'pages/mall/index', text: '商城' },
      { pagePath: 'pages/me/index', text: '我的' },
    ],
  },
};
