// Ricorrenze della Famiglia e copia di una ricetta in un'altra Famiglia (SPEC §28).
import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi } from './aiuti'

const CARTELLA = 'test-results/ricorrenze'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${nome}.png`, fullPage: true })
}

test('ricorrenze: creare, rinominare, eliminare senza perdere gli eventi', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  await page.addInitScript((id) => localStorage.setItem('menuapp.famiglia', id), famiglia.id)
  await page.goto('/#/famiglia?scheda=gestione')
  await page.getByLabel('Nuova ricorrenza').fill('Ferragosto')
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).first().click()
  const elenco = page.getByRole('list', { name: 'Ricorrenze della Famiglia' })
  await expect(elenco).toContainText('Ferragosto · 0 eventi')
  await elenco.getByRole('button', { name: 'Azioni per Ferragosto' }).click()
  await page.getByRole('menuitem', { name: 'Rinomina' }).click()
  await page.getByRole('dialog').getByLabel('Nome', { exact: true }).fill('Ferragosto al mare')
  await page.getByRole('dialog').getByRole('button', { name: 'Salva' }).click()
  await expect(elenco).toContainText('Ferragosto al mare')
  await foto(page, '01-ricorrenze')

  // Un evento nella ricorrenza; poi la ricorrenza si elimina e l'evento resta.
  const r = (await apiLeggi<{ id: string; nome: string }[]>(request, `/famiglie/${famiglia.id}/ricorrenze`)).find((x) => x.nome === 'Ferragosto al mare')!
  await apiScrivi(request, 'post', '/eventi', { id: 'ric-ev', nome: 'Grigliata', data: '2027-08-15', oraServizio: null, tipo: 'pranzo', occasione: '', adulti: 6, bambini: 0, note: '', gruppoId: famiglia.id })
  await apiScrivi(request, 'put', '/eventi/ric-ev/ricorrenza', { ricorrenzaId: r.id })
  await page.reload()
  await expect(elenco).toContainText('Ferragosto al mare · 1 evento')
  await elenco.getByRole('button', { name: 'Azioni per Ferragosto al mare' }).click()
  await page.getByRole('menuitem', { name: 'Elimina' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Elimina ricorrenza' }).click()
  await expect(page.getByText('Ferragosto al mare')).toHaveCount(0)
  expect((await apiLeggi<{ nome: string; ricorrenzaId: string | null }>(request, '/eventi/ric-ev'))).toMatchObject({ nome: 'Grigliata', ricorrenzaId: null })
})

test('copia di una ricetta in un\'altra Famiglia, indipendente e con la provenienza', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  const gruppi = await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')
  const famiglia = gruppi.find((g) => g.nome === 'Famiglia')!
  const altra = gruppi.find((g) => g.nome === 'Amici del mare') ?? (await apiScrivi(request, 'post', '/famiglie', { id: 'fam-mare', nome: 'Amici del mare' })).corpo
  await apiScrivi(request, 'post', '/piatti', { id: 'ric-pesto', nome: 'Pesto genovese', porzioniBase: 4, famiglie: [famiglia.id], procedimento: ['Pestare nel mortaio'], ingredienti: [] })

  await page.goto('/#/ricettario/ric-pesto')
  // La Famiglia d'origine fa parte dell'identità della ricetta (SPEC §35).
  await expect(page.getByTestId('famiglia-origine')).toHaveText('Nata in Famiglia')
  await page.getByRole('button', { name: 'Copia in un\'altra Famiglia' }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Nella Famiglia').selectOption({ label: 'Amici del mare' })
  await dialogo.getByText('Indica che viene da').click()
  await dialogo.getByRole('button', { name: 'Copia' }).click()
  await expect(page.getByTestId('provenienza-ricetta')).toContainText('da «Famiglia» (era «Pesto genovese»)')
  await expect(page.getByTestId('visibilita-ricetta')).toContainText('Amici del mare')
  await expect(page.getByTestId('famiglia-origine')).toHaveText('Nata in Amici del mare')
  await foto(page, '02-copia-ricetta')
  const copiaId = /ricettario\/([^/?]+)/.exec(page.url())![1]!
  expect(copiaId).not.toBe('ric-pesto')

  // L'originale cambia, la copia no.
  const originale = await apiLeggi<Record<string, unknown>>(request, '/piatti/ric-pesto')
  await apiScrivi(request, 'put', '/piatti/ric-pesto', { ...originale, procedimento: ['Frullare'] })
  expect((await apiLeggi<{ procedimento: string[]; famiglie: { id: string }[] }>(request, `/piatti/${copiaId}`))).toMatchObject({ procedimento: ['Pestare nel mortaio'], famiglie: [{ id: altra.id }] })
})
