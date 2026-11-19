// Segnaposto (SPEC §42): dalla scheda dell'evento, nomi a mano o dai partecipanti, copie, ordine,
// nome dell'evento, formati, stile coordinato al menù, salvataggio e stampa su A4 senza sbordare.
import { type APIRequestContext, expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi } from './aiuti'

test.describe.configure({ mode: 'serial' })

const CARTELLA = 'test-results/segnaposto'

async function preparaEvento(request: APIRequestContext, id: string, nome: string, occasione = 'Natale') {
  const esistente = await request.get(`/api/v1/eventi/${id}`)
  if (esistente.ok()) {
    const e = (await esistente.json()) as { versione: number; stato: string }
    let versione = e.versione
    if (e.stato === 'archiviato') versione = (await apiScrivi(request, 'post', `/eventi/${id}/riapri`, { versione })).corpo.versione
    expect((await apiScrivi(request, 'delete', `/eventi/${id}?versione=${versione}`)).stato).toBe(204)
  }
  const r = await apiScrivi(request, 'post', '/eventi', { id, nome, data: '2026-12-25', oraServizio: '13:00', tipo: 'pranzo', occasione, adulti: 8, bambini: 0, note: '' })
  expect(r.stato).toBe(201)
}

const segnaposto = (request: APIRequestContext, id: string) => apiLeggi<{ salvati: boolean; versione: number; opzioni: Record<string, unknown> & { nomi: { testo: string; copie: number; stampa: boolean }[] } }>(request, `/eventi/${id}/segnaposto`)
const anteprima = (page: Page) => page.getByTestId('anteprima-segnaposto')
const nomi = (page: Page) => page.getByTestId('nome-segnaposto')

async function aggiungi(page: Page, ...testi: string[]) {
  for (const t of testi) {
    await page.getByLabel('Nuovo nome').fill(t)
    await page.getByLabel('Nuovo nome').press('Enter')
  }
}

/** In ogni faccia stampata il nome sta nella sua zona, senza sbordare né toccare ornamenti ed evento. */
async function controllaNomi(page: Page, dove: string) {
  await expect(anteprima(page)).toHaveAttribute('data-pronto', '')
  const problemi = await page.locator(`${dove} [data-testid="faccia-segnaposto"]`).evaluateAll((facce) =>
    facce.flatMap((f, i) => {
      const faccia = f.getBoundingClientRect()
      const zona = f.querySelector('.sp-zona-nome')!.getBoundingClientRect()
      const nome = f.querySelector('.sp-nome')
      if (!nome) return []
      const n = nome.getBoundingClientRect()
      const righe = [...nome.children].map((r) => (r as HTMLElement).getBoundingClientRect().height)
      const out: string[] = []
      if (n.top < zona.top - 0.5 || n.bottom > zona.bottom + 0.5 || n.left < faccia.left || n.right > faccia.right) out.push(`${i}: «${nome.textContent}» fuori dalla zona`)
      // Ogni riga prevista resta su una riga: nessun a capo imprevisto.
      const alta = Math.max(...righe)
      if (righe.some((h) => h > alta * 1.5) || nome.scrollWidth > (nome as HTMLElement).clientWidth + 1) out.push(`${i}: «${nome.textContent}» va a capo o sborda`)
      return out
    }),
  )
  expect(problemi).toEqual([])
}

async function paginePdf(page: Page, nome: string): Promise<number> {
  const pdf = await page.pdf({ path: `${CARTELLA}/${nome}.pdf`, preferCSSPageSize: true, printBackground: true })
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

test('senza partecipanti: nomi a mano, copie, ordine, nome dell\'evento, formati; salvati e ritrovati', async ({ page, request }, info) => {
  const id = `sp-mano-${info.project.name}`
  await preparaEvento(request, id, 'Natale 2026')
  await page.goto(`/#/eventi/${id}`)
  await page.getByRole('link', { name: 'Stampa segnaposto' }).click()
  await expect(page.getByRole('heading', { name: 'Stampa segnaposto' })).toBeVisible()
  await expect(page.getByText('L\'evento non ha partecipanti con il nome')).toBeVisible()
  await expect(page.getByText('Nessun nome: aggiungi gli ospiti')).toBeVisible()
  await expect(page.getByRole('button', { name: /Stampa/ }).last()).toBeDisabled()

  // Aggiunta, doppioni ignorati (maiuscole e accenti), accenti e apostrofi intatti.
  await aggiungi(page, 'Nonna Lù', "Nonno D'Angelo", 'nonna lu', 'Élise')
  await expect(nomi(page)).toHaveCount(3)
  await expect(page.getByTestId('conteggio-segnaposto')).toContainText('3 segnaposto · 1 foglio A4')
  await expect(anteprima(page).getByTestId('segnaposto')).toHaveCount(3)
  await expect(anteprima(page).getByTestId('segnaposto').nth(1)).toContainText("Nonno D'Angelo")
  // Cavalletto: il nome anche sul retro, capovolto.
  await expect(anteprima(page).getByTestId('retro-segnaposto').first()).toHaveText('Nonna Lù')
  await page.getByLabel('Nome anche sul retro').uncheck()
  await expect(anteprima(page).getByTestId('retro-segnaposto').first()).toHaveText('')

  // Copie, deselezione, riordino, modifica, rimozione.
  await page.getByRole('button', { name: 'Una copia in più di Élise' }).click()
  await page.getByRole('button', { name: 'Una copia in più di Élise' }).click()
  await expect(page.getByTestId('conteggio-segnaposto')).toContainText('5 segnaposto · 2 fogli A4')
  await page.getByLabel("Stampa Nonno D'Angelo").uncheck()
  await expect(page.getByTestId('conteggio-segnaposto')).toContainText('4 segnaposto · 1 foglio A4')
  await page.getByRole('button', { name: 'Sposta su Élise' }).click()
  await expect(nomi(page).nth(1).getByRole('textbox')).toHaveValue('Élise')
  await nomi(page).nth(0).getByRole('textbox').fill('Nonna Lucia')
  await expect(anteprima(page).getByTestId('segnaposto').first()).toContainText('Nonna Lucia')
  await aggiungi(page, 'Da togliere')
  await page.getByRole('button', { name: 'Togli Da togliere' }).click()
  await expect(nomi(page)).toHaveCount(3)

  // Nome dell'evento: proposto il titolo, poi un testo libero.
  await expect(anteprima(page).locator('.sp-evento')).toHaveCount(0)
  await page.getByLabel('Mostra nome dell\'evento').check()
  await expect(anteprima(page).locator('.sp-evento').first()).toHaveText('Natale 2026')
  await page.getByLabel('Testo', { exact: true }).fill('Natale in famiglia')
  await expect(anteprima(page).locator('.sp-evento').first()).toHaveText('Natale in famiglia')

  // Formato piatto: 10 per foglio.
  await page.getByRole('radio', { name: /Piatto/ }).click()
  await expect(page.getByTestId('conteggio-segnaposto')).toContainText('4 segnaposto · 1 foglio A4')
  await expect(anteprima(page).getByTestId('retro-segnaposto')).toHaveCount(0)
  await page.getByLabel('Linee di taglio').uncheck()
  await expect(anteprima(page).locator('.sp-taglio')).toHaveCount(0)

  // Salvato sul server; riaprendo si ritrova tutto, senza doppioni.
  await expect(page.getByText('salvati', { exact: true })).toBeVisible()
  await expect.poll(async () => (await segnaposto(request, id)).opzioni).toMatchObject({
    formato: 'piatto', secondaFaccia: false, mostraEvento: true, testoEvento: 'Natale in famiglia', lineeTaglio: false,
    nomi: [{ testo: 'Nonna Lucia', copie: 1, stampa: true }, { testo: 'Élise', copie: 3 }, { testo: "Nonno D'Angelo", stampa: false }],
  })
  await page.reload()
  await expect(nomi(page)).toHaveCount(3)
  await expect(nomi(page).nth(1).getByRole('textbox')).toHaveValue('Élise')
  await expect(page.getByRole('radio', { name: /Piatto/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('Testo', { exact: true })).toHaveValue('Natale in famiglia')

  // Dal menù ai segnaposto e ritorno, nello stesso evento; il menù non cambia.
  await page.getByRole('link', { name: 'Stampa menù' }).click()
  await expect(page.getByRole('heading', { name: 'Stampa menù' })).toBeVisible()
  await expect(page.getByText('stile salvato')).toBeVisible()
  await page.getByRole('link', { name: 'Stampa segnaposto' }).click()
  await expect(page.getByRole('heading', { name: 'Stampa segnaposto' })).toBeVisible()
  expect((await apiLeggi<{ opzioni: Record<string, unknown> }>(request, `/eventi/${id}/stampa`)).opzioni).not.toHaveProperty('segnaposto')
})

test('dai partecipanti: nomi proposti, poi indipendenti; «Aggiungi dai partecipanti» senza doppioni; stile del menù o proprio', async ({ page, request }, info) => {
  const id = `sp-part-${info.project.name}`
  await preparaEvento(request, id, 'Compleanno di Anna', 'Compleanno')
  for (const [pid, nome, stato] of [['p1', 'Anna', 'confermato'], ['p2', 'Bruno', 'in_attesa'], ['p3', 'Carla', 'assente']] as const) {
    expect((await apiScrivi(request, 'post', `/eventi/${id}/partecipanti`, { id: `${id}-${pid}`, nome, stato })).stato).toBe(201)
  }
  await page.goto(`/#/eventi/${id}/segnaposto`)
  await expect(page.getByText('Proposti dai partecipanti')).toBeVisible()
  await expect(nomi(page)).toHaveCount(2)
  await expect(nomi(page).nth(0).getByRole('textbox')).toHaveValue('Anna')
  // Stile del menù (Festivo per un compleanno).
  await expect(anteprima(page).getByTestId('faccia-segnaposto').first()).toHaveAttribute('data-modello', 'festivo')

  await nomi(page).nth(0).getByRole('textbox').fill('Anna (festeggiata)')
  await expect(page.getByText('salvati', { exact: true })).toBeVisible()
  await expect.poll(async () => (await segnaposto(request, id)).salvati).toBe(true)
  // Un partecipante nuovo: solo proposto, l'elenco dei segnaposto non cambia da sé.
  expect((await apiScrivi(request, 'post', `/eventi/${id}/partecipanti`, { id: `${id}-p4`, nome: 'Dario', stato: 'confermato' })).stato).toBe(201)
  await page.reload()
  await expect(nomi(page)).toHaveCount(2)
  await page.getByRole('button', { name: /Aggiungi dai partecipanti \(2\)/ }).click()
  await expect(nomi(page)).toHaveCount(4)
  await expect(nomi(page).nth(2).getByRole('textbox')).toHaveValue('Anna')
  await expect(nomi(page).nth(3).getByRole('textbox')).toHaveValue('Dario')
  await expect(page.getByRole('button', { name: /Aggiungi dai partecipanti/ })).toHaveCount(0)
  // I partecipanti non cambiano.
  const p = await apiLeggi<{ inviti: { nome: string }[] }>(request, `/eventi/${id}/partecipanti`)
  expect(p.inviti.map((x) => x.nome)).toEqual(['Anna', 'Bruno', 'Carla', 'Dario'])

  // Stile proprio dei segnaposto: il menù resta com'è.
  await page.getByRole('radio', { name: /Personalizzato/ }).click()
  await page.getByRole('radio', { name: 'Elegante' }).click()
  await expect(anteprima(page).getByTestId('faccia-segnaposto').first()).toHaveAttribute('data-modello', 'elegante')
  await expect.poll(async () => (await segnaposto(request, id)).opzioni.stile).toMatchObject({ modello: 'elegante' })
  expect((await apiLeggi<{ opzioni: { modello: string } }>(request, `/eventi/${id}/stampa`)).opzioni.modello).toBe('festivo')
  await page.getByRole('radio', { name: /Come il menù/ }).click()
  await expect(anteprima(page).getByTestId('faccia-segnaposto').first()).toHaveAttribute('data-modello', 'festivo')
})

test('stampa su A4: nomi lunghi e accentati dentro la loro zona in ogni modello, più fogli, pagine del PDF', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'il PDF lo produce solo Chrome desktop')
  const id = 'sp-stampa'
  await preparaEvento(request, id, 'Pranzo di Natale')
  const testi = ['Leo', 'Nonna Lù', "Nonno D'Angelo", 'Élise-Françoise', 'Maria Gabriella Bartolomei Carzaniga', 'Massimiliano Ferdinando', 'Zia Ada', 'Gianmarco', 'Supercalifragilistichespiralidoso', 'Bea', 'Ottavio Rossi', 'Lucia']
  const lista = testi.map((testo, i) => ({ id: `n${i}`, testo, stampa: true, copie: 1 }))
  const salva = async (o: Record<string, unknown>) => {
    const s = await segnaposto(request, id)
    expect((await apiScrivi(request, 'put', `/eventi/${id}/segnaposto`, { opzioni: { ...s.opzioni, nomi: lista, ...o }, versione: s.versione })).stato).toBe(200)
  }
  for (const modello of ['elegante', 'minimal', 'rustico', 'festivo', 'natale'] as const) {
    const caratteri = { elegante: 'classica', minimal: 'moderna', rustico: 'garamond', festivo: 'classica', natale: 'calligrafica' }[modello]
    const palette = { elegante: 'bordeaux', minimal: 'grafite', rustico: 'terracotta', festivo: 'festa', natale: 'natale' }[modello]
    for (const formato of ['cavalletto', 'piatto'] as const) {
      await salva({ formato, mostraEvento: true, testoEvento: null, stile: { modello, palette, caratteri, decorazioni: true } })
      await page.goto('about:blank')
      await page.goto(`/#/eventi/${id}/segnaposto`)
      await expect(page.getByTestId('conteggio-segnaposto')).toContainText(formato === 'cavalletto' ? '12 segnaposto · 3 fogli A4' : '12 segnaposto · 2 fogli A4')
      await controllaNomi(page, '[data-testid="anteprima-segnaposto"]')
      await page.emulateMedia({ media: 'print' })
      await controllaNomi(page, '.menu-stampa')
      expect(await paginePdf(page, `${modello}-${formato}`)).toBe(formato === 'cavalletto' ? 3 : 2)
      await page.emulateMedia({ media: 'screen' })
    }
  }
  // Il menù dello stesso evento stampa come prima.
  await page.goto(`/#/eventi/${id}/stampa`)
  await expect(page.getByTestId('anteprima-menu').locator('.menu-foglio').first()).toBeVisible()
})
