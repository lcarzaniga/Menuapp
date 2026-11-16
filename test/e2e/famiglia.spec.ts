// Spazio della famiglia con due browser indipendenti (SPEC §20): bacheca con sondaggio,
// notifiche, bacheca dell'evento con proposta accettata nel menù, chi porta cosa integrato
// con la spesa, valutazioni e classifica.
import { mkdirSync } from 'node:fs'
import { type APIRequestContext, type Browser, devices, expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi, chiediAccesso } from './aiuti'

test.describe.configure({ mode: 'serial' })
const CARTELLA = 'test-results/famiglia'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${nome}.png` })
}

/** Nuovo familiare con il suo telefono autorizzato (invito e approvazione via API dell'amministratore). */
async function familiare(browser: Browser, request: APIRequestContext, nome: string) {
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

const oggi = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })

test('famiglia: bacheca e sondaggio, evento con proposta, chi porta cosa, stelle e classifica', async ({ page, browser, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'scenario con due browser: una sola esecuzione')
  test.setTimeout(150_000)
  const lucia = await familiare(browser, request, 'Lucia')

  // ── Bacheca della famiglia: Loris apre un sondaggio
  await page.goto('/#/famiglia')
  await expect(page.getByRole('heading', { name: 'Famiglia' })).toBeVisible()
  await page.getByRole('button', { name: 'Sondaggio' }).click()
  await page.getByLabel('Domanda').fill('Natale: carne o pesce?')
  await page.getByLabel('Opzione 1').fill('Carne')
  await page.getByLabel('Opzione 2').fill('Pesce')
  await page.getByRole('button', { name: 'Pubblica' }).click()
  const sondaggio = page.getByRole('article', { name: 'Messaggio di Loris' }).filter({ hasText: 'Natale: carne o pesce?' })
  await expect(sondaggio).toBeVisible()

  // ── Lucia: campanella, notifica, apertura diretta, voto e commento
  await lucia.page.reload()
  await expect(lucia.page.getByRole('link', { name: /Notifiche, \d+ da leggere/ })).toBeVisible({ timeout: 15_000 })
  await lucia.page.getByRole('link', { name: /Notifiche/ }).click()
  await foto(lucia.page, '01-notifiche')
  await lucia.page.getByRole('button', { name: /carne o pesce/ }).click()
  await expect(lucia.page).toHaveURL(/#\/famiglia\?messaggio=/)
  const perLucia = lucia.page.getByRole('article', { name: 'Messaggio di Loris' }).filter({ hasText: 'Natale: carne o pesce?' })
  await perLucia.getByRole('radio', { name: 'Pesce' }).click()
  await expect(perLucia.getByText('1 votante')).toBeVisible()
  await perLucia.getByLabel('Rispondi').fill('Pesce, senza dubbio!')
  await perLucia.getByRole('button', { name: 'Invia il commento' }).click()
  await expect(perLucia.getByText('Pesce, senza dubbio!')).toBeVisible()
  await perLucia.getByRole('button', { name: 'Aggiungi una reazione' }).click()
  await perLucia.getByRole('button', { name: /😋 0/ }).click()
  await foto(lucia.page, '02-bacheca-famiglia')

  // Loris riceve la risposta e vede il risultato.
  await page.goto('/#/notifiche')
  await expect(page.getByRole('button', { name: /Pesce, senza dubbio!/ })).toBeVisible({ timeout: 15_000 })
  await page.goto('/#/famiglia')
  // Risultati dopo il voto: prima di votare Loris non li vede.
  await expect(sondaggio.getByText('risultati dopo il voto')).toBeVisible()
  await sondaggio.getByRole('radio', { name: 'Carne' }).click()
  await expect(sondaggio.getByRole('radio', { name: /Pesce/ })).toContainText('Lucia')
  await expect(sondaggio.getByText('2 votanti')).toBeVisible()

  // ── Evento di Loris condiviso con Lucia in sola lettura (partecipa)
  const ev = (await apiScrivi(request, 'post', '/eventi', { id: 'ev-famiglia', nome: 'Pranzo di famiglia', data: oggi(), oraServizio: '13:00', tipo: 'pranzo', occasione: '', adulti: 8, bambini: 0, note: '' })).corpo
  await apiScrivi(request, 'post', '/piatti', {
    id: 'p-tiramisu-e2e',
    nome: 'Tiramisù della festa',
    porzioniBase: 8,
    ingredienti: [{ id: 'i-masc-e2e', ordine: 0, testoOriginale: '500 g mascarpone', nome: 'mascarpone', ingredienteId: null, quantita: 500, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] }],
  })
  await apiScrivi(request, 'post', '/eventi/ev-famiglia/voci', { voci: [{ id: 'v-tiramisu-e2e', portataId: ev.portate[4].id, nome: 'Tiramisù', piattoId: 'p-tiramisu-e2e' }] })
  await apiScrivi(request, 'put', `/eventi/ev-famiglia/condivisioni/${lucia.id}`, { permesso: 'lettura' })

  // Lucia propone un piatto nella bacheca dell'evento.
  await lucia.page.goto('/#/eventi/ev-famiglia/bacheca')
  await lucia.page.getByRole('button', { name: 'Proponi un piatto' }).click()
  await lucia.page.getByLabel('Piatto proposto').fill('Panettone farcito')
  await lucia.page.getByLabel('Portata').selectOption('Dolci')
  await lucia.page.getByRole('button', { name: 'Pubblica' }).click()
  await expect(lucia.page.getByRole('article', { name: 'Messaggio di Lucia' }).getByText('In valutazione')).toBeVisible()
  await foto(lucia.page, '03-proposta')

  // Lucia si offre per il tiramisù, che porta già pronto: esce dalla spesa.
  await lucia.page.getByRole('navigation', { name: 'Schede dell\'evento' }).getByRole('link', { name: 'Chi porta' }).click()
  const riga = lucia.page.getByTestId('incarico').filter({ hasText: 'Tiramisù' })
  await riga.getByRole('button', { name: 'Me ne occupo io' }).click()
  await lucia.page.getByRole('dialog').getByRole('button', { name: 'Me ne occupo io' }).click()
  await expect(riga.getByText('tu')).toBeVisible()
  await expect(riga.getByText('fuori dalla spesa')).toBeVisible()
  await foto(lucia.page, '04-chi-porta')

  // ── Loris accetta la proposta e la mette nel menù; vede chi porta il tiramisù
  await page.goto('/#/eventi/ev-famiglia/bacheca')
  const proposta = page.getByRole('article', { name: 'Messaggio di Lucia' })
  await proposta.getByRole('button', { name: 'Accetta e metti nel menù' }).click()
  await expect(proposta.getByText('✓ Nel menù')).toBeVisible()
  await foto(page, '05-proposta-accettata')
  await page.getByRole('navigation', { name: 'Schede dell\'evento' }).getByRole('link', { name: 'Menù' }).click()
  await expect(page.getByRole('button', { name: 'Panettone farcito: apri dettagli' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tiramisù: apri dettagli' })).toContainText('Lucia')
  const spesa = await apiLeggi<unknown>(request, '/eventi/ev-famiglia/spesa')
  expect(JSON.stringify(spesa)).not.toContain('mascarpone')

  // ── Stelle (l'evento è oggi) e classifica
  await lucia.page.goto('/#/eventi/ev-famiglia/menu')
  await lucia.page.getByRole('group', { name: 'Valuta Tiramisù' }).getByRole('button', { name: '5 stelle' }).click()
  await expect(lucia.page.getByRole('group', { name: 'Valuta Tiramisù' })).toContainText('1 voto')
  await foto(lucia.page, '06-stelle')
  await page.goto('/#/famiglia?scheda=apprezzati')
  await expect(page.getByRole('list', { name: 'Classifica dei piatti' })).toContainText('Tiramisù')
  await foto(page, '07-classifica')

  // ── Revoca: per Lucia l'evento (e la sua bacheca) non esistono più
  await apiScrivi(request, 'delete', `/eventi/ev-famiglia/condivisioni/${lucia.id}`)
  await lucia.page.goto('/#/eventi/ev-famiglia/bacheca')
  await expect(lucia.page.getByText('Questo evento non è disponibile')).toBeVisible()
  await lucia.ctx.close()
})
