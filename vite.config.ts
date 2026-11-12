import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Pubblicata su https://lcarzaniga.github.io/Menuapp/
  base: '/Menuapp/',
  // Solo localhost: dal PC con tunnel SSH, dal telefono con `tailscale serve`.
  // L'HMR usa la porta della pagina, quindi funziona in entrambi i casi.
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: ['loris-srv01.dala-tortoise.ts.net'],
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    allowedHosts: ['loris-srv01.dala-tortoise.ts.net'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Menù & Co.',
        short_name: 'Menù & Co.',
        description: 'Menù & Co.',
        lang: 'it',
        theme_color: '#b5482c',
        background_color: '#fbf7f2',
        display: 'standalone',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
