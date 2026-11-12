import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pacchetto from './package.json' with { type: 'json' }

// Hash corto del commit, mostrato in Impostazioni → Dati.
function hashCommit(): string {
  if (process.env.MENUAPP_COMMIT) return process.env.MENUAPP_COMMIT
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'sconosciuto'
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  define: {
    __VERSIONE_APP__: JSON.stringify(`${pacchetto.version}+${hashCommit()}`),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Solo localhost: dal PC con tunnel SSH, dal telefono con `tailscale serve :8443`.
  // Le chiamate /api vanno al backend di sviluppo (npm run dev:server).
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: ['loris-srv01.dala-tortoise.ts.net'],
    proxy: { '/api': { target: 'http://127.0.0.1:9871', changeOrigin: false } },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        // I dati non vanno mai in cache: SQLite sul server è l'unica fonte di verità.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: /\/api\//, handler: 'NetworkOnly' }],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        id: '/',
        name: 'Menù & Co.',
        short_name: 'Menù & Co.',
        description: 'Pranzi, cene e ricorrenze di famiglia: menù, ricette, spesa e preparazione.',
        lang: 'it',
        start_url: '/',
        scope: '/',
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
