import { defineConfig, devices } from '@playwright/test'

// Server reale (backend + frontend compilato) con un database temporaneo (SPEC §17.5).
const PORTA = 4174
const ORIGINE = `http://127.0.0.1:${PORTA}`

export default defineConfig({
  testDir: 'test/e2e',
  outputDir: 'test-results/playwright',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: ORIGINE,
    channel: 'chrome',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'telefono', use: { ...devices['Pixel 7'], channel: 'chrome' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1280, height: 860 } } },
  ],
  webServer: {
    command: 'rm -rf test-results/dati-e2e && node server/main.ts',
    url: `${ORIGINE}/api/v1/salute`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      MENUAPP_HOST: '127.0.0.1',
      MENUAPP_PORTA: String(PORTA),
      MENUAPP_DATI: 'test-results/dati-e2e',
      MENUAPP_STATICI: 'test-results/dist-e2e',
      MENUAPP_ORIGINI: ORIGINE,
      MENUAPP_RILASCIO: 'e2e',
    },
  },
})
