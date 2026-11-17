// Aggiornamento della PWA fra due build reali (SPEC §13, §29.8), su un server di prova isolato
// (127.0.0.1:4175, dati in test-results/dati-pwa): l'app installata con la build in uso rileva la
// nuova versione, avvisa senza ricaricare da sola, si aggiorna su richiesta, non tiene file della
// build vecchia e conserva sessione, dati e preferenze del dispositivo. La produzione non è toccata.
import { execFileSync } from 'node:child_process'
import { cpSync, readdirSync, rmSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { chiediAccesso } from './aiuti'

const ORIGINE = 'http://127.0.0.1:4175'
const STATICI = 'test-results/statici-pwa'
const BUILD_NUOVA = 'test-results/dist-pwa-nuova'

const console_ = (...argomenti: string[]) =>
  execFileSync(process.execPath, ['server/amministrazione.ts', ...argomenti], {
    env: { ...process.env, MENUAPP_DATI: 'test-results/dati-pwa', MENUAPP_URL_PRIVATO: ORIGINE },
    encoding: 'utf8',
  })

/** URL dei file del guscio in cache nel service worker. */
const inCache = () =>
  (async () => {
    const url: string[] = []
    for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) url.push(new URL(r.url).pathname)
    return url
  })()

test('nuova versione: rilevata, annunciata, applicata su richiesta, senza file vecchi né dati persi', async ({ page }) => {
  test.setTimeout(90_000)
  // ── Primo accesso con la build in uso
  const link = /https?:\/\/\S+\/#\/attiva\/\S+/.exec(console_('invito'))![0]
  const codice = await chiediAccesso(page, link.replace(/^https?:\/\/[^/]+/, ''), 'Telefono di prova PWA')
  expect(console_('approva', codice)).toContain('Approvata')
  await expect(page.getByRole('heading', { name: 'Eventi', exact: true })).toBeVisible({ timeout: 10_000 })
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // Ricaricando, la pagina è servita dal service worker.
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await page.goto('/#/impostazioni/dati')
  const versioneVecchia = (await page.getByText(/^0\.1\.0\+/).first().textContent())!.split(' ')[0]!
  expect(versioneVecchia).not.toContain('pwa-nuova')

  // Dati sul server e preferenza del dispositivo, che devono sopravvivere all'aggiornamento.
  const evento = await page.evaluate(async () => {
    const r = await fetch('/api/v1/eventi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'ev-pwa', nome: 'Cena prima dell\'aggiornamento', data: '2027-01-15', oraServizio: '20:00', tipo: 'cena', occasione: '', adulti: 4, bambini: 0, note: '' }),
    })
    return r.status
  })
  expect(evento).toBe(201)
  await page.evaluate(() => localStorage.setItem('menuapp.prova-pwa', 'resta'))
  await page.goto('/#/')
  await page.reload()
  await expect(page.getByText('Cena prima dell\'aggiornamento')).toBeVisible()
  await expect(page.getByText('Nuova versione disponibile')).toHaveCount(0)
  const vecchiFile = (await page.evaluate(inCache)).filter((u) => u.startsWith('/assets/'))
  expect(vecchiFile.length).toBeGreaterThan(0)

  // ── Rilascio della nuova build sul server di prova (i file statici vengono sostituiti)
  rmSync(STATICI, { recursive: true, force: true })
  cpSync(BUILD_NUOVA, STATICI, { recursive: true })
  const fileNuovi = new Set(readdirSync(`${BUILD_NUOVA}/assets`).map((f) => `/assets/${f}`))
  const soloVecchi = vecchiFile.filter((u) => !fileNuovi.has(u))
  expect(soloVecchi.length, 'le due build devono differire').toBeGreaterThan(0)

  // ── Ritorno in primo piano: controllo, avviso; nessun ricaricamento automatico
  const prima = await page.evaluate(() => performance.timeOrigin)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByText('Nuova versione disponibile')).toBeVisible({ timeout: 20_000 })
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(prima)
  // Intanto l'app funziona ancora con la versione vecchia.
  await expect(page.getByText('Cena prima dell\'aggiornamento')).toBeVisible()

  // ── Aggiorna: la pagina si ricarica con la nuova build
  await Promise.all([page.waitForEvent('load', { timeout: 20_000 }), page.getByRole('button', { name: 'Aggiorna' }).click()])
  expect(await page.evaluate(() => performance.timeOrigin)).not.toBe(prima)
  await page.goto('/#/impostazioni/dati')
  await expect(page.getByText(/^0\.1\.0\+pwa-nuova/)).toBeVisible()
  await expect(page.getByText('Nuova versione disponibile')).toHaveCount(0)

  // Nessun file della build vecchia nella cache; tutti quelli nuovi sì.
  const cache = await page.evaluate(inCache)
  expect(cache.filter((u) => soloVecchi.includes(u))).toEqual([])
  expect(cache).toContain('/index.html')
  expect(cache.some((u) => u.startsWith('/api/'))).toBe(false)

  // Sessione, dati del server e preferenze del dispositivo intatti.
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: 'Eventi', exact: true })).toBeVisible()
  await expect(page.getByText('Cena prima dell\'aggiornamento')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('menuapp.prova-pwa'))).toBe('resta')
})
