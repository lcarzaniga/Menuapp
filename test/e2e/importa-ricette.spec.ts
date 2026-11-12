// Importazione ricette (docs/FORMATO-RICETTA.md): testo a mano, pacchetto con foto, foto dalla scheda.
import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { strToU8, zipSync } from 'fflate'

test.describe.configure({ mode: 'serial' })

/** JPEG vero, disegnato da Chrome (serve un'immagine decodificabile per la riduzione). */
async function jpeg(page: Page, colore: string): Promise<Buffer> {
  const dataUrl = await page.evaluate((c) => {
    const t = document.createElement('canvas')
    t.width = 2400
    t.height = 1600
    const x = t.getContext('2d')!
    x.fillStyle = c
    x.fillRect(0, 0, 2400, 1600)
    x.fillStyle = '#fff'
    x.beginPath()
    x.arc(1200, 800, 500, 0, Math.PI * 2)
    x.fill()
    return t.toDataURL('image/jpeg', 0.9)
  }, colore)
  return Buffer.from(dataUrl.split(',')[1]!, 'base64')
}

test('import da testo scritto a mano', async ({ page }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  await page.goto('/#/ricettario')
  await page.getByRole('button', { name: 'Importa' }).click()
  await page.getByLabel('Testo della ricetta').fill('# Crostata di marmellata\nPorzioni: 8\nCottura: 35 min\n\n## Ingredienti\n- 300 g di farina 00\n- 150 g di burro\n- 2 uova\n- 3 4 cucchiai di marmellata\n\n## Procedimento\n1. Impastare.\n2. Stendere e farcire.\n3. Cuocere.')
  await page.getByRole('button', { name: 'Leggi il testo' }).click()
  await expect(page.getByText('4 ingredienti')).toBeVisible()
  await expect(page.getByText('1 da verificare')).toBeVisible()
  await expect(page.getByText('3 passaggi')).toBeVisible()
  await page.getByRole('button', { name: 'Importa la ricetta' }).click()
  await expect(page.getByRole('heading', { name: 'Crostata di marmellata' })).toBeVisible()
  await expect(page.getByText('per 8 porzioni')).toBeVisible()
  await expect(page.getByText('1 da verificare')).toBeVisible()
})

test('import di un pacchetto con foto, foto aggiunta dalla scheda, esportazione', async ({ page }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  await page.goto('/#/ricettario')
  const [rossa, verde, blu] = [await jpeg(page, '#a5412a'), await jpeg(page, '#5f7556'), await jpeg(page, '#2f5a9e')]
  const ricetta = {
    formato: 'menuapp-ricetta',
    versione: 1,
    nome: 'Tiramisù di Natale',
    portata: 'Dolci',
    porzioniBase: 8,
    ingredienti: ['500 g mascarpone', { testo: '4 uova', quantita: 4, nome: 'uova' }, '300 g di savoiardi'],
    procedimento: ['Montare i tuorli.', 'Alternare savoiardi e crema.'],
    foto: [{ file: 'foto/1.jpg', didascalia: 'In teglia' }, { file: 'foto/2.jpg', didascalia: 'La fetta', principale: true }],
  }
  mkdirSync('test-results/import', { recursive: true })
  const percorso = 'test-results/import/tiramisu.menuapp-ricetta'
  writeFileSync(percorso, zipSync({ 'ricetta.json': strToU8(JSON.stringify(ricetta)), 'foto/1.jpg': rossa, 'foto/2.jpg': verde }))

  await page.getByRole('button', { name: 'Importa' }).click()
  await page.locator('input[type=file]').setInputFiles(percorso)
  await expect(page.getByText('2 foto')).toBeVisible()
  await expect(page.getByRole('img', { name: 'La fetta' })).toBeVisible()
  await page.getByRole('button', { name: 'Importa la ricetta' }).click()
  await expect(page.getByRole('heading', { name: 'Tiramisù di Natale' })).toBeVisible({ timeout: 15_000 })

  // la principale è «La fetta», ridotta a 1600 px
  const principale = page.getByRole('img', { name: 'La fetta' }).first()
  await expect(principale).toBeVisible()
  const larghezza = await principale.evaluate((i: HTMLImageElement) => (i.complete ? i.naturalWidth : 0))
  expect(larghezza).toBe(1600)

  // foto aggiunta dalla scheda
  writeFileSync('test-results/import/blu.jpg', blu)
  await page.locator('input[type=file][accept="image/*"]').setInputFiles('test-results/import/blu.jpg')
  await expect(page.getByText('Foto aggiunta')).toBeVisible()
  await expect(page.locator('section[aria-label="Foto"] img')).toHaveCount(3)
  await page.screenshot({ path: 'test-results/import/scheda.png', fullPage: true })

  // esportazione nel formato v1
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Esporta ricetta' }).click()
  expect((await download).suggestedFilename()).toBe('tiramisu-di-natale.menuapp-ricetta')

  // ricettario: miniatura della foto principale
  await page.goto('/#/ricettario')
  await expect(page.locator('a[href="#/ricettario"] img, ul img').first()).toBeVisible()
})
