// «Chi porta cosa» flessibile (SPEC §39): un piatto a scelta nasce in Chi porta, compare nel menù come
// «da definire» con chi lo porta, si precisa senza perdere l'incarico.
import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { apiLeggi, apiScrivi } from './aiuti'

test('piatto a scelta: da Chi porta al menù, poi precisato', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  await apiScrivi(request, 'post', '/eventi', { id: 'ct-ev', nome: 'Grigliata', data: '2030-07-10', oraServizio: null, tipo: 'cena', occasione: '', adulti: 10, bambini: 0, coefficienteBambini: 0.5, note: '', gruppoId: famiglia.id })

  await page.goto('/#/eventi/ct-ev/chi-porta')
  await page.getByRole('button', { name: 'Piatto a scelta' }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByLabel('Portata').selectOption({ label: 'Antipasti' })
  await dialogo.getByLabel('Quanti').fill('2')
  await dialogo.getByText('Me ne occupo io').click()
  await dialogo.getByRole('button', { name: 'Aggiungi' }).click()
  const riga = page.getByTestId('incarico').filter({ hasText: 'Antipasti a scelta' })
  await expect(riga).toContainText('2 × Antipasti a scelta')
  await expect(riga).toContainText('a scelta di chi lo porta')
  await expect(riga).toContainText('tu')

  // Nel menù è la stessa voce, «da definire», con chi la porta; niente spesa.
  await page.goto('/#/eventi/ct-ev/menu')
  const voce = page.getByRole('button', { name: /Antipasti a scelta: apri dettagli/ })
  await expect(voce).toContainText('da definire')
  await expect(voce).toContainText('Loris')
  mkdirSync('test-results/contributi', { recursive: true })
  await page.screenshot({ path: 'test-results/contributi/01-menu.png' })

  // Precisato: stesso incarico, nuovo nome.
  await page.goto('/#/eventi/ct-ev/chi-porta')
  await page.getByTestId('incarico').filter({ hasText: 'Antipasti a scelta' }).getByRole('button', { name: 'Precisa' }).click()
  await page.getByRole('dialog').getByLabel('Piatto').fill('Bruschette e crostini')
  await page.getByRole('dialog').getByRole('button', { name: 'Salva' }).click()
  const precisato = page.getByTestId('incarico').filter({ hasText: 'Bruschette e crostini' })
  await expect(precisato).toContainText('2 × Bruschette e crostini')
  await expect(precisato).toContainText('tu')
  await expect(precisato).not.toContainText('a scelta di chi lo porta')
  await page.screenshot({ path: 'test-results/contributi/02-chi-porta.png' })
})
