// Ricorrenze standard (SPEC §30), dal telefono: un evento «Vigilia di Natale» entra da solo nella
// ricorrenza standard, la si può cambiare o togliere; duplicato resta nella ricorrenza e le due
// edizioni si confrontano; una ricorrenza della Famiglia con lo stesso nome resta distinta.
import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi, azioneEvento, senzaScorrimentoOrizzontale } from './aiuti'

const CARTELLA = 'test-results/ricorrenze-standard'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${nome}.png`, fullPage: true })
}

test('vigilia di Natale: ricorrenza automatica, modificabile, duplicata e confrontata', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  test.setTimeout(90_000)
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  await page.addInitScript((id) => localStorage.setItem('menuapp.famiglia', id), famiglia.id)
  // Una ricorrenza della Famiglia con lo stesso nome di una standard.
  await apiScrivi(request, 'post', `/famiglie/${famiglia.id}/ricorrenze`, { id: 'rs-vigilia', nome: 'Vigilia di Natale' })

  // ── Nuovo evento: l'occasione propone la ricorrenza standard
  await page.goto('/#/eventi/nuovo')
  const ricorrenza = page.getByLabel('Ricorrenza', { exact: true })
  await expect(ricorrenza).toHaveValue('')
  await page.getByLabel('Occasione').fill('Vigilia di Natale')
  await expect(ricorrenza).toHaveValue('standard:vigilia-natale')
  await expect(page.getByText('Dall\'occasione: le edizioni di «Vigilia di Natale»')).toBeVisible()
  // Le due «Vigilia di Natale» sono distinte nell'elenco.
  await expect(ricorrenza.locator('optgroup[label="Ricorrenze standard"] option', { hasText: 'Vigilia di Natale' })).toHaveCount(1)
  await expect(ricorrenza.locator('optgroup[label="Ricorrenze della Famiglia"] option', { hasText: 'Vigilia di Natale (della Famiglia)' })).toHaveCount(1)
  await page.getByLabel('Data').fill('2026-12-24')
  await senzaScorrimentoOrizzontale(page)
  await foto(page, '01-nuovo-evento')
  await page.getByRole('button', { name: 'Crea e componi il menù' }).click()
  await expect(page.getByRole('heading', { name: 'Vigilia di Natale 2026' })).toBeVisible()
  const id = /eventi\/([^/]+)/.exec(page.url())![1]!
  expect(await apiLeggi<{ ricorrenzaStandard: string | null; ricorrenzaId: string | null }>(request, `/eventi/${id}`)).toMatchObject({ ricorrenzaStandard: 'vigilia-natale', ricorrenzaId: null })
  await apiScrivi(request, 'post', `/eventi/${id}/voci`, { voci: [{ id: 'rs-v1', portataId: (await apiLeggi<{ portate: { id: string }[] }>(request, `/eventi/${id}`)).portate[1]!.id, nome: 'Baccalà fritto' }] })

  // ── Panoramica: la si toglie e la si rimette; la scelta resta
  await page.goto(`/#/eventi/${id}`)
  const pannello = page.getByLabel('Ricorrenza dell\'evento')
  await expect(pannello).toHaveValue('standard:vigilia-natale')
  await pannello.selectOption('')
  await expect(page.getByText('Nessuna ricorrenza', { exact: true }).last()).toBeAttached()
  await expect(page.getByTestId('ricorrenza-suggerita')).toHaveCount(0)
  await page.reload()
  await expect(pannello).toHaveValue('')
  await pannello.selectOption('standard:vigilia-natale')
  await expect(page.getByText('Ricorrenza: Vigilia di Natale · standard')).toBeVisible()
  await foto(page, '02-panoramica')

  // ── Duplica per il 2027: stessa ricorrenza, nessuna definizione nuova
  await azioneEvento(page, 'Duplica evento')
  const dialogo = page.getByRole('dialog')
  await expect(dialogo.getByLabel('Ricorrenza')).toHaveValue('standard:vigilia-natale')
  await dialogo.getByRole('button', { name: 'Duplica' }).click()
  await expect(page.getByRole('heading', { name: 'Vigilia di Natale 2027' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Altri eventi della ricorrenza' })).toContainText('Vigilia di Natale 2026')
  const ricorrenzeFamiglia = await apiLeggi<{ nome: string }[]>(request, `/famiglie/${famiglia.id}/ricorrenze`)
  expect(ricorrenzeFamiglia.filter((r) => r.nome === 'Vigilia di Natale')).toHaveLength(1)

  // ── Confronto fra le due edizioni
  await page.getByRole('link', { name: 'Confronta con l\'anno scorso' }).click()
  await expect(page.getByTestId('eventi-confrontati')).toContainText('Stessa ricorrenza: Vigilia di Natale')
  await expect(page.getByRole('list', { name: 'In entrambe' })).toContainText('Baccalà fritto')
  await foto(page, '03-confronto')
})
