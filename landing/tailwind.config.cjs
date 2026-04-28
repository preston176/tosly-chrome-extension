/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-red':    '#ef4444',
        'brand-yellow': '#eab308',
        'brand-green':  '#22c55e',
        'ink':          '#0a0a0c',
        'ink-soft':     '#1c1c20',
        'surface':      '#f8f8fb',
        'surface-2':    '#f0f0f5',
        'muted':        '#6b7280',
      },
      fontFamily: {
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
