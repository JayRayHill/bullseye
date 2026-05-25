/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Dark mode follows the user's OS preference. If we add a manual toggle
  // later, flip this to 'class' and add a small bootstrap script to read
  // the persisted preference.
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Bullseye Offense brand palette. Anchor = #0c5f3f (the UNIQ Supply
        // green). Tints derived by blending toward white; shades toward black.
        brand: {
          50: '#f0faf4',
          100: '#d9f2e3',
          200: '#aee5c6',
          300: '#74d2a4',
          400: '#3eb682',
          500: '#1a8e60',
          600: '#0e7349',
          700: '#0c5f3f',
          800: '#094c33',
          900: '#073a27',
        },
        // Semantic pin colors — closed deals share the brand color so the
        // map IS the brand. Lost stays neutral; lead amber stays high-contrast.
        closed: '#0c5f3f',
        lost: '#6b7280',
        lead: '#f59e0b',
      },
    },
  },
  plugins: [],
};
