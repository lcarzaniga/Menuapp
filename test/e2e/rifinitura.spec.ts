// Rifinitura UX (SPEC §29), dal telefono e con due persone: notifiche riconoscibili, raggruppate
// e apribili fino all'incarico preciso; la Famiglia giusta da una notifica; presenze gestite solo
// da chi può modificare l'evento; suggerimenti del ricettario da tastiera; ritorno nel ricettario
// alla stessa ricerca e posizione; testi lunghi senza scorrimento orizzontale; evento archiviato.
import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { apiDa, apiLeggi, apiScrivi, familiare, senzaScorrimentoOrizzontale } from './aiuti'

test.describe.configure({ mode: 'serial' })
const CARTELLA = 'test-results/rifinitura'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${nome}.png`, fullPage: true })
}
const NOME_LUNGO = 'Pranzo di Santo Stefano dai nonni con tutti i cugini, gli zii e gli amici di sempre'

test('notifiche, presenze in sola lettura, tastiera, ricettario e archivio', async ({ page, browser, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'scenario con due browser: una sola esecuzione')
  test.setTimeout(150_000)
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  await page.addInitScript((id) => localStorage.setItem('menuapp.famiglia', id), famiglia.id)
  const marta = await familiare(browser, request, 'Marta')

  // ── Evento di Loris nella Famiglia, condiviso con Marta in sola lettura (partecipa)
  const ev = (await apiScrivi(request, 'post', '/eventi', { id: 'rf-ev', nome: NOME_LUNGO, data: '2027-12-26', oraServizio: '13:00', tipo: 'pranzo', occasione: '', adulti: 10, bambini: 2, coefficienteBambini: 0.5, note: '', gruppoId: famiglia.id })).corpo
  expect((await apiScrivi(request, 'put', `/eventi/rf-ev/condivisioni/${marta.id}`, { permesso: 'lettura' })).stato).toBe(200)

  // ── Marta si offre per il vino e aggiunge il pane: per Loris una notifica con due aggiornamenti
  expect((await apiDa(marta.page, 'POST', '/eventi/rf-ev/cose', { id: 'rf-vino', nome: 'Vino', prendo: true })).stato).toBe(201)
  expect((await apiDa(marta.page, 'POST', '/eventi/rf-ev/cose', { id: 'rf-pane', nome: 'Pane' })).stato).toBe(201)
  await page.goto('/#/notifiche')
  const notifica = page.getByTestId('notifica').filter({ hasText: 'Da portare: «Pane»' })
  await expect(notifica).toContainText('Chi porta cosa')
  await expect(notifica).toContainText(NOME_LUNGO)
  await expect(page.getByRole('region', { name: 'Da leggere' })).toContainText('Da portare: «Pane»')
  await notifica.getByRole('button', { name: '2 aggiornamenti' }).click()
  const aggiornamenti = notifica.getByRole('list', { name: /Aggiornamenti/ })
  await expect(aggiornamenti.getByRole('listitem')).toHaveCount(2)
  await senzaScorrimentoOrizzontale(page)
  await foto(page, '01-notifiche')
  // Ogni aggiornamento porta al suo incarico, evidenziato.
  await aggiornamenti.getByRole('button', { name: /Marta porta «Vino»/ }).click()
  await expect(page).toHaveURL(/chi-porta\?incarico=cosa(%3A|:)rf-vino/)
  await expect(page.getByTestId('incarico').filter({ hasText: 'Vino' })).toHaveClass(/ring-2/)
  await foto(page, '02-incarico-evidenziato')
  // Aperta, la notifica passa fra le già lette.
  await page.goto('/#/notifiche')
  await expect(page.getByRole('region', { name: 'Già lette' })).toContainText('Da portare: «Pane»')

  // ── Presenze: Marta è fra i partecipanti ma non può modificare l'evento
  expect((await apiScrivi(request, 'post', '/eventi/rf-ev/partecipanti', { id: 'rf-p-marta', utenteId: marta.id })).stato).toBe(201)
  await marta.page.goto('/#/eventi/rf-ev/partecipanti')
  await expect(marta.page.getByTestId('chi-gestisce')).toContainText('Le presenze le aggiorna chi può modificare l\'evento: Loris')
  await expect(marta.page.getByTestId('mio-invito')).toHaveCount(0)
  await expect(marta.page.getByRole('group', { name: /Presenza di/ })).toHaveCount(0)
  await expect(marta.page.getByTestId('invito').filter({ hasText: 'Marta' })).toContainText('in attesa')
  await foto(marta.page, '03-presenze-sola-lettura')
  // Il server rifiuta anche la conferma della propria presenza.
  expect((await apiDa(marta.page, 'PUT', '/partecipanti/rf-p-marta', { nome: 'Marta', categoria: 'adulto', stato: 'confermato', note: '', versione: 1 })).stato).toBe(403)
  await marta.ctx.close()

  // ── Da una notifica di un'altra Famiglia si apre quella Famiglia (che diventa attiva)
  const altra = await apiScrivi(request, 'post', '/famiglie', { id: 'rf-rossi', nome: 'Famiglia Rossi' })
  expect(altra.stato).toBe(201)
  await page.goto('/#/famiglia?famiglia=rf-rossi&messaggio=eliminato')
  await expect(page.getByRole('heading', { name: 'Famiglia Rossi' })).toBeVisible()
  await expect(page.getByText('Il messaggio della notifica non è più disponibile')).toBeVisible()
  // Si torna alla Famiglia (il selettore cambia la Famiglia attiva).
  await page.getByRole('combobox', { name: 'Famiglia attiva' }).filter({ visible: true }).selectOption({ label: 'Famiglia' })
  await expect(page.getByRole('heading', { name: 'Famiglia', exact: true })).toBeVisible()

  // ── Menù: le ricette del ricettario contestuale si scelgono anche da tastiera (SPEC §43)
  await apiScrivi(request, 'post', '/piatti', { id: 'rf-crostata', nome: 'Crostata di albicocche', porzioniBase: 8, ingredienti: [], famiglie: [famiglia.id] })
  await page.goto('/#/eventi/rf-ev/menu')
  await page.reload()
  const campo = page.getByLabel('Aggiungi a Dolci')
  await campo.fill('crostata di albi')
  await expect(page.getByRole('listbox', { name: /^Ricette per/ })).toBeVisible()
  await campo.press('ArrowDown')
  const attiva = page.getByRole('listbox', { name: /^Ricette per/ }).getByRole('option', { selected: true })
  await expect(attiva).toContainText('Crostata di albicocche')
  await expect(campo).toHaveAttribute('aria-activedescendant', (await attiva.getAttribute('id'))!)
  await campo.press('Enter')
  await expect(page.getByRole('button', { name: 'Crostata di albicocche: apri dettagli' })).toBeVisible()
  const menu = await apiLeggi<{ portate: { voci: { nome: string; piattoId: string | null }[] }[] }>(request, '/eventi/rf-ev/menu')
  expect(menu.portate.flatMap((p) => p.voci).find((v) => v.nome === 'Crostata di albicocche')?.piattoId).toBe('rf-crostata')
  // Esc chiude il ricettario e lascia scrivere liberamente.
  await campo.fill('crostata di albi')
  await campo.press('Escape')
  await expect(page.getByRole('listbox', { name: /^Ricette per/ })).toHaveCount(0)

  // ── Ricettario: tornando da una ricetta si ritrovano ricerca e posizione
  for (let i = 1; i <= 25; i++) await apiScrivi(request, 'post', '/piatti', { id: `rf-zuppa-${i}`, nome: `Zuppa numero ${String(i).padStart(2, '0')}`, porzioniBase: 4, ingredienti: [] })
  await page.goto('/#/ricettario')
  await page.getByLabel('Cerca un piatto').fill('crostata di albi')
  await page.getByRole('link', { name: /Crostata di albicocche/ }).click()
  await expect(page.getByRole('heading', { name: 'Crostata di albicocche' })).toBeVisible()
  await page.goBack()
  await expect(page.getByLabel('Cerca un piatto')).toHaveValue('crostata di albi')
  await page.getByLabel('Cerca un piatto').fill('')
  const zuppa = page.getByRole('link', { name: /Zuppa numero 20/ })
  await zuppa.scrollIntoViewIfNeeded()
  const y = await page.evaluate(() => window.scrollY)
  expect(y).toBeGreaterThan(300)
  await zuppa.click()
  await expect(page.getByRole('heading', { name: 'Zuppa numero 20' })).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50)
  await page.goBack()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 80)

  // ── Testi lunghi e evento archiviato: niente scorrimento orizzontale, sola lettura
  await page.goto('/#/eventi/rf-ev')
  await expect(page.getByRole('heading', { name: NOME_LUNGO })).toBeVisible()
  await senzaScorrimentoOrizzontale(page)
  const attuale = await apiLeggi<{ versione: number }>(request, '/eventi/rf-ev')
  expect((await apiScrivi(request, 'post', '/eventi/rf-ev/archivia', { versione: attuale.versione ?? ev.versione })).stato).toBe(200)
  await page.reload()
  for (const scheda of ['', '/partecipanti', '/menu', '/chi-porta', '/bacheca']) {
    await page.goto(`/#/eventi/rf-ev${scheda}`)
    await expect(page.getByText('Archiviato · sola lettura')).toBeVisible()
    await senzaScorrimentoOrizzontale(page)
  }
  await expect(page.getByRole('button', { name: 'Cosa da portare' })).toHaveCount(0)
  await page.goto('/#/eventi/rf-ev/partecipanti')
  await expect(page.getByTestId('invito').filter({ hasText: 'Marta' })).toBeVisible()
  await expect(page.getByRole('group', { name: /Presenza di/ })).toHaveCount(0)
  await foto(page, '04-archiviato')
})
