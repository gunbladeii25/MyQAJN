/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1C458A', light: '#2557B0', dark: '#163670' },
        alert: { red: '#DC2626', orange: '#EA580C', yellow: '#CA8A04', blue: '#2563EB', green: '#16A34A' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
