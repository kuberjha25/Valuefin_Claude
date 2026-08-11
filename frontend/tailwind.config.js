/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'] },
      colors: {
        navy: { 950: '#081428', 900: '#0b1f3a', 800: '#122c4f', 700: '#1a3a64' },
        teal: { 500: '#0e9f97', 600: '#0b837d' },
        gold: { 400: '#e0b45c', 500: '#d9a441' }
      },
      boxShadow: { soft: '0 1px 2px rgba(8,20,40,.06), 0 8px 24px -12px rgba(8,20,40,.18)' }
    }
  },
  plugins: []
};
