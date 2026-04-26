/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#4F46E5', light: '#818CF8', dark: '#3730A3' },
      },
    },
  },
  plugins: [],
};
