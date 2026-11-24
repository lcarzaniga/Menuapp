// Ricettario contestuale del menù (SPEC §43): il campo «Aggiungi a…» di una portata apre le ricette
// di quella tipologia, filtrate dal testo dello stesso campo. Desktop: colonna a destra, trascinamento
// su una portata o su una voce senza ricetta, doppio clic, frecce e Invio. Telefono: pannello dal
// basso con «+». Invio crea sempre una voce libera; una ricetta scelta non crea anche quella libera.
import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi } from './aiuti'

const CARTELLA = 'test-results/ricettario-contestuale'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${test.info().project.name}-${nome}.png` })
}
const ing = (id: string, nome: string) => ({ id, ordine: 0, testoOriginale: nome, nome, ingredienteId: null, quantita: null, quantitaMax: null, unita: null, scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] })

type Voce = { id: string; nome: string; piattoId: string | null; versione: number }
type MenuApi = { portate: { id: string; nome: string; voci: Voce[] }[] }
const vociDi = async (request: Parameters<typeof apiLeggi>[0], ev: string, portata: string) =>
  (await apiLeggi<MenuApi>(request, `/eventi/${ev}/menu`)).portate.find((p) => p.nome === portata)!.voci

async function preparaDati(request: Parameters<typeof apiLeggi>[0], k: string) {
  // Ricette con nomi propri del progetto: il database dei test è condiviso.
  for (const [id, nome, portataSuggerita, ingredienti] of [
    [`rc-${k}-lasagne`, `Lasagne verdi ${k}`, 'Primi', ['lasagne', 'spinaci', 'besciamella']],
    [`rc-${k}-risotto`, `Risotto allo zafferano ${k}`, 'Primo', ['riso carnaroli', 'zafferano']],
    [`rc-${k}-gnocchi`, `Gnocchi di zucca ${k}`, 'Primi', ['zucca', 'patate']],
    [`rc-${k}-tiramisu`, `Tiramisù ${k}`, 'Dolci', ['savoiardi', 'mascarpone']],
    [`rc-${k}-salsa`, `Salsa allo zafferano ${k}`, null, ['zafferano', 'panna']],
  ] as const) await apiScrivi(request, 'post', '/piatti', { id, nome, portataSuggerita, porzioniBase: 4, ingredienti: ingredienti.map((n, i) => ing(`${id}-${i}`, n)) })
  const ev = `ev-rc-${k}`
  await apiScrivi(request, 'post', '/eventi', { id: ev, nome: `Pranzo contestuale ${k}`, data: '2027-03-14', oraServizio: '13:00', tipo: 'pranzo', occasione: '', adulti: 6, bambini: 0, note: '' })
  return ev
}

test('desktop: colonna a destra, filtro, Invio, trascinamento, doppio clic e tastiera', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'colonna laterale e mouse')
  const k = 'rcd'
  const ev = await preparaDati(request, k)
  await page.goto(`/#/eventi/${ev}/menu`)
  const primi = page.getByLabel('Aggiungi a Primi')
  const pannello = page.getByRole('complementary', { name: /^Ricettario/ })
  await expect(pannello).toHaveCount(0)

  // ── Si apre dalla portata messa a fuoco, con tutte le ricette della sua tipologia
  await primi.focus()
  await expect(pannello).toHaveAccessibleName('Ricettario: Primi')
  const elenco = pannello.getByRole('listbox')
  await expect(elenco.getByRole('option', { name: new RegExp(`Lasagne verdi ${k}`) })).toBeVisible()
  await expect(elenco.getByRole('option', { name: new RegExp(`Risotto allo zafferano ${k}`) })).toBeVisible() // «Primo» → Primi
  await expect(elenco.getByRole('option', { name: new RegExp(`Tiramisù ${k}`) })).toHaveCount(0)
  await expect(elenco.getByRole('option', { name: new RegExp(`Salsa allo zafferano ${k}`) })).toHaveCount(0) // senza portata: solo cercando
  // Nessuna seconda casella di ricerca, nessun pulsante «Aggiungi» sulle righe.
  await expect(pannello.getByRole('textbox')).toHaveCount(0)
  await expect(elenco.getByRole('button')).toHaveCount(0)
  // Il menù resta affiancato, non coperto.
  const bm = await page.getByRole('heading', { name: 'Primi' }).boundingBox()
  const bp = await pannello.boundingBox()
  expect(bp!.width).toBeGreaterThanOrEqual(300)
  expect(bp!.width).toBeLessThanOrEqual(360)
  expect(bm!.x + bm!.width).toBeLessThanOrEqual(bp!.x)
  await foto(page, '01-pannello')

  // ── Il testo del campo filtra mentre si scrive: nome, ingredienti, e le ricette senza portata
  await primi.pressSequentially('zaff')
  await expect(elenco.getByRole('option', { name: new RegExp(`Risotto allo zafferano ${k}`) })).toBeVisible()
  await expect(elenco.getByRole('option', { name: new RegExp(`Salsa allo zafferano ${k}`) })).toContainText('senza portata')
  await expect(elenco.getByRole('option', { name: new RegExp(`Lasagne verdi ${k}`) })).toHaveCount(0)
  await primi.fill('spinaci')
  await expect(elenco.getByRole('option', { name: new RegExp(`Lasagne verdi ${k}`) })).toContainText('con spinaci')
  // Il database dei test è condiviso: per il caso «nessun risultato» una parola che nessuno usa.
  await primi.fill(`quinoa${k}`)
  await expect(pannello.getByRole('status')).toContainText(`Nessuna ricetta per «quinoa${k}»`)

  // ── Cambio di portata: il filtro segue il campo messo a fuoco
  await page.getByLabel('Aggiungi a Dolci').focus()
  await expect(pannello).toHaveAccessibleName('Ricettario: Dolci')
  await expect(elenco.getByRole('option', { name: new RegExp(`Tiramisù ${k}`) })).toBeVisible()
  await expect(primi).toHaveValue(`quinoa${k}`) // il testo dei primi resta

  // ── Invio con il testo: voce libera, come sempre, e nessuna ricetta collegata
  await primi.fill(`Pasta e fagioli ${k}`)
  await primi.press('Enter')
  await expect(page.getByRole('button', { name: `Pasta e fagioli ${k}: apri dettagli` })).toBeVisible()
  await expect(primi).toHaveValue('')
  expect((await vociDi(request, ev, 'Primi')).map((v) => [v.nome, v.piattoId])).toEqual([[`Pasta e fagioli ${k}`, null]])

  // ── Trascinamento sulla portata: voce collegata, testo pulito, nessuna voce libera con il filtro
  await primi.fill('gnocchi')
  const gnocchi = elenco.getByRole('option', { name: new RegExp(`Gnocchi di zucca ${k}`) })
  const sezionePrimi = page.locator('section', { has: page.getByRole('heading', { name: 'Primi' }) })
  await gnocchi.hover()
  await page.mouse.down()
  await sezionePrimi.getByRole('heading', { name: 'Primi' }).hover()
  await sezionePrimi.getByRole('heading', { name: 'Primi' }).hover({ position: { x: 20, y: 5 } })
  await expect(sezionePrimi).toHaveAttribute('data-destinazione', 'true')
  await expect(sezionePrimi).toContainText(`Rilascia per aggiungere «Gnocchi di zucca ${k}» a Primi`)
  await foto(page, '02-trascinamento')
  await page.mouse.up()
  await expect(page.getByRole('button', { name: `Gnocchi di zucca ${k}: apri dettagli` })).toBeVisible()
  await expect(primi).toHaveValue('')
  let voci = await vociDi(request, ev, 'Primi')
  expect(voci.map((v) => [v.nome, v.piattoId])).toEqual([
    [`Pasta e fagioli ${k}`, null],
    [`Gnocchi di zucca ${k}`, `rc-${k}-gnocchi`],
  ])

  // ── Trascinamento su un'altra portata: la voce va dove la si rilascia
  await primi.focus()
  await elenco.getByRole('option', { name: new RegExp(`Lasagne verdi ${k}`) }).dragTo(page.getByRole('heading', { name: 'Secondi' }))
  await expect.poll(async () => (await vociDi(request, ev, 'Secondi')).map((v) => v.piattoId)).toEqual([`rc-${k}-lasagne`])

  // ── Su una voce libera esistente: la collega, il nome resta, nessuna voce nuova
  await elenco.getByRole('option', { name: new RegExp(`Risotto allo zafferano ${k}`) }).dragTo(page.getByRole('button', { name: `Pasta e fagioli ${k}: apri dettagli` }))
  await expect(page.getByText(`«Pasta e fagioli ${k}» collegata a «Risotto allo zafferano ${k}»`)).toBeVisible()
  voci = await vociDi(request, ev, 'Primi')
  expect(voci.map((v) => [v.nome, v.piattoId])).toEqual([
    [`Pasta e fagioli ${k}`, `rc-${k}-risotto`],
    [`Gnocchi di zucca ${k}`, `rc-${k}-gnocchi`],
  ])

  // ── Doppio clic: una voce sola (nessun doppione accidentale); la stessa ricetta si può riaggiungere
  await primi.focus()
  await elenco.getByRole('option', { name: new RegExp(`Gnocchi di zucca ${k}`) }).dblclick()
  await expect(page.getByRole('button', { name: `Gnocchi di zucca ${k}: apri dettagli` })).toHaveCount(2)
  await expect.poll(async () => (await vociDi(request, ev, 'Primi')).filter((v) => v.piattoId === `rc-${k}-gnocchi`).length).toBe(2)

  // ── Tastiera, alternativa al trascinamento: frecce e Invio dal campo
  await primi.focus()
  await primi.fill(`lasagne verdi ${k}`)
  await primi.press('ArrowDown')
  const scelta = elenco.getByRole('option', { selected: true })
  await expect(scelta).toContainText(`Lasagne verdi ${k}`)
  await expect(primi).toHaveAttribute('aria-activedescendant', (await scelta.getAttribute('id'))!)
  await primi.press('Enter')
  await expect.poll(async () => (await vociDi(request, ev, 'Primi')).filter((v) => v.piattoId === `rc-${k}-lasagne`).length).toBe(1)
  expect((await vociDi(request, ev, 'Primi')).some((v) => v.nome === `lasagne verdi ${k}`)).toBe(false)

  // ── Chiudere non perde il testo; il pulsante del ricettario lo riapre
  await primi.fill('zucca')
  await pannello.getByRole('button', { name: 'Chiudi il ricettario' }).click()
  await expect(pannello).toHaveCount(0)
  await expect(primi).toHaveValue('zucca')
  await expect(primi).toBeFocused()
  await page.getByRole('button', { name: 'Mostra le ricette di Primi' }).click()
  await expect(elenco.getByRole('option', { name: new RegExp(`Gnocchi di zucca ${k}`) })).toBeVisible()
  // Esc chiude anche da tastiera, sempre senza perdere il testo.
  await primi.press('Escape')
  await expect(pannello).toHaveCount(0)
  await expect(primi).toHaveValue('zucca')
})

test('telefono: pannello dal basso con «+», sopra il campo e senza seconda ricerca', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'pannello dal basso')
  const k = 'rct'
  const ev = await preparaDati(request, k)
  await page.goto(`/#/eventi/${ev}/menu`)
  const primi = page.getByLabel('Aggiungi a Primi')
  const pannello = page.getByRole('region', { name: /^Ricettario/ })

  await primi.click()
  await expect(pannello).toHaveAccessibleName('Ricettario: Primi')
  await expect(pannello.getByRole('textbox')).toHaveCount(0)
  const elenco = pannello.getByRole('listbox')
  await expect(elenco.getByRole('option', { name: new RegExp(`Gnocchi di zucca ${k}`) })).toBeVisible()
  await expect(elenco.getByRole('option', { name: new RegExp(`Tiramisù ${k}`) })).toHaveCount(0)
  // Il campo resta visibile sopra il pannello.
  const bc = await primi.boundingBox()
  const bp = await pannello.boundingBox()
  expect(bc!.y + bc!.height).toBeLessThanOrEqual(bp!.y)
  await foto(page, '01-pannello')

  // ── Filtro per ingrediente mentre si scrive, poi «+»: voce collegata, testo pulito, fuoco nel campo
  await primi.pressSequentially('zuc')
  await expect(elenco.getByRole('option', { name: new RegExp(`Gnocchi di zucca ${k}`) })).toBeVisible()
  await expect(elenco.getByRole('option', { name: new RegExp(`Lasagne verdi ${k}`) })).toHaveCount(0)
  await foto(page, '02-filtro')
  await elenco.getByRole('button', { name: `Aggiungi «Gnocchi di zucca ${k}» a Primi` }).click()
  await expect(page.getByRole('button', { name: `Gnocchi di zucca ${k}: apri dettagli` })).toBeVisible()
  await expect(primi).toHaveValue('')
  await expect(primi).toBeFocused()
  expect((await vociDi(request, ev, 'Primi')).map((v) => [v.nome, v.piattoId])).toEqual([[`Gnocchi di zucca ${k}`, `rc-${k}-gnocchi`]])

  // ── Due tocchi rapidi su «+» non creano doppioni
  const piu = elenco.getByRole('button', { name: `Aggiungi «Lasagne verdi ${k}» a Primi` })
  await piu.evaluate((b: HTMLButtonElement) => {
    b.click()
    b.click()
  })
  await expect(page.getByRole('button', { name: `Lasagne verdi ${k}: apri dettagli` })).toBeVisible()
  await page.waitForTimeout(500)
  expect((await vociDi(request, ev, 'Primi')).filter((v) => v.piattoId === `rc-${k}-lasagne`)).toHaveLength(1)

  // ── Invio: voce libera, come sempre
  await primi.fill(`Brodo ${k}`)
  await primi.press('Enter')
  await expect(page.getByRole('button', { name: `Brodo ${k}: apri dettagli` })).toBeVisible()
  expect((await vociDi(request, ev, 'Primi')).find((v) => v.nome === `Brodo ${k}`)?.piattoId).toBeNull()

  // ── Chiudere e continuare a scrivere: il campo tiene il fuoco e il testo
  await primi.fill('ris')
  await pannello.getByRole('button', { name: 'Chiudi il ricettario' }).click()
  await expect(pannello).toHaveCount(0)
  await expect(primi).toBeFocused()
  await primi.pressSequentially('otto')
  await expect(primi).toHaveValue('risotto')
  await expect(pannello).toHaveCount(0)
  await primi.fill('')

  // ── Toccare fuori chiude il pannello; la voce libera si collega dall'editor, come prima
  await page.getByRole('button', { name: `Brodo ${k}: apri dettagli` }).click()
  await expect(pannello).toHaveCount(0)
  const dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Cerca un piatto esistente').fill(`Risotto allo zafferano ${k}`)
  await dialogo.getByRole('button', { name: new RegExp(`Risotto allo zafferano ${k}.*collega`) }).click()
  await dialogo.getByRole('button', { name: 'Salva' }).click()
  await expect.poll(async () => (await vociDi(request, ev, 'Primi')).find((v) => v.nome === `Brodo ${k}`)?.piattoId).toBe(`rc-${k}-risotto`)
  expect(await vociDi(request, ev, 'Primi')).toHaveLength(3)
})
