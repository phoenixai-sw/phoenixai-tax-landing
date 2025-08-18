/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'pastel-yellow': '#FFF9C4',
        'pastel-pink': '#FCE4EC',
        'pastel-blue': '#E3F2FD',
        'pastel-green': '#F1F8E9',
        'pastel-purple': '#F3E5F5',
        'soft-yellow': '#FFF176',
        'soft-pink': '#F48FB1',
        'soft-blue': '#81D4FA',
        'soft-green': '#AED581',
        'soft-purple': '#CE93D8',
        'text-dark': '#2E3440',
        'text-medium': '#5E81AC',
        'border-light': '#E5E7EB',
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease forwards',
        'pulse-slow': 'pulse 2s infinite',
        'colorful-text': 'colorfulText 8s ease infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(30px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        colorfulText: {
          '0%': { backgroundPosition: '0% 50%' },
          '25%': { backgroundPosition: '25% 25%' },
          '50%': { backgroundPosition: '100% 50%' },
          '75%': { backgroundPosition: '75% 75%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      maxWidth: {
        '1080': '1080px',
      },
    },
  },
  plugins: [],
}
