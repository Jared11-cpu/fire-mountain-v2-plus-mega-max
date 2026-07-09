/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Noto Serif SC"', '"Source Han Serif SC"', 'serif'],
        sans: ['"HarmonyOS Sans SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      colors: {
        river: '#0E6B72',
        ink: '#12222A',
        jade: '#2FB98E',
        tower: '#D35236',
        mist: '#F3F8F6',
        night: '#101820',
      },
      boxShadow: {
        soft: '0 24px 70px rgba(17, 34, 42, 0.14)',
        glow: '0 18px 60px rgba(47, 185, 142, 0.28)',
      },
      backgroundImage: {
        'river-grid':
          'linear-gradient(rgba(14,107,114,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(14,107,114,0.08) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};
