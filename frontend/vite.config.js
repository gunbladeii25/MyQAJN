import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png', 'KPMJN-Hitam.png', 'logo-myqajn.png'],
      manifest: {
        name: 'MyQA@JN — AI-Powered School QA Resolution Agent',
        short_name: 'MyQA@JN',
        description: 'Sistem Pengurusan Kualiti Sekolah — Jemaah Nazir, Kementerian Pendidikan Malaysia',
        lang: 'ms',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FAFAFA',
        theme_color: '#1D4ED8',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell (hashed filenames, so a new deploy
        // is always a cache miss for changed files — no stale-app risk).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Never let the SPA navigation fallback intercept API calls or the
        // SSE dashboard stream — those must always hit the network live.
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
})
