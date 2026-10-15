/**
 * 菲丽亚宠物 Philia · Tailwind preset（换皮批片 1 · v2.0 色纪律落地；
 * 产品-1015 换皮 片0-三端壳：令牌值对齐 READY-FOR-DEV-20261015 §2 成稿）
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
 *   品牌色    bg-brand-cta（深棕 #5C5040：CTA/深卡/dock 激活块/rail，Ready §2.1 brand）
 *             / bg-brand-cta-pressed / text-brand-cta-on
 *             bg-brand-primary（cream 点睛·仅「此刻要做」每屏≤2）/ bg-brand-primary-hover / bg-brand-primary-pressed / bg-brand-primary-light
 *             bg-brand-secondary（次阶）/ bg-brand-secondary-light / bg-brand-secondary-deep
 *   角标      bg-violet（活动角标紫 #A78BE8，≤10%，禁 CTA/Tab）/ text-violet-on
 *   文字      text-ink / text-ink-secondary / text-ink-placeholder
 *   边框      border-line / border-line-strong / divide-line-divider
 *   状态      bg-success（深棕墨·不设绿）/ bg-success-light / text-success-deep / bg-danger（赭红）/ bg-danger-light / text-danger-deep
 *   圆角      rounded-card(16) / rounded-input(12) / rounded-tag(8) / rounded-sheet(20) / rounded-full
 *   投影      shadow-card / shadow-elevated / shadow-philia
 *   字号      text-title-lg(20) / text-title(17) / text-body(15) / text-caption(12) / text-body-lg(16) / text-price(20)
 *             v2 字阶梯（§2.1）：text-v2-manifesto(34) / text-v2-screen(27) / text-v2-card-title(26) / text-v2-topic(20)
 *             / text-v2-big-num(24) / text-v2-section(16) / text-v2-list-title(13.5) / text-v2-note(11) / text-v2-trace(9.5) / text-v2-micro(8)
 *   渐变      bg-philia-gradient（深棕 brand→pressed）/ bg-philia-gradient-hover / bg-philia-gradient-rail
 *   动效      animate-halo（呼吸光环 1.8s）/ scale-92 + duration-120（tab 按下）
 *             duration-300 + ease-philia-out（philial 页转场）
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          /* 深棕 CTA 族（Ready §2.1 brand/pressed）：CTA/深卡/dock 激活块/rail */
          cta: {
            DEFAULT: '#5C5040', // brand 深棕（禁改主色）
            pressed: '#4A4034', // brand.pressed
            on: '#FAF7F0', // CTA 面文字/图标（canvas 反白）
          },
          primary: {
            DEFAULT: '#F2DC8C', // cream 点睛（Ready §2.1 cream，仅「此刻要做」每屏 ≤2；键名沿用 --gold）
            hover: '#EFD471', // 推导：明度 −6
            pressed: '#EBCA50', // 推导：明度 −13
            light: '#F8F2DD', // 提示卡暖底（推导：S−12 L=92）
          },
          secondary: {
            DEFAULT: '#A89779', // 次阶（Ready §2.1 secondary：次要字/icon）
            light: '#F3EEE4', // 软面板/未选 chip（Ready §2.1 surface）
            deep: '#99845F', // 推导：S+2 L−8
          },
        },
        canvas: '#FAF7F0', // canvas 页面底（Ready §2.1；唯一页面底色，禁 cream 代）
        card: '#FFFFFF', // 白卡面（只作卡片面，不作页面底）
        sunken: '#F3EEE4', // 下沉区/圆章/头像底（并入 surface 族）
        oak: {
          DEFAULT: '#A89779', // 次阶空间色（与 secondary 同值）
          light: '#E9E1D2', // 环轨道同族（surface 同族 L−4 推导）
        },
        violet: {
          DEFAULT: '#A78BE8', // 活动角标紫（Ready §2.1 violet，≤10%，禁 CTA/Tab）
          on: '#2C2822', // 紫底文字
        },
        ink: {
          DEFAULT: '#2C2822', // 深棕墨 body（Ready §2.1 body）
          secondary: '#A89779', // 次要文字（Ready §2.1 secondary）
          placeholder: '#B8AA96', // 弱标签（Ready §2.1 muted）
        },
        line: {
          DEFAULT: 'rgba(44,40,34,.14)', // 发丝线（基色随 body 换代）
          strong: 'rgba(44,40,34,.22)',
          divider: '#E8E2D6', // 行内分隔（Ready §2.1 divider 成稿实色）
          // 1px 暖墨细线 ring，替代投影做层级
          ring: 'rgba(44,40,34,.09)',
        },
        success: {
          // 反馈件色纪律：成功不设绿色——深棕墨族（45 号档 P1-1②）；
          // Ready §2.1「现网语义保留·勿换 brand」：片0 三值原样不动
          DEFAULT: '#3B2E24',
          light: '#F1E9D6',
          deep: '#2E2318',
        },
        danger: {
          DEFAULT: '#B4502E', // 暖调赭红（Ready §2.1 alert 同值，仅异常，禁纯红）
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
        'philia-gradient': 'linear-gradient(135deg, #5C5040 0%, #4A4034 100%)', // 深棕 brand→pressed（Ready §2.1；tokens.gradients.philia 同名同值）
        'philia-gradient-hover': 'linear-gradient(135deg, #665947 0%, #504639 100%)',
        'philia-gradient-rail': 'linear-gradient(160deg, #5C5040 0%, #4A4034 100%)', // 商家端 M1 导航轨 160°（tokens.gradients.philiaRail 同名同值）
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
