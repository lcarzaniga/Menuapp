// Multiutente con due browser indipendenti (SPEC §19): invito, approvazione del dispositivo,
// evento condiviso in modifica e in lettura, revoca, ricetta condivisa e copiata, revoca del
// dispositivo.
import { mkdirSync } from 'node:fs'
import { type Browser, devices, expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi, chiediAccesso } from './aiuti'

test.describe.configure({ mode: 'serial' })
const CARTELLA = 'test-results/multiutente'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${nome}.png` })
}

/** Telefono di un'altra persona: browser separato, senza la sessione dell'amministratore. */
async function telefonoNuovo(browser: Browser) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'it-IT', storageState: { cookies: [], origins: [] } })
  return { ctx, page: await ctx.newPage() }
}

test('invito, approvazione, condivisione e revoca fra due persone', async ({ page, browser, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'scenario con due browser: una sola esecuzione')
  test.setTimeout(120_000)

  // ── L'amministratore crea l'utente e il suo invito
  await page.goto('/#/impostazioni/utenti')
  await page.getByRole('button', { name: 'Utente' }).click()
  await page.getByLabel('Nome').fill('Anna')
  await page.getByRole('button', { name: 'Crea e genera l\'invito' }).click()
  const link = await page.getByLabel('Link d\'invito').inputValue()
  expect(link).toMatch(/#\/attiva\/[A-Za-z0-9_-]{43}$/)
  await foto(page, '01-invito')

  // ── Anna apre il link sul suo telefono: senza approvazione non entra
  const anna = await telefonoNuovo(browser)
  const codice = await chiediAccesso(anna.page, link, 'Telefono di Anna')
  await foto(anna.page, '02-attesa-approvazione')
  // Lo stesso link non funziona una seconda volta (né su un altro browser).
  const intruso = await telefonoNuovo(browser)
  await intruso.page.goto(link)
  await intruso.page.getByRole('button', { name: 'Richiedi l\'accesso' }).click()
  await expect(intruso.page.getByText(/già stato usato/)).toBeVisible()
  await intruso.ctx.close()

  // ── L'amministratore approva la richiesta con il codice giusto
  const richiesta = page.getByTestId('richiesta').filter({ hasText: codice })
  await expect(richiesta).toBeVisible({ timeout: 10_000 })
  await foto(page, '03-richiesta')
  await richiesta.getByRole('button', { name: 'Approva' }).click()
  await expect(anna.page.getByRole('heading', { name: 'Eventi', exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(anna.page.getByText('Crea il tuo primo evento')).toBeVisible()

  // ── Evento di Loris, condiviso con Anna in modifica
  const ev = (await apiScrivi(request, 'post', '/eventi', { id: 'ev-condiviso', nome: 'Cena dai nonni', data: '2026-12-31', oraServizio: '20:00', tipo: 'cena', occasione: '', adulti: 6, bambini: 0, note: '' })).corpo
  await apiScrivi(request, 'post', '/eventi/ev-condiviso/voci', { voci: [{ id: 'v-arrosto', portataId: ev.portate[2].id, nome: 'Arrosto' }] })
  await page.goto('/#/eventi/ev-condiviso')
  await page.getByLabel('Condividi con').selectOption({ label: 'Anna' })
  await page.getByLabel('Permesso', { exact: true }).selectOption('modifica')
  await page.getByRole('button', { name: 'Condividi', exact: true }).click()
  await expect(page.getByLabel('Permesso di Anna')).toHaveValue('modifica')
  await foto(page, '04-condivisione')

  await anna.page.reload()
  // Un solo elenco in ordine di data: l'evento condiviso si riconosce dal badge.
  await expect(anna.page.getByRole('link', { name: /Cena dai nonni/ }).first()).toBeVisible()
  await expect(anna.page.getByTestId('evento-condiviso').first()).toHaveText('di Loris · puoi modificare')
  await expect(anna.page.getByRole('region', { name: 'Condivisi con me' })).toHaveCount(0)
  await foto(anna.page, '05-eventi-anna')
  await anna.page.getByRole('link', { name: /Cena dai nonni/ }).first().click()
  await expect(anna.page.getByTestId('permesso-evento')).toHaveText('Di Loris · puoi modificare')
  await anna.page.getByRole('navigation', { name: 'Schede dell\'evento' }).getByRole('link', { name: 'Menù' }).click()
  await anna.page.getByLabel('Aggiungi a Dolci').fill('Panettone')
  await anna.page.getByLabel('Aggiungi a Dolci').press('Enter')
  await expect(anna.page.getByRole('button', { name: 'Panettone: apri dettagli' })).toBeVisible()
  // Loris vede la modifica di Anna (aggiornamento automatico dalla revisione, ogni 10 s).
  await page.goto('/#/eventi/ev-condiviso/menu')
  await expect(page.getByRole('button', { name: 'Panettone: apri dettagli' })).toBeVisible({ timeout: 15_000 })

  // ── Sola lettura: i comandi di Anna si spengono
  await page.goto('/#/eventi/ev-condiviso')
  await page.getByLabel('Permesso di Anna').selectOption('lettura')
  await expect(page.getByText('Condivisione aggiornata')).toBeVisible()
  await anna.page.reload()
  await expect(anna.page.getByTestId('permesso-evento')).toHaveText('Di Loris · sola lettura')
  await expect(anna.page.getByLabel('Aggiungi a Dolci')).toBeDisabled()
  await foto(anna.page, '06-sola-lettura')
  // Anche tentando dall'API, il server rifiuta.
  const tentativo = await anna.page.evaluate(async () => {
    const r = await fetch('/api/v1/eventi/ev-condiviso/voci', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ voci: [{ id: 'v-x', portataId: 'x', nome: 'Intruso' }] }),
    })
    return r.status
  })
  expect(tentativo).toBe(403)

  // ── Revoca della condivisione
  await page.getByRole('button', { name: 'Revoca a Anna' }).click()
  await page.getByRole('button', { name: 'Revoca', exact: true }).click()
  await anna.page.reload()
  await expect(anna.page.getByText('Questo evento non è disponibile')).toBeVisible()
  await foto(anna.page, '07-evento-revocato')

  // ── Ricettario di famiglia: Anna vede la ricetta di Loris senza condivisioni e la copia
  // Con più Famiglie la ricetta va resa visibile in una (SPEC §28): quella di Anna.
  const famiglia = (await (await request.get('/api/v1/gruppi')).json()).find((g: { nome: string }) => g.nome === 'Famiglia').id
  await apiScrivi(request, 'post', '/piatti', { id: 'p-cotechino', nome: 'Cotechino con lenticchie', porzioniBase: 6, ingredienti: [], famiglie: [famiglia] })
  await anna.page.goto('/#/ricettario')
  const riga = anna.page.getByRole('link', { name: /Cotechino con lenticchie/ })
  await expect(riga).toContainText('di Loris')
  await foto(anna.page, '08-ricettario-famiglia')
  await riga.click()
  await expect(anna.page.getByRole('button', { name: 'Modifica' })).toHaveCount(0)
  await anna.page.getByRole('button', { name: 'Copia nel mio ricettario' }).click()
  await expect(anna.page.getByText('dalla ricetta di Loris')).toBeVisible()
  await expect(anna.page.getByRole('button', { name: 'Modifica' })).toBeEnabled()
  await foto(anna.page, '09-copia-ricetta')

  // ── Loris rende privata la ricetta: Anna non vede più l'originale, la sua copia resta
  await page.goto('/#/ricettario/p-cotechino')
  await expect(page.getByTestId('visibilita-ricetta')).toContainText('Visibile ai membri di Famiglia')
  // Con una Famiglia c'è «Rendi privata»; con più Famiglie si sceglie «Privata» nell'elenco.
  const rendiPrivata = page.getByRole('button', { name: 'Rendi privata' })
  if (await rendiPrivata.count()) await rendiPrivata.click()
  else await page.getByLabel('Dove è visibile la ricetta').selectOption({ label: 'Privata: solo io' })
  await expect(page.getByTestId('visibilita-ricetta')).toContainText('la vedi solo tu')
  await foto(page, '10-ricetta-privata')
  await anna.page.goto('/#/ricettario')
  await expect(anna.page.getByRole('link', { name: /Cotechino con lenticchie/ })).toHaveCount(1)
  await expect(anna.page.getByRole('link', { name: /Cotechino con lenticchie/ })).not.toContainText('di Loris')
  // Loris vede solo la sua (privata): la copia di Anna nasce privata.
  const diLoris = await apiLeggi<{ nome: string; mio: boolean; visibilita: string; proprietario: { nome: string } }[]>(request, '/piatti?q=cotechino')
  expect(diLoris.map((p) => [p.proprietario.nome, p.mio, p.visibilita])).toEqual([['Loris', true, 'privata']])

  // ── Revoca del dispositivo di Anna
  await page.goto('/#/impostazioni/utenti')
  const dispositivo = page.getByTestId('dispositivo').filter({ hasText: 'Telefono di Anna' })
  await dispositivo.getByRole('button', { name: 'Scollega' }).click()
  await page.getByRole('button', { name: 'Scollega', exact: true }).last().click()
  await expect(page.getByText('Dispositivo scollegato')).toBeVisible()
  await anna.page.goto('/#/')
  await expect(anna.page.getByRole('heading', { name: /non autorizzato|non più valido/ })).toBeVisible({ timeout: 15_000 })
  await foto(anna.page, '11-dispositivo-revocato')
  await anna.ctx.close()
})

test('dall\'esterno senza sessione: solo la schermata di accesso, nessun dato dalle API', async ({ browser }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  const { ctx, page } = await telefonoNuovo(browser)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dispositivo non autorizzato' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Sezioni' })).toHaveCount(0)
  await foto(page, '00-non-autorizzato')
  const stati = await page.evaluate(async () =>
    Promise.all(['/api/v1/eventi', '/api/v1/piatti', '/api/v1/esportazione', '/api/v1/backup', '/api/v1/admin/utenti'].map(async (u) => (await fetch(u)).status)),
  )
  expect(stati).toEqual([401, 401, 401, 401, 401])
  await ctx.close()
})
