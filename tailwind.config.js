/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // After-Hours Exchange tokens — all resolved from CSS variables so
        // both themes share the same utility names.
        ink: {
          DEFAULT: 'var(--text)',
          dim: 'var(--text-2)',
          mute: 'var(--text-3)',
        },
        paper: {
          DEFAULT: 'var(--bg)',
          alt: 'var(--surface-2)',
          dim: 'var(--surface)',
        },
        card: 'var(--surface)',
        gold: {
          DEFAULT: 'var(--brand)',
          light: 'var(--brand)',
          deep: 'var(--brand)',
        },
        brand: 'var(--brand)',
        oxblood: {
          DEFAULT: 'var(--down)',
          light: 'var(--down)',
          deep: 'var(--down)',
        },
        verdigris: {
          DEFAULT: 'var(--up)',
          light: 'var(--up)',
          deep: 'var(--up)',
        },
        up: 'var(--up)',
        down: 'var(--down)',
        flat: 'var(--flat)',
        director: 'var(--director)',
        golden: 'var(--golden)',
        demon: 'var(--demon)',
        warn: 'var(--warn)',
        rule: 'var(--border)',
      },
      borderColor: {
        rule: 'var(--border)',
        'rule-strong': 'var(--border-strong)',
      },
      letterSpacing: {
        masthead: '0.02em',
        caps: '0.18em',
        capstight: '0.12em',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.04) inset',
        overlay: '0 24px 64px -24px rgba(0,0,0,0.65)',
        'brand-glow': '0 0 0 1px color-mix(in srgb, var(--brand) 45%, transparent), 0 8px 24px -12px color-mix(in srgb, var(--brand) 45%, transparent)',
      },
      keyframes: {
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        reveal: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'reveal-fast': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'live-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        'price-flash-up': {
          '0%': { backgroundColor: 'color-mix(in srgb, var(--up) 22%, transparent)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'price-flash-down': {
          '0%': { backgroundColor: 'color-mix(in srgb, var(--down) 22%, transparent)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        'fade-in-down': 'fade-in-down 0.3s ease-out',
        reveal: 'reveal 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'reveal-fast': 'reveal-fast 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'live-pulse': 'live-pulse 2.4s ease-in-out infinite',
        'price-flash-up': 'price-flash-up 0.6s ease-out',
        'price-flash-down': 'price-flash-down 0.6s ease-out',
      },
    },
  },
  plugins: [],
};
