/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Dark mode is toggled by the `dark` class on <html>. ThemeContext writes
  // the class based on the user's saved preference (light / dark / system),
  // and a tiny inline script in index.html applies it before React mounts
  // so we never flash the wrong theme.
  darkMode: 'class',
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
        // map IS the brand. Lost stays neutral; lead (open) is coral;
        // contacted leads render baby-blue (handled in icons.ts only).
        closed: '#0c5f3f',
        lost: '#6b7280',
        lead: '#ef8b55',
        // Full warm-shifted slate scale. Tailwind's default slate is cool
        // (hue ~215°) which reads as blue-ish — wrong for chrome built around
        // the UNIQ Supply warm dark (#231f20). These values are tuned to the
        // same warm hue family (~20°), keeping the luminance ramp Tailwind
        // expects so all the existing slate-xxx classes still create their
        // usual contrast relationships, just without the cool cast on input
        // borders, slider tracks, and divider lines.
        slate: {
          50: '#faf9f8',
          100: '#f3f1f0',
          200: '#e4e1df',
          300: '#cfcbc9',
          400: '#a39e9c',
          500: '#737070',
          600: '#525050', // mid-tone, used for state-border lines too
          700: '#3a3837',
          800: '#2c2728',
          900: '#231f20', // surfaces (cards, header, drawer)
          950: '#1a1718', // canvas / body background
        },
      },
    },
  },
  plugins: [],
};
