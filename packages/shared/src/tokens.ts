/**
 * 菲丽亚宠物 Philia · 品牌设计 Token（批次 5 · B 阶段品牌换色 v1.1 冻结版）
 *
 * 本文件是三端 PWA（客户端 / 商家端 / 员工端）唯一的设计常量来源。
 * Tailwind preset（@philia/config/tailwind-preset）与本文件保持同名同值，
 * 改色先改这里，再同步 preset。
 *
 * 冻结凭据：B5-0 冻结确认书（2026-09-08 老板拍板）；
 * 终值表：docs/BRAND-TOKENS-v1.1.md（唯一改色通道凭据）。
 *
 * VI 色板：柠檬黄 #FDC830（主）/ 薄荷绿 #7FD8BE（辅）/ 浅木 #D4B896（空间色）/
 * 深棕墨 #4A3B2E（文字）/ 米白 #F6F1E3（底色）。珊瑚粉 #FFAAA5 已删，全域 0 命中。
 *
 * 推导规则（与冻结表一致）：交互态同 H 同 S，hover 明度 −6、pressed −13
 * （dark 域方向反转：hover +6 / pressed −6）；洗色 light 主色同 H、S−12、L=92，
 * 副色同 H、S−9、L=88，功能色同 H、S−7、L=92；加深 deep 副色同 H、S+2、L−8，
 * 功能色同 H 同 S、L−10；中性族 hue 对齐深棕墨 27.9°。
 *
 * 中文排版硬性规则：中文禁止使用 font-style: italic（机械伪斜体伤害可读性），
 * 强调请用字重 / 颜色 / 字号 / 字距；中文永远不落拉丁展示字体
 * （Poppins/Montserrat 只承载拉丁，中文落 Noto Sans SC）；字体自托管 woff2，禁外链 CDN。
 */

/* ------------------------------------------------------------------------ */
/* 颜色（light 域终值）                                                        */
/* ------------------------------------------------------------------------ */

export const colors = {
  brand: {
    /** 柠檬黄 · 主品牌色：主按钮、active 态、价格强调。锁定值（VI 主色）。 */
    primary: '#FDC830',
    /** 主按钮前景（on-primary）：深棕墨，对比度 6.89:1（WCAG AA 预核过线）。 */
    onPrimary: '#4A3B2E',
    /** 主色 hover：同 H 同 S，明度 −6。 */
    primaryHover: '#FDC012',
    /** 主色 pressed：同 H 同 S，明度 −13。 */
    primaryPressed: '#E8AD02',
    /** 主色浅底：选中态 / 标签底 / 轻强调区块（同 H、S−12、L=92）。 */
    primaryLight: '#FCF3D9',
    /** 薄荷绿 · 副品牌色：渐变副色、寄养/余量品牌场景点缀（不参与功能反馈）。锁定值（VI 辅色）。 */
    secondary: '#7FD8BE',
    /** 副色浅底（同 H、S−9、L=88）。 */
    secondaryLight: '#D3EEE6',
    /** 副色加深：渐变 hover 端点（同 H、S+2、L−8）。 */
    secondaryDeep: '#5ED1AF',
  },
  bg: {
    /** 米白 · 全局页面背景。锁定值（VI 底色）。 */
    canvas: '#F6F1E3',
    /** 卡片 / 浮层底色（保持纯白）。 */
    card: '#FFFFFF',
    /** 下沉区底色：输入区、凹陷分组底（米白同规则 S+3.4、L−3）。 */
    sunken: '#F3ECD6',
    /** 浅木 · 空间色：寄养/房间场景辅助底、暖色区块。锁定值（VI 空间色）。 */
    oak: '#D4B896',
    /** 浅木洗色（同 H、S−12、L=92）。 */
    oakLight: '#F1EBE5',
  },
  text: {
    /** 深棕墨 · 一切正文与标题。锁定值（VI 文字色）。 */
    primary: '#4A3B2E',
    /** 次级文字 / 说明文字（hue→27.9°，S/L 同档）。 */
    secondary: '#8A796B',
    /** 占位符 / 禁用文字（暖灰，hue 已对齐深棕墨）。 */
    placeholder: '#BDB2A8',
    /** 深底上的反白文字。 */
    inverse: '#FFFFFF',
  },
  border: {
    /** 默认暖色发丝边框（hue→27.9°）。 */
    default: '#EBE2DB',
    /** 强描边（hue→27.9°）。 */
    strong: '#DDD1C6',
    /** 更浅的分隔线（列表项 hairline，hue→27.9°）。 */
    divider: '#F0EAE5',
    /** U1-B 新增（v9.1 深度策略）：1px 暖墨细线 ring，替代投影做层级。 */
    ring: 'rgba(74, 59, 46, .09)',
  },
  /** 苔绿 · 成功 / 完成态。功能色原值保留（确认书第 1 条），不占品牌位。 */
  success: {
    base: '#7FA87C',
    light: '#E8EFE8',
    deep: '#649160',
  },
  /** 标准功能红 · 危险 / 错误态（确认书第 2 条，token 独立一行）。 */
  danger: {
    base: '#D92D20',
    /** 同 H、S−7、L=92。 */
    light: '#F8DFDD',
    /** 同 H 同 S、L−10。 */
    deep: '#AC2419',
  },
} as const;

/* ------------------------------------------------------------------------ */
/* dark 域终值（确认书第 3 条：批次 5 开启；映射子表见 docs/BRAND-TOKENS-v1.1.md §四） */
/* ------------------------------------------------------------------------ */

export const darkColors = {
  brand: {
    /** 品牌色原值保留（深色底上明度自足，对比度 10.53:1）。 */
    primary: '#FDC830',
    onPrimary: '#4A3B2E',
    /** hover 提亮 +6。 */
    primaryHover: '#FDD04E',
    /** pressed 压暗 −6。 */
    primaryPressed: '#FDC012',
    /** 深底洗色 L=20。 */
    primaryLight: '#5F4807',
    secondary: '#7FD8BE',
    /** 深底 L=24。 */
    secondaryLight: '#225848',
    secondaryDeep: '#5ED1AF',
  },
  bg: {
    /** 深棕墨同族压明度 L=12。 */
    canvas: '#261E17',
    /** L=17。 */
    card: '#352B21',
    /** L=9（凹陷更深）。 */
    sunken: '#1C1712',
    /** 浅木深色化。 */
    oak: '#6D502C',
    oakLight: '#352B21',
  },
  text: {
    /** 米白反相（dark/canvas 14.53:1）。 */
    primary: '#F6F1E3',
    /** L=68。 */
    secondary: '#B7ADA4',
    /** L=50。 */
    placeholder: '#8F7E70',
    /** 亮底上的深字。 */
    inverse: '#4A3B2E',
  },
  border: {
    /** L=26。 */
    default: '#504135',
    /** L=34。 */
    strong: '#685545',
    /** L=21。 */
    divider: '#40352B',
  },
  /** 功能色 +8 提亮 / 深底 / 浅字。 */
  success: {
    base: '#97B895',
    light: '#2D3A2C',
    deep: '#C1CEBF',
  },
  /** 功能色 +8 提亮 / 深底 / 浅字（dark canvas 上 4.15:1，G5 专项核对）。 */
  danger: {
    base: '#E34A3F',
    light: '#551511',
    deep: '#EEAEAA',
  },
} as const;

/* ------------------------------------------------------------------------ */
/* 渐变                                                                      */
/* ------------------------------------------------------------------------ */

export const gradients = {
  /** philia 主按钮渐变：135° 柠檬黄 → 薄荷绿。锁定值（dark 域同值）。 */
  philia: 'linear-gradient(135deg, #FDC830 0%, #7FD8BE 100%)',
  /** philia 渐变 hover：两端点各自派生档。 */
  philiaHover: 'linear-gradient(135deg, #FDC012 0%, #5ED1AF 100%)',
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
  /* U1-B 新增（v9.1 圆角四档：卡 20 / 控件 14 / 小签 6 / 全圆）；
     既有档保留供旧件，全圆档沿用 full；新件一律走 panel/control/chip/full */
  /** 卡（大卡/面板）。 */
  panel: '20px',
  /** 控件（按钮/输入/chips 容器）。 */
  control: '14px',
  /** 小签（角标/小标签）。 */
  chip: '6px',
} as const;

/* ------------------------------------------------------------------------ */
/* 投影（一律暖色系，禁止中性灰投影；dark 域 rgba 保留，深色底上自然弱化）          */
/* ------------------------------------------------------------------------ */

export const shadows = {
  /** 卡片静息投影：暖深棕 5% 透明度，轻贴底。 */
  card: '0 2px 10px rgba(61, 50, 41, 0.05)',
  /** 浮起态投影：弹层、hover 浮起卡片。 */
  elevated: '0 8px 24px rgba(61, 50, 41, 0.08)',
  /** philia 按钮投影：柠檬黄光晕（随主色）。锁定值。 */
  philia: '0 6px 16px rgba(253, 200, 48, 0.35)',
  /** 呼吸光环关键帧起止（配合 motion.halo，1.8s 循环；随主色）。锁定值。 */
  haloFrom: '0 0 0 0 rgba(253, 200, 48, 0.45)',
  haloTo: '0 0 0 14px rgba(253, 200, 48, 0)',
  /** U1-B 新增（v9.1 深度策略）：近零软影，与 border.ring 细线 ring 配套使用。 */
  hairline: '0 1px 2px rgba(61, 50, 41, 0.04)',
} as const;

/* ------------------------------------------------------------------------ */
/* 字体（自托管 woff2，禁外链 CDN；中文禁斜体、中文不落拉丁展示字体）              */
/* ------------------------------------------------------------------------ */

export const fontFamily = {
  /**
   * 全局字族：Poppins（拉丁正文）→ Noto Sans SC（中文）→ 系统栈兜底。
   * 中文禁斜体：需要强调时用 600 字重 / 品牌色 / 字号对比。
   */
  sans: 'Poppins, "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif',
  /**
   * 拉丁展示字体（标题）：Montserrat SemiBold → 中文永远落 Noto Sans SC Bold，
   * 不允许拉丁展示字体渲染中文标题。
   */
  display: 'Montserrat, "Noto Sans SC", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
  /**
   * 数字与价格字族：Montserrat → Noto Sans SC → 系统栈；
   * 搭配 numericStyle（tabular-nums）获得等宽感，金额、时间、编号一律使用。
   */
  number: 'Montserrat, "Noto Sans SC", "Helvetica Neue", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
  /**
   * U1-B 新增（v9.1）：中文展示位衬线链。woff2 产品侧随后入库，
   * 未入库时静默回退 Songti SC / 系统 serif，不报错；只用于中文展示位，不承载正文。
   */
  serifCn: '"Noto Serif SC", "Songti SC", serif',
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
  /* U1-B 新增（v9.1 字阶 11/12/14/17/20，详情页可 28/32）；
     12/17/20 已由 caption/title/titleLg 覆盖，此处补 11/14/28/32 四档 */
  /** 极小辅助字（dock 标签/角标）。 */
  captionXs: { size: '11px', lineHeight: '15px', weight: 400 },
  /** v9.1 正文档（15 既有档保留供旧件）。 */
  bodySm: { size: '14px', lineHeight: '20px', weight: 400 },
  /** 详情页大字一档。 */
  detail: { size: '28px', lineHeight: '36px', weight: 600 },
  /** 详情页大字二档。 */
  detailLg: { size: '32px', lineHeight: '40px', weight: 600 },
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
  '--brand-on-primary': colors.brand.onPrimary,
  '--brand-primary-hover': colors.brand.primaryHover,
  '--brand-primary-pressed': colors.brand.primaryPressed,
  '--brand-primary-light': colors.brand.primaryLight,
  '--brand-secondary': colors.brand.secondary,
  '--brand-secondary-light': colors.brand.secondaryLight,
  '--bg-canvas': colors.bg.canvas,
  '--bg-card': colors.bg.card,
  '--bg-sunken': colors.bg.sunken,
  '--bg-oak': colors.bg.oak,
  '--bg-oak-light': colors.bg.oakLight,
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
  /* U1-B 新增（v9.1 四档圆角 / 细线 ring / 近零影） */
  '--radius-panel': radius.panel,
  '--radius-control': radius.control,
  '--radius-chip': radius.chip,
  '--border-ring': colors.border.ring,
  '--shadow-hairline': shadows.hairline,
} as const;

/** 聚合导出，便于 `import { tokens } from '@philia/shared/tokens'`。 */
export const tokens = {
  colors,
  darkColors,
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
