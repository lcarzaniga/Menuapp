// Ricette pubbliche fra Famiglie (SPEC §36): pubblicazione con conferma, preferenza «Includi ricette
// pubbliche» persistente, filtro, etichette, copia privata in una propria Famiglia, indipendenza.
import { expect, test } from '@playwright/test'
import { apiDa, apiLeggi, apiScrivi, familiare, vaiA } from './aiuti'

test('pubblica, trovata da un\'altra Famiglia con la preferenza, copiata privata e indipendente', async ({ page, request, browser }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  await apiScrivi(request, 'post', '/piatti', { id: 'pub-ragu', nome: 'Ragù pubblico della nonna', porzioniBase: 4, famiglie: [famiglia.id], procedimento: ['Rosolare piano'], ingredienti: [] })

  // L'autore la pubblica dalla scheda, con una conferma.
  await page.goto('/#/ricettario/pub-ragu')
  await page.getByRole('button', { name: 'Pubblica nell\'app…' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Pubblica' }).click()
  await expect(page.getByTestId('pubblica-ricetta')).toContainText('Pubblica nell\'app: tutti gli utenti la leggono')

  // Ospite, di un'altra Famiglia: non la vede finché non include le pubbliche.
  const ospite = await familiare(browser, request, 'Ospite', false)
  const o = ospite.page
  expect((await apiDa(o, 'POST', '/famiglie', { id: 'fam-verdi', nome: 'Famiglia Verdi' })).stato).toBeLessThan(300)
  await vaiA(o, 'Ricettario')
  await expect(o.getByText('Ragù pubblico della nonna')).toHaveCount(0)
  const includi = o.getByRole('button', { name: 'Includi ricette pubbliche' })
  await expect(includi).toHaveAttribute('aria-pressed', 'false')
  await includi.click()
  const riga = o.getByRole('link', { name: /Ragù pubblico della nonna/ })
  await expect(riga).toContainText('pubblica · Famiglia')
  await o.getByRole('button', { name: 'Solo pubbliche' }).click()
  await expect(o.getByRole('link', { name: /Ragù pubblico della nonna/ })).toBeVisible()
  // La preferenza resta (è sul server).
  await o.reload()
  await expect(o.getByRole('button', { name: 'Includi ricette pubbliche' })).toHaveAttribute('aria-pressed', 'true')

  // Copia in una sua Famiglia: privata, sua, con la provenienza.
  await o.getByRole('link', { name: /Ragù pubblico della nonna/ }).click()
  await o.getByRole('button', { name: 'Copia in una mia Famiglia' }).click()
  await o.getByRole('dialog').getByRole('button', { name: 'Copia' }).click()
  await expect(o.getByTestId('famiglia-origine')).toHaveText('Nata in Famiglia Verdi')
  await expect(o.getByTestId('visibilita-ricetta')).toContainText('Privata')
  await expect(o.getByTestId('provenienza-ricetta')).toContainText('da «Famiglia» (era «Ragù pubblico della nonna»)')
  const copiaId = /ricettario\/([^/?]+)/.exec(o.url())![1]!

  // L'autore la rende privata: Ospite non vede più l'originale, la copia resta.
  await apiScrivi(request, 'put', '/piatti/pub-ragu/visibilita', { visibilita: 'privata' })
  const dopo = await o.evaluate(async (id) => [(await fetch('/api/v1/piatti/pub-ragu')).status, (await fetch(`/api/v1/piatti/${id}`)).status], copiaId)
  expect(dopo).toEqual([404, 200])
  await ospite.ctx.close()
})
