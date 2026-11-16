// Persone senza account negli incarichi (SPEC §22): rubrica della Famiglia, affidamento a
// una persona della rubrica o a un nome nuovo, quantità e unità, «A cura di» e spesa.
import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi } from './aiuti'

const CARTELLA = 'test-results/esterni'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${nome}.png` })
}

test('rubrica e incarichi affidati a chi non ha l\'app', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  await page.addInitScript((id) => localStorage.setItem('menuapp.famiglia', id), famiglia.id)

  // ── Rubrica: Nonna Maria non usa l'app
  await page.goto('/#/famiglia?scheda=membri')
  await page.getByLabel('Nome', { exact: true }).fill('Nonna Maria')
  await page.getByLabel('Nota (facoltativa)').fill('Fa le lasagne migliori')
  await page.locator('form').filter({ has: page.getByLabel('Nota (facoltativa)') }).getByRole('button', { name: 'Aggiungi' }).click()
  await expect(page.getByRole('list', { name: 'Rubrica senza app' })).toContainText('Nonna Maria')
  await foto(page, '01-rubrica')

  // ── Evento della Famiglia con le lasagne
  const ev = (await apiScrivi(request, 'post', '/eventi', { id: 'ev-esterni', nome: 'Pranzo con i nonni', data: '2027-03-14', oraServizio: '13:00', tipo: 'pranzo', occasione: '', adulti: 10, bambini: 0, note: '', gruppoId: famiglia.id })).corpo
  await apiScrivi(request, 'post', '/piatti', {
    id: 'p-lasagne-esterni',
    nome: 'Lasagne della nonna',
    porzioniBase: 6,
    ingredienti: [{ id: 'i-bes-esterni', ordine: 0, testoOriginale: '500 ml besciamella', nome: 'besciamella', ingredienteId: null, quantita: 500, quantitaMax: null, unita: 'ml', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] }],
  })
  await apiScrivi(request, 'post', '/eventi/ev-esterni/voci', { voci: [{ id: 'v-lasagne-esterni', portataId: ev.portate[1].id, nome: 'Lasagne', piattoId: 'p-lasagne-esterni', porzioni: 10 }] })

  // ── Le lasagne a Nonna Maria, già pronte: escono dalla spesa
  await page.goto('/#/eventi/ev-esterni/chi-porta')
  const lasagne = page.getByTestId('incarico').filter({ hasText: 'Lasagne' })
  await expect(lasagne).toContainText('per 10')
  await lasagne.getByRole('button', { name: 'Affida' }).click()
  const finestra = page.getByRole('dialog')
  await finestra.getByLabel('Persona').selectOption({ label: 'Nonna Maria' })
  await finestra.getByLabel('Note (facoltative)').fill('per 10 persone')
  await finestra.getByText('Lo porta già pronto').click()
  await finestra.getByRole('button', { name: 'Affida', exact: true }).click()
  await expect(lasagne).toContainText('Nonna Maria · senza app')
  await expect(lasagne).toContainText('fuori dalla spesa')

  // ── Vino: 4 bottiglie, a Zio Marco (nome nuovo salvato in rubrica)
  await page.getByRole('button', { name: 'Cosa da portare' }).click()
  const nuova = page.getByRole('dialog')
  await nuova.getByLabel('Cosa', { exact: true }).fill('Vino rosso')
  await nuova.getByLabel('Quantità').fill('4')
  await nuova.getByLabel('Unità').fill('bottiglie')
  await nuova.getByText('Me ne occupo io').click()
  await nuova.getByRole('button', { name: 'Aggiungi' }).click()
  const vino = page.getByTestId('incarico').filter({ hasText: 'Vino rosso' })
  await expect(vino).toContainText('4 bottiglie')
  await vino.getByRole('button', { name: 'Affida' }).click()
  await page.getByRole('dialog').getByLabel('Persona').selectOption({ label: 'Un altro nome…' })
  await page.getByRole('dialog').getByLabel('Nome', { exact: true }).fill('Zio Marco')
  await page.getByRole('dialog').getByRole('button', { name: 'Affida', exact: true }).click()
  await expect(vino).toContainText('Zio Marco · senza app')
  await foto(page, '02-chi-porta')

  // «A cura di» nel menù e spesa coerenti; Zio Marco è ora in rubrica.
  await page.getByRole('navigation', { name: 'Schede dell\'evento' }).getByRole('link', { name: 'Menù' }).click()
  await expect(page.getByRole('button', { name: 'Lasagne: apri dettagli' })).toContainText('Nonna Maria')
  expect(JSON.stringify(await apiLeggi(request, '/eventi/ev-esterni/spesa'))).not.toContain('besciamella')
  const rubrica = await apiLeggi<{ nome: string }[]>(request, `/famiglie/${famiglia.id}/rubrica`)
  expect(rubrica.map((e) => e.nome)).toEqual(expect.arrayContaining(['Nonna Maria', 'Zio Marco']))
})
