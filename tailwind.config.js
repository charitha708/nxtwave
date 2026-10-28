/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#155EEF',
          50: '#EAF2FF',
          100: '#D7E3F7',
          200: '#B5CCF0',
          300: '#8AAEE5',
          400: '#5C8BD8',
          500: '#155EEF',
          600: '#1247C9',
          700: '#123A8C',
          800: '#0E2B66',
          900: '#0A1E47',
        },
        navy: '#123A8C',
        pale: '#EAF2FF',
        surface: '#F7FAFF',
        ink: '#172B4D',
        muted: '#526581',
        line: '#D7E3F7',
        ok: '#16803D',
        err: '#B42318',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(18, 58, 140, 0.04), 0 4px 16px rgba(18, 58, 140, 0.06)',
        pop: '0 8px 30px rgba(18, 58, 140, 0.12)',
      },
    },
  },
  plugins: [],
};
