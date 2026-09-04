/**
 * 菲丽亚宠物 Philia · Tailwind preset
 *
 * 各端 app 的 tailwind.config 引用方式：
 *   module.exports = {
 *     presets: [require('@philia/config/tailwind-preset')],
 *     content: ['./index.html', './src/**.{ts,tsx} 及各子目录'],
 *   }
 *
 * 与 packages/shared/src/tokens.ts 同名同值；改值两处同步。
 * 本 preset 不含 content / 插件，仅注入品牌 theme。
 *
 * 常用类速查：
 *   背景      bg-canvas / bg-card / bg-sunken
 *   品牌色    bg-brand-primary / bg-brand-primary-hover / bg-brand-primary-pressed / bg-brand-primary-light
 *             bg-brand-secondary / bg-brand-secondary-light / bg-brand-secondary-deep
 *   文字      text-ink / text-ink-secondary / text-ink-placeholder
 *   边框      border-line / border-line-strong / divide-line-divider
 *   状态      bg-success / bg-success-light / text-success-deep / bg-danger / bg-danger-light / text-danger-deep
 *   圆角      rounded-card(16) / rounded-input(12) / rounded-tag(8) / rounded-sheet(20) / rounded-full
 *   投影      shadow-card / shadow-elevated / shadow-philia
 *   字号      text-title-lg(20) / text-title(17) / text-body(15) / text-caption(12) / text-body-lg(16) / text-price(20)
 *   渐变      bg-philia-gradient / bg-philia-gradient-hover
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
            DEFAULT: '#D98E5F', // 暖杏橘（锁定）
            hover: '#D37D46',
            pressed: '#C7692F',
            light: '#F5E9E1',
          },
          secondary: {
            DEFAULT: '#F2C9A4', // 奶杏（锁定）
            light: '#F5E1CE',
            deep: '#EEB47F',
          },
        },
        canvas: '#FBF7F2', // 米白暖底（锁定）
        card: '#FFFFFF',
        sunken: '#F8F0E6',
        ink: {
          DEFAULT: '#3D3229', // 暖深棕正文（锁定）
          secondary: '#8A7A6B', // （锁定）
          placeholder: '#BDB2A8',
        },
        line: {
          DEFAULT: '#EBE3DB',
          strong: '#DDD0C6',
          divider: '#F0EBE5',
        },
        success: {
          DEFAULT: '#7FA87C', // 苔绿（锁定）
          light: '#E8EFE8',
          deep: '#649160',
        },
        danger: {
          DEFAULT: '#C96F5E', // 陶红（锁定）
          light: '#F3E4E1',
          deep: '#B7503D',
        },
      },

      borderRadius: {
        tag: '8px',
        input: '12px', // 输入框（锁定）
        card: '16px', // 卡片（锁定）
        sheet: '20px',
        full: '9999px', // 胶囊按钮（锁定）
      },

      // 一律暖色投影，禁止中性灰
      boxShadow: {
        card: '0 2px 10px rgba(61, 50, 41, 0.05)',
        elevated: '0 8px 24px rgba(61, 50, 41, 0.08)',
        philia: '0 6px 16px rgba(214, 138, 90, 0.35)', // （锁定）
      },

      fontSize: {
        'title-lg': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        title: ['17px', { lineHeight: '24px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '22px' }],
        'body-lg': ['16px', { lineHeight: '24px' }], // 员工端 ≥16px
        caption: ['12px', { lineHeight: '16px' }],
        price: ['20px', { lineHeight: '28px', fontWeight: '600' }],
      },

      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        // 数字与价格：配合 font-variant-numeric: tabular-nums 使用
        number: ['Helvetica Neue', 'Helvetica', 'Arial', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },

      backgroundImage: {
        'philia-gradient': 'linear-gradient(135deg, #D98E5F 0%, #F2C9A4 100%)', // （锁定）
        'philia-gradient-hover': 'linear-gradient(135deg, #D37D46 0%, #EEB47F 100%)',
      },

      keyframes: {
        // philia 按钮 / StepTimeline active 节点的呼吸光环（1.8s）
        halo: {
          '0%': { boxShadow: '0 0 0 0 rgba(217, 142, 95, 0.45)' },
          '100%': { boxShadow: '0 0 0 14px rgba(217, 142, 95, 0)' },
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
