// Memoria di famiglia (SPEC §40): storia del proprietario, ricordo di un familiare con autore,
// ognuno modifica solo i suoi; l'amministratore della Famiglia può toglierli.
import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { apiLeggi, apiScrivi, familiare } from './aiuti'

test('storia e ricordi di una ricetta di famiglia', async ({ page, request, browser }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  test.setTimeout(90_000)
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  await apiScrivi(request, 'post', '/piatti', { id: 'mem-ragu', nome: 'Ragù di nonna Lina', famiglie: [famiglia.id] })

  await page.goto('/#/ricettario/mem-ragu')
  const memoria = page.getByTestId('memoria-ricetta')
  await memoria.getByRole('button', { name: 'Scrivi' }).click()
  await page.getByRole('dialog').getByRole('textbox', { name: 'Storia' }).fill('Nonna Lina lo preparava ogni domenica, dal 1962.')
  await page.getByRole('dialog').getByRole('button', { name: 'Salva' }).click()
  await expect(memoria.getByTestId('storia-ricetta')).toContainText('dal 1962')

  // Un familiare aggiunge un ricordo: con il suo nome; lui lo modifica, l'autore della ricetta no.
  const zia = await familiare(browser, request, 'Rosa')
  await zia.page.goto('/#/ricettario/mem-ragu')
  const suaMemoria = zia.page.getByTestId('memoria-ricetta')
  await expect(suaMemoria.getByTestId('storia-ricetta')).toContainText('Nonna Lina')
  await suaMemoria.getByRole('button', { name: 'Aggiungi un ricordo' }).click()
  await zia.page.getByRole('dialog').getByLabel('Ricordo').fill('Il pentolone sul fuoco dalle sette del mattino.')
  await zia.page.getByRole('dialog').getByRole('button', { name: 'Aggiungi', exact: true }).click()
  const suo = suaMemoria.getByTestId('contributo-memoria').filter({ hasText: 'pentolone' })
  await expect(suo).toContainText('Rosa')
  await expect(suo.getByRole('button', { name: 'Modifica' })).toBeVisible()

  await page.reload()
  const visto = memoria.getByTestId('contributo-memoria').filter({ hasText: 'pentolone' })
  await expect(visto).toContainText('Rosa')
  await expect(visto.getByRole('button', { name: 'Modifica' })).toHaveCount(0)
  // L'amministratore della Famiglia può toglierlo.
  await expect(visto.getByRole('button', { name: 'Elimina' })).toBeVisible()
  mkdirSync('test-results/memoria', { recursive: true })
  await memoria.screenshot({ path: 'test-results/memoria/01-memoria.png' })
  await zia.ctx.close()
})
