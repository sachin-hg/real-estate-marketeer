/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#7C3AED',
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          400: '#A78BFA',
          600: '#6D28D9',
          700: '#5B21B6',
          900: '#2E1065',
        },
        amber: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        emerald: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-amber': 'pulseAmber 0.6s ease-in-out',
        'flash-green': 'flashGreen 0.8s ease-in-out',
        'typewriter': 'typewriter 0.1s steps(1) forwards',
        'dot-travel': 'dotTravel 2s ease-in-out infinite',
      },
      keyframes: {
        pulseAmber: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: '#FDE68A' },
        },
        flashGreen: {
          '0%': { backgroundColor: 'transparent' },
          '20%': { backgroundColor: '#D1FAE5' },
          '100%': { backgroundColor: 'transparent' },
        },
        dotTravel: {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
      },
    },
  },
  plugins: [],
}
