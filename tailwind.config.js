/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        closed: '#16a34a',
        lost: '#6b7280',
        lead: '#f59e0b',
      },
    },
  },
  plugins: [],
};
