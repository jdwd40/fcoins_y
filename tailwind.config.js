/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        serif: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#0e0b08',
          900: '#120e09',
          800: '#1a140d',
          700: '#241c12',
          600: '#2f2617',
          500: '#3a2f1d',
        },
        paper: {
          DEFAULT: '#f3ead3',
          50: '#faf6e8',
          100: '#f3ead3',
          200: '#e8dcbb',
          300: '#d9c995',
          400: '#c5b077',
          dim: '#e6d9b4',
        },
        gold: {
          DEFAULT: '#c9a227',
          light: '#e0bd4a',
          deep: '#9e7b14',
        },
        oxblood: {
          DEFAULT: '#8b2e2e',
          light: '#b24040',
          deep: '#5e1818',
        },
        verdigris: {
          DEFAULT: '#3e7b5a',
          light: '#5a9c78',
          deep: '#265a3d',
        },
        rule: 'rgba(243, 234, 211, 0.14)',
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
