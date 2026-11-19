// Regia della cucina (SPEC §38): dal piano vuoto alla proposta dai piatti, spunta, filtri, testo grande.
import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { apiLeggi, apiScrivi } from './aiuti'

const oggi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())

test('regia: prepara il piano dai piatti, spunta e filtri', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'pensata per schermi larghi: una sola esecuzione')
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  const ev = (await apiScrivi(request, 'post', '/eventi', { id: 'rg-ev', nome: 'Pranzo della domenica', data: oggi(), oraServizio: '23:30', tipo: 'pranzo', occasione: '', adulti: 6, bambini: 0, note: '', gruppoId: famiglia.id })).corpo
  await apiScrivi(request, 'post', '/piatti', { id: 'rg-arrosto', nome: 'Arrosto al forno', tempoPreparazioneMin: 20, tempoCotturaMin: 70, attrezzature: ['teglia'], procedimento: ['Infornare a 180 °C'], famiglie: [famiglia.id] })
  await apiScrivi(request, 'post', '/piatti', { id: 'rg-insalata', nome: 'Insalata', procedimento: ['Lavare e condire'], famiglie: [famiglia.id] })
  await apiScrivi(request, 'post', '/eventi/rg-ev/voci', { voci: [{ id: 'rg-v1', portataId: ev.portate[2].id, nome: 'Arrosto al forno', piattoId: 'rg-arrosto' }, { id: 'rg-v2', portataId: ev.portate[3].id, nome: 'Insalata', piattoId: 'rg-insalata' }] })

  await page.goto('/#/eventi/rg-ev/piano')
  await page.getByRole('link', { name: 'Regia della cucina' }).click()
  await expect(page.getByRole('heading', { name: 'Regia della cucina' })).toBeVisible()
  await expect(page.getByText('Il piano delle attività è vuoto')).toBeVisible()
  await page.getByRole('button', { name: 'Prepara il piano dai piatti' }).click()
  const dialogo = page.getByRole('dialog')
  // Ora suggerita dai tempi della ricetta (90 minuti prima delle 23:30), modificabile.
  await expect(dialogo.getByLabel('Ora per Arrosto al forno')).toHaveValue('22:00')
  await expect(dialogo.getByLabel('Ora per Insalata')).toHaveValue('')
  await dialogo.getByRole('button', { name: 'Crea 2 attività' }).click()

  const schede = page.getByTestId('attivita-regia')
  await expect(schede).toHaveCount(2)
  const arrosto = schede.filter({ hasText: 'Preparare arrosto al forno' })
  await expect(arrosto).toContainText('Forno')
  await expect(arrosto).toContainText('prep. 20′ · cottura 70′')
  await expect(arrosto.getByRole('link', { name: 'Ricetta in cucina' })).toBeVisible()
  // Filtro per attrezzatura: solo il forno.
  await page.getByRole('button', { name: 'Forno', exact: true }).click()
  await expect(schede).toHaveCount(1)
  await page.getByRole('button', { name: 'Tutte', exact: true }).click()
  // Spunta: passa fra le fatte (lo stesso stato del piano).
  await page.getByRole('button', { name: 'Preparare insalata: segna fatta' }).click()
  await expect(page.getByRole('region', { name: 'Fatto' })).toContainText('Preparare insalata')
  await page.getByRole('button', { name: 'Testo grande' }).click()
  mkdirSync('test-results/regia', { recursive: true })
  await page.screenshot({ path: 'test-results/regia/01-regia.png', fullPage: true })
  // Il piano vede le stesse attività.
  await page.goto('/#/eventi/rg-ev/piano')
  await expect(page.getByText('1 di 2 fatte')).toBeVisible()
})
