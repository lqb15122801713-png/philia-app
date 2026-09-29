/**
 * 菲丽亚宠物 Philia · Tailwind preset（换皮批片 1 · v2.0 色纪律落地）
 *
 * 各端 app 的 tailwind.config 引用方式：
 *   module.exports = {
 *     presets: [require('@philia/config/tailwind-preset')],
 *     content: ['./index.html', './src/**.{ts,tsx} 及各子目录'],
 *   }
 *
 * 与 packages/shared/src/tokens.ts 同名同值；改值两处同步。
 * 冻结凭据（换代）：34 号档《设计规范 v2.0》§一 + CJ-0928-01 + PD-13
 * （B5-0 v1.1 柠檬黄时代已退役，docs/BRAND-TOKENS-v1.1.md 转历史档案）。
 * 本 preset 不含 content / 插件，仅注入品牌 theme。
 *
 * 常用类速查：
 *   背景      bg-canvas / bg-card / bg-sunken / bg-oak / bg-oak-light
 *   品牌色    bg-brand-primary（淡黄点睛·每屏≤2）/ bg-brand-primary-hover / bg-brand-primary-pressed / bg-brand-primary-light
 *             bg-brand-secondary（卡其次阶）/ bg-brand-secondary-light / bg-brand-secondary-deep
 *   文字      text-ink / text-ink-secondary / text-ink-placeholder
 *   边框      border-line / border-line-strong / divide-line-divider
 *   状态      bg-success（深棕墨·不设绿）/ bg-success-light / text-success-deep / bg-danger（赭红）/ bg-danger-light / text-danger-deep
 *   圆角      rounded-card(16) / rounded-input(12) / rounded-tag(8) / rounded-sheet(20) / rounded-full
 *   投影      shadow-card / shadow-elevated / shadow-philia
 *   字号      text-title-lg(20) / text-title(17) / text-body(15) / text-caption(12) / text-body-lg(16) / text-price(20)
 *             v2 字阶梯（§2.1）：text-v2-manifesto(34) / text-v2-screen(27) / text-v2-card-title(26) / text-v2-topic(20)
 *             / text-v2-big-num(24) / text-v2-section(16) / text-v2-list-title(13.5) / text-v2-note(11) / text-v2-trace(9.5) / text-v2-micro(8)
 *   渐变      bg-philia-gradient（深棕谱系）/ bg-philia-gradient-hover
 *   动效      animate-halo（呼吸光环 1.8s）/ scale-92 + duration-120（tab 按下）
 *             duration-300 + ease-philia-out（philial 页转场）
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: {
            DEFAULT: '#F2DFA6', // 淡黄点睛（v2.0 §1.1 --gold，每屏 ≤2 处）
            hover: '#E8CF8C', // 深一档淡金（--gold-deep 同族）
            pressed: '#D9C08A', // 蜡封淡金（--t3-metal）
            light: '#FBF5E4', // 提示卡暖底（§1.4）
          },
          secondary: {
            DEFAULT: '#B9A482', // 卡其次阶（v2.0 --khaki；薄荷绿已退役）
            light: '#F1E9D6', // 分段开关底（§1.4）
            deep: '#A08B62', // 卡其铜深端（--t2 同族）
          },
        },
        canvas: '#FAF8F2', // 纸白页面底（v2.0 --paper，唯一页面底色）
        card: '#FFFFFF', // 白卡面（只作卡片面，不作页面底）
        sunken: '#F4EDDC', // 下沉区/圆章/头像底（§1.4）
        oak: {
          DEFAULT: '#B9A482', // 卡其空间色（次阶）
          light: '#EDE4CE', // 环轨道同族（§1.4）
        },
        ink: {
          DEFAULT: '#3B2E24', // 深棕墨（v2.0 --ink）
          secondary: '#8A7D6B', // 暖灰同温（--muted，对比 ≥4.5:1）
          placeholder: '#B9A98F',
        },
        line: {
          DEFAULT: 'rgba(59,46,36,.14)', // 发丝线（--line）
          strong: 'rgba(59,46,36,.22)',
          divider: 'rgba(59,46,36,.08)', // 更软发丝线（--line-soft）
          // 1px 暖墨细线 ring，替代投影做层级
          ring: 'rgba(59,46,36,.09)',
        },
        success: {
          DEFAULT: '#3B2E24', // 反馈件色纪律：成功不设绿色——深棕墨族（45 号档 P1-1②）
          light: '#F1E9D6',
          deep: '#2E2318',
        },
        danger: {
          DEFAULT: '#B4502E', // 暖调赭红（v2.0 §1.4，禁纯红）
          light: '#F6E3DA',
          deep: '#8F3F22',
        },
      },

      borderRadius: {
        tag: '8px',
        input: '12px', // 输入框（锁定）
        card: '16px', // 卡片（锁定）
        sheet: '20px',
        full: '9999px', // 胶囊按钮（锁定）
        // U1-B 新增（v9.1 圆角四档：卡 20 / 控件 14 / 小签 6 / 全圆）；
        // 既有档保留供旧件，全圆档沿用 full；新件一律走 panel/control/chip/full
        panel: '20px', // 卡（大卡/面板）
        control: '14px', // 控件（按钮/输入/chips 容器）
        chip: '6px', // 小签（角标/小标签）
      },

      // 一律暖色投影，禁止中性灰
      boxShadow: {
        card: '0 2px 10px rgba(61, 50, 41, 0.05)',
        elevated: '0 8px 24px rgba(61, 50, 41, 0.08)',
        philia: '0 6px 16px rgba(46, 35, 24, 0.18)', // 染色阴影（v2.0 §3.3 小件影族）
        // 近零软影，与 line.ring 细线 ring 配套使用
        hairline: '0 1px 2px rgba(61, 50, 41, 0.04)',
      },

      fontSize: {
        'title-lg': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        title: ['17px', { lineHeight: '24px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '22px' }],
        'body-lg': ['16px', { lineHeight: '24px' }], // 员工端 ≥16px
        caption: ['12px', { lineHeight: '16px' }],
        price: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        // U1-B 新增（v9.1 字阶 11/12/14/17/20，详情页可 28/32）；
        // 12/17/20 已由 caption/title/title-lg 覆盖，此处补 11/14/28/32 四档
        'caption-xs': ['11px', { lineHeight: '15px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        detail: ['28px', { lineHeight: '36px', fontWeight: '600' }],
        'detail-lg': ['32px', { lineHeight: '40px', fontWeight: '600' }],
        // v2.0 §2.1 字阶梯（换皮批片 1 落 token；业务组件换引用归片 2-4）
        'v2-manifesto': ['34px', { lineHeight: '51px', fontWeight: '900' }],
        'v2-screen': ['27px', { lineHeight: '36px', fontWeight: '900' }],
        'v2-card-title': ['26px', { lineHeight: '34px', fontWeight: '900' }],
        'v2-topic': ['20px', { lineHeight: '28px', fontWeight: '800' }],
        'v2-big-num': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'v2-section': ['16px', { lineHeight: '22px', fontWeight: '800' }],
        'v2-list-title': ['13.5px', { lineHeight: '19px', fontWeight: '700' }],
        'v2-note': ['11px', { lineHeight: '15px' }],
        'v2-trace': ['9.5px', { lineHeight: '13px' }],
        'v2-micro': ['8px', { lineHeight: '11px' }],
      },

      // 字体自托管 woff2（禁外链 CDN）；三轨不串（v2.0 §二）：屏题=serif / 正文=sans / 数字=mono；中文禁斜体
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'PingFang SC',
          'Microsoft YaHei',
          'Hiragino Sans GB',
          'Noto Sans SC',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        // 衬线轨（展示位）：宣言/屏题/卡面档名/证书题——Noto Serif SC 900
        display: ['Noto Serif SC', 'Songti SC', 'SimSun', 'serif'],
        // 等宽轨：金额/时间/编号/溯源行——JetBrains Mono + tabular-nums
        number: ['JetBrains Mono', 'SF Mono', 'Noto Sans SC', 'monospace'],
        // 中文展示位衬线链（历史键名保留，同 display 轨）
        'serif-cn': ['Noto Serif SC', 'Songti SC', 'serif'],
      },

      backgroundImage: {
        'philia-gradient': 'linear-gradient(135deg, #3B2E24 0%, #2E2318 100%)', // 135° 深棕谱系（身份带 §1.2；柠檬黄渐变已退役）
        'philia-gradient-hover': 'linear-gradient(135deg, #46382A 0%, #332A1E 100%)',
      },

      keyframes: {
        // philia 按钮 / StepTimeline active 节点的呼吸光环（1.8s，染色深棕）
        halo: {
          '0%': { boxShadow: '0 0 0 0 rgba(59, 46, 36, 0.28)' },
          '100%': { boxShadow: '0 0 0 14px rgba(59, 46, 36, 0)' },
        },
      },
      animation: {
        halo: 'halo 1.8s ease-out infinite',
      },

      // Tab 按下：scale-92 duration-120（锁定 0.92 / 120ms）
      scale: {
        92: '0.92',
      },
      transitionDuration: {
        120: '120ms',
        300: '300ms',
        1800: '1800ms',
      },
      transitionTimingFunction: {
        // philial 页转场 ease-out（锁定 300ms ease-out）
        'philia-out': 'cubic-bezier(0.33, 1, 0.68, 1)',
        'philia-inout': 'cubic-bezier(0.65, 0, 0.35, 1)',
        'philia-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      zIndex: {
        sticky: '10',
        tabbar: '50',
        overlay: '100',
        modal: '200',
        toast: '300',
      },

      spacing: {
        // philia 中央凸起按钮直径 64px（锁定）；员工端按钮最小高度 56px
        'philia-btn': '64px',
        'staff-btn': '56px',
        'tabbar-h': '56px',
      },
    },
  },
  plugins: [],
};
