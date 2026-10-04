/**
 * 菲丽亚宠物 Philia · 品牌设计 Token（换皮批片 1 · v2.0 色纪律落地）
 *
 * 本文件是三端 PWA（客户端 / 商家端 / 员工端）唯一的设计常量来源。
 * Tailwind preset（@philia/config/tailwind-preset）与本文件保持同名同值，
 * 改色先改这里，再同步 preset。
 *
 * 冻结凭据（换代）：34 号档《设计规范 v2.0》§一 token 全表 + CJ-0928-01（PD-11
 * 会签）+ PD-13 施工令。B5-0 v1.1 色板（柠檬黄主色时代）已退役——
 * docs/BRAND-TOKENS-v1.1.md 转历史档案。
 *
 * VI 色纪律（v2.0 §1.1）：纸白底 #FAF8F2 / 深棕墨 #3B2E24 主体 / 淡黄 #F2DFA6
 * 点睛（每屏 ≤2 处）/ 卡其 #B9A482 次阶；白卡 #FFFFFF 仅作卡片面（唯一的白）；
 * 禁用色（柠檬黄/暖阳橙/深绿/纯黑纯白底，值表见 34 号档 §1.5）一律禁入码（grep 级红线）。
 *
 * 反馈件色纪律（45 号档 P1-1 改进方向②，产品侧补钉）：成功/正常不设绿色——
 * success 族=深棕墨族（✓+墨色呈现）；异常/扣减/红字=暖调赭红 #B4502E（禁纯红）。
 *
 * 中文排版硬性规则：中文禁止使用 font-style: italic（机械伪斜体伤害可读性），
 * 强调请用字重 / 颜色 / 字号 / 字距；中文永远不落拉丁展示字体；
 * 字体自托管 woff2，禁外链 CDN。三轨字阶：屏题=serif（Noto Serif SC）/
 * 正文=sans（系统栈）/ 数字金额时间=mono（JetBrains Mono）——三轨不串（§二）。
 */

/* ------------------------------------------------------------------------ */
/* 颜色（light 域终值）                                                        */
/* ------------------------------------------------------------------------ */

export const colors = {
  brand: {
    /** 淡黄 · 点睛色：选中态/角标/激活位/进度点（每屏 ≤2 处，铁律）。v2.0 §1.1 --gold。 */
    primary: '#F2DFA6',
    /** 点睛位前景（on-gold）：深棕墨（淡黄底上正文对比 ≥4.5:1）。 */
    onPrimary: '#3B2E24',
    /** 点睛 hover：深一档淡金（v2.0 §1.1 --gold-deep 同族）。 */
    primaryHover: '#E8CF8C',
    /** 点睛 pressed：蜡封淡金（--t3-metal）。 */
    primaryPressed: '#D9C08A',
    /** 点睛浅底：提示卡暖底（v2.0 §1.4）。 */
    primaryLight: '#FBF5E4',
    /** 卡其 · 次阶：分隔/次要标签（不作大面填充）。v2.0 §1.1 --khaki（薄荷绿已退役）。 */
    secondary: '#B9A482',
    /** 次阶浅底：分段开关底（v2.0 §1.4）。 */
    secondaryLight: '#F1E9D6',
    /** 次阶加深：卡其铜深端（--t2 同族）。 */
    secondaryDeep: '#A08B62',
  },
  bg: {
    /** 纸白 · 全局页面背景（唯一页面底色，不用纯白）。v2.0 §1.1 --paper。 */
    canvas: '#FAF8F2',
    /** 白卡面（主卡=白卡+墨描边；只作卡片面，不作页面底）。v2.0 §1.1 --card。 */
    card: '#FFFFFF',
    /** 下沉区底色：输入区/圆章/头像底（v2.0 §1.4 圆章底）。 */
    sunken: '#F4EDDC',
    /** 卡其 · 空间色（次阶辅助底，不大面填充）。 */
    oak: '#B9A482',
    /** 卡其洗色（回馈金环轨道同族，§1.4）。 */
    oakLight: '#EDE4CE',
  },
  text: {
    /** 深棕墨 · 一切正文与标题。v2.0 §1.1 --ink。 */
    primary: '#3B2E24',
    /** 次要文字（暖灰同温，正文对比 ≥4.5:1）。v2.0 §1.1 --muted。 */
    secondary: '#8A7D6B',
    /** 占位符 / 禁用文字（暖灰，hue 对齐深棕墨）。 */
    placeholder: '#B9A98F',
    /** 深底上的反白文字。 */
    inverse: '#FFFFFF',
  },
  border: {
    /** 发丝线（卡边/分隔，半透明染色，禁硬实色线）。v2.0 §1.1 --line。 */
    default: 'rgba(59,46,36,.14)',
    /** 强描边（染色加深档）。 */
    strong: 'rgba(59,46,36,.22)',
    /** 更软发丝线（行内分隔）。v2.0 §1.1 --line-soft。 */
    divider: 'rgba(59,46,36,.08)',
    /** 1px 暖墨细线 ring，替代投影做层级。 */
    ring: 'rgba(59,46,36,.09)',
  },
  /** 成功/正常 · 反馈件色纪律：不设绿色——深棕墨族（✓+墨色呈现，45 号档 P1-1②）。 */
  success: {
    base: '#3B2E24',
    light: '#F1E9D6',
    deep: '#2E2318',
  },
  /** 异常/扣减/红字 · 暖调赭红（v2.0 §1.4，禁纯红）。 */
  danger: {
    base: '#B4502E',
    light: '#F6E3DA',
    deep: '#8F3F22',
  },
} as const;

/* ------------------------------------------------------------------------ */
/* dark 域终值（确认书第 3 条：批次 5 开启；映射子表见 docs/BRAND-TOKENS-v1.1.md §四） */
/* ------------------------------------------------------------------------ */

export const darkColors = {
  brand: {
    /** 淡黄点睛（深底上明度自足）。 */
    primary: '#F2DFA6',
    onPrimary: '#3B2E24',
    /** hover 提亮（淡金）。 */
    primaryHover: '#F6E7BE',
    /** pressed 压暗（深一档淡金）。 */
    primaryPressed: '#E8CF8C',
    /** 深底洗色。 */
    primaryLight: '#3A2F1E',
    secondary: '#B9A482',
    /** 深底次阶洗色。 */
    secondaryLight: '#3A3227',
    secondaryDeep: '#A08B62',
  },
  bg: {
    /** 深棕墨同族压明度 L=12。 */
    canvas: '#261E17',
    /** L=17。 */
    card: '#352B21',
    /** L=9（凹陷更深）。 */
    sunken: '#1C1712',
    /** 卡其深色化。 */
    oak: '#6D5B43',
    oakLight: '#352B21',
  },
  text: {
    /** 米白反相。 */
    primary: '#F6EFDD',
    /** 深底次文字（v2.0 §1.2）。 */
    secondary: '#C9BBA0',
    /** 深底弱提示（v2.0 §1.2）。 */
    placeholder: '#B9A98F',
    /** 亮底上的深字。 */
    inverse: '#3B2E24',
  },
  border: {
    /** 金线族（v2.0 §1.2 深底分隔线）。 */
    default: 'rgba(217,192,138,.22)',
    strong: 'rgba(217,192,138,.38)',
    divider: 'rgba(217,192,138,.14)',
  },
  /** 成功/正常（深底）：不设绿色——淡金墨族。 */
  success: {
    base: '#C9BBA0',
    light: '#2D2A24',
    deep: '#F1E9D6',
  },
  /** 赭红（深底提亮）。 */
  danger: {
    base: '#D4744F',
    light: '#40251B',
    deep: '#E8A58C',
  },
} as const;

/* ------------------------------------------------------------------------ */
/* 渐变                                                                      */
/* ------------------------------------------------------------------------ */

export const gradients = {
  /** philia 主行动渐变：135° 深棕谱系（身份带 §1.2；柠檬黄→薄荷绿渐变已退役，
   *  渐变按钮=反廉价黑名单件的合规形态=深棕渐变）。 */
  philia: 'linear-gradient(135deg, #3B2E24 0%, #2E2318 100%)',
  /** philia 渐变 hover：同谱系微提亮。 */
  philiaHover: 'linear-gradient(135deg, #46382A 0%, #332A1E 100%)',
  /** BANNER 占位淡金渐变：165°（home-v2 .hv2-banner 同帧；槽位占位块共用——
   *  端口批片 C 顺带件①：字面量收编唯一来源，三端引用不另写）。 */
  philiaBanner: 'linear-gradient(165deg, #EFDCAB 0%, #EBD398 52%, #F2E7CB 100%)',
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
  /** philia 按钮投影：染色阴影（禁纯黑；v2.0 §3.3 小件影族）。 */
  philia: '0 6px 16px rgba(46, 35, 24, 0.18)',
  /** 呼吸光环关键帧起止（配合 motion.halo，1.8s 循环；染色深棕）。 */
  haloFrom: '0 0 0 0 rgba(59, 46, 36, 0.28)',
  haloTo: '0 0 0 14px rgba(59, 46, 36, 0)',
  /** 近零软影，与 border.ring 细线 ring 配套使用。 */
  hairline: '0 1px 2px rgba(61, 50, 41, 0.04)',
} as const;

/* ------------------------------------------------------------------------ */
/* 字体（自托管 woff2，禁外链 CDN；中文禁斜体、中文不落拉丁展示字体）              */
/* ------------------------------------------------------------------------ */

export const fontFamily = {
  /**
   * 无衬线轨（系统栈）：正文、列表、按钮、UI 默认（v2.0 §二——干净执行）。
   * 中文禁斜体：需要强调时用 600 字重 / 品牌色 / 字号对比。
   */
  sans: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Noto Sans SC", "Helvetica Neue", Helvetica, Arial, sans-serif',
  /**
   * 衬线轨（展示位）：宣言、屏级大题、卡面档名、证书题——编辑感（杂志封面，不是工具）。
   * 中文永远落 Noto Serif SC / Songti SC，拉丁同轨承载。
   */
  display: '"Noto Serif SC", "Songti SC", "SimSun", serif',
  /**
   * 等宽轨：编号、金额、时间、溯源行、eyebrow 标签、规则明面——档案感。
   * 搭配 numericStyle（tabular-nums）使用。
   */
  number: '"JetBrains Mono", "SF Mono", "Noto Sans SC", monospace',
  /**
   * 中文展示位衬线链（同 display 轨，历史键名保留）。
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
  /* ---- v2.0 §2.1 字阶梯（换皮批片 1 落 token；业务组件换引用归片 2-4） ---- */
  /** 宣言（L-01 登录宣言，serif 900，line-height 1.5）。 */
  v2Manifesto: { size: '34px', lineHeight: '51px', weight: 900 },
  /** 屏题（apphead 商城/我的/会员页头，serif 900）。 */
  v2Screen: { size: '27px', lineHeight: '36px', weight: 900 },
  /** 卡题（证书题 26/卡面档名 25-26，serif 900）。 */
  v2CardTitle: { size: '26px', lineHeight: '34px', weight: 900 },
  /** 题（日报题 22/空态题 21/美容师名 20）。 */
  v2Topic: { size: '20px', lineHeight: '28px', weight: 800 },
  /** 大数字（账本余额 24，mono 700，letter-spacing -.02em）。 */
  v2BigNum: { size: '24px', lineHeight: '32px', weight: 700 },
  /** 截面题（sec-h 16 sans 800；弹层题 17 serif 900 另列）。 */
  v2Section: { size: '16px', lineHeight: '22px', weight: 800 },
  /** 列表题（13-13.5）。 */
  v2ListTitle: { size: '13.5px', lineHeight: '19px', weight: 700 },
  /** 小签（权益名 11/更改链 11.5/mono 辅助 10.5）。 */
  v2Note: { size: '11px', lineHeight: '15px', weight: 400 },
  /** 溯源行（mono 9-9.5，letter-spacing .02-.2em）。 */
  v2Trace: { size: '9.5px', lineHeight: '13px', weight: 400 },
  /** 微印（卡面槽位注 8/环心副签 7.5——最小 7.5 封底，再小禁用）。 */
  v2Micro: { size: '8px', lineHeight: '11px', weight: 400 },
} as const;

/* ------------------------------------------------------------------------ */
/* 层级                                                                      */
/* ------------------------------------------------------------------------ */

export const zIndex = {
  base: 0,
  /** 吸顶区块（列表吸顶分类条）。 */
  sticky: 10,
  /** 底部 dock（U1-A 起为客户端 AppDock 悬浮 pill）。 */
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
