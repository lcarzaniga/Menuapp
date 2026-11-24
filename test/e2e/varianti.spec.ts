// Varianti delle ricette nelle voci del menù (SPEC §44): adattare gli ingredienti dalla finestra
// della voce, riprendere una versione precedente di un altro evento, Cucina con avviso e nota, ritorno
// alla ricetta, evento archiviato. La ricetta originale non cambia mai.
import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi } from './aiuti'

const CARTELLA = 'test-results/varianti'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${test.info().project.name}-${nome}.png` })
}
const ing = (id: string, testo: string, nome: string, quantita: number, unita: string) => ({
  id, ordine: 0, testoOriginale: testo, nome, ingredienteId: null, quantita, quantitaMax: null, unita, scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [],
})
type Voce = { id: string; nome: string; piattoId: string | null; versione: number; portataId: string; variante: null | { descrizione: string; nota: string; ingredienti: { nome: string }[] } }
const voceApi = (request: Parameters<typeof apiLeggi>[0], id: string) => apiLeggi<Voce>(request, `/voci/${id}`)
const spesa = async (request: Parameters<typeof apiLeggi>[0], ev: string) => (await apiLeggi<{ voci: { nome: string }[] }>(request, `/eventi/${ev}/spesa`)).voci.map((v) => v.nome).sort()

test('adattare gli ingredienti, riprendere una versione precedente, Cucina e ritorno alla ricetta', async ({ page, request }, info) => {
  const k = info.project.name === 'desktop' ? 'vd' : 'vt'
  const ricetta = `palline-${k}`
  await apiScrivi(request, 'post', '/piatti', {
    id: ricetta, nome: `Finte palline di Natale ${k}`, porzioniBase: 6, portataSuggerita: 'Antipasti',
    ingredienti: [ing(`${k}-m`, '300 g mortadella', 'mortadella', 300, 'g'), ing(`${k}-p`, '60 g pistacchi', 'pistacchi', 60, 'g'), ing(`${k}-s`, '20 g spaghetti', 'spaghetti', 20, 'g')],
    procedimento: ['Frullate la mortadella.', 'Formate le palline e passatele nei pistacchi.'],
  })
  // Pasqua: una variante già usata (preparata dall'API).
  const pasqua = `pasqua-${k}`
  const ev1 = (await apiScrivi(request, 'post', '/eventi', { id: pasqua, nome: `Pasqua ${k}`, data: '2027-03-28', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 8, bambini: 0, note: '' })).corpo
  await apiScrivi(request, 'post', `/eventi/${pasqua}/voci`, { voci: [{ id: `${k}-vp`, portataId: ev1.portate[0].id, nome: 'Finte palline', piattoId: ricetta }] })
  await apiScrivi(request, 'put', `/voci/${k}-vp/variante`, {
    versione: 1,
    variante: { descrizione: 'tonno e capperi', nota: 'Tonno ben sgocciolato.', porzioniBase: 6, ingredienti: [ing(`${k}-t`, '200 g tonno', 'tonno', 200, 'g'), ing(`${k}-c`, '20 g capperi', 'capperi', 20, 'g')] },
  })
  // Natale: la stessa ricetta, inserita come sempre.
  const natale = `natale-${k}`
  const ev2 = (await apiScrivi(request, 'post', '/eventi', { id: natale, nome: `Natale ${k}`, data: '2027-12-25', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 8, bambini: 0, note: '' })).corpo
  await apiScrivi(request, 'post', `/eventi/${natale}/voci`, { voci: [{ id: `${k}-vn`, portataId: ev2.portate[0].id, nome: 'Finte palline', piattoId: ricetta }] })

  await page.goto(`/#/eventi/${natale}/menu`)
  const riga = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Finte palline: apri dettagli' }) })
  await expect(riga).not.toContainText('variante')
  await page.getByRole('button', { name: 'Finte palline: apri dettagli' }).click()
  const voce = page.getByRole('dialog', { name: 'Voce del menù' })
  const sezione = voce.getByTestId('ingredienti-voce')
  await expect(sezione).toContainText('Ingredienti: come nella ricetta')
  await expect(sezione.getByRole('button', { name: 'Usa una versione precedente' })).toBeVisible()

  // ── Adatta: due ingredienti tolti, tre aggiunti, una quantità cambiata
  await sezione.getByRole('button', { name: 'Adatta ingredienti' }).click()
  const editor = page.getByRole('dialog', { name: 'Ingredienti per questo evento' })
  await expect(editor.getByTestId('porzioni-variante')).toContainText('Le quantità qui sotto sono per')
  await expect(editor.getByLabel('Porzioni a cui si riferiscono le quantità')).toHaveValue('6')
  await expect(editor.getByTestId('porzioni-variante')).toContainText('Nel menù questa voce è per 8 porzioni')
  await foto(page, '01-editor')
  for (const nome of ['mortadella', 'pistacchi']) {
    await editor.getByRole('button', { name: new RegExp(` ${nome}`) }).click()
    await page.getByRole('dialog').last().getByRole('button', { name: 'Elimina' }).click()
  }
  await editor.getByRole('button', { name: 'Incolla ingredienti' }).click()
  await page.getByLabel('Ingredienti da analizzare').fill('250 g ricotta\n40 g sesamo\n10 g erba cipollina')
  await page.getByRole('button', { name: 'Aggiungi 3 righe' }).click()
  await expect(editor.getByRole('button', { name: / ricotta/ })).toBeVisible()
  await editor.getByLabel('Porzioni a cui si riferiscono le quantità').fill('4')
  await editor.getByLabel('Come la chiami? (facoltativo)').fill('ricotta e sesamo')
  await editor.getByLabel('Nota per questa versione (facoltativa)').fill('Ricotta ben scolata, niente frullatore.')
  await editor.getByRole('button', { name: 'Salva' }).click()
  await expect(editor).toHaveCount(0)
  await expect(sezione).toContainText('Ingredienti personalizzati · ricotta e sesamo (4)')
  // Il «Salva» della voce non entra in conflitto con la variante appena salvata.
  await voce.getByLabel('Note').fill('Per gli zii')
  await voce.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(voce).toHaveCount(0)
  await expect(riga).toContainText('variante · ricotta e sesamo')
  await foto(page, '02-menu')
  let v = await voceApi(request, `${k}-vn`)
  expect(v.variante?.ingredienti.map((i) => i.nome)).toEqual(['spaghetti', 'ricotta', 'sesamo', 'erba cipollina'])
  expect(await spesa(request, natale)).toEqual(['erba cipollina', 'ricotta', 'sesamo', 'spaghetti'])
  // La ricetta e l'altro evento restano come erano.
  const r = await apiLeggi<{ ingredienti: { nome: string }[]; versione: number }>(request, `/piatti/${ricetta}`)
  expect(r.ingredienti.map((i) => i.nome)).toEqual(['mortadella', 'pistacchi', 'spaghetti'])
  expect((await voceApi(request, `${k}-vp`)).variante?.descrizione).toBe('tonno e capperi')

  // ── Cucina: ingredienti della variante, avviso discreto e nota sopra il procedimento
  await page.goto(`/#/eventi/${natale}/voci/${k}-vn/cucina`)
  await expect(page.getByText('personalizzati per questo evento')).toBeVisible()
  await expect(page.getByTestId('avviso-variante')).toContainText('Ingredienti personalizzati: verifica che il procedimento sia adatto a questa versione.')
  await expect(page.getByTestId('avviso-variante')).toContainText('Ricotta ben scolata, niente frullatore.')
  // Ingredienti della variante; il procedimento resta quello della ricetta (cita ancora la mortadella).
  const ingredienti = page.locator('section').filter({ has: page.getByRole('heading', { name: /^Ingredienti/ }) })
  await expect(ingredienti.getByRole('button', { name: /ricotta/ })).toBeVisible()
  await expect(ingredienti.getByRole('button', { name: /mortadella/ })).toHaveCount(0)
  await expect(page.getByText('Frullate la mortadella.')).toBeVisible()
  await foto(page, '03-cucina')
  // Il menù stampato non mostra la nota della variante.
  await page.goto(`/#/eventi/${natale}/stampa`)
  await expect(page.getByText('Finte palline').first()).toBeVisible()
  await expect(page.getByText('Ricotta ben scolata')).toHaveCount(0)

  // ── Versione precedente: si sceglie dall'evento, viene copiata
  await page.goto(`/#/eventi/${natale}/menu`)
  await page.getByRole('button', { name: 'Finte palline: apri dettagli' }).click()
  await sezione.getByRole('button', { name: 'Usa una versione precedente' }).click()
  const precedenti = page.getByRole('dialog', { name: 'Usa una versione precedente' })
  await expect(precedenti).toContainText('Sostituisce gli ingredienti personalizzati di questa voce')
  await foto(page, '04-versioni')
  await precedenti.getByRole('button', { name: new RegExp(`Pasqua ${k}.*tonno e capperi`) }).click()
  await expect(precedenti).toHaveCount(0)
  await expect(sezione).toContainText('Ingredienti personalizzati · tonno e capperi (2)')
  v = await voceApi(request, `${k}-vn`)
  expect(v.variante).toMatchObject({ descrizione: 'tonno e capperi', nota: 'Tonno ben sgocciolato.' })

  // ── Torna alla ricetta
  await sezione.getByRole('button', { name: 'Torna alla ricetta' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Torna alla ricetta' }).click()
  await expect(sezione).toContainText('Ingredienti: come nella ricetta')
  await page.keyboard.press('Escape')
  await expect(riga).not.toContainText('variante')
  expect(await spesa(request, natale)).toEqual(['mortadella', 'pistacchi', 'spaghetti'])

  // ── Evento archiviato: Cucina dall'archivio, con la variante conservata
  const e1 = await apiLeggi<{ versione: number }>(request, `/eventi/${pasqua}`)
  await apiScrivi(request, 'post', `/eventi/${pasqua}/archivia`, { versione: e1.versione })
  await page.goto(`/#/eventi/${pasqua}/voci/${k}-vp/cucina`)
  await expect(page.getByTestId('avviso-variante')).toContainText('Tonno ben sgocciolato.')
  await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: /^Ingredienti/ }) }).getByRole('button', { name: /tonno/ })).toBeVisible()
})
