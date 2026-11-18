import { execFileSync } from 'node:child_process'
import { type APIRequestContext, type Browser, devices, expect, type Page } from '@playwright/test'

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

/** Segreto della console del Worker nelle prove su Cloudflare (playwright.cloudflare.config.ts). */
export const CODICE_CONSOLE_E2E = 'codice-console-e2e-lungo-almeno-trentadue-caratteri'
export const SU_CLOUDFLARE = process.env.MENUAPP_E2E_CLOUDFLARE === '1'

/** Console di amministrazione sul database del server di prova (come dal terminale del server). */
export function console_(...argomenti: string[]): string {
  // Su Cloudflare: la console del Worker protetta dal segreto (scripts/cloudflare/console.ts).
  if (SU_CLOUDFLARE) {
    return execFileSync(process.execPath, ['scripts/cloudflare/console.ts', ...argomenti], {
      env: { ...process.env, MENUAPP_URL: ORIGINE, MENUAPP_CODICE_CONSOLE: CODICE_CONSOLE_E2E },
      encoding: 'utf8',
    })
  }
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

/** Nuovo familiare con il suo telefono autorizzato (invito e approvazione via API dell'amministratore). */
export async function familiare(browser: Browser, request: APIRequestContext, nome: string) {
  const id = `utente-e2e-${nome.toLowerCase()}`
  const esiste = (await apiLeggi<{ id: string }[]>(request, '/admin/utenti')).some((u) => u.id === id)
  if (!esiste) expect((await apiScrivi(request, 'post', '/admin/utenti', { id, nome, famiglia: true })).stato).toBe(201)
  const invito = (await apiScrivi(request, 'post', `/admin/utenti/${id}/inviti`, {})).corpo as { link: string }
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'it-IT', storageState: { cookies: [], origins: [] } })
  const page = await ctx.newPage()
  const codice = await chiediAccesso(page, invito.link.replace(/^https?:\/\/[^/]+/, ''), `Telefono di ${nome}`)
  const richiesta = (await apiLeggi<{ id: string; codice: string }[]>(request, '/admin/richieste')).find((r) => r.codice === codice)!
  expect((await apiScrivi(request, 'post', `/richieste/${richiesta.id}/approva`, {})).stato).toBe(200)
  await expect(page.getByRole('heading', { name: 'Eventi', exact: true })).toBeVisible({ timeout: 10_000 })
  return { id, ctx, page }
}


/** Chiamata API dal browser di un'altra persona (con la sua sessione). */
export async function apiDa(page: Page, metodo: 'POST' | 'PUT' | 'DELETE', url: string, corpo?: unknown): Promise<{ stato: number; corpo: any }> {
  return page.evaluate(
    async ({ metodo, url, corpo }) => {
      const r = await fetch(`/api/v1${url}`, { method: metodo, headers: corpo === undefined ? {} : { 'content-type': 'application/json' }, body: corpo === undefined ? undefined : JSON.stringify(corpo) })
      return { stato: r.status, corpo: await r.json().catch(() => null) }
    },
    { metodo, url, corpo },
  )
}

/** Nessuno scorrimento orizzontale della pagina. */
export async function senzaScorrimentoOrizzontale(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
}

/** Riepilogo dell'evento → menù «Azioni» → voce (SPEC §31.2). */
export async function azioneEvento(page: Page, voce: string) {
  await page.getByRole('button', { name: 'Azioni dell\'evento' }).click()
  await page.getByRole('menuitem', { name: voce }).click()
}

/** Passa alla scheda (e al segmento) dell'evento: Riepilogo, Menù, Persone, Prepara, Bacheca. */
export async function schedaEvento(page: Page, scheda: string, segmento?: string) {
  await page.getByRole('navigation', { name: 'Schede dell\'evento' }).getByRole('link', { name: scheda, exact: true }).click()
  if (segmento) await page.getByRole('navigation', { name: scheda }).getByRole('link', { name: segmento, exact: true }).click()
}
