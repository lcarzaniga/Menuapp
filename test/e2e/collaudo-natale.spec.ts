// Collaudo completo (mandato §12): pranzo di Natale 2026 da due dispositivi.
import { expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi, console_, SU_CLOUDFLARE } from './aiuti'

test.describe.configure({ mode: 'serial' })

const foto = (page: Page, nome: string) => page.screenshot({ path: `test-results/schermate/collaudo-${nome}.png`, fullPage: true })

async function incolla(page: Page, etichetta: string, testo: string) {
  const campo = page.getByLabel(etichetta)
  await campo.focus()
  await campo.evaluate((el, t) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, testo)
}

async function ricetta(page: Page, voce: string, porzioni: string, ingredienti: string, procedimento: string) {
  await page.getByRole('button', { name: `${voce}: apri dettagli` }).click()
  await page.getByRole('button', { name: `Crea «${voce}» nel ricettario` }).click()
  await page.getByLabel('Porzioni base').fill(porzioni)
  await page.getByRole('button', { name: 'Incolla ingredienti' }).click()
  await page.getByLabel('Ingredienti da analizzare').fill(ingredienti)
  await page.getByRole('button', { name: /^Aggiungi \d+ righe?$/ }).click()
  await page.getByLabel('Procedimento').fill(procedimento)
  await page.getByRole('button', { name: 'Salva piatto' }).click()
  await expect(page.getByRole('heading', { name: voce })).toBeVisible()
}

test('Natale 2026: dal menù alla tavola, da due dispositivi', async ({ page, browser, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'scenario unico: il secondo dispositivo è un contesto desktop')
  test.setTimeout(180_000)
  // ── Telefono: evento e partecipanti
  await page.goto('/#/eventi/nuovo')
  await page.getByLabel('Occasione').fill('Natale')
  await page.getByLabel('Data').fill('2026-12-25')
  await expect(page.getByLabel('Nome dell\'evento')).toHaveValue('Natale 2026')
  for (let i = 0; i < 4; i++) await page.getByLabel('Più adulti').click()
  for (let i = 0; i < 4; i++) await page.getByLabel('Più bambini').click()
  await page.getByLabel('Un bambino conta come').selectOption('0.5')
  await expect(page.getByText('10 coperti equivalenti')).toBeVisible()
  await page.getByRole('button', { name: 'Crea e componi il menù' }).click()

  // ── Menù con più portate
  await incolla(page, 'Aggiungi a Antipasti', 'Crostini toscani\nSalmone affumicato')
  await expect(page.getByText('2 voci aggiunte a Antipasti')).toBeVisible()
  await page.getByLabel('Aggiungi a Primi').fill('Lasagne alla bolognese')
  await page.getByLabel('Aggiungi a Primi').press('Enter')
  await page.getByLabel('Aggiungi a Secondi').fill('Arrosto di vitello')
  await page.getByLabel('Aggiungi a Secondi').press('Enter')
  await page.getByLabel('Aggiungi a Dolci').fill('Tiramisù')
  await page.getByLabel('Aggiungi a Dolci').press('Enter')
  await expect(page.getByRole('button', { name: 'Tiramisù: apri dettagli' })).toBeVisible()
  const eventoId = /eventi\/([^/]+)/.exec(page.url())![1]!

  // ── Ricette collegate, ingredienti interpretati
  await ricetta(page, 'Lasagne alla bolognese', '6', '500 g di lasagne\n600 g di macinato di manzo\n1 l di latte\n80 g di burro\nparmigiano grattugiato 150 g\nnoce moscata q.b.', 'Preparare il ragù.\n\nMontare gli strati e infornare.')
  await page.goto(`/#/eventi/${eventoId}/menu`)
  await ricetta(page, 'Tiramisù', '8', '500 g mascarpone\n4 uova\n100 g di zucchero\n300 g di savoiardi\n2 tazzine di caffè\ncacao amaro q.b.', 'Montare tuorli e zucchero.\n\nAlternare savoiardi e crema.')
  await foto(page, '01-tiramisu')

  // ── Spesa aggregata e scalata
  await page.goto(`/#/eventi/${eventoId}/spesa`)
  const daComprare = page.getByRole('region', { name: 'Da comprare' })
  await expect(daComprare.getByText(/625 g\s+mascarpone/i)).toBeVisible() // 500 × 10/8
  await expect(daComprare.getByText(/835 g\s+lasagne/i)).toBeVisible() // 500 × 10/6 = 833 → per eccesso a 5 g
  await expect(page.getByText('Arrosto di vitello: nessuna ricetta')).toBeVisible()
  await foto(page, '02-spesa')
  // spunta di alcuni acquisti
  await page.getByRole('button', { name: 'mascarpone: segna comprato' }).click()
  await page.getByRole('button', { name: 'savoiardi: segna comprato' }).click()
  await expect(page.getByRole('region', { name: 'Comprato' }).getByText(/mascarpone/i)).toBeVisible()

  // ── Secondo dispositivo (PC): stesso evento, modifica del menù
  const pc = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'it-IT' })
  const p2 = await pc.newPage()
  await p2.goto(`/#/eventi/${eventoId}/menu`)
  await expect(p2.getByRole('button', { name: 'Tiramisù: apri dettagli' })).toBeVisible()
  // il PC porta il tiramisù a 16 porzioni
  await p2.getByRole('button', { name: 'Tiramisù: apri dettagli' }).click()
  await p2.getByLabel('Porzioni').fill('16')
  await p2.getByRole('button', { name: 'Salva' }).click()
  await expect(p2.getByText('16 porzioni')).toBeVisible()

  // ── Telefono: riconciliazione senza ricaricare (aggiornamento automatico ≤ 15 s)
  await expect(page.getByText(/da integrare: segnato per 625 g, ora servono 1 kg/)).toBeVisible({ timeout: 15_000 })
  await expect(daComprare.getByText(/\+375 g\s+mascarpone/i)).toBeVisible()
  await foto(page, '03-riconciliazione')
  await page.getByRole('button', { name: 'Coperto anche l\'aumento' }).first().click()
  await expect(page.getByRole('region', { name: 'Comprato' }).getByText(/1 kg\s+mascarpone/i)).toBeVisible()

  // ── Conflitto: stessa voce modificata da due dispositivi
  await page.goto(`/#/eventi/${eventoId}/menu`)
  await page.getByRole('button', { name: 'Crostini toscani: apri dettagli' }).click()
  await p2.reload()
  await p2.getByRole('button', { name: 'Crostini toscani: apri dettagli' }).click()
  await p2.getByLabel('Note').fill('dal PC')
  await p2.getByRole('button', { name: 'Salva' }).click()
  await expect(p2.getByText('Salvato')).toBeVisible()
  await page.getByLabel('Note').fill('dal telefono')
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('dialog', { name: 'Modificato da un altro dispositivo' })).toBeVisible()
  await page.getByRole('button', { name: 'Ricarica i dati attuali' }).click()

  // ── Piano: attività create e completate
  await page.goto(`/#/eventi/${eventoId}/piano`)
  await page.getByRole('button', { name: 'Attività' }).click()
  await page.getByLabel('Cosa fare').fill('Preparare il ragù')
  await page.getByRole('button', { name: 'Il giorno prima' }).click()
  await page.getByLabel('Piatto collegato').selectOption({ label: 'Lasagne alla bolognese' })
  await page.getByRole('button', { name: 'Salva' }).click()
  await page.getByRole('button', { name: 'Attività' }).click()
  await page.getByLabel('Cosa fare').fill('Apparecchiare')
  await page.getByRole('button', { name: 'La mattina' }).click()
  await page.getByRole('button', { name: 'Salva' }).click()
  await page.getByRole('button', { name: 'Preparare il ragù: fatto' }).click()
  await expect(page.getByText('1 di 2 fatte')).toBeVisible()
  await foto(page, '04-piano')

  // ── Stampa del menù
  await page.goto(`/#/eventi/${eventoId}/stampa`)
  const menu = page.getByTestId('anteprima-menu')
  await expect(menu.locator('.menu-titolo')).toHaveText('Natale 2026')
  await expect(menu.getByText('Lasagne alla bolognese')).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await foto(page, '05-stampa')
  await expect(page.getByRole('button', { name: /Stampa/ })).toBeHidden()
  await expect(page.locator('.menu-stampa').getByText('Lasagne alla bolognese')).toBeVisible()
  await page.emulateMedia({ media: null })

  // ── Backup e ripristino su questo database di prova
  const prima = (await apiLeggi<{ impronta: string }>(request, '/esportazione')).impronta
  const backup = await apiScrivi(request, 'post', '/backup', {})
  expect(backup.stato).toBe(201)
  await apiScrivi(request, 'delete', `/eventi/${eventoId}?versione=${(await apiLeggi<{ versione: number }>(request, `/eventi/${eventoId}`)).versione}`)
  expect((await apiLeggi<unknown[]>(request, '/eventi')).find((e) => (e as { id: string }).id === eventoId)).toBeUndefined()
  await page.goto('/#/impostazioni/dati')
  if (SU_CLOUDFLARE) {
    // Su Cloudflare il ripristino si fa solo dalla console (SPEC §32.6).
    await expect(page.getByRole('button', { name: 'Ripristina' })).toHaveCount(0)
    expect(console_('ripristina', (backup.corpo as { nome: string }).nome)).toContain('Ripristinato')
  } else {
    await page.getByRole('listitem').filter({ hasText: 'Manuale' }).first().getByRole('button', { name: 'Ripristina' }).click()
    await page.getByLabel(/Per confermare/).fill('RIPRISTINA')
    await page.getByRole('dialog').getByRole('button', { name: 'Ripristina' }).click()
    await expect(page.getByText('Ripristino completato')).toBeVisible()
  }
  expect((await apiLeggi<{ impronta: string }>(request, '/esportazione')).impronta).toBe(prima)
  // il PC vede di nuovo l'evento senza ricaricare a mano
  await p2.goto('/')
  await expect(p2.getByRole('link', { name: /Natale 2026/ })).toBeVisible()
  await pc.close()
})
