// Confronti visivi (restyling, fase 0): schermate di riferimento delle pagine principali, per vedere
// ogni cambiamento grafico prima che arrivi su TEST. Si eseguono con `npm run test:aspetto` su un
// server separato e un database nuovo (playwright.aspetto.config.ts).
//
// Stabilità: dati creati qui sempre uguali, orologio del browser fisso (i «tra N giorni» non cambiano
// col passare dei giorni), caratteri caricati prima dello scatto, animazioni e transizioni spente,
// foto disegnate dal test, immagini caricate subito, service worker e notifiche a comparsa esclusi,
// schermo sempre acceso concesso subito;
// le date scritte dal server con l'ora reale (creazione dei messaggi, accessi) riscritte con un
// istante fisso nelle risposte dell'API.
import { type APIRequestContext, type Browser, type BrowserContextOptions, devices, expect, type Locator, type Page, test } from '@playwright/test'
import { apiLeggi, apiScrivi, ORIGINE } from './aiuti'


const SESSIONE = process.env.MENUAPP_E2E_SESSIONE ?? 'test-results/sessione-aspetto.json'
/** «Oggi» per il browser: un mese prima degli eventi di prova. */
const OGGI = new Date('2030-11-19T10:00:00+01:00')
/** Istante fisso per le date scritte dal server (creazione dei messaggi, accessi…): il giorno prima. */
const IERI = OGGI.getTime() - 24 * 3600 * 1000

/** Sostituisce con IERI gli istanti reali (millisecondi di questi anni) nei campi «…Il» e «…At». */
function dateFisse(v: unknown, chiave = ''): unknown {
  if (Array.isArray(v)) return v.map((x) => dateFisse(x))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dateFisse(x, k)]))
  if (typeof v === 'number' && /(Il|At)$/.test(chiave) && v > 1.6e12 && v < 2.2e12) return IERI
  return v
}

interface Configurazione {
  nome: string
  contesto: BrowserContextOptions
  tema: 'chiaro' | 'scuro'
  testo: 'normale' | 'enorme'
}

const telefono = (larghezza: number): BrowserContextOptions => ({
  viewport: { width: larghezza, height: 800 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  userAgent: devices['Pixel 7'].userAgent,
})
const desktop: BrowserContextOptions = { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 }

/** Telefono (390 e 360 px) e desktop, chiaro e scuro, testo al 100% e al 150%. */
const CONFIGURAZIONI: Configurazione[] = [
  { nome: 'telefono390-chiaro-100', contesto: telefono(390), tema: 'chiaro', testo: 'normale' },
  { nome: 'telefono390-scuro-100', contesto: telefono(390), tema: 'scuro', testo: 'normale' },
  { nome: 'telefono390-chiaro-150', contesto: telefono(390), tema: 'chiaro', testo: 'enorme' },
  { nome: 'telefono360-scuro-150', contesto: telefono(360), tema: 'scuro', testo: 'enorme' },
  { nome: 'desktop-chiaro-100', contesto: desktop, tema: 'chiaro', testo: 'normale' },
  { nome: 'desktop-scuro-100', contesto: desktop, tema: 'scuro', testo: 'normale' },
]

// ── Dati di prova ───────────────────────────────────────────

interface Dati {
  vigilia: string
  conFoto: string
  senzaFoto: string
}

const ing = (id: string, testo: string, nome: string, quantita: number | null, unita: string | null) => ({
  id,
  ordine: 0,
  testoOriginale: testo,
  nome,
  ingredienteId: null,
  quantita,
  quantitaMax: null,
  unita,
  scalatura: quantita === null ? 'fissa' : 'proporzionale',
  facoltativo: false,
  nota: '',
  statoParsing: 'certo',
  problemiParsing: [],
})

async function ok(r: Promise<{ stato: number; corpo: unknown }>) {
  const x = await r
  expect(x.stato, JSON.stringify(x.corpo)).toBeLessThan(300)
  return x.corpo as Record<string, unknown>
}

/** Foto disegnata nel browser: stessa immagine a ogni esecuzione. */
async function foto(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const t = document.createElement('canvas')
    t.width = 1200
    t.height = 800
    const x = t.getContext('2d')!
    const g = x.createLinearGradient(0, 0, 1200, 800)
    g.addColorStop(0, '#e9b44c')
    g.addColorStop(1, '#a5412a')
    x.fillStyle = g
    x.fillRect(0, 0, 1200, 800)
    x.fillStyle = '#fffaf4'
    for (const [cx, cy, r] of [[380, 420, 170], [720, 360, 210], [960, 560, 120]]) {
      x.beginPath()
      x.arc(cx!, cy!, r!, 0, Math.PI * 2)
      x.fill()
    }
    return t.toDataURL('image/jpeg', 0.9)
  })
  return Buffer.from(dataUrl.split(',')[1]!, 'base64')
}

async function preparaDati(request: APIRequestContext, page: Page): Promise<void> {
  const famiglia = (await apiLeggi<{ id: string; nome: string }[]>(request, '/gruppi')).find((g) => g.nome === 'Famiglia')!
  await ok(
    apiScrivi(request, 'post', '/piatti', {
      id: 'asp-conchiglioni',
      nome: 'Conchiglioni melanzane e pesce spada',
      portataSuggerita: 'Primi',
      porzioniBase: 8,
      tempoPreparazioneMin: 30,
      tempoCotturaMin: 40,
      procedimento: [
        'Taglia le melanzane a cubetti, salale e lasciale riposare 20 minuti.',
        "In padella fai rosolare l'aglio con l'olio, aggiungi le melanzane e cuoci 10 minuti. Unisci il pesce spada a dadini e cuoci altri 5 minuti.",
        'Cuoci i conchiglioni al dente, scolali e saltali nel condimento con il prezzemolo.',
      ],
      note: 'Il pesce spada si può sostituire con il tonno fresco.',
      ingredienti: [
        ing('asp-i1', '500 g conchiglioni', 'conchiglioni', 500, 'g'),
        ing('asp-i2', '2 melanzane', 'melanzane', 2, null),
        ing('asp-i3', '400 g pesce spada', 'pesce spada', 400, 'g'),
        ing('asp-i4', "olio extravergine d'oliva q.b.", "olio extravergine d'oliva", null, null),
      ],
    }),
  )
  const r = await request.post(`/api/v1/piatti/asp-conchiglioni/foto?id=asp-foto1&principale=1`, { headers: { origin: ORIGINE, 'content-type': 'image/jpeg' }, data: await foto(page) })
  expect(r.status(), await r.text()).toBe(201)
  await ok(
    apiScrivi(request, 'post', '/piatti', {
      id: 'asp-tiramisu',
      nome: 'Tiramisù della tradizione',
      portataSuggerita: 'Dolci',
      porzioniBase: 6,
      tempoPreparazioneMin: 25,
      procedimento: ['Monta i tuorli con lo zucchero, poi unisci il mascarpone.', 'Alterna savoiardi bagnati nel caffè e crema; finisci con il cacao.'],
      ingredienti: [ing('asp-t1', '4 uova', 'uova', 4, null), ing('asp-t2', '500 g mascarpone', 'mascarpone', 500, 'g'), ing('asp-t3', '300 g savoiardi', 'savoiardi', 300, 'g')],
    }),
  )

  const evento = async (id: string, nome: string, data: string, ora: string | null, adulti: number, bambini: number) => {
    const e = await ok(apiScrivi(request, 'post', '/eventi', { id, nome, data, oraServizio: ora, tipo: 'cena', occasione: 'Natale', adulti, bambini, note: '', gruppoId: famiglia.id }))
    return e as { id: string; portate: { id: string; nome: string }[] }
  }
  const vigilia = await evento('asp-vigilia', 'Vigilia di Natale 2030', '2030-12-24', '21:00', 12, 2)
  await evento('asp-natale', 'Natale 2030', '2030-12-25', null, 12, 2)
  await evento('asp-stefano', 'Santo Stefano 2030 dai nonni, con tutta la famiglia allargata', '2030-12-26', '13:00', 10, 4)
  const portata = (nome: string) => vigilia.portate.find((p) => p.nome === nome)!.id
  await ok(
    apiScrivi(request, 'post', '/eventi/asp-vigilia/voci', {
      voci: [
        { id: 'asp-v1', portataId: portata('Antipasti'), nome: 'Olive ripiene di tonno fritte' },
        { id: 'asp-v2', portataId: portata('Antipasti'), nome: 'Antipasti a scelta', daDefinire: true },
        { id: 'asp-v3', portataId: portata('Primi'), nome: 'Conchiglioni melanzane e pesce spada', piattoId: 'asp-conchiglioni' },
        { id: 'asp-v4', portataId: portata('Dolci'), nome: 'Tiramisù della tradizione', piattoId: 'asp-tiramisu' },
      ],
    }),
  )
  await ok(apiScrivi(request, 'post', '/eventi/asp-vigilia/messaggi', { id: 'asp-m1', testo: 'Si comincia alle 21: chi porta le bevande?' }))
  await ok(apiScrivi(request, 'post', '/eventi/asp-vigilia/messaggi', { id: 'asp-m2', testo: 'Che secondo facciamo?', sondaggio: { opzioni: ['Baccalà', 'Orata al forno'], multipla: false, risultati: 'sempre' } }))
  await ok(apiScrivi(request, 'post', '/eventi/asp-vigilia/messaggi', { id: 'asp-m3', testo: '', proposta: { nome: 'Insalata di mare', portataNome: 'Antipasti' } }))
}

// ── Pagine ──────────────────────────────────────────────────

interface Schermata {
  nome: string
  url: (d: Dati) => string
  /** Elemento che indica la pagina pronta. */
  pronta: (p: Page) => Locator
  /** Parti che variano da un'esecuzione all'altra e non si possono rendere fisse: coperte da una maschera. */
  maschere?: (p: Page) => Locator[]
}

const SCHERMATE: Schermata[] = [
  { nome: 'eventi', url: () => '/#/', pronta: (p) => p.getByRole('link', { name: 'Vigilia di Natale 2030' }).first() },
  { nome: 'evento', url: (d) => `/#/eventi/${d.vigilia}`, pronta: (p) => p.getByTestId('azioni-evento') },
  { nome: 'menu', url: (d) => `/#/eventi/${d.vigilia}/menu`, pronta: (p) => p.getByText('Olive ripiene di tonno fritte').first() },
  {
    nome: 'bacheca',
    url: (d) => `/#/eventi/${d.vigilia}/bacheca`,
    pronta: (p) => p.getByText('Orata al forno').first(),
  },
  { nome: 'ricetta-con-foto', url: (d) => `/#/ricettario/${d.conFoto}`, pronta: (p) => p.getByRole('heading', { name: 'Conchiglioni melanzane e pesce spada' }) },
  { nome: 'ricetta-senza-foto', url: (d) => `/#/ricettario/${d.senzaFoto}`, pronta: (p) => p.getByRole('heading', { name: 'Tiramisù della tradizione' }) },
  { nome: 'cucina', url: (d) => `/#/ricettario/${d.conFoto}/cucina`, pronta: (p) => p.getByText('Schermo sempre acceso') },
  { nome: 'famiglia', url: () => '/#/famiglia', pronta: (p) => p.getByRole('heading', { name: 'Famiglia', exact: true }).first() },
  { nome: 'impostazioni', url: () => '/#/impostazioni', pronta: (p) => p.getByRole('heading', { name: 'Impostazioni', exact: true }).first() },
]

/**
 * Niente transizioni né cursore lampeggiante; barre di scorrimento nascoste (variano col sistema);
 * notifiche a comparsa nascoste (passeggere, compaiono in momenti diversi). Sul telefono la barra in
 * basso va in fondo alla pagina (fissa, nelle schermate intere coprirebbe il contenuto a metà) e lo
 * sfondo dell'app copre tutta la pagina (fisso, coprirebbe solo la prima schermata). Le foto si
 * ridimensionano senza filtro: Chrome a volte usa quello rapido, a volte quello di qualità.
 */
const STILE_STABILE = `*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; scroll-behavior: auto !important; }
html { scrollbar-width: none; } ::-webkit-scrollbar { display: none; }
[data-sonner-toaster] { display: none !important; }
img { image-rendering: pixelated !important; }
body { position: relative; }
body::before { position: absolute !important; }
nav[aria-label="Sezioni"][class*="bottom-0"] { position: absolute !important; }`

async function apri(browser: Browser, c: Configurazione): Promise<Page> {
  const contesto = await browser.newContext({
    ...c.contesto,
    baseURL: ORIGINE,
    storageState: SESSIONE,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    colorScheme: c.tema === 'scuro' ? 'dark' : 'light',
    reducedMotion: 'reduce',
    // Il service worker si installa in un momento casuale e lo annuncia con una notifica.
    serviceWorkers: 'block',
  })
  await contesto.addInitScript(
    ([tema, testo]) => {
      localStorage.setItem('menuapp.tema', tema)
      localStorage.setItem('menuapp.testo', testo)
      // Schermo sempre acceso (vista cucina): nel browser automatico la richiesta si risolve o viene
      // revocata in momenti diversi; qui è concessa subito e non revocata, come su un telefono vero.
      const blocco = { released: false, type: 'screen', release: async () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => blocco } })
    },
    [c.tema, c.testo],
  )
  await contesto.route('**/api/v1/**', async (route) => {
    const risposta = await route.fetch()
    if (route.request().method() !== 'GET' || !(risposta.headers()['content-type'] ?? '').includes('application/json')) return route.fulfill({ response: risposta })
    return route.fulfill({ response: risposta, json: dateFisse(await risposta.json()) })
  })
  const page = await contesto.newPage()
  await page.clock.setFixedTime(OGGI)
  return page
}

/** Pagina pronta: contenuto visibile, caratteri caricati, immagini decodificate, rete ferma. */
async function attendi(page: Page, s: Schermata) {
  await expect(s.pronta(page)).toBeVisible()
  await page.addStyleTag({ content: STILE_STABILE })
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {
    await document.fonts.ready
    for (const img of document.querySelectorAll('img')) {
      img.loading = 'eager'
      await img.decode().catch(() => undefined)
    }
  })
  // Il carattere dell'interfaccia deve essere davvero caricato (non il ripiego di sistema) nei pesi usati.
  const pesi = await page.evaluate(async () => {
    const caricati = await Promise.all(['400', '500', '600', '700'].map((p) => document.fonts.load(`${p} 16px 'Plus Jakarta Sans Variable'`)))
    return caricati.map((f) => f.length)
  })
  expect(pesi.every((n) => n > 0)).toBe(true)
}

/** Identificativi fissi: ogni configurazione è un test a sé, e una differenza non ferma le altre. */
const dati: Dati = { vigilia: 'asp-vigilia', conFoto: 'asp-conchiglioni', senzaFoto: 'asp-tiramisu' }

// Primo test del file (un solo worker, in ordine): crea i dati sul database nuovo del server.
test('dati di prova', async ({ request, page }) => {
  await page.goto('/')
  await preparaDati(request, page)
})

for (const c of CONFIGURAZIONI) {
  test(`schermate · ${c.nome}`, async ({ browser }) => {
    const page = await apri(browser, c)
    for (const s of SCHERMATE) {
      await page.goto(s.url(dati))
      await attendi(page, s)
      // Mai uno scorrimento orizzontale della pagina.
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${s.nome} · ${c.nome}: pagina più larga dello schermo`).toBeLessThanOrEqual(0)
      // Confronto «morbido»: si registrano tutte le schermate diverse, il test fallisce comunque.
      await expect.soft(page, `${s.nome} · ${c.nome}`).toHaveScreenshot(`${s.nome}--${c.nome}.png`, { fullPage: true, mask: s.maschere?.(page) ?? [] })
    }
    await page.context().close()
  })
}

// Barra in basso del telefono com'è davvero (senza gli adattamenti degli scatti): durante lo
// scorrimento resta sul bordo dello schermo, non copre la fine della pagina, etichette intere e
// separate anche a 360 px con il testo al 150%.
test('barra in basso durante lo scorrimento', async ({ browser }) => {
  for (const c of [CONFIGURAZIONI[0]!, CONFIGURAZIONI[3]!]) {
    const page = await apri(browser, c)
    for (const [url, pronta] of [['/#/', 'Vigilia di Natale 2030'], [`/#/ricettario/${dati.conFoto}`, 'Gestione della ricetta']] as const) {
      await page.goto(url)
      // Pagina caricata per intero prima di scorrere.
      await expect(page.getByText(pronta).first()).toBeVisible()
      await page.waitForLoadState('networkidle')
      const barra = page.getByRole('navigation', { name: 'Sezioni' }).filter({ visible: true })
      await expect(barra).toBeVisible()
      for (const posizione of ['meta', 'fondo'] as const) {
        await page.evaluate((p) => window.scrollTo(0, p === 'fondo' ? document.documentElement.scrollHeight : document.documentElement.scrollHeight / 2), posizione)
        await page.waitForTimeout(100)
        const m = await barra.evaluate((nav) => {
          const r = nav.getBoundingClientRect()
          // Il testo di ogni voce, misurato direttamente (qualunque sia il markup): dentro la sua colonna e
          // non tagliato dal contenitore.
          const etichette = [...nav.querySelectorAll('a')].map((a) => {
            const camminatore = document.createTreeWalker(a, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent!.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) })
            let nodo = camminatore.nextNode()
            while (nodo && /^\d+$/.test(nodo.textContent!.trim())) nodo = camminatore.nextNode() // il contatore delle notifiche
            const intervallo = document.createRange()
            intervallo.selectNodeContents(nodo!)
            const r = intervallo.getBoundingClientRect()
            const colonna = a.getBoundingClientRect()
            const contenitore = nodo!.parentElement!
            return { testo: nodo!.textContent, r, intera: r.left >= colonna.left - 0.5 && r.right <= colonna.right + 0.5 && contenitore.scrollWidth <= contenitore.clientWidth + 0.5 }
          })
          const main = document.querySelector('main')!
          // L'ultimo contenuto visibile (testi, immagini, icone, controlli; non i contenitori, che hanno
          // il margine per la barra): in fondo alla pagina deve finire sopra la barra.
          const contenuti = [...main.querySelectorAll('*')].filter((e) => {
            const r = e.getBoundingClientRect()
            if (r.height === 0 || getComputedStyle(e).visibility === 'hidden') return false
            return /^(IMG|svg|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.tagName) || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())
          })
          const ultimo = contenuti.map((e) => e.getBoundingClientRect().bottom).reduce((a, b) => Math.max(a, b), 0)
          return { basso: r.bottom, alto: r.top, altezzaFinestra: innerHeight, etichette, ultimo }
        })
        expect(Math.abs(m.basso - m.altezzaFinestra), `${c.nome} ${url} ${posizione}: barra sul bordo`).toBeLessThanOrEqual(1)
        for (const e of m.etichette) expect(e.intera, `${c.nome}: «${e.testo}» intera`).toBe(true)
        for (let i = 1; i < m.etichette.length; i++) expect(m.etichette[i]!.r.left, `${c.nome}: etichette separate`).toBeGreaterThanOrEqual(m.etichette[i - 1]!.r.right)
        if (posizione === 'fondo') expect(m.ultimo, `${c.nome} ${url}: fine pagina sopra la barra`).toBeLessThanOrEqual(m.alto + 1)
      }
    }
    await page.context().close()
  }
})
