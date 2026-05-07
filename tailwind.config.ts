import type { Config } from 'tailwindcss';

// Lighter Superteam-aligned variant of the sold-main monochrome eldritch theme.
// Keeps the ink/bone backbone, adds a sea-green accent + amber highlight so
// sold-earn reads as "the bounty arm" — distinct, but a sibling of sold-main.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'earn-ink': '#0b0b0b',
        'earn-bone': '#fbfaf5',
        'earn-cream': '#f4f1e8',
        'earn-accent': '#0f6e56',
        'earn-accent-soft': '#a8d6c5',
        'earn-amber': '#e2b73a',
        'earn-gray': {
          0: '#ffffff',
          50: '#fbfaf5',
          100: '#f4f1e8',
          200: '#e7e3d6',
          300: '#cac5b6',
          400: '#9a958a',
          500: '#6e6a63',
          600: '#4b4843',
          700: '#302e2a',
          800: '#171615',
          900: '#0b0b0b',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
        eldritch: ['Unbounded', 'IBM Plex Sans', 'sans-serif'],
      },
      spacing: {
        unit: '4px',
      },
    },
  },
  plugins: [],
};

export default config;
