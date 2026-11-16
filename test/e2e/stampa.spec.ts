// Designer del menù stampato: modelli, formati, impaginazione, salvataggio per evento, stampa.
import { type APIRequestContext, expect, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi } from './aiuti'

test.describe.configure({ mode: 'serial' })

const CARTELLA = 'test-results/stampa'

interface Evento {
  id: string
  versione: number
  portate: { id: string; nome: string }[]
}

/** Evento con le voci indicate (per portata); lo ricrea da zero a ogni chiamata. */
async function preparaEvento(request: APIRequestContext, id: string, dati: { nome: string; occasione: string; voci: string[][]; note?: boolean }) {
  const esistente = await request.get(`/api/v1/eventi/${id}`)
  if (esistente.ok()) {
    const e = (await esistente.json()) as Evento & { stato: string }
    let versione = e.versione
    if (e.stato === 'archiviato') versione = (await apiScrivi(request, 'post', `/eventi/${id}/riapri`, { versione })).corpo.versione
    expect((await apiScrivi(request, 'delete', `/eventi/${id}?versione=${versione}`)).stato).toBe(204)
  }
  const r = await apiScrivi(request, 'post', '/eventi', { id, nome: dati.nome, data: '2026-12-25', oraServizio: '13:00', tipo: 'pranzo', occasione: dati.occasione, adulti: 8, bambini: 2, note: '' })
  expect(r.stato).toBe(201)
  const e = r.corpo as Evento
  const voci = dati.voci.flatMap((nomi, p) =>
    nomi.map((nome, i) => ({ id: `${id}-${p}-${i}`, portataId: e.portate[p]!.id, nome, note: dati.note ? `Nota per ${nome.toLowerCase()}, con qualche parola in più` : '' })),
  )
  if (voci.length) expect((await apiScrivi(request, 'post', `/eventi/${id}/voci`, { voci })).stato).toBe(201)
  return apiLeggi<Evento>(request, `/eventi/${id}`)
}

const NATALE = [
  ['Crostini toscani', 'Salmone affumicato con burro e pan brioche', 'Insalata di mare'],
  ['Tortellini in brodo', 'Lasagne alla bolognese'],
  ['Cappone ripieno con salsa di mele'],
  ['Patate al forno', 'Cavolini di Bruxelles'],
  ['Tiramisù', 'Panettone e pandoro'],
  ['Caffè e frutta secca'],
]

const LUNGO = Array.from({ length: 7 }, (_, p) => Array.from({ length: 7 }, (_, i) => `Piatto numero ${i + 1} della portata ${p + 1}, con un nome piuttosto lungo`))

async function stile(request: APIRequestContext, id: string) {
  return apiLeggi<{ versione: number; opzioni: Record<string, unknown> }>(request, `/eventi/${id}/stampa`)
}
async function salvaStile(request: APIRequestContext, id: string, opzioni: Record<string, unknown>) {
  const s = await stile(request, id)
  const r = await apiScrivi(request, 'put', `/eventi/${id}/stampa`, { opzioni: { ...s.opzioni, ...opzioni }, versione: s.versione })
  expect(r.stato, JSON.stringify(r.corpo)).toBe(200)
}

async function apriDesigner(page: Page, id: string) {
  await page.goto('about:blank')
  await page.goto(`/#/eventi/${id}/stampa`)
  await expect(page.getByRole('heading', { name: 'Stampa menù' })).toBeVisible()
  await expect(page.getByTestId('anteprima-menu').locator('.menu-foglio').first()).toBeVisible()
}

const anteprima = (page: Page) => page.getByTestId('anteprima-menu')

/** Nessun testo tagliato: in ogni pagina stampata il contenuto sta nell'area. */
async function controllaNienteTagliato(page: Page) {
  const fuori = await page.locator('.menu-stampa .menu-area').evaluateAll((aree) =>
    aree
      .map((a, i) => {
        const r = a.getBoundingClientRect()
        const figli = [...a.children].map((c) => c.getBoundingClientRect())
        const basso = Math.max(r.top, ...figli.map((f) => f.bottom))
        const alto = Math.min(r.bottom, ...figli.map((f) => f.top))
        return basso > r.bottom + 1 || alto < r.top - 1 || a.scrollWidth > a.clientWidth + 1 ? i : -1
      })
      .filter((i) => i >= 0),
  )
  expect(fuori, 'pagine con contenuto fuori dall\'area').toEqual([])
}

/** Numero di pagine del PDF prodotto dalla stampa del browser. */
async function paginePdf(page: Page, nome = 'menu'): Promise<number> {
  const pdf = await page.pdf({ path: `${CARTELLA}/${nome}.pdf`, preferCSSPageSize: true, printBackground: true })
  return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

test('primo uso: stile predefinito dall\'occasione, modifiche immediate, salvate sul server e ritrovate da un altro dispositivo', async ({ page, browser, request }, info) => {
  const ev = await preparaEvento(request, `st-natale-${info.project.name}`, { nome: 'Natale 2026', occasione: 'Natale', voci: NATALE })
  await page.goto(`/#/eventi/${ev.id}`)
  await page.getByRole('link', { name: 'Stampa menù' }).click()
  await expect(page.getByRole('heading', { name: 'Stampa menù' })).toBeVisible()

  // Predefiniti: modello Natale, A4, titolo = nome dell'evento.
  await expect(page.getByRole('radio', { name: /^Natale:/ })).toHaveAttribute('aria-checked', 'true')
  await expect(anteprima(page).locator('.menu-pagina').first()).toHaveAttribute('data-modello', 'natale')
  await expect(anteprima(page).locator('.menu-titolo')).toHaveText('Natale 2026')
  await expect(anteprima(page).getByText('Tortellini in brodo')).toBeVisible()
  await expect(page.getByText('stile salvato')).toBeVisible()

  // Ogni modifica si vede subito nell'anteprima.
  await page.getByRole('radio', { name: /^Rustico:/ }).click()
  await expect(anteprima(page).locator('.menu-pagina').first()).toHaveAttribute('data-modello', 'rustico')
  await page.getByLabel('Titolo', { exact: true }).fill('Pranzo di Natale')
  await expect(anteprima(page).locator('.menu-titolo')).toHaveText('Pranzo di Natale')
  await page.getByLabel('Sottotitolo').fill('Casa Carzaniga')
  await expect(anteprima(page).locator('.menu-sottotitolo')).toHaveText('Casa Carzaniga')
  await page.getByLabel('Nota finale').fill('Buone feste a tutti!')
  await expect(anteprima(page).getByText('Buone feste a tutti!')).toBeVisible()
  await page.getByRole('radio', { name: /Verde bosco/ }).click()
  await page.getByRole('radio', { name: /Moderna/ }).click()
  await page.getByLabel('Mostra la data').uncheck()
  await expect(anteprima(page).locator('.menu-data')).toHaveCount(0)
  await page.getByRole('radio', { name: /2 × A5/ }).click()
  await expect(anteprima(page).locator('.menu-foglio').first()).toHaveAttribute('data-formato', 'A5x2')
  await expect(anteprima(page).locator('.menu-foglio').first().locator('.menu-pagina')).toHaveCount(2)

  // Salvataggio automatico sul server.
  await expect(page.getByText('stile salvato')).toBeVisible()
  await expect.poll(async () => (await stile(request, ev.id)).opzioni).toMatchObject({
    modello: 'rustico', titolo: 'Pranzo di Natale', sottotitolo: 'Casa Carzaniga', nota: 'Buone feste a tutti!', palette: 'bosco', caratteri: 'moderna', mostraData: false, formato: 'A5x2',
  })
  // Il menù non cambia.
  const menu = await apiLeggi<{ portate: { voci: unknown[] }[] }>(request, `/eventi/${ev.id}/menu`)
  expect(menu.portate.flatMap((p) => p.voci)).toHaveLength(11)

  // Un altro dispositivo ritrova esattamente lo stesso stile.
  const altro = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'it-IT' })
  const p2 = await altro.newPage()
  await apriDesigner(p2, ev.id)
  await expect(p2.getByRole('radio', { name: /^Rustico:/ })).toHaveAttribute('aria-checked', 'true')
  await expect(p2.getByLabel('Titolo', { exact: true })).toHaveValue('Pranzo di Natale')
  await expect(p2.getByRole('radio', { name: /Verde bosco/ })).toHaveAttribute('aria-checked', 'true')
  await expect(p2.getByRole('radio', { name: /2 × A5/ })).toHaveAttribute('aria-checked', 'true')
  await expect(p2.getByLabel('Mostra la data')).not.toBeChecked()
  await altro.close()

  // Ripristino dello stile predefinito.
  await page.getByRole('button', { name: 'Ripristina stile predefinito' }).click()
  await expect(page.getByRole('radio', { name: /^Natale:/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('Titolo', { exact: true })).toHaveValue('')
  await expect(anteprima(page).locator('.menu-titolo')).toHaveText('Natale 2026')
  await expect.poll(async () => (await stile(request, ev.id)).opzioni).toMatchObject({ modello: 'natale', titolo: null, formato: 'A4', nota: '' })
})

test('due dispositivi: le modifiche dell\'altro vincono sul salvataggio con versione vecchia', async ({ page, request }, info) => {
  const ev = await preparaEvento(request, `st-conflitto-${info.project.name}`, { nome: 'Cena di Capodanno', occasione: 'Capodanno', voci: NATALE })
  await apriDesigner(page, ev.id)
  await expect(page.getByRole('radio', { name: /^Elegante:/ })).toHaveAttribute('aria-checked', 'true')
  // L'altro dispositivo salva mentre questo ha ancora la versione 0.
  await salvaStile(request, ev.id, { modello: 'minimal', titolo: 'Dall\'altro telefono' })
  await page.getByLabel('Nota finale').fill('Nota da qui')
  await expect(page.getByText('cambiato da un altro dispositivo')).toBeVisible()
  await expect(page.getByLabel('Titolo', { exact: true })).toHaveValue('Dall\'altro telefono')
  await expect(page.getByRole('radio', { name: /^Minimal:/ })).toHaveAttribute('aria-checked', 'true')
  expect((await stile(request, ev.id)).opzioni).toMatchObject({ modello: 'minimal', nota: '' })
  // Da qui in poi si salva normalmente sulla versione nuova.
  await page.getByLabel('Nota finale').fill('Ora sì')
  await expect.poll(async () => (await stile(request, ev.id)).opzioni.nota).toBe('Ora sì')
})

test('evento archiviato: stile in sola lettura dallo snapshot, stampa disponibile', async ({ page, request }, info) => {
  const ev = await preparaEvento(request, `st-archivio-${info.project.name}`, { nome: 'Natale 2025', occasione: 'Natale', voci: NATALE })
  await salvaStile(request, ev.id, { modello: 'festivo', nota: 'Archiviato con stile' })
  const ar = await apiScrivi(request, 'post', `/eventi/${ev.id}/archivia`, { versione: ev.versione })
  expect(ar.stato).toBe(200)
  await apriDesigner(page, ev.id)
  await expect(page.getByText('Evento archiviato')).toBeVisible()
  await expect(anteprima(page).locator('.menu-pagina').first()).toHaveAttribute('data-modello', 'festivo')
  await expect(anteprima(page).getByText('Archiviato con stile')).toBeVisible()
  await expect(page.getByRole('radio', { name: /^Elegante:/ })).toBeDisabled()
  await expect(page.getByLabel('Titolo', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Ripristina stile predefinito' })).toBeDisabled()
  await expect(page.getByRole('button', { name: /Stampa/ })).toBeEnabled()
})

test('telefono e desktop: pagina intera visibile, niente scorrimento orizzontale, anteprima ingrandibile', async ({ page, request }, info) => {
  const ev = await preparaEvento(request, `st-schermo-${info.project.name}`, { nome: 'Natale 2026', occasione: 'Natale', voci: NATALE })
  await apriDesigner(page, ev.id)
  const larghezze = await page.evaluate(() => ({ documento: document.documentElement.scrollWidth, finestra: window.innerWidth }))
  expect(larghezze.documento).toBeLessThanOrEqual(larghezze.finestra)
  const foglio = await anteprima(page).locator('[role="img"]').first().boundingBox()
  const finestra = page.viewportSize()!
  expect(foglio!.x).toBeGreaterThanOrEqual(0)
  expect(foglio!.x + foglio!.width).toBeLessThanOrEqual(finestra.width)
  if (info.project.name === 'desktop') expect(foglio!.y + foglio!.height).toBeLessThanOrEqual(finestra.height)
  // Proporzioni A4.
  expect(foglio!.height / foglio!.width).toBeCloseTo(297 / 210, 1)

  // Il messaggio «App installata» (primo avvio) copre per qualche secondo la parte alta dello schermo.
  await expect(page.getByText('App installata')).toHaveCount(0, { timeout: 10_000 })
  await page.getByRole('button', { name: 'Ingrandisci l\'anteprima' }).click()
  const finestraIngrandita = page.getByRole('dialog', { name: 'Anteprima ingrandita' })
  await expect(finestraIngrandita).toBeVisible()
  const prima = (await finestraIngrandita.locator('[role="img"]').first().boundingBox())!.width
  await finestraIngrandita.getByRole('button', { name: 'Ingrandisci' }).click()
  await expect.poll(async () => (await finestraIngrandita.locator('[role="img"]').first().boundingBox())!.width).toBeGreaterThan(prima * 1.2)
  await page.screenshot({ path: `${CARTELLA}/ingrandita-${info.project.name}.png` })
  await finestraIngrandita.getByRole('button', { name: 'Chiudi l\'anteprima' }).click()
  await expect(finestraIngrandita).toHaveCount(0)
  await page.screenshot({ path: `${CARTELLA}/designer-${info.project.name}.png`, fullPage: true })
})

test('stampa: solo i fogli, senza interfaccia; pagine del PDF giuste per ogni formato', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'PDF e media print: una sola esecuzione')
  const ev = await preparaEvento(request, 'st-pdf', { nome: 'Natale 2026', occasione: 'Natale', voci: NATALE })
  await apriDesigner(page, ev.id)
  await page.emulateMedia({ media: 'print' })
  for (const nascosto of [page.getByRole('heading', { name: 'Stampa menù' }), page.getByRole('navigation', { name: 'Sezioni' }).first(), page.getByRole('button', { name: /Stampa/ }), page.getByTestId('anteprima-menu'), page.getByLabel('Titolo', { exact: true })]) {
    await expect(nascosto).toBeHidden()
  }
  await expect(page.locator('.menu-stampa .menu-foglio')).toHaveCount(1)
  await expect(page.locator('.menu-stampa .menu-foglio')).toBeVisible()
  await expect(page.locator('.menu-stampa').getByText('Tortellini in brodo')).toBeVisible()
  await page.screenshot({ path: `${CARTELLA}/media-print.png`, fullPage: true })
  await controllaNienteTagliato(page)
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true })
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1)
  // Il testo del PDF non contiene l'interfaccia (i flussi sono compressi: si controlla il DOM stampabile).
  const testoStampato = await page.evaluate(() => {
    const visibili: string[] = []
    const giro = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (giro.nextNode()) {
      const el = giro.currentNode.parentElement
      if (el && el.checkVisibility() && giro.currentNode.textContent!.trim()) visibili.push(giro.currentNode.textContent!.trim())
    }
    return visibili.join(' | ')
  })
  for (const parola of ['Ripristina', 'Anteprima', 'Modello', 'Eventi', 'Ricettario', 'Consigli']) expect(testoStampato).not.toContain(parola)

  await page.emulateMedia({ media: null })
  for (const [formato, attese] of [['A4', 1], ['A5', 1], ['A5x2', 1]] as const) {
    await salvaStile(request, ev.id, { formato })
    await page.reload()
    await expect(page.getByRole('radio', { name: formato === 'A5x2' ? /2 × A5/ : new RegExp(`^${formato}`) })).toHaveAttribute('aria-checked', 'true')
    await expect(anteprima(page).locator('.menu-foglio').first()).toHaveAttribute('data-formato', formato)
    await page.waitForTimeout(300)
    expect(await paginePdf(page, `formato-${formato}`), formato).toBe(attese)
    await page.emulateMedia({ media: 'print' })
    await controllaNienteTagliato(page)
    await page.emulateMedia({ media: null })
  }
})

test('menù lungo: più pagine senza testi tagliati né pagine vuote; menù corto: una pagina', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'una sola esecuzione')
  const lungo = await preparaEvento(request, 'st-lungo', { nome: 'Pranzo di nozze', occasione: 'Matrimonio', voci: LUNGO, note: true })
  await salvaStile(request, lungo.id, { mostraNote: true })
  for (const formato of ['A4', 'A5', 'A5x2'] as const) {
    await salvaStile(request, lungo.id, { formato })
    await apriDesigner(page, lungo.id)
    await expect(page.getByText(/Il menù è lungo e occupa \d+ pagine/)).toBeVisible()
    const fogli = await page.locator('.menu-stampa .menu-foglio').count()
    expect(fogli).toBeGreaterThan(1)
    await page.emulateMedia({ media: 'print' })
    await controllaNienteTagliato(page)
    // Ogni pagina ha contenuto; tutti i piatti compaiono una volta per copia.
    const perPagina = await page.locator('.menu-stampa .menu-foglio').evaluateAll((f) => f.map((x) => x.querySelectorAll('.menu-voce').length))
    expect(perPagina.every((n) => n > 0)).toBe(true)
    const copie = formato === 'A5x2' ? 2 : 1
    expect(perPagina.reduce((a, b) => a + b, 0)).toBe(49 * copie)
    // Carattere mai sotto la soglia di leggibilità.
    const minimo = await page.locator('.menu-stampa .menu-piatto').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(minimo).toBeGreaterThanOrEqual(formato === 'A4' ? 16 : 13) // px: 12 pt in A4, ~10 pt in A5
    await page.emulateMedia({ media: null })
    expect(await paginePdf(page), formato).toBe(fogli)
    await anteprima(page).screenshot({ path: `${CARTELLA}/lungo-${formato}.png` })
  }

  const corto = await preparaEvento(request, 'st-corto', { nome: 'Merenda', occasione: 'Compleanno', voci: [['Torta di mele'], [], [], [], ['Succhi di frutta']] })
  await apriDesigner(page, corto.id)
  await expect(page.locator('.menu-stampa .menu-foglio')).toHaveCount(1)
  await expect(page.locator('.menu-stampa .menu-portata')).toHaveCount(2)
  await page.getByLabel('Nascondi le portate vuote').uncheck()
  await expect(page.locator('.menu-stampa .menu-portata')).toHaveCount(7)
  await page.getByLabel('Nascondi le portate vuote').check()
  await anteprima(page).screenshot({ path: `${CARTELLA}/corto.png` })
})

test('i cinque modelli nei tre formati (schermate di controllo)', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'una sola esecuzione')
  test.setTimeout(120_000)
  const ev = await preparaEvento(request, 'st-modelli', { nome: 'Natale 2026', occasione: 'Natale', voci: NATALE, note: true })
  for (const modello of ['elegante', 'minimal', 'rustico', 'festivo', 'natale'] as const) {
    for (const formato of ['A4', 'A5', 'A5x2'] as const) {
      const base = await apiLeggi<{ opzioni: Record<string, unknown> }>(request, `/eventi/${ev.id}/stampa`)
      const predefiniti: Record<string, [string, string]> = {
        elegante: ['bordeaux', 'classica'], minimal: ['grafite', 'moderna'], rustico: ['terracotta', 'garamond'], festivo: ['festa', 'classica'], natale: ['natale', 'calligrafica'],
      }
      await salvaStile(request, ev.id, { ...base.opzioni, modello, formato, palette: predefiniti[modello]![0], caratteri: predefiniti[modello]![1], sottotitolo: 'Casa Carzaniga', nota: 'Buone feste e buon appetito!', mostraNote: modello === 'elegante' && formato === 'A4' })
      await apriDesigner(page, ev.id)
      await expect(anteprima(page).locator('.menu-pagina').first()).toHaveAttribute('data-modello', modello)
      await page.emulateMedia({ media: 'print' })
      await expect(page.locator('.menu-stampa .menu-foglio')).toHaveCount(1)
      await controllaNienteTagliato(page)
      await page.locator('.menu-stampa .menu-foglio').first().screenshot({ path: `${CARTELLA}/${modello}-${formato}.png` })
      await page.emulateMedia({ media: null })
    }
  }
})
