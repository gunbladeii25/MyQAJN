/** @type {import('tailwindcss').Config} */

// Malaysia Government Design System (MYDS) tokens — sourced from
// govtechmy/myds (packages/style/styles/theme/color.css) since the docs
// site (design.digital.gov.my) doesn't print hex codes directly.
const gray = {
  50: '#FAFAFA', 100: '#F4F4F5', 200: '#E4E4E7', 300: '#D4D4D8', 400: '#A1A1AA',
  500: '#6B6B74', 600: '#52525B', 700: '#3F3F46', 800: '#27272A', 900: '#18181B', 950: '#09090B',
}
const primary = {
  50: '#EFF6FF', 100: '#DBEAFE', 200: '#C2D5FF', 300: '#96B7FF', 400: '#6394FF',
  500: '#3A75F6', 600: '#2563EB', 700: '#1D4ED8', 800: '#1E40AF', 900: '#1E3A8A', 950: '#172554',
  // DEFAULT/light/dark kept as a transitional shim for existing `bg-primary`,
  // `hover:bg-primary-dark` etc. call sites — pages are migrating to the
  // numbered scale (bg-primary-600, etc.) directly, remove once done.
  DEFAULT: '#2563EB', light: '#6394FF', dark: '#1D4ED8',
}
const danger = {
  50: '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5', 400: '#F87171',
  500: '#EF4444', 600: '#DC2626', 700: '#B91C1C', 800: '#991B1B', 900: '#7F1D1D', 950: '#450A0A',
}
const success = {
  50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#83DAA3', 400: '#4ADE80',
  500: '#22C55E', 600: '#16A34A', 700: '#15803D', 800: '#166534', 900: '#14532D', 950: '#052E16',
}
const warning = {
  50: '#FEFCE8', 100: '#FEF9C3', 200: '#FEF08A', 300: '#FDE047', 400: '#FACC15',
  500: '#EAB308', 600: '#CA8A04', 700: '#A16207', 800: '#854D0E', 900: '#713F12', 950: '#422006',
}

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gray, primary, danger, warning, success,
        // Back-compat alias used by a handful of older call sites
        alert: { red: danger[600], orange: warning[700], yellow: warning[600], blue: primary[600], green: success[600] },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xs: '4px', sm: '6px', md: '8px', lg: '12px', xl: '14px',
      },
      boxShadow: {
        button: '0 1px 3px 0 rgba(24,24,27,0.07)',
        card: '0 2px 6px 0 rgba(24,24,27,0.05), 0 6px 24px 0 rgba(24,24,27,0.05)',
        menu: '0 2px 6px 0 rgba(24,24,27,0.05), 0 12px 50px 0 rgba(24,24,27,0.10)',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
}
