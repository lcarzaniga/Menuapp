import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) }

export default defineConfig({
  define: { __VERSIONE_APP__: JSON.stringify('0.0.0-test') },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'dominio',
          environment: 'node',
          include: ['src/domain/**/*.test.ts', 'src/contratto/**/*.test.ts', 'test/*.test.ts'],
        },
      },
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts'],
          // SQLite reale su file: un worker per file di test, niente condivisione.
          pool: 'forks',
          testTimeout: 20000,
        },
      },
      {
        // Stessa suite sul motore leggero, quello dell'installazione Cloudflare (SPEC §32.1).
        test: {
          name: 'server-leggero',
          environment: 'node',
          include: ['server/**/*.test.ts'],
          env: { MENUAPP_MOTORE: 'leggero' },
          pool: 'forks',
          testTimeout: 20000,
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        define: { __VERSIONE_APP__: JSON.stringify('0.0.0-test') },
        test: {
          name: 'ui',
          environment: 'happy-dom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./test/setup-ui.ts'],
        },
      },
    ],
  },
})
