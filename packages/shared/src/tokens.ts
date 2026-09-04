/**
 * 菲丽亚宠物 Philia · 品牌设计 Token（P0 / T0.2）
 *
 * 本文件是三端 PWA（客户端 / 商家端 / 员工端）唯一的设计常量来源。
 * Tailwind preset（@philia/config/tailwind-preset）与本文件保持同名同值，
 * 改色先改这里，再同步 preset。
 *
 * 基础色板为方案锁定值，不可推翻；衍生色按「同色相温度、同饱和度、
 * 仅明度阶梯变化」从锁定色推导（HSL 空间），保证整族色彩同温。
 *
 * 中文排版硬性规则：中文禁止使用 font-style: italic（机械伪斜体伤害可读性），
 * 强调请用字重 / 颜色 / 字号 / 字距；数字与价格使用等宽感字形
 * （font-variant-numeric: tabular-nums，见 numericStyle）。
 */

/* ------------------------------------------------------------------------ */
/* 颜色                                                                      */
/* ------------------------------------------------------------------------ */

export const colors = {
  brand: {
    /** 暖杏橘 · 主品牌色：主按钮、active 态、philia 按钮渐变主色。锁定值。 */
    primary: '#D98E5F',
    /** 主色 hover：HSL 同温同饱，明度 -6。 */
    primaryHover: '#D37D46',
    /** 主色 pressed：HSL 同温同饱，明度 -13。 */
    primaryPressed: '#C7692F',
    /** 主色浅底：选中态 / 标签底 / 轻强调区块（同温低饱和高明度洗色）。 */
    primaryLight: '#F5E9E1',
    /** 奶杏 · 副品牌色：渐变副色、标签底。锁定值。 */
    secondary: '#F2C9A4',
    /** 副色浅底：更轻的标签 / 卡片内部强调底。 */
    secondaryLight: '#F5E1CE',
    /** 副色加深：渐变 hover 端点、奶杏系描边强调。 */
    secondaryDeep: '#EEB47F',
  },
  bg: {
    /** 米白暖底 · 全局页面背景（不用纯白）。锁定值。 */
    canvas: '#FBF7F2',
    /** 卡片 / 浮层底色。锁定值。 */
    card: '#FFFFFF',
    /** 下沉区底色：输入区、凹陷分组底，比 canvas 再暖半度。 */
    sunken: '#F8F0E6',
  },
  text: {
    /** 暖深棕 · 正文主色（不用纯黑）。锁定值。 */
    primary: '#3D3229',
    /** 次级文字 / 说明文字。锁定值。 */
    secondary: '#8A7A6B',
    /** 占位符 / 禁用文字（暖灰，与文字族同温）。 */
    placeholder: '#BDB2A8',
    /** 深底上的反白文字。 */
    inverse: '#FFFFFF',
  },
  border: {
    /** 默认暖色发丝边框（卡片分割线、输入框描边）。 */
    default: '#EBE3DB',
    /** 强描边：锁定态节点描边、输入框 focus 前态。 */
    strong: '#DDD0C6',
    /** 更浅的分隔线（列表项 hairline）。 */
    divider: '#F0EBE5',
  },
  /** 苔绿 · 成功 / 完成态。锁定值，衍生 light/deep 同温。 */
  success: {
    base: '#7FA87C',
    light: '#E8EFE8',
    deep: '#649160',
  },
  /** 陶红 · 危险 / 错误态。锁定值，衍生 light/deep 同温。 */
  danger: {
    base: '#C96F5E',
    light: '#F3E4E1',
    deep: '#B7503D',
  },
} as const;

/* ------------------------------------------------------------------------ */
/* 渐变                                                                      */
/* ------------------------------------------------------------------------ */

export const gradients = {
  /** philia 主按钮渐变（中央凸起圆形按钮、主 CTA）。锁定值。 */
  philia: 'linear-gradient(135deg, #D98E5F 0%, #F2C9A4 100%)',
  /** philia 渐变 hover：副色端点加深一档，主色端用 hover 色。 */
  philiaHover: 'linear-gradient(135deg, #D37D46 0%, #EEB47F 100%)',
} as const;

/* ------------------------------------------------------------------------ */
/* 圆角                                                                      */
/* ------------------------------------------------------------------------ */

export const radius = {
  /** 小标签 / 缩略图 / 角标。 */
  tag: '8px',
  /** 输入框。锁定值。 */
  input: '12px',
  /** 卡片。锁定值。 */
  card: '16px',
  /** 底部动作面板 / 弹层大圆角。 */
  sheet: '20px',
  /** 按钮全圆角胶囊 / 圆形按钮。锁定值。 */
  full: '9999px',
} as const;

/* ------------------------------------------------------------------------ */
/* 投影（一律暖色系，禁止中性灰投影）                                          */
/* ------------------------------------------------------------------------ */

export const shadows = {
  /** 卡片静息投影：暖深棕 5% 透明度，轻贴底。 */
  card: '0 2px 10px rgba(61, 50, 41, 0.05)',
  /** 浮起态投影：弹层、hover 浮起卡片。 */
  elevated: '0 8px 24px rgba(61, 50, 41, 0.08)',
  /** philia 按钮投影：杏橘色光晕。锁定值。 */
  philia: '0 6px 16px rgba(214, 138, 90, 0.35)',
  /** 呼吸光环关键帧起止（配合 motion.halo，1.8s 循环）。锁定值。 */
  haloFrom: '0 0 0 0 rgba(217, 142, 95, 0.45)',
  haloTo: '0 0 0 14px rgba(217, 142, 95, 0)',
} as const;

/* ------------------------------------------------------------------------ */
/* 字体                                                                      */
/* ------------------------------------------------------------------------ */

export const fontFamily = {
  /**
   * 全局字族：系统栈，必须能渲染中文，禁止引入需要翻墙的字体 CDN。
   * 中文禁斜体：需要强调时用 600 字重 / 品牌色 / 字号对比。
   */
  sans: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif',
  /**
   * 可选拉丁展示字体槽位（品牌海报 / 大标题英文装饰用）。
   * 引入授权字体后把字族名前置即可，例如：
   * '"Fraunces", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'。
   * 中文永远落回 PingFang / 雅黑，不允许拉丁展示字体渲染中文标题。
   */
  display: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif',
  /**
   * 数字与价格字族：搭配 numericStyle（tabular-nums）获得等宽感，
   * 金额、时间、编号一律使用，保证纵向对齐。
   */
  number: '"Helvetica Neue", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
} as const;

/** 数字等宽感样式：价格 / 倒计时 / 编号元素必须带上。 */
export const numericStyle = {
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
} as const;

export const fontSize = {
  /** 页面主标题（一档标题）。锁定值 20px。 */
  titleLg: { size: '20px', lineHeight: '28px', weight: 600 },
  /** 卡片 / 区块标题（二档标题）。锁定值 17px。 */
  title: { size: '17px', lineHeight: '24px', weight: 600 },
  /** 正文。锁定值 15px。 */
  body: { size: '15px', lineHeight: '22px', weight: 400 },
  /** 辅助说明 / 时间戳 / 标签。锁定值 12px。 */
  caption: { size: '12px', lineHeight: '16px', weight: 400 },
  /** 员工端执行界面正文加大档（≥16px 硬性要求）。 */
  bodyLg: { size: '16px', lineHeight: '24px', weight: 400 },
  /** 价格大字：配合 fontFamily.number + numericStyle。 */
  price: { size: '20px', lineHeight: '28px', weight: 600 },
} as const;

/* ------------------------------------------------------------------------ */
/* 层级                                                                      */
/* ------------------------------------------------------------------------ */

export const zIndex = {
  base: 0,
  /** 吸顶区块（列表吸顶分类条）。 */
  sticky: 10,
  /** 底部 TabBar（含 ConvexTabBar 凸起按钮）。 */
  tabBar: 50,
  /** 遮罩层。 */
  overlay: 100,
  /** 模态 / 动作面板。 */
  modal: 200,
  /** 全局提示 Toast。 */
  toast: 300,
} as const;

/* ------------------------------------------------------------------------ */
/* 动效                                                                      */
/* ------------------------------------------------------------------------ */

export const motion = {
  duration: {
    /** Tab 按下反馈时长。锁定值 120ms。 */
    tabPress: 120,
    /** 常规 hover / 颜色过渡。 */
    fast: 160,
    /** 常规组件过渡。 */
    normal: 200,
    /** philia 页面转场时长。锁定值 300ms。 */
    page: 300,
    /** philia 按钮呼吸光环周期。锁定值 1.8s。 */
    halo: 1800,
  },
  easing: {
    /** 标准缓出（页转场、元素入场）：philial 页转场锁定 ease-out。 */
    easeOut: 'cubic-bezier(0.33, 1, 0.68, 1)',
    /** 对称缓动（透明度、高度变化）。 */
    easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    /** 轻回弹（按钮按下回弹、徽章弹出），幅度克制不夸张。 */
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  /** Tab 按下反馈：scale 0.92 / 120ms。锁定值。 */
  tabPress: { scale: 0.92, duration: 120 },
  /** philia 页面转场：300ms ease-out。锁定值。 */
  pageTransition: { duration: 300, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' },
  /** philia 按钮呼吸光环：1.8s 无限循环，阴影从 haloFrom 扩散到 haloTo。 */
  halo: { duration: 1800, iterationCount: 'infinite' },
} as const;

/* ------------------------------------------------------------------------ */
/* 组件级尺寸                                                                */
/* ------------------------------------------------------------------------ */

export const componentSize = {
  /** philia 中央凸起按钮直径。锁定值 64px。 */
  philiaButton: '64px',
  /** 员工端执行按钮最小高度（≥56px 硬性要求）。 */
  staffButtonMin: '56px',
  /** 底部 TabBar 高度（不含凸起）。 */
  tabBarHeight: '56px',
} as const;

/* ------------------------------------------------------------------------ */
/* CSS 变量映射（运行时主题 / 内联样式备用）                                    */
/* ------------------------------------------------------------------------ */

export const cssVars = {
  '--brand-primary': colors.brand.primary,
  '--brand-primary-hover': colors.brand.primaryHover,
  '--brand-primary-pressed': colors.brand.primaryPressed,
  '--brand-primary-light': colors.brand.primaryLight,
  '--brand-secondary': colors.brand.secondary,
  '--brand-secondary-light': colors.brand.secondaryLight,
  '--bg-canvas': colors.bg.canvas,
  '--bg-card': colors.bg.card,
  '--bg-sunken': colors.bg.sunken,
  '--text-primary': colors.text.primary,
  '--text-secondary': colors.text.secondary,
  '--text-placeholder': colors.text.placeholder,
  '--border-default': colors.border.default,
  '--success': colors.success.base,
  '--danger': colors.danger.base,
  '--gradient-philia': gradients.philia,
  '--radius-card': radius.card,
  '--radius-input': radius.input,
  '--radius-full': radius.full,
  '--shadow-card': shadows.card,
  '--shadow-philia': shadows.philia,
} as const;

/** 聚合导出，便于 `import { tokens } from '@philia/shared/tokens'`。 */
export const tokens = {
  colors,
  gradients,
  radius,
  shadows,
  fontFamily,
  fontSize,
  numericStyle,
  zIndex,
  motion,
  componentSize,
  cssVars,
} as const;

export type Tokens = typeof tokens;
