// Riorganizzazione (SPEC §31), dal telefono: cinque sezioni, Famiglia attiva ricordata e distinta da
// quella dell'evento, nuovo evento nella Famiglia giusta, cinque schede dell'evento con i vecchi
// indirizzi, «Per te», duplicazione anche in sola lettura, vista cucina, ricetta, archivio,
// impostazioni personali e di amministrazione, ricaricamento.
import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { apiDa, apiLeggi, apiScrivi, familiare, schedaEvento, senzaScorrimentoOrizzontale } from './aiuti'

test.describe.configure({ mode: 'serial' })
const CARTELLA = 'test-results/riorganizzazione'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${nome}.png`, fullPage: true })
}
const selettore = (page: Page) => page.getByRole('combobox', { name: 'Famiglia attiva' }).filter({ visible: true })
const scheda = (page: Page, nome: string) => page.getByRole('navigation', { name: 'Schede dell\'evento' }).getByRole('link', { name: nome, exact: true })

test('navigazione riorganizzata, Famiglie, schede, duplicazione e permessi', async ({ page, browser, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'scenario su telefono con due persone: una sola esecuzione')
  test.setTimeout(150_000)
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  await apiScrivi(request, 'post', '/famiglie', { id: 'ro-amici', nome: 'Amici del lago' })
  await page.addInitScript((id) => {
    if (!sessionStorage.getItem('ro-inizio')) {
      sessionStorage.setItem('ro-inizio', '1')
      localStorage.setItem('menuapp.famiglia', id)
    }
  }, famiglia.id)

  // ── Cinque sezioni nella barra in basso
  await page.goto('/#/')
  const barra = page.getByRole('navigation', { name: 'Sezioni' }).filter({ visible: true })
  for (const s of ['Eventi', 'Ricettario', 'Famiglia', 'Notifiche', 'Impostazioni']) await expect(barra.getByRole('link', { name: new RegExp(s) })).toBeVisible()

  // ── Famiglia attiva: scelta dall'utente e ricordata dopo il ricaricamento
  await expect(selettore(page)).toHaveValue(famiglia.id)
  await selettore(page).selectOption({ label: 'Amici del lago' })
  await page.reload()
  await expect(selettore(page)).toHaveValue('ro-amici')
  // Un nuovo evento nasce nella Famiglia attiva, che si vede e si può cambiare.
  await page.getByRole('link', { name: 'Nuovo', exact: true }).click()
  await expect(page.getByLabel('Famiglia', { exact: true })).toHaveValue('ro-amici')
  await page.getByLabel('Occasione').fill('Ferragosto')
  await page.getByLabel('Data').fill('2027-08-15')
  await page.getByRole('button', { name: 'Crea e componi il menù' }).click()
  await expect(page.getByRole('heading', { name: 'Ferragosto 2027' })).toBeVisible()
  const grigliata = /eventi\/([^/]+)/.exec(page.url())![1]!
  expect((await apiLeggi<{ gruppo: { id: string } | null }>(request, `/eventi/${grigliata}/accesso`)).gruppo?.id).toBe('ro-amici')

  // ── Evento della Famiglia «Famiglia» aperto con «Amici del lago» attiva: il contesto si vede,
  // la Famiglia attiva non cambia da sola.
  const ev = (await apiScrivi(request, 'post', '/eventi', { id: 'ro-ev', nome: 'Pranzo della domenica', data: '2027-03-07', oraServizio: '13:00', tipo: 'pranzo', occasione: '', adulti: 6, bambini: 0, note: '', gruppoId: famiglia.id })).corpo
  await apiScrivi(request, 'post', '/piatti', { id: 'ro-ragu', nome: 'Ragù della domenica', porzioniBase: 6, ingredienti: [], famiglie: [famiglia.id] })
  await apiScrivi(request, 'post', '/eventi/ro-ev/voci', { voci: [{ id: 'ro-v1', portataId: ev.portate[1].id, nome: 'Ragù della domenica', piattoId: 'ro-ragu' }] })
  await page.goto('/#/eventi/ro-ev')
  await expect(page.getByTestId('famiglia-evento')).toHaveText('Famiglia')
  await expect(page.getByTestId('contesto-famiglia')).toContainText('Evento della Famiglia «Famiglia»')
  // Dentro l'evento il selettore non c'è: conta la Famiglia dell'evento.
  await expect(selettore(page)).toHaveCount(0)
  await foto(page, '01-riepilogo-altra-famiglia')
  await page.getByRole('button', { name: 'Passa a «Famiglia»' }).click()
  await expect(page.getByTestId('contesto-famiglia')).toHaveCount(0)

  // ── Cinque schede; i vecchi indirizzi portano alla scheda giusta, anche ricaricando
  for (const s of ['Riepilogo', 'Menù', 'Persone', 'Prepara', 'Bacheca']) await expect(scheda(page, s)).toBeVisible()
  await senzaScorrimentoOrizzontale(page)
  for (const [percorso, nome, segmento] of [
    ['partecipanti', 'Persone', 'Presenze'],
    ['chi-porta', 'Persone', 'Chi porta'],
    ['spesa', 'Prepara', 'Spesa'],
    ['piano', 'Prepara', 'Piano'],
    ['bacheca', 'Bacheca', null],
    ['menu', 'Menù', null],
  ] as const) {
    await page.goto(`/#/eventi/ro-ev/${percorso}`)
    await page.reload()
    await expect(scheda(page, nome)).toHaveAttribute('aria-current', 'page')
    if (segmento) await expect(page.getByRole('navigation', { name: nome }).getByRole('link', { name: segmento })).toHaveAttribute('aria-current', 'page')
  }
  // Prepara: la vista cucina dei piatti con ricetta a un tocco.
  await schedaEvento(page, 'Prepara', 'Spesa')
  await page.getByRole('navigation', { name: 'Vista cucina dei piatti' }).getByRole('link', { name: 'Ragù della domenica' }).click()
  await expect(page).toHaveURL(/voci\/ro-v1\/cucina/)
  await page.goBack()
  // Menù: stampa e vista cucina sulla riga del piatto.
  await schedaEvento(page, 'Menù')
  await expect(page.getByRole('link', { name: 'Stampa' })).toBeVisible()
  await page.getByRole('link', { name: 'Vista cucina: Ragù della domenica' }).click()
  await expect(page).toHaveURL(/voci\/ro-v1\/cucina/)
  // Indietro torna dove si era (la cronologia), non all'elenco.
  await page.goBack()
  await expect(scheda(page, 'Menù')).toHaveAttribute('aria-current', 'page')

  // ── Riepilogo: azioni nel menù per chi organizza
  await schedaEvento(page, 'Riepilogo')
  await page.getByRole('button', { name: 'Azioni dell\'evento' }).click()
  for (const v of ['Modifica evento', 'Duplica evento', 'Concludi', 'Archivia', 'Elimina evento']) await expect(page.getByRole('menuitem', { name: v })).toBeVisible()
  await page.keyboard.press('Escape')

  // ── Anna: sola lettura. Vede, duplica (la copia è sua), non modifica.
  const anna = await familiare(browser, request, 'Ornella')
  await apiScrivi(request, 'put', `/eventi/ro-ev/condivisioni/${anna.id}`, { permesso: 'lettura' })
  await apiScrivi(request, 'post', '/eventi/ro-ev/cose', { id: 'ro-vino', nome: 'Vino' })
  await anna.page.goto('/#/eventi/ro-ev')
  await anna.page.getByRole('button', { name: 'Azioni dell\'evento' }).click()
  await expect(anna.page.getByRole('menuitem', { name: 'Duplica evento' })).toBeEnabled()
  for (const v of ['Modifica evento', 'Concludi', 'Archivia', 'Elimina evento']) await expect(anna.page.getByRole('menuitem', { name: v })).toHaveCount(0)
  await anna.page.getByRole('menuitem', { name: 'Duplica evento' }).click()
  await anna.page.getByRole('dialog').getByRole('button', { name: 'Duplica' }).click()
  await expect(anna.page.getByRole('heading', { name: 'Pranzo della domenica' })).toBeVisible()
  await expect(anna.page.getByTestId('permesso-evento')).toHaveCount(0)
  // Il server rifiuta comunque le modifiche all'originale.
  expect((await apiDa(anna.page, 'PUT', '/eventi/ro-ev', { ...ev, versione: ev.versione })).stato).toBe(403)
  // «Me ne occupo io» in Chi porta, poi «Per te» nella pagina Eventi.
  await anna.page.goto('/#/eventi/ro-ev/chi-porta')
  const vino = anna.page.getByTestId('incarico').filter({ hasText: 'Vino' })
  await vino.getByRole('button', { name: 'Me ne occupo io' }).click()
  await expect(vino).toContainText('tu')
  await anna.page.goto('/#/')
  await expect(anna.page.getByRole('region', { name: 'Per te' })).toContainText('Porti Vino')
  // Un solo elenco in ordine di data: prima l'evento condiviso (marzo 2027, con il badge), poi
  // la copia di Ornella (marzo 2028), senza sezioni separate.
  await expect(anna.page.getByRole('region', { name: 'Prossimo evento' })).toContainText('Pranzo della domenica')
  await expect(anna.page.getByRole('region', { name: 'Prossimo evento' }).getByTestId('evento-condiviso')).toHaveText('di Loris · sola lettura')
  await expect(anna.page.getByRole('region', { name: 'Condivisi con me' })).toHaveCount(0)
  // Le schede dell'elenco (fuori da «Per te»): sotto il prossimo, la copia di Ornella, senza badge.
  const schede = anna.page.locator('a[href^="#/eventi/"]').filter({ hasText: /\d+ piatt[oi]/ }).filter({ hasText: 'Pranzo della domenica' })
  await expect(schede).toHaveCount(1)
  await expect(schede.getByTestId('evento-condiviso')).toHaveCount(0)
  await anna.page.getByRole('region', { name: 'Per te' }).getByRole('link', { name: /Porti Vino/ }).click()
  await expect(anna.page).toHaveURL(/chi-porta\?incarico=cosa(%3A|:)ro-vino/)
  await foto(anna.page, '02-chi-porta-anna')
  await anna.ctx.close()

  // ── Eventi: Duplica dalla pagina iniziale, segmenti Conclusi e Archivio
  await page.goto('/#/')
  await page.getByRole('button', { name: 'Duplica un evento' }).click()
  await page.getByLabel('Evento da duplicare').selectOption('ro-ev')
  await page.getByRole('button', { name: 'Continua' }).click()
  await expect(page.getByRole('dialog')).toContainText('a partire da «Pranzo della domenica»')
  await page.keyboard.press('Escape')
  const attuale = await apiLeggi<{ versione: number }>(request, '/eventi/ro-ev')
  await apiScrivi(request, 'post', '/eventi/ro-ev/archivia', { versione: attuale.versione })
  await page.goto('/#/eventi/archivio')
  // Archiviato via API: si ricarica, come farebbe la revisione periodica.
  await page.reload()
  await expect(page).toHaveURL(/vista=archivio/)
  await expect(page.getByRole('navigation', { name: 'Quali eventi' }).getByRole('link', { name: 'Archivio' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('link', { name: /Pranzo della domenica/ })).toBeVisible()
  await page.getByRole('link', { name: /Pranzo della domenica/ }).click()
  await expect(page.getByText('Archiviato · sola lettura')).toBeVisible()
  await page.getByRole('button', { name: 'Eventi' }).click()
  await expect(page).toHaveURL(/vista=archivio/)
  await foto(page, '03-archivio')

  // ── Ricetta: contenuto prima, gestione raggiungibile
  await page.goto('/#/ricettario/ro-ragu')
  const gestione = page.getByRole('region', { name: 'Gestione della ricetta' })
  await expect(page.getByRole('link', { name: 'Vista cucina' })).toBeVisible()
  expect(await page.evaluate(() => {
    const cucina = [...document.querySelectorAll('a')].find((a) => a.textContent?.includes('Vista cucina'))!
    return cucina.compareDocumentPosition(document.getElementById('gestione-ricetta')!) & Node.DOCUMENT_POSITION_FOLLOWING
  })).toBeTruthy()
  await page.getByRole('button', { name: 'Gestione della ricetta' }).click()
  await expect(gestione).toBeInViewport()
  await expect(gestione.getByLabel('Dove è visibile la ricetta').or(gestione.getByTestId('visibilita-ricetta')).first()).toBeVisible()

  // ── Famiglia: Bacheca, Apprezzati, Persone, Gestione (il vecchio «Membri» porta a Persone)
  await page.goto('/#/famiglia?scheda=membri')
  await expect(page.getByRole('navigation', { name: 'Sezioni della famiglia' }).getByRole('link', { name: 'Persone' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Senza app' })).toBeVisible()
  await page.getByRole('link', { name: 'Gestione', exact: true }).click()
  await expect(page.getByText('Standard, già pronte:')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crea un\'altra Famiglia' })).toBeVisible()

  // ── Impostazioni: personali e amministrazione separate
  await page.goto('/#/impostazioni')
  await expect(page.getByRole('navigation', { name: 'Impostazioni personali' })).toContainText('Il mio account')
  await expect(page.getByRole('navigation', { name: 'Amministrazione' })).toContainText('Reparti del supermercato')
  await page.getByRole('link', { name: /Reparti del supermercato/ }).click()
  await expect(page.getByRole('heading', { name: 'Reparti', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Indietro' }).click()
  await expect(page).toHaveURL(/#\/impostazioni$/)
  await foto(page, '04-impostazioni')
})
