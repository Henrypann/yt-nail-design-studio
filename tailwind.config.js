/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 中性灰阶（11 级，token 单一来源见 src/design-system/tokens.css）
        gray: {
          50: 'var(--gray-50)',
          100: 'var(--gray-100)',
          200: 'var(--gray-200)',
          300: 'var(--gray-300)',
          400: 'var(--gray-400)',
          500: 'var(--gray-500)',
          600: 'var(--gray-600)',
          700: 'var(--gray-700)',
          800: 'var(--gray-800)',
          900: 'var(--gray-900)',
          950: 'var(--gray-950)',
        },
        // 单一品牌主色
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          active: 'var(--color-primary-active)',
          soft: 'var(--color-primary-soft)', // 8% 主色填充（选中态背景）
          foreground: 'var(--color-primary-foreground)',
        },
        // 语义色（Toast / 状态徽标四型）
        success: { DEFAULT: 'var(--color-success)', soft: 'var(--color-success-soft)' },
        warning: { DEFAULT: 'var(--color-warning)', soft: 'var(--color-warning-soft)' },
        error: { DEFAULT: 'var(--color-error)', soft: 'var(--color-error-soft)' },
        info: { DEFAULT: 'var(--color-info)', soft: 'var(--color-info-soft)' },
        // 画布底色
        canvas: 'var(--color-canvas-bg)',
      },
      borderRadius: {
        button: 'var(--radius-button)', // 6px
        panel: 'var(--radius-panel)', // 8px
        card: 'var(--radius-card)', // 12px
      },
      boxShadow: {
        float: 'var(--shadow-float)', // 悬浮面板
        modal: 'var(--shadow-modal)', // 模态
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Segoe UI',
          'sans-serif',
        ],
      },
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translate(-50%, -8px)' },
          to: { opacity: '1', transform: 'translate(-50%, 0)' },
        },
        'modal-in': {
          from: { opacity: '0', transform: 'scale(0.97) translateY(4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'skeleton-pulse': 'skeleton-pulse 1.2s ease-in-out infinite',
        'fade-in': 'fade-in 150ms ease-out',
        'fade-out': 'fade-out 150ms ease-out forwards',
        'toast-in': 'toast-in 200ms ease-out',
        'modal-in': 'modal-in 200ms ease-out',
        'spin-slow': 'spin-slow 0.8s linear infinite',
      },
    },
  },
  plugins: [],
};
