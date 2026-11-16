// Ricerca delle ricette per nome e ingredienti (SPEC §23), nel ricettario e nella scelta di un
// piatto per il menù; filtro per portata insieme alla ricerca, rubrica senza ricerca.
import { mkdirSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi } from './aiuti'

const CARTELLA = 'test-results/ricerca'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${nome}.png` })
}
const ing = (id: string, nome: string) => ({ id, ordine: 0, testoOriginale: nome, nome, ingredienteId: null, quantita: null, quantitaMax: null, unita: null, scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] })

test('cerca per nome e ingredienti nel ricettario e nel menù', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  for (const [id, nome, portataSuggerita, ingredienti] of [
    ['r-carbonara', 'Spaghetti alla carbonara', 'Primi', ['spaghetti', 'guanciale', 'uova', 'pecorino romano']],
    ['r-amatriciana', 'Bucatini all\'amatriciana', 'Primi', ['bucatini', 'guanciale', 'pomodori pelati', 'pecorino romano']],
    ['r-frittata', 'Frittata di zucchine', 'Secondi', ['uova', 'zucchine', 'menta']],
    ['r-guanciale', 'Guanciale croccante', 'Antipasti', ['guanciale']],
  ] as const) await apiScrivi(request, 'post', '/piatti', { id, nome, portataSuggerita, ingredienti: ingredienti.map((n, k) => ing(`${id}-${k}`, n)) })

  // ── Ricettario: «guanciale pecorino», senza distinzione di maiuscole
  await page.goto('/#/ricettario')
  await page.getByLabel('Cerca un piatto').fill('GUANCIALE Pecorino')
  const nelNome = page.getByRole('region', { name: 'Negli ingredienti' })
  await expect(nelNome.getByRole('link', { name: /Bucatini all'amatriciana/ })).toContainText('con guanciale, pecorino romano')
  await expect(nelNome.getByRole('link', { name: /Spaghetti alla carbonara/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Corrispondenze parziali' }).getByRole('link', { name: /Guanciale croccante/ })).toBeVisible()
  // Con la ricerca l'ordine è per pertinenza: niente rubrica alfabetica.
  await expect(page.getByRole('navigation', { name: 'Rubrica alfabetica' })).toHaveCount(0)
  await foto(page, '01-ricettario')
  // Il filtro per portata resta e si combina con la ricerca.
  await page.getByLabel('Cerca un piatto').fill('uova')
  await expect(page.getByRole('link', { name: /Frittata di zucchine/ })).toBeVisible()
  await page.getByRole('group', { name: 'Filtra per portata' }).getByRole('button', { name: /^Primi \d+$/ }).click()
  await expect(page.getByRole('link', { name: /Spaghetti alla carbonara/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Frittata di zucchine/ })).toHaveCount(0)
  await page.getByRole('group', { name: 'Filtra per portata' }).getByRole('button', { name: /^Tutte/ }).click()

  // ── Menù: scrivendo un ingrediente si trova la ricetta e la si collega
  const ev = (await apiScrivi(request, 'post', '/eventi', { id: 'ev-ricerca', nome: 'Cena di prova ricerca', data: '2027-04-10', oraServizio: null, tipo: 'cena', occasione: '', adulti: 4, bambini: 0, note: '' })).corpo
  await page.goto('/#/eventi/ev-ricerca/menu')
  await page.getByPlaceholder('Aggiungi a secondi…').fill('zucchine menta')
  const proposte = page.getByRole('listbox', { name: 'Piatti del ricettario' })
  await expect(proposte.getByRole('option', { name: /Frittata di zucchine/ })).toContainText('con menta')
  await foto(page, '02-menu')
  await proposte.getByRole('option', { name: /Frittata di zucchine/ }).click()
  await expect(page.getByRole('button', { name: 'Frittata di zucchine: apri dettagli' })).toBeVisible()
  const menu = await apiLeggi<{ portate: { voci: { nome: string; piattoId: string | null }[] }[] }>(request, `/eventi/${ev.id}/menu`)
  expect(menu.portate.flatMap((p) => p.voci).find((v) => v.nome === 'Frittata di zucchine')?.piattoId).toBe('r-frittata')
})
