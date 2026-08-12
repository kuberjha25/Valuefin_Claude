/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace']
      },
      colors: {
        /* surfaces — near-black with a violet cast */
        ink: {
          950: '#06060e',
          900: '#0a0a16',
          850: '#0f0f1e',
          800: '#15152a',   /* the chart surface the palette was validated against */
          700: '#1e1e38',
          600: '#2a2a4a'
        },
        /* UI accents — chrome, glow and text, not chart marks */
        neon: {
          violet: '#9d8bff',
          indigo: '#8069f5',
          cyan: '#22d3ee',
          teal: '#0fa0c9',
          pink: '#ff5cc8',
          lime: '#a3e635',
          amber: '#fbbf24'
        },
        /* validated chart marks — see index.css :root for the CSS custom properties */
        series: { 1: '#8069f5', 2: '#0fa0c9' },
        state: {
          good: '#22a06b',
          warn: '#c99a00',
          bad: '#e05252',
          od1: '#8a3030', od2: '#b03c3c', od3: '#d75454', od4: '#fa8080'
        }
      },
      /* the slash modifier reads this scale — the default stops at multiples of 5 */
      opacity: { 8: '.08', 12: '.12', 15: '.15', 35: '.35', 45: '.45', 55: '.55', 65: '.65', 85: '.85' },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        glass: '0 1px 0 0 rgba(255,255,255,.06) inset, 0 20px 40px -24px rgba(0,0,0,.9)',
        glow: '0 0 0 1px rgba(157,139,255,.35), 0 0 28px -6px rgba(128,105,245,.55)',
        lift: '0 24px 48px -28px rgba(0,0,0,.95)'
      },
      keyframes: {
        drift: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(4%,-6%,0) scale(1.08)' },
          '66%': { transform: 'translate3d(-5%,4%,0) scale(.94)' }
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        popIn: { from: { opacity: '0', transform: 'translateY(6px) scale(.98)' }, to: { opacity: '1', transform: 'none' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'none' } },
        growY: { from: { transform: 'scaleY(0)' }, to: { transform: 'scaleY(1)' } },
        sweep: { from: { strokeDashoffset: '1' }, to: { strokeDashoffset: '0' } },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(255,92,200,.45)' },
          '70%': { boxShadow: '0 0 0 10px rgba(255,92,200,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(255,92,200,0)' }
        }
      },
      animation: {
        drift: 'drift 26s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        popIn: 'popIn .28s cubic-bezier(.2,.9,.3,1.4) both',
        slideIn: 'slideIn .3s cubic-bezier(.2,.9,.3,1.2) both',
        growY: 'growY .6s cubic-bezier(.2,.9,.3,1.1) both',
        sweep: 'sweep 1.1s ease-out both',
        pulseRing: 'pulseRing 2s ease-out infinite'
      }
    }
  },
  plugins: []
};
