/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        'famicom-cream': '#F5E6D0',
        'famicom-red': '#8B1A1A',
        'famicom-dark-red': '#6B1010',
        'famicom-slot': '#2A2A2A',
        'nes-blue': '#0000AA',
        'nes-white': '#FCFCFC',
        'nes-yellow': '#FFAA00',
        'nes-black': '#000000'
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'Zpix', 'monospace']
      },
      animation: {
        'cursor-blink': 'blink 0.5s step-end infinite',
        'led-pulse': 'pulse 2s ease-in-out infinite',
        'cartridge-insert': 'slide-down 0.6s ease-in-out',
        'screen-flicker': 'flicker 0.3s ease-in-out'
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' }
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' }
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' }
        },
        flicker: {
          '0%': { opacity: '1' },
          '25%': { opacity: '0.3' },
          '50%': { opacity: '0.8' },
          '75%': { opacity: '0.2' },
          '100%': { opacity: '1' }
        }
      }
    }
  },
  plugins: []
}
