/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist Variable"', '"Inter Tight"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono Variable"', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        display: ['"Geist Variable"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // dark, monochrome "technical document" palette
        canvas: '#060607',
        card: '#0d0d0f',
        paper: '#141417',
        line: '#2a2a2f',
        hair: '#1c1c20',
        ink: '#ecece8', // primary foreground
        inv: '#0a0a0b', // foreground on inverted (light) surfaces
        sub: '#b2b2ad',
        mute: '#7a7a7d',
        faint: '#4b4b50',
        accent: '#86d7f2', // ice cyan, used sparingly
        ok: '#62d39b',
        stop: '#ff4b3e',
        info: '#8fb0ff',
      },
      borderRadius: { card: '14px' },
      keyframes: {
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
        fadeUp: { from: { transform: 'translateY(6px)' }, to: { transform: 'none' } },
      },
      animation: { pulseSoft: 'pulseSoft 1.4s ease-in-out infinite', fadeUp: 'fadeUp .22s ease-out' },
    },
  },
  plugins: [],
};
