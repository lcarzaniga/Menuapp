// Schermate di controllo visivo su telefono, PC ed Echo Show 15 (1920×1080), chiaro e scuro.
import { expect, test } from '@playwright/test'
import { apiLeggi, apiScrivi } from './aiuti'

test.describe.configure({ mode: 'serial' })

const SCHERMI = [
  { nome: 'telefono', viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
  { nome: 'pc', viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1 },
  { nome: 'echo-show-15', viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, hasTouch: true },
]

test('vetrina', async ({ browser, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'una sola esecuzione')
  test.setTimeout(120_000)
  const ev = await apiScrivi(request, 'post', '/eventi', { id: 'vetrina', nome: 'Natale 2026', data: '2026-12-25', oraServizio: '13:00', tipo: 'pranzo', occasione: 'Natale', adulti: 8, bambini: 4, note: '' })
  if (ev.stato === 201) {
    const e = await apiLeggi<{ portate: { id: string }[] }>(request, '/eventi/vetrina')
    await apiScrivi(request, 'post', '/eventi', { id: 'vetrina-2', nome: 'Compleanno di Giulia', data: '2027-01-17', oraServizio: '16:30', tipo: 'pranzo', occasione: 'Compleanno', adulti: 6, bambini: 6, note: '' })
    await apiScrivi(request, 'post', '/piatti', {
      id: 'vetrina-tiramisu', nome: 'Tiramisù', porzioniBase: 8, procedimento: ['Montare i tuorli con lo zucchero.', 'Alternare savoiardi bagnati nel caffè e crema.'],
      ingredienti: [
        { id: 'vt1', ordine: 0, testoOriginale: '500 g mascarpone', nome: 'mascarpone', ingredienteId: 'ing-mascarpone', quantita: 500, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] },
        { id: 'vt2', ordine: 1, testoOriginale: '4 uova', nome: 'uova', ingredienteId: 'ing-uova', quantita: 4, quantitaMax: null, unita: null, scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] },
        { id: 'vt3', ordine: 2, testoOriginale: '300 g savoiardi', nome: 'savoiardi', ingredienteId: 'ing-savoiardi', quantita: 300, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [] },
      ],
    })
    const voci = [
      [0, 'Crostini toscani'], [0, 'Salmone affumicato con burro e pan brioche'], [1, 'Tortellini in brodo'], [1, 'Lasagne alla bolognese'],
      [2, 'Cappone ripieno'], [3, 'Patate al forno'], [4, 'Tiramisù', 'vetrina-tiramisu'], [4, 'Panettone e pandoro'],
    ] as const
    await apiScrivi(request, 'post', '/eventi/vetrina/voci', { voci: voci.map(([p, nome, piatto], i) => ({ id: `vv${i}`, portataId: e.portate[p]!.id, nome, piattoId: piatto ?? null, incaricato: i === 2 ? 'Zia Anna' : '' })) })
  }
  for (const s of SCHERMI) {
    for (const tema of ['light', 'dark'] as const) {
      const ctx = await browser.newContext({ ...s, colorScheme: tema, locale: 'it-IT' })
      const page = await ctx.newPage()
      for (const [rotta, nome] of [['/', 'home'], ['/eventi/vetrina/menu', 'menu'], ['/eventi/vetrina/spesa', 'spesa'], ['/ricettario', 'ricettario']] as const) {
        if (tema === 'dark' && nome !== 'home' && nome !== 'menu') continue
        await page.goto(`/#${rotta}`)
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        await page.waitForTimeout(400)
        await page.screenshot({ path: `test-results/vetrina/${s.nome}-${tema}-${nome}.png` })
      }
      await ctx.close()
    }
  }
})
