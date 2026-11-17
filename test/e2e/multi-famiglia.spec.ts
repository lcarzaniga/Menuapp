// Più Famiglie (SPEC §21): chi ne ha una sola non vede il selettore; con due compare e separa
// bacheche ed eventi; chi non ne ha vede la schermata iniziale e può entrare con un invito.
import { mkdirSync } from 'node:fs'
import { devices, expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi, chiediAccesso } from './aiuti'

test.describe.configure({ mode: 'serial' })
const CARTELLA = 'test-results/multi-famiglia'
const foto = async (page: Page, nome: string) => {
  mkdirSync(CARTELLA, { recursive: true })
  await page.screenshot({ path: `${CARTELLA}/${nome}.png` })
}
const selettore = (page: Page) => page.getByRole('combobox', { name: 'Famiglia attiva' }).filter({ visible: true })

test('una Famiglia senza selettore, poi due Famiglie con selettore e contenuti separati, invito ad aderire', async ({ page, browser, request }, info) => {
  test.skip(info.project.name !== 'telefono', 'scenario su telefono: una sola esecuzione')
  test.setTimeout(120_000)
  const famiglie = await apiLeggi<{ id: string }[]>(request, '/gruppi')
  test.skip(famiglie.length !== 1, 'serve la sola Famiglia iniziale')

  // ── Una sola Famiglia: nessun selettore, nessun passaggio in più
  await page.goto('/#/famiglia')
  await expect(page.getByRole('heading', { name: 'Famiglia', exact: true })).toBeVisible()
  await expect(selettore(page)).toHaveCount(0)
  await foto(page, '01-una-famiglia')

  // ── Loris crea una seconda Famiglia: compare il selettore, attiva la nuova
  await page.getByRole('link', { name: 'Gestione', exact: true }).click()
  await page.getByRole('button', { name: 'Crea un\'altra Famiglia' }).click()
  await page.getByRole('dialog').getByLabel('Nome', { exact: true }).fill('Famiglia Bianchi')
  await page.getByRole('button', { name: 'Crea', exact: true }).click()
  await expect(selettore(page)).toHaveValue(/.+/)
  await expect(page.getByRole('heading', { name: 'Famiglia Bianchi' })).toBeVisible()
  await page.getByRole('link', { name: 'Bacheca', exact: true }).click()
  await page.getByRole('textbox', { name: 'Messaggio', exact: true }).fill('Solo per i Bianchi')
  await page.getByRole('button', { name: 'Pubblica' }).click()
  await expect(page.getByText('Solo per i Bianchi')).toBeVisible()
  await foto(page, '02-seconda-famiglia')

  // Cambio Famiglia: la bacheca cambia, la scelta resta dopo il ricaricamento.
  await selettore(page).selectOption({ label: 'Famiglia' })
  await expect(page.getByRole('heading', { name: 'Famiglia', exact: true })).toBeVisible()
  await expect(page.getByText('Solo per i Bianchi')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Famiglia', exact: true })).toBeVisible()
  await selettore(page).selectOption({ label: 'Famiglia Bianchi' })

  // Un evento creato ora nasce nei Bianchi e compare solo con loro attivi.
  await page.goto('/#/eventi/nuovo')
  await page.getByLabel('Nome dell\'evento').fill('Grigliata dai Bianchi')
  await page.getByLabel('Data').fill('2027-06-12')
  await page.getByRole('button', { name: 'Crea e componi il menù' }).click()
  await expect(page.getByRole('heading', { name: 'Grigliata dai Bianchi' })).toBeVisible()
  await page.goto('/#/')
  await expect(page.getByText('Grigliata dai Bianchi')).toBeVisible()
  await selettore(page).selectOption({ label: 'Famiglia' })
  await expect(page.getByText('Grigliata dai Bianchi')).toHaveCount(0)
  await selettore(page).selectOption({ label: 'Famiglia Bianchi' })

  // ── Invito ad aderire per una persona con un account ma senza Famiglie
  await page.goto('/#/famiglia?scheda=persone')
  await page.getByRole('button', { name: 'Invita nella Famiglia' }).click()
  const link = await page.getByLabel('Link d\'invito alla Famiglia').inputValue()
  expect(link).toMatch(/#\/unisciti\//)

  const id = 'utente-e2e-sara'
  expect((await apiScrivi(request, 'post', '/admin/utenti', { id, nome: 'Sara', famiglia: false })).stato).toBe(201)
  const invitoAccount = (await apiScrivi(request, 'post', `/admin/utenti/${id}/inviti`, {})).corpo as { link: string }
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'it-IT', storageState: { cookies: [], origins: [] } })
  const sara = await ctx.newPage()
  const codice = await chiediAccesso(sara, invitoAccount.link.replace(/^https?:\/\/[^/]+/, ''), 'Telefono di Sara')
  const richiesta = (await apiLeggi<{ id: string; codice: string }[]>(request, '/admin/richieste')).find((r) => r.codice === codice)!
  await apiScrivi(request, 'post', `/richieste/${richiesta.id}/approva`, {})
  await expect(sara.getByRole('heading', { name: 'Eventi', exact: true })).toBeVisible({ timeout: 10_000 })
  // Senza Famiglie: schermata iniziale semplice, nessun selettore.
  await sara.goto('/#/famiglia')
  await expect(sara.getByText('Non fai ancora parte di una Famiglia')).toBeVisible()
  await expect(selettore(sara)).toHaveCount(0)
  await foto(sara, '03-nessuna-famiglia')
  // Entra nei Bianchi con il link: una sola Famiglia, ancora nessun selettore.
  await sara.goto(link.replace(/^https?:\/\/[^/]+/, ''))
  await expect(sara.getByText('Ti ha invitato Loris.')).toBeVisible()
  await sara.getByRole('button', { name: 'Entra nella Famiglia' }).click()
  await expect(sara.getByRole('heading', { name: 'Famiglia Bianchi' })).toBeVisible()
  await expect(sara.getByText('Solo per i Bianchi')).toBeVisible()
  await expect(selettore(sara)).toHaveCount(0)
  await foto(sara, '04-entrata-con-invito')
  // Sara non vede la bacheca della Famiglia di Loris.
  const altra = famiglie[0]!.id
  expect(await sara.evaluate(async (g) => (await fetch(`/api/v1/gruppi/${g}/bacheca`)).status, altra)).toBe(404)
  await ctx.close()
})
