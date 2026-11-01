/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8ec3ff',
          400: '#59a1ff',
          500: '#3b82f6',
          600: '#1d63eb',
          700: '#164dd8',
          800: '#1840af',
          900: '#1a3a8a',
        },
        surface: {
          900: '#0f1117',
          800: '#171923',
          700: '#1e2233',
          600: '#262b3d',
          500: '#2f3549',
        },
        neon: {
          green:  '#22d3ee',
          blue:   '#3b82f6',
          purple: '#a78bfa',
          pink:   '#f472b6',
        },
      },
    },
  },
  plugins: [],
}

