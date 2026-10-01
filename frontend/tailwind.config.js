/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        secondary: '#1F2937',
        // Boutique Premium tokens — no sobrescribir gray, usar surface/brand
        brand: {
          50: '#f8f5ee',
          100: '#ede6d3',
          200: '#dccfb0',
          300: '#c6a664',
          400: '#b8934f',
          500: '#C6A664',
          600: '#a8833a',
        },
        surface: {
          DEFAULT: '#0B0D12',
          muted: '#151821',
          elevated: '#1c2030',
          border: 'rgba(255,255,255,0.08)',
        },
        text: {
          primary: '#F8FAFC',
          muted: '#94A3B8',
          dim: '#64748B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        logo: ['Luckiest Guy', 'cursive'],
      },
      fontSize: {
        fluidxs: 'clamp(0.75rem, 0.85vw, 0.875rem)',
        fluidsm: 'clamp(0.875rem, 1vw, 1rem)',
        fluidbase: 'clamp(1rem, 1.2vw, 1.125rem)',
        fluidlg: 'clamp(1.125rem, 1.5vw, 1.35rem)',
        fluidxl: 'clamp(1.25rem, 2vw, 1.75rem)',
        fluid2xl: 'clamp(1.5rem, 3vw, 2.25rem)',
        fluid3xl: 'clamp(1.875rem, 4vw, 3rem)',
        fluid4xl: 'clamp(2.25rem, 5vw, 3.75rem)',
      },
      spacing: {
        fluid: 'clamp(1rem, 4vw, 3rem)',
        'fluid-sm': 'clamp(0.75rem, 2vw, 1.5rem)',
        'fluid-lg': 'clamp(1.5rem, 3vw, 2.5rem)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0,0,0,0.35)',
        glow: '0 0 40px rgba(198,166,100,0.15)',
        'glow-blue': '0 8px 30px rgba(59,130,246,0.15)',
      },
      maxWidth: {
        fluid: 'min(100% - 2rem, 1920px)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}

