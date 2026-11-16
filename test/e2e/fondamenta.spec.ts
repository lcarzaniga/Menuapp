import { expect, test } from '@playwright/test'
import { apiLeggi, apiScrivi, riattaccaServer, staccaServer, vaiA } from './aiuti'

test.describe.configure({ mode: 'serial' })

test('navigazione fra le sezioni e ricarica su una rotta profonda', async ({ page }) => {
  await page.goto('/')
  for (const s of ['Ricettario', 'Famiglia', 'Notifiche', 'Impostazioni', 'Eventi'] as const) {
    await vaiA(page, s)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
  await page.goto('/#/impostazioni/dati')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Dati e backup' })).toBeVisible()
  await page.goto('/#/non/esiste')
  await expect(page.getByRole('heading', { name: 'Pagina non trovata' })).toBeVisible()
})

test('server non raggiungibile: banner e comandi disattivati, poi ritorno automatico', async ({ page }) => {
  await page.goto('/#/impostazioni/dati')
  const backupOra = page.getByRole('button', { name: 'Backup ora' })
  await expect(backupOra).toBeEnabled()
  await staccaServer(page)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('status')).toContainText('Server non raggiungibile')
  await expect(backupOra).toBeDisabled()
  await riattaccaServer(page)
  await page.getByRole('button', { name: 'Riprova' }).click()
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(backupOra).toBeEnabled()
})

test('backup ora, esportazione e ripristino dal backup', async ({ page, request }) => {
  await page.goto('/#/impostazioni/dati')
  await page.getByRole('button', { name: 'Backup ora' }).click()
  await expect(page.getByText(/Backup creato e verificato/)).toBeVisible()
  const zip = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Esporta con le foto (ZIP)' }).click()
  expect((await zip).suggestedFilename()).toMatch(/^menuapp-esportazione-.*\.zip$/)
  const json = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Solo dati (JSON)' }).click()
  expect((await json).suggestedFilename()).toMatch(/^menuapp-esportazione-.*\.json$/)

  const revisione = (await apiLeggi<{ revisione: number }>(request, '/revisione')).revisione
  await page.getByRole('button', { name: 'Ripristina' }).first().click()
  await expect(page.getByRole('dialog')).toContainText('Ripristinare questi dati?')
  const pulsante = page.getByRole('dialog').getByRole('button', { name: 'Ripristina' })
  await expect(pulsante).toBeDisabled()
  await page.getByLabel(/Per confermare/).fill('ripristina')
  await pulsante.click()
  await expect(page.getByText('Ripristino completato')).toBeVisible()
  expect((await apiLeggi<{ revisione: number }>(request, '/revisione')).revisione).toBeGreaterThan(revisione)
})

test('due dispositivi: la modifica dell\'uno arriva all\'altro e il conflitto è segnalato', async ({ request }) => {
  const imp = await apiLeggi<{ versione: number; coefficienteBambini: number; portatePredefinite: { id: string; nome: string }[] }>(request, '/impostazioni')
  const corpo = { portatePredefinite: imp.portatePredefinite, versione: imp.versione }
  const a = await apiScrivi(request, 'put', '/impostazioni', { ...corpo, coefficienteBambini: 0.6 })
  const b = await apiScrivi(request, 'put', '/impostazioni', { ...corpo, coefficienteBambini: 0.4 })
  expect(a.stato).toBe(200)
  expect(b.stato).toBe(409)
  expect(b.corpo.errore.dettagli.attuale.coefficienteBambini).toBe(0.6)
})

test('service worker: guscio in cache, API mai in cache', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  const cache = await page.evaluate(async () => {
    const nomi = await caches.keys()
    const url: string[] = []
    for (const n of nomi) for (const r of await (await caches.open(n)).keys()) url.push(new URL(r.url).pathname)
    return url
  })
  expect(cache).toContain('/index.html')
  expect(cache.some((u) => u.startsWith('/api/'))).toBe(false)
})
