import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0129AC',
          dark: '#809EFC',
        },
        secondary: '#809EFC',
        surface: {
          DEFAULT: '#E1ECFF',
          dark: 'rgba(128, 158, 252, 0.08)',
        },
        background: {
          DEFAULT: '#FAFBFE',
          dark: '#0F1117',
        },
        border: {
          DEFAULT: '#E2E8F0',
          dark: '#2A2D3A',
        },
        text: {
          primary: '#2E2E2E',
          secondary: '#707070',
          'primary-dark': '#E8E8ED',
          'secondary-dark': '#8B8D98',
        },
        card: {
          DEFAULT: '#FFFFFF',
          dark: '#1A1D27',
        },
        success: {
          DEFAULT: '#059669',
          bg: 'rgba(5, 150, 105, 0.1)',
        },
        warning: {
          DEFAULT: '#D97706',
          bg: 'rgba(217, 119, 6, 0.1)',
        },
        danger: {
          DEFAULT: '#DC2626',
          bg: 'rgba(220, 38, 38, 0.1)',
        },
        info: {
          DEFAULT: '#0129AC',
          bg: 'rgba(1, 41, 172, 0.1)',
        },
        chart: {
          1: '#0129AC',
          2: '#809EFC',
          3: '#059669',
          4: '#D97706',
          5: '#DC2626',
          6: '#6366F1',
        },
      },
      fontFamily: {
        // The whole app uses Poppins only — `mono` is intentionally the same
        // stack (not a real monospace font) so that any leftover or future
        // `font-mono` usage can't silently reintroduce a second typeface.
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        h1: ['28px', { fontWeight: '600', lineHeight: '1.3' }],
        h2: ['22px', { fontWeight: '600', lineHeight: '1.3' }],
        h3: ['18px', { fontWeight: '600', lineHeight: '1.4' }],
        h4: ['15px', { fontWeight: '600', lineHeight: '1.4' }],
        body: ['14px', { fontWeight: '400', lineHeight: '1.6' }],
        small: ['12px', { fontWeight: '400', lineHeight: '1.5' }],
        metric: ['28px', { fontWeight: '600', lineHeight: '1.2' }],
        code: ['13px', { fontWeight: '400', lineHeight: '1.6' }],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(1, 41, 172, 0.04), 0 1px 2px rgba(1, 41, 172, 0.02)',
        dropdown: '0 4px 24px rgba(1, 41, 172, 0.08), 0 2px 8px rgba(1, 41, 172, 0.04)',
        'card-hover': '0 4px 16px rgba(1, 41, 172, 0.08), 0 2px 6px rgba(1, 41, 172, 0.04)',
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
