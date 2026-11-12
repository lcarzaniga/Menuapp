import { type APIRequestContext, expect, type Page } from '@playwright/test'

export const ORIGINE = 'http://127.0.0.1:4174'

/** Chiamata API come la farebbe un altro dispositivo. */
export async function apiScrivi(request: APIRequestContext, metodo: 'post' | 'put' | 'delete', url: string, corpo?: unknown) {
  const r = await request[metodo](`/api/v1${url}`, {
    headers: { origin: ORIGINE, 'content-type': 'application/json' },
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
export async function vaiA(page: Page, sezione: 'Eventi' | 'Ricettario' | 'Ingredienti' | 'Impostazioni') {
  await page.getByRole('navigation', { name: 'Sezioni' }).filter({ visible: true }).getByRole('link', { name: sezione }).click()
}
