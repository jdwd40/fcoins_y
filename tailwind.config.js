/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#f5f6fa',
          900: '#101114',
          800: '#232633',
          700: '#484b5e',
          600: '#686b82',
          500: '#85899e',
        },
        paper: {
          DEFAULT: '#08090d',
          50: '#ffffff',
          100: '#f5f7fb',
          200: '#eef1f7',
          300: '#dedee5',
          400: '#9497a9',
          dim: '#0d0f16',
        },
        gold: {
          DEFAULT: '#7132f5',
          light: '#8b5cf6',
          deep: '#5b1ecf',
        },
        oxblood: {
          DEFAULT: '#dc3545',
          light: '#ff5d68',
          deep: '#a52332',
        },
        verdigris: {
          DEFAULT: '#149e61',
          light: '#2ed58a',
          deep: '#026b3f',
        },
        rule: 'rgba(148, 151, 169, 0.16)',
      },
      letterSpacing: {
        masthead: '0.02em',
        caps: '0.18em',
        capstight: '0.12em',
      },
      boxShadow: {
        'card-dark': '0 1px 0 rgba(243,234,211,0.06) inset, 0 24px 48px -24px rgba(0,0,0,0.6)',
        'card-light': '0 1px 0 rgba(255,255,255,0.6) inset, 0 24px 48px -24px rgba(46,30,10,0.2)',
        'gold-glow': '0 0 0 1px rgba(201,162,39,0.5), 0 8px 24px -8px rgba(201,162,39,0.4)',
      },
      keyframes: {
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out-up': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-10px)' },
        },
        'ticker': {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'reveal': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'reveal-fast': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'draw-line': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
      },
      animation: {
        'fade-in-down': 'fade-in-down 0.3s ease-out',
        'fade-out-up': 'fade-out-up 0.3s ease-out',
        'ticker': 'ticker 90s linear infinite',
        'ticker-slow': 'ticker 140s linear infinite',
        'flicker': 'flicker 2.4s ease-in-out infinite',
        'reveal': 'reveal 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'reveal-fast': 'reveal-fast 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'draw-line': 'draw-line 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
