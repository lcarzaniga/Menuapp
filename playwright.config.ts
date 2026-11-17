import { defineConfig, devices } from '@playwright/test'

// Server reale (backend + frontend compilato) con un database temporaneo (SPEC §17.5).
const PORTA = 4174
const ORIGINE = `http://127.0.0.1:${PORTA}`
const SESSIONE_AMMINISTRATORE = 'test-results/sessione-amministratore.json'
// Aggiornamento della PWA fra due build (SPEC §29.8): un secondo server isolato, con dati e file
// statici suoi; la cartella dei file viene sostituita durante il test dalla seconda build.
const PORTA_PWA = 4175
const ORIGINE_PWA = `http://127.0.0.1:${PORTA_PWA}`
const ambiente = (porta: number, origine: string, dati: string, statici: string) => ({
  MENUAPP_HOST: '127.0.0.1',
  MENUAPP_PORTA: String(porta),
  MENUAPP_DATI: dati,
  MENUAPP_STATICI: statici,
  MENUAPP_ORIGINI: origine,
  MENUAPP_RILASCIO: 'e2e',
  MENUAPP_URL_PRIVATO: origine,
})

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
    // Primo accesso reale dell'amministratore (invito da console, approvazione con codice):
    // la sessione salvata vale per tutti gli altri test.
    { name: 'accesso', testMatch: /accesso\.setup\.ts/, use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'telefono', dependencies: ['accesso'], use: { ...devices['Pixel 7'], channel: 'chrome', storageState: SESSIONE_AMMINISTRATORE } },
    {
      name: 'desktop',
      dependencies: ['accesso'],
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1280, height: 860 }, storageState: SESSIONE_AMMINISTRATORE },
    },
    { name: 'pwa', testMatch: /aggiornamento\.pwa\.ts/, use: { ...devices['Pixel 7'], channel: 'chrome', baseURL: ORIGINE_PWA } },
  ],
  webServer: [
    {
      command: 'rm -rf test-results/dati-e2e && node server/main.ts',
      url: `${ORIGINE}/api/v1/salute`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: ambiente(PORTA, ORIGINE, 'test-results/dati-e2e', 'test-results/dist-e2e'),
    },
    {
      command: 'rm -rf test-results/dati-pwa test-results/statici-pwa && cp -r test-results/dist-e2e test-results/statici-pwa && node server/main.ts',
      url: `${ORIGINE_PWA}/api/v1/salute`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: ambiente(PORTA_PWA, ORIGINE_PWA, 'test-results/dati-pwa', 'test-results/statici-pwa'),
    },
  ],
})
