/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        clinic: {
          50:  '#eef3fb',
          100: '#d5e3f5',
          200: '#afc8ec',
          300: '#7aaade',
          400: '#4a82cb',
          500: '#2a63b2',
          600: '#1e4d8c',  // Logo blue
          700: '#163a6b',
          800: '#102848',
          900: '#0b1d35',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
