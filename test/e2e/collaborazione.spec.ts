// Collaborazione sulle ricette (SPEC §41), lo scenario di collaudo: un familiare propone tre modifiche
// (una foto), il proprietario ne approva due e ne rifiuta una, il proponente vede l'esito, la
// cronologia lo registra, la ricetta si trasferisce e l'amministratore la riassegna.
import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { apiDa, apiLeggi, apiScrivi, familiare } from './aiuti'

// PNG 1×1 valido: le foto passano dalla riduzione del browser.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test('proposta con foto, approvazione parziale, cronologia, trasferimento e riassegnazione', async ({ page, request, browser }, info) => {
  test.skip(info.project.name !== 'telefono', 'una sola esecuzione')
  test.setTimeout(150_000)
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  await apiScrivi(request, 'post', '/piatti', { id: 'col-torta', nome: 'Torta paradiso', porzioniBase: 8, tempoCotturaMin: 30, procedimento: ['Montare', 'Cuocere'], famiglie: [famiglia.id] })
  mkdirSync('test-results/collaborazione', { recursive: true })
  writeFileSync('test-results/collaborazione/fetta.png', PNG)

  // 1–2. Rosa apre la ricetta di Loris e propone tre modifiche, una è una foto.
  const rosa = await familiare(browser, request, 'Nives')
  const r = rosa.page
  await r.goto('/#/ricettario/col-torta')
  await r.getByRole('button', { name: 'Proponi una modifica' }).click()
  await r.getByLabel('Cottura (min)').fill('25')
  await r.getByLabel('Note').fill('Servire con zucchero a velo')
  await r.locator('input[type=file]').setInputFiles('test-results/collaborazione/fetta.png')
  await r.getByLabel('Perché (facoltativo)').fill('La faccio così da anni')
  await r.getByRole('button', { name: 'Invia la proposta' }).click()
  const suaProposta = r.getByTestId('proposta').first()
  await expect(suaProposta).toContainText('in attesa')
  await expect(suaProposta.getByTestId('modifica')).toHaveCount(3)

  // 3. Loris riceve la notifica, che porta alla proposta.
  await page.goto('/#/notifiche')
  await page.getByText('Nives propone modifiche a «Torta paradiso»').click()
  await expect(page).toHaveURL(/ricettario\/col-torta\/proposte\?proposta=/)
  // 4. Approva le note e la foto, rifiuta la cottura con un motivo.
  const proposta = page.getByTestId('proposta').first()
  const modifica = (testo: string) => proposta.getByTestId('modifica').filter({ hasText: testo })
  await modifica('Tempo di cottura').getByRole('button', { name: 'Rifiuta' }).click()
  await modifica('Tempo di cottura').getByPlaceholder('Motivo (facoltativo)').fill('In 30 minuti viene meglio')
  await modifica('Consigli e note').getByRole('button', { name: 'Approva' }).click()
  await modifica('Foto da aggiungere').getByRole('button', { name: 'Approva' }).click()
  await expect(proposta.getByTestId('riepilogo-decisioni')).toContainText('2 da approvare, 1 da rifiutare')
  await page.screenshot({ path: 'test-results/collaborazione/01-decisione.png', fullPage: true })
  await proposta.getByRole('button', { name: 'Conferma le decisioni' }).click()
  await expect(proposta).toContainText('conclusa')

  // 5. La ricetta cambia solo dove è stato approvato.
  const torta = await apiLeggi<{ tempoCotturaMin: number; note: string; foto: unknown[] }>(request, '/piatti/col-torta')
  expect(torta).toMatchObject({ tempoCotturaMin: 30, note: 'Servire con zucchero a velo' })
  expect(torta.foto).toHaveLength(1)

  // 6. Nives vede l'esito di ogni modifica.
  await r.reload()
  const esito = r.getByTestId('proposta').first()
  await expect(esito.getByTestId('modifica').filter({ hasText: 'Tempo di cottura' })).toContainText('rifiutata')
  await expect(esito.getByTestId('modifica').filter({ hasText: 'Tempo di cottura' })).toContainText('In 30 minuti viene meglio')
  await expect(esito.getByTestId('modifica').filter({ hasText: 'Consigli e note' })).toContainText('approvata')

  // 7. La cronologia registra chi ha proposto e chi ha approvato.
  await page.goto('/#/ricettario/col-torta/cronologia')
  await expect(page.getByTestId('revisione').filter({ hasText: 'Proposta di Nives, approvata da Loris' })).toBeVisible()
  await page.screenshot({ path: 'test-results/collaborazione/02-cronologia.png', fullPage: true })

  // 8–9. Loris trasferisce la ricetta a Nives, che accetta.
  await page.goto('/#/ricettario/col-torta')
  await page.getByRole('button', { name: 'Trasferisci proprietà' }).click()
  await page.getByRole('dialog').getByLabel('A chi').selectOption({ label: 'Nives' })
  await page.getByRole('dialog').getByRole('button', { name: 'Invia la richiesta' }).click()
  await expect(page.getByTestId('avviso-trasferimento')).toContainText('In attesa che Nives accetti')
  await r.goto('/#/ricettario/col-torta')
  await r.getByTestId('avviso-trasferimento').getByRole('button', { name: 'Accetta' }).click()
  await expect(r.getByRole('button', { name: 'Modifica' })).toBeVisible()

  // 10. L'amministratore riassegna una ricetta della Famiglia; non una privata.
  await page.reload()
  await page.getByRole('button', { name: 'Riassegna proprietà' }).click()
  await page.getByRole('dialog').getByLabel('A chi').selectOption({ label: 'Loris' })
  await page.getByRole('dialog').getByLabel('Motivazione (obbligatoria)').fill('Nives ha chiesto di restituirla')
  await page.getByRole('dialog').getByRole('button', { name: 'Riassegna' }).click()
  await expect(page.getByRole('button', { name: 'Modifica' })).toBeVisible()
  expect((await apiDa(r, 'POST', '/piatti', { id: 'col-privata', nome: 'Segreta di Nives', visibilita: 'privata' })).stato).toBe(201)
  expect((await apiScrivi(request, 'post', '/piatti/col-privata/riassegnazione', { id: 'col-r', a: 'utente-e2e-nives', motivazione: 'x' })).stato).toBe(404)
  await rosa.ctx.close()
})
