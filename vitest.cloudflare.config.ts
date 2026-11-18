import { defineConfig } from 'vitest/config'

// Prove dell'installazione Cloudflare sul Worker in locale (npm run test:cloudflare, SPEC §32.8).
export default defineConfig({
  test: {
    name: 'cloudflare',
    environment: 'node',
    include: ['test/cloudflare/**/*.test.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
})
