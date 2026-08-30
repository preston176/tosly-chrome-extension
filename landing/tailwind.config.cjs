/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── legacy v1 tokens (index.astro, support, privacy) ─────────── */
        'brand-red':    '#ef4444',
        'brand-yellow': '#eab308',
        'brand-green':  '#22c55e',
        'ink':          '#0a0a0c',
        'ink-soft':     '#1c1c20',
        'surface':      '#f8f8fb',
        'surface-2':    '#f0f0f5',
        'muted':        '#6b7280',
        'body':         '#374151',
        'hairline':     '#e5e7eb',

        /* ── editorial design system ──────────────────────────────────── */
        navy: '#00063d',
        flame:  { 200: '#fff7f5', 300: '#ffe8e2', 400: '#ffb3a3', 500: '#fa7560', 600: '#fa4028', 700: '#801a10', 800: '#410d07' },
        azure:  { 300: '#ceebff', 400: '#81cbff', 500: '#0095ff', 600: '#0043d3', 700: '#0011a7', 800: '#00063d' },
        lime:   { 300: '#e6ffd9', 400: '#d2ffc1', 500: '#96ff6f', 600: '#45ff00', 700: '#207a00', 800: '#103a00' },
        sun:    { 300: '#fffeef', 400: '#fffdd9', 500: '#fffbb7', 600: '#fff67d', 700: '#fff133', 800: '#a69f00' },
        rose:   { 300: '#fff9fc', 400: '#ffe6f3', 500: '#ffb3de', 600: '#ff80c8', 700: '#ff66cc', 800: '#5a003c' },
        iris:   { 400: '#e7e3f7', 500: '#b5a9e3', 600: '#7c5ac4', 700: '#391e7e' },
        paper:  { 50: '#f9f9f9', 100: '#f2f2f3', 200: '#e0e0e1' },
        graphite: { 600: '#7d7d7e', 700: '#5e5d5f', 900: '#262627', 950: '#1b1b1c' },
      },
      fontFamily: {
        sans:      ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display:   ['Fraunces', 'Georgia', 'serif'],
        heading:   ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        mono:      ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        /* fluid editorial scale, mirrors Jasper's clamp ramp */
        'd1':    ['clamp(2.25rem, 1.53rem + 3.2vw, 4rem)',     { lineHeight: '1.06', letterSpacing: '-0.03em' }],
        'd2':    ['clamp(2rem, 1.66rem + 1.5vw, 3rem)',        { lineHeight: '1.1',  letterSpacing: '-0.025em' }],
        'd3':    ['clamp(1.625rem, 1.47rem + 0.69vw, 2rem)',   { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'd4':    ['clamp(1.25rem, 1.16rem + 0.43vw, 1.5rem)',  { lineHeight: '1.2',  letterSpacing: '-0.02em' }],
        'lede':  ['1.125rem',  { lineHeight: '1.4',  letterSpacing: '-0.01em' }],
        'copy':  ['1rem',      { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'fine':  ['0.875rem',  { lineHeight: '1.35', letterSpacing: '-0.01em' }],
        'label': ['0.8rem',    { lineHeight: '1.4',  letterSpacing: '0.01em' }],
      },
      maxWidth: {
        site: '85rem',   /* 1360px — matches Jasper's container */
        prose2: '46rem',
      },
      spacing: {
        'sec':    'clamp(4rem, 3.14rem + 4.29vw, 7rem)',
        'sec-sm': 'clamp(3rem, 2.14rem + 4.29vw, 6rem)',
        'sec-lg': 'clamp(7rem, 5.79rem + 6.07vw, 11.25rem)',
        'gutter': 'clamp(1.25rem, 0.28rem + 3.86vw, 3.75rem)',
      },
    },
  },
  plugins: [],
};
