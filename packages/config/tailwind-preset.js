/**
 * 菲丽亚宠物 Philia · Tailwind preset（批次 5 · B 阶段品牌换色 v1.1 冻结版）
 *
 * 各端 app 的 tailwind.config 引用方式：
 *   module.exports = {
 *     presets: [require('@philia/config/tailwind-preset')],
 *     content: ['./index.html', './src/**.{ts,tsx} 及各子目录'],
 *   }
 *
 * 与 packages/shared/src/tokens.ts 同名同值；改值两处同步。
 * 冻结凭据：docs/BRAND-TOKENS-v1.1.md（B5-0 冻结确认书 2026-09-08 老板拍板）。
 * 本 preset 不含 content / 插件，仅注入品牌 theme。
 *
 * 常用类速查：
 *   背景      bg-canvas / bg-card / bg-sunken / bg-oak / bg-oak-light
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
            DEFAULT: '#FDC830', // 柠檬黄（VI 主色，锁定）
            hover: '#FDC012', // 明度 −6
            pressed: '#E8AD02', // 明度 −13
            light: '#FCF3D9', // 同 H、S−12、L=92
          },
          secondary: {
            DEFAULT: '#7FD8BE', // 薄荷绿（VI 辅色，锁定；不参与功能反馈）
            light: '#D3EEE6', // 同 H、S−9、L=88
            deep: '#5ED1AF', // 同 H、S+2、L−8
          },
        },
        canvas: '#F6F1E3', // 米白（VI 底色，锁定）
        card: '#FFFFFF',
        sunken: '#F3ECD6',
        oak: {
          DEFAULT: '#D4B896', // 浅木（VI 空间色：寄养/房间场景辅助底、暖色区块）
          light: '#F1EBE5', // 浅木洗色（同 H、S−12、L=92）
        },
        ink: {
          DEFAULT: '#4A3B2E', // 深棕墨（VI 文字色，锁定；兼 on-primary 主按钮前景）
          secondary: '#8A796B', // hue→27.9°，S/L 同档
          placeholder: '#BDB2A8',
        },
        line: {
          DEFAULT: '#EBE2DB',
          strong: '#DDD1C6',
          divider: '#F0EAE5',
        },
        success: {
          DEFAULT: '#7FA87C', // 苔绿（功能色原值保留，确认书第 1 条）
          light: '#E8EFE8',
          deep: '#649160',
        },
        danger: {
          DEFAULT: '#D92D20', // 标准功能红（确认书第 2 条，token 独立一行）
          light: '#F8DFDD',
          deep: '#AC2419',
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
        philia: '0 6px 16px rgba(253, 200, 48, 0.35)', // 柠檬黄光晕（随主色，锁定）
      },

      fontSize: {
        'title-lg': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        title: ['17px', { lineHeight: '24px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '22px' }],
        'body-lg': ['16px', { lineHeight: '24px' }], // 员工端 ≥16px
        caption: ['12px', { lineHeight: '16px' }],
        price: ['20px', { lineHeight: '28px', fontWeight: '600' }],
      },

      // 字体自托管 woff2（禁外链 CDN）；中文不落拉丁展示字体，中文禁斜体
      fontFamily: {
        sans: [
          'Poppins',
          'Noto Sans SC',
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
        // 拉丁标题：Montserrat SemiBold；中文永远落 Noto Sans SC Bold
        display: ['Montserrat', 'Noto Sans SC', '-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        // 数字与价格：Montserrat → Noto Sans SC，配合 font-variant-numeric: tabular-nums 使用
        number: ['Montserrat', 'Noto Sans SC', 'Helvetica Neue', 'Helvetica', 'Arial', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },

      backgroundImage: {
        'philia-gradient': 'linear-gradient(135deg, #FDC830 0%, #7FD8BE 100%)', // 135° 柠檬黄→薄荷绿（锁定）
        'philia-gradient-hover': 'linear-gradient(135deg, #FDC012 0%, #5ED1AF 100%)',
      },

      keyframes: {
        // philia 按钮 / StepTimeline active 节点的呼吸光环（1.8s，随主色）
        halo: {
          '0%': { boxShadow: '0 0 0 0 rgba(253, 200, 48, 0.45)' },
          '100%': { boxShadow: '0 0 0 14px rgba(253, 200, 48, 0)' },
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
