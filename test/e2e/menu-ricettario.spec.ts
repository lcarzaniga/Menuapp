import { expect, type Page, test } from '@playwright/test'
import { apiLeggi } from './aiuti'

test.describe.configure({ mode: 'serial' })

async function screenshot(page: Page, nome: string) {
  await page.screenshot({ path: `test-results/schermate/${test.info().project.name}-${nome}.png`, fullPage: true })
}

/** Incolla testo in un campo come farebbe l'utente (evento paste con clipboardData). */
async function incolla(page: Page, etichetta: string, testo: string) {
  const campo = page.getByLabel(etichetta)
  await campo.focus()
  await campo.evaluate((el, t) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, testo)
}

test('evento, menù veloce, ricetta e vista cucina', async ({ page, request }, info) => {
  const nome = `Natale 2026 ${info.project.name}`
  await page.goto('/')
  await page.getByRole('link', { name: 'Nuovo' }).first().click()
  await page.getByLabel('Occasione').fill('Natale')
  await page.getByLabel('Nome dell\'evento').fill(nome)
  await page.getByLabel('Data').fill('2026-12-25')
  await page.getByLabel('Più adulti').click()
  await page.getByLabel('Più adulti').click()
  await page.getByLabel('Più adulti').click()
  await page.getByLabel('Più adulti').click() // 8 adulti
  for (let i = 0; i < 4; i++) await page.getByLabel('Più bambini').click()
  await page.getByLabel('Un bambino conta come').selectOption('0.5')
  await expect(page.getByText('10 coperti equivalenti')).toBeVisible()
  await screenshot(page, '01-nuovo-evento')
  await page.getByRole('button', { name: 'Crea e componi il menù' }).click()

  // Menù: inserimento rapido e multiriga
  await expect(page.getByLabel('Aggiungi a Antipasti')).toBeVisible()
  await page.getByLabel('Aggiungi a Antipasti').fill('Crostini toscani')
  await page.getByLabel('Aggiungi a Antipasti').press('Enter')
  await expect(page.getByRole('button', { name: 'Crostini toscani: apri dettagli' })).toBeVisible()
  await incolla(page, 'Aggiungi a Primi', '- Lasagne alla bolognese\n- Tortellini in brodo\n')
  await expect(page.getByText('2 voci aggiunte a Primi')).toBeVisible()
  await page.getByLabel('Aggiungi a Secondi').fill('Cappone ripieno')
  await page.getByLabel('Aggiungi a Secondi').press('Enter')
  await expect(page.getByRole('button', { name: 'Cappone ripieno: apri dettagli' })).toBeVisible()
  expect((await apiLeggi<unknown[]>(request, '/piatti')).length).toBe(info.project.name === 'telefono' ? 0 : 1)
  await screenshot(page, '02-menu')

  // Modifica di una voce: porzioni e incaricato
  await page.getByRole('button', { name: 'Tortellini in brodo: apri dettagli' }).click()
  await page.getByLabel('Porzioni').fill('12')
  await page.getByLabel('Chi lo prepara').fill('Zia Anna')
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByText('12 porzioni')).toBeVisible()
  await expect(page.getByText('Zia Anna')).toBeVisible()

  // Spostamento: il crostino passa ai primi e torna su
  await page.getByRole('button', { name: 'Azioni per Tortellini in brodo' }).click()
  await page.getByRole('menuitem', { name: 'Sposta su' }).click()
  const primi = page.locator('section', { has: page.getByRole('heading', { name: 'Primi' }) })
  await expect(primi.getByRole('listitem').first()).toContainText('Tortellini in brodo')

  // Crea nel ricettario e ingredienti incollati
  await page.getByRole('button', { name: 'Lasagne alla bolognese: apri dettagli' }).click()
  await page.getByRole('button', { name: /Crea «Lasagne alla bolognese» nel ricettario/ }).click()
  await expect(page.getByLabel('Porzioni base')).toBeVisible()
  await page.getByLabel('Porzioni base').fill('6')
  await page.getByRole('button', { name: 'Incolla ingredienti' }).click()
  await page.getByLabel('Ingredienti da analizzare').fill('500 g di lasagne\n400 g di macinato di manzo\n1 l di latte\n80 g di burro\nparmigiano grattugiato 100 g\nnoce moscata q.b.\n3 4 pomodori')
  await expect(page.getByText('Anteprima: 6 certe, 1 da verificare')).toBeVisible()
  await screenshot(page, '03-anteprima-parser')
  await page.getByRole('button', { name: 'Aggiungi 7 righe' }).click()
  await page.getByRole('button', { name: /pomodori/ }).filter({ hasText: 'Da verificare' }).click()
  await page.getByLabel('Quantità', { exact: true }).fill('3')
  await page.getByRole('textbox', { name: 'Ingrediente', exact: true }).fill('pomodori')
  await page.getByRole('button', { name: 'Conferma' }).click()
  await page.getByLabel('Procedimento').fill('Preparare il ragù.\n\nPreparare la besciamella.\n\nMontare gli strati e infornare.')
  await page.getByRole('button', { name: 'Salva piatto' }).click()
  await expect(page.getByRole('heading', { name: 'Lasagne alla bolognese' })).toBeVisible()
  await expect(page.getByText('per 6 porzioni')).toBeVisible()
  await expect(page.getByText('da verificare')).toHaveCount(0)
  await screenshot(page, '04-scheda-piatto')

  // Vista cucina dalla voce: 10 coperti → quantità × 10/6
  const eventi = await apiLeggi<{ id: string; nome: string }[]>(request, '/eventi')
  const eventoId = eventi.find((e) => e.nome === nome)?.id
  expect(eventoId).toBeTruthy()
  const menu = await apiLeggi<{ portate: { voci: { id: string; nome: string }[] }[] }>(request, `/eventi/${eventoId}/menu`)
  const lasagne = menu.portate.flatMap((p) => p.voci).find((v) => v.nome === 'Lasagne alla bolognese')!
  await page.goto(`/#/eventi/${eventoId}/voci/${lasagne.id}/cucina`)
  await expect(page.getByText('833 g')).toBeVisible() // 500 g × 10/6
  await expect(page.getByText('1,67 l')).toBeVisible()
  await page.getByRole('button', { name: /833 g/ }).click()
  await screenshot(page, '05-cucina')
  await page.getByLabel('Più porzioni').click()
  await expect(page.getByText('917 g')).toBeVisible() // 11 porzioni
})
