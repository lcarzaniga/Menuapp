import { execFileSync } from 'node:child_process'
import { type APIRequestContext, expect, type Page } from '@playwright/test'

export const ORIGINE = 'http://127.0.0.1:4174'

/** Chiamata API come la farebbe un altro dispositivo. */
export async function apiScrivi(request: APIRequestContext, metodo: 'post' | 'put' | 'delete', url: string, corpo?: unknown) {
  const r = await request[metodo](`/api/v1${url}`, {
    headers: corpo === undefined ? { origin: ORIGINE } : { origin: ORIGINE, 'content-type': 'application/json' },
    ...(corpo === undefined ? {} : { data: corpo }),
  })
  return { stato: r.status(), corpo: await r.json().catch(() => null) }
}

export async function apiLeggi<T = unknown>(request: APIRequestContext, url: string): Promise<T> {
  const r = await request.get(`/api/v1${url}`)
  expect(r.ok()).toBeTruthy()
  return (await r.json()) as T
}

/** Simula il server non raggiungibile per questa pagina. */
export async function staccaServer(page: Page) {
  await page.route('**/api/**', (r) => r.abort('connectionrefused'))
}
export async function riattaccaServer(page: Page) {
  await page.unroute('**/api/**')
}

/** Clic sulla barra di navigazione, che su telefono e su desktop è diversa. */
export async function vaiA(page: Page, sezione: 'Eventi' | 'Ricettario' | 'Famiglia' | 'Notifiche' | 'Impostazioni') {
  await page.getByRole('navigation', { name: 'Sezioni' }).filter({ visible: true }).getByRole('link', { name: sezione }).click()
}

const DATI_E2E = 'test-results/dati-e2e'

/** Console di amministrazione sul database del server di prova (come dal terminale del server). */
export function console_(...argomenti: string[]): string {
  return execFileSync(process.execPath, ['server/amministrazione.ts', ...argomenti], {
    env: { ...process.env, MENUAPP_DATI: DATI_E2E, MENUAPP_URL_PRIVATO: ORIGINE },
    encoding: 'utf8',
  })
}

/** Link d'invito creato dalla console per un utente. */
export function invitoDaConsole(utente?: string): string {
  const uscita = console_('invito', ...(utente ? [utente] : []))
  const link = /https?:\/\/\S+\/#\/attiva\/\S+/.exec(uscita)?.[0]
  if (!link) throw new Error(`Nessun link nell'uscita della console: ${uscita}`)
  return link
}

/** Da un link d'invito: richiesta dal browser, poi restituisce il codice mostrato. */
export async function chiediAccesso(page: Page, link: string, dispositivo: string): Promise<string> {
  await page.goto(link)
  await page.getByLabel('Nome del dispositivo').fill(dispositivo)
  await page.getByRole('button', { name: 'Richiedi l\'accesso' }).click()
  const codice = (await page.getByTestId('codice-attivazione').textContent())?.trim() ?? ''
  expect(codice).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/)
  return codice
}
