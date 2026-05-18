/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5E3FE0',
          50: '#F0ECFD',
          100: '#E3DCFB',
          600: '#4A30C0',
        },
      },
    },
  },
  plugins: [],
}
