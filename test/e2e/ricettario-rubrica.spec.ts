// Ricettario sfogliabile: filtro per portata in testa e rubrica alfabetica a lato.
import { expect, type Page, test } from '@playwright/test'
import { apiScrivi } from './aiuti'

test.describe.configure({ mode: 'serial' })

const PIATTI: [string, string | null][] = [
  ['Arancini al ragù', 'Antipasti'],
  ['Acciughe fritte', 'Antipasti / Fritti'],
  ['Bruschette al pomodoro', 'Antipasti'],
  ['Crostini ai fegatini', 'Antipasti'],
  ['Cannelloni ricotta e spinaci', 'Primi'],
  ['Fusilli al pesto', 'Primi'],
  ['Gnocchi alla sorrentina', 'Primi'],
  ['Minestrone di verdure', 'Primi'],
  ['Pappardelle al cinghiale', 'Primi'],
  ['Brasato al Barolo', 'Secondi'],
  ['Pollo alla cacciatora', 'Secondi'],
  ['Saltimbocca alla romana', 'Secondi'],
  ['Vitello tonnato della nonna', 'Secondi'],
  ['Zucchine trifolate', 'Contorni'],
  ['Patate al rosmarino', 'Contorni'],
  ['Tiramisù alle fragole', 'Dolci'],
  ['Zuppa inglese', 'Dolci al cucchiaio'],
  ['Panna cotta ai frutti di bosco', 'Dolci al cucchiaio'],
  ['Erbazzone emiliano', 'Piatti unici'],
  ['Salsa verde', null],
  ['Ragù bianco', 'Primi'],
  ['Torta salata di porri', 'Antipasti'],
]

test.beforeAll(async ({ request }) => {
  for (const [i, [nome, portataSuggerita]] of PIATTI.entries()) {
    const r = await apiScrivi(request, 'post', '/piatti', { id: `rubrica-${i}`, nome, portataSuggerita })
    expect([200, 201], JSON.stringify(r.corpo)).toContain(r.stato)
  }
})

const filtri = (page: Page) => page.getByRole('group', { name: 'Filtra per portata' })
const rubrica = (page: Page) => page.getByRole('navigation', { name: 'Rubrica alfabetica' })

test('filtro per portata in testa all\'elenco, ricordato tornando dal piatto', async ({ page }) => {
  await page.goto('/#/ricettario')
  await expect(filtri(page).getByRole('button', { name: /^Tutte/ })).toHaveAttribute('aria-pressed', 'true')
  // Le varianti importate ricadono nella portata predefinita; quelle nuove hanno un filtro loro.
  for (const nome of ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Piatti unici', 'Senza portata']) {
    await expect(filtri(page).getByRole('button', { name: new RegExp(`^${nome} \\d+$`) })).toBeVisible()
  }
  await filtri(page).getByRole('button', { name: /^Dolci \d+$/ }).click()
  await expect(page.getByRole('link', { name: /Zuppa inglese/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Tiramisù alle fragole/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Brasato al Barolo/ })).toHaveCount(0)
  await expect(page).toHaveURL(/portata=Dolci/)

  await page.getByRole('link', { name: /Tiramisù alle fragole/ }).click()
  await expect(page.getByRole('heading', { name: 'Tiramisù alle fragole' })).toBeVisible()
  await page.goBack()
  await expect(filtri(page).getByRole('button', { name: /^Dolci \d+$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name: /Brasato al Barolo/ })).toHaveCount(0)

  // Filtro e ricerca insieme; «Tutte» toglie il filtro.
  await filtri(page).getByRole('button', { name: /^Secondi \d+$/ }).click()
  await page.getByLabel('Cerca un piatto').fill('pollo')
  await expect(page.getByRole('link', { name: /Pollo alla cacciatora/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Saltimbocca/ })).toHaveCount(0)
  await filtri(page).getByRole('button', { name: /^Tutte/ }).click()
  await page.getByLabel('Cerca un piatto').fill('')
  await expect(page.getByRole('link', { name: /Brasato al Barolo/ })).toBeVisible()
})

test('rubrica alfabetica: lettere a lato, sezioni per iniziale, salto alla lettera', async ({ page }, info) => {
  await page.goto('/#/ricettario')
  await expect(rubrica(page)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Lettera A' }).getByRole('link', { name: /Acciughe fritte/ })).toBeVisible()
  // Lettere senza piatti: visibili ma non nella sequenza del tabulatore.
  await expect(rubrica(page).getByRole('button', { name: 'Lettera Q' })).toHaveAttribute('tabindex', '-1')

  await rubrica(page).getByRole('button', { name: 'Lettera S' }).click()
  await expect(page.getByRole('heading', { name: 'S', exact: true })).toBeInViewport()
  await expect(rubrica(page).getByRole('button', { name: 'Lettera S' })).toHaveAttribute('aria-current', 'true')
  // Lettera vuota: come in un'agenda si apre la prima lettera piena che segue (Q → R).
  await rubrica(page).getByRole('button', { name: 'Lettera Q' }).click()
  await expect(page.getByRole('heading', { name: 'R', exact: true })).toBeInViewport()

  if (info.project.name === 'telefono') {
    // Trascinando il dito lungo le linguette l'elenco segue (da M: in alto può esserci un avviso).
    const z = await rubrica(page).getByRole('button', { name: 'Lettera Z' }).boundingBox()
    const b = await rubrica(page).getByRole('button', { name: 'Lettera M' }).boundingBox()
    await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2)
    await page.mouse.down()
    await page.mouse.move(z!.x + z!.width / 2, z!.y + z!.height / 2, { steps: 8 })
    await page.mouse.up()
    await expect(page.getByRole('heading', { name: 'Z', exact: true })).toBeInViewport()
  }

  // Niente scorrimento orizzontale della pagina; la rubrica non copre le schede.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  const scheda = await page.getByRole('link', { name: /Brasato al Barolo/ }).boundingBox()
  const nav = await rubrica(page).boundingBox()
  expect(scheda!.x + scheda!.width).toBeLessThanOrEqual(nav!.x)

  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `test-results/ricettario/rubrica-${info.project.name}.png` })
  await filtri(page).getByRole('button', { name: /^Primi \d+$/ }).click()
  await expect(filtri(page).getByRole('button', { name: /^Primi \d+$/ })).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.move(0, 0)
  await page.screenshot({ path: `test-results/ricettario/primi-${info.project.name}.png` })
})
