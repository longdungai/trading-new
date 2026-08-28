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
        background: '#0b0e14',
        surface: '#121722',
        'surface-lighter': '#1a2232',
        'surface-border': '#242f44',
        primary: {
          DEFAULT: '#3b82f6',
          dark: '#1d4ed8',
          light: '#60a5fa',
        },
        accent: {
          green: '#10b981',
          red: '#f43f5e',
          yellow: '#f59e0b',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Roboto Mono', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(59, 130, 246, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
