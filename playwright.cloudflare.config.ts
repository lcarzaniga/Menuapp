import { defineConfig } from '@playwright/test'
import base from './playwright.config'
import { CODICE_CONSOLE_E2E } from './test/e2e/aiuti'

// Stessa suite e2e contro il Worker in locale (wrangler dev: workerd, Durable Object, R2 simulati),
// con la console protetta dal segreto al posto del terminale del server (SPEC §32.8).
// L'aggiornamento della PWA fra due build (progetto `pwa`) resta una prova del server Debian.
const PORTA = 4174
const ORIGINE = `http://127.0.0.1:${PORTA}`
process.env.MENUAPP_E2E_CLOUDFLARE = '1'

export default defineConfig({
  ...base,
  projects: base.projects!.filter((p) => p.name !== 'pwa'),
  webServer: [
    {
      command: [
        'rm -rf test-results/dati-cf-e2e && npx wrangler dev',
        // --local-upstream: senza, wrangler riscrive Host e Origin col dominio di produzione della rotta.
        `--port ${PORTA} --ip 127.0.0.1 --local-upstream 127.0.0.1:${PORTA} --persist-to test-results/dati-cf-e2e --log-level warn`,
        `--var MENUAPP_URL_PUBBLICO:${ORIGINE} --var MENUAPP_CODICE_CONSOLE:${CODICE_CONSOLE_E2E} --var MENUAPP_RILASCIO:e2e`,
      ].join(' '),
      url: `${ORIGINE}/api/v1/salute`,
      reuseExistingServer: false,
      timeout: 90_000,
    },
  ],
})
