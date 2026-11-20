import { defineConfig, devices } from '@playwright/test'

// Confronti visivi del restyling (fase 0): schermate di riferimento delle pagine principali, su un
// server separato con un database nuovo a ogni esecuzione, così i dati degli altri test non entrano
// nelle immagini. Le schermate di riferimento valgono per questo server e per il Chrome installato:
// dopo un aggiornamento di Chrome si rigenerano (npm run test:aspetto:aggiorna) prima di confrontare.
const PORTA = '4176'
const ORIGINE = `http://127.0.0.1:${PORTA}`
const DATI = 'test-results/dati-aspetto'
const SESSIONE = 'test-results/sessione-aspetto.json'
// Gli aiuti condivisi con gli e2e (console, accesso) leggono server e dati da qui.
process.env.MENUAPP_E2E_PORTA = PORTA
process.env.MENUAPP_E2E_DATI = DATI
process.env.MENUAPP_E2E_SESSIONE = SESSIONE

export default defineConfig({
  testDir: 'test/e2e',
  testMatch: /(accesso\.setup|aspetto\.visivo)\.ts/,
  outputDir: 'test-results/aspetto',
  snapshotPathTemplate: 'test/e2e/aspetto/{arg}{ext}',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
    // Stesso Chrome e stessi caratteri: si chiede l'identità, con la sola tolleranza dell'antialiasing.
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixels: 0 },
  },
  reporter: [['list']],
  use: { baseURL: ORIGINE, channel: 'chrome', locale: 'it-IT', timezoneId: 'Europe/Rome', trace: 'retain-on-failure' },
  projects: [
    { name: 'accesso', testMatch: /accesso\.setup\.ts/, use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'aspetto', testMatch: /aspetto\.visivo\.ts/, dependencies: ['accesso'], use: { ...devices['Desktop Chrome'], channel: 'chrome', storageState: SESSIONE } },
  ],
  webServer: {
    command: `rm -rf ${DATI} && node server/main.ts`,
    url: `${ORIGINE}/api/v1/salute`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      MENUAPP_HOST: '127.0.0.1',
      MENUAPP_PORTA: PORTA,
      MENUAPP_DATI: DATI,
      MENUAPP_STATICI: 'test-results/dist-aspetto',
      MENUAPP_ORIGINI: ORIGINE,
      MENUAPP_RILASCIO: 'aspetto',
      MENUAPP_URL_PRIVATO: ORIGINE,
    },
  },
})
