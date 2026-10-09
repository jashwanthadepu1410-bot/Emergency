/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070b14',
          900: '#0a0f1d',
          850: '#0f172a',
          800: '#131e36',
          700: '#1e294b',
          600: '#2d3b66',
        },
        emergency: {
          red: '#ef4444',
          crimson: '#dc2626',
          darkRed: '#991b1b',
        },
        traffic: {
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
          blue: '#3b82f6',
        }
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'beacon': 'beacon 1.5s ease-in-out infinite alternate',
      },
      keyframes: {
        beacon: {
          '0%': { boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)' },
          '100%': { boxShadow: '0 0 25px rgba(239, 68, 68, 0.9), 0 0 40px rgba(239, 68, 68, 0.4)' },
        }
      }
    },
  },
  plugins: [],
}
