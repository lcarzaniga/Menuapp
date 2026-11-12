// Collaudo del parser (SPEC §8.4): ≥ 100 righe reali, catalogo vero.
import { describe, expect, it } from 'vitest'
import { vociCatalogo } from '../../../server/db/seed/catalogo.ts'
import { analizzaRiga, analizzaTesto, indicizzaCatalogo, type RigaAnalizzata } from './analizza.ts'

const indice = indicizzaCatalogo(
  vociCatalogo().map((v) => ({ id: v.id, nome: v.nome, sinonimi: v.sinonimi, scalaturaAbituale: v.fissa ? 'fissa' : 'proporzionale' })),
)

type Atteso = Partial<{
  q: number | null
  max: number | null
  u: RigaAnalizzata['unita']
  nome: string
  nota: string
  fac: boolean
  ing: string | null
  sugg: string
  sc: 'proporzionale' | 'fissa'
}>
// [riga, stato atteso, campi attesi]
type Caso = [string, 'certo' | 'da_verificare', Atteso]

const CASI: Caso[] = [
  // quantità prima del nome
  ['200 g farina', 'certo', { q: 200, u: 'g', nome: 'farina', ing: 'ing-farina-00' }],
  ['200g di farina 00', 'certo', { q: 200, u: 'g', nome: 'farina 00', ing: 'ing-farina-00' }],
  ['1,5 kg di patate', 'certo', { q: 1.5, u: 'kg', nome: 'patate', ing: 'ing-patate' }],
  ['1.5 kg di patate', 'certo', { q: 1.5, u: 'kg' }],
  ['500 g di macinato di manzo', 'certo', { q: 500, u: 'g', nome: 'macinato di manzo', ing: 'ing-macinato-di-manzo' }],
  ['100 ml di latte', 'certo', { q: 100, u: 'ml', ing: 'ing-latte' }],
  ['1 l di brodo vegetale', 'certo', { q: 1, u: 'l', ing: 'ing-brodo-vegetale' }],
  ['1 lt latte', 'certo', { q: 1, u: 'l', nome: 'latte' }],
  ['2 dl di panna fresca', 'certo', { q: 2, u: 'dl', ing: 'ing-panna-fresca' }],
  ['3 hg di prosciutto cotto', 'certo', { q: 3, u: 'hg', ing: 'ing-prosciutto-cotto' }],
  ['2 etti di mortadella', 'certo', { q: 2, u: 'hg', ing: 'ing-mortadella' }],
  ['50 cl di vino bianco secco', 'certo', { q: 50, u: 'cl', ing: 'ing-vino-bianco-da-cucina' }],
  ['gr. 200 di zucchero', 'certo', { q: 200, u: 'g', nome: 'zucchero', ing: 'ing-zucchero' }],
  ['g 150 burro', 'certo', { q: 150, u: 'g', nome: 'burro' }],
  // quantità dopo il nome
  ['farina 00 200 g', 'certo', { q: 200, u: 'g', nome: 'farina 00' }],
  ['Farina 00 g 200', 'certo', { q: 200, u: 'g', nome: 'Farina 00', ing: 'ing-farina-00' }],
  ['Zucchero g 150', 'certo', { q: 150, u: 'g', nome: 'Zucchero' }],
  ['burro 50 g (morbido)', 'certo', { q: 50, u: 'g', nome: 'burro', nota: 'morbido' }],
  ['Uova 2', 'certo', { q: 2, u: null, nome: 'Uova', ing: 'ing-uova' }],
  ['patate 1 kg', 'certo', { q: 1, u: 'kg', nome: 'patate' }],
  ['latte ml 250', 'certo', { q: 250, u: 'ml', nome: 'latte' }],
  ['Parmigiano grattugiato 80 g', 'certo', { q: 80, u: 'g', ing: 'ing-parmigiano-reggiano' }],
  ['mascarpone gr 500', 'certo', { q: 500, u: 'g', nome: 'mascarpone' }],
  // conteggi e numeri in parola
  ['2 uova', 'certo', { q: 2, u: null, nome: 'uova', ing: 'ing-uova' }],
  ['un uovo', 'certo', { q: 1, nome: 'uovo', ing: 'ing-uova' }],
  ['uno scalogno', 'certo', { q: 1, nome: 'scalogno', ing: 'ing-scalogno' }],
  ['una cipolla', 'certo', { q: 1, nome: 'cipolla', ing: 'ing-cipolle' }],
  ["un'arancia", 'certo', { q: 1, nome: 'arancia', ing: 'ing-arance' }],
  ['mezzo limone', 'certo', { q: 0.5, nome: 'limone', ing: 'ing-limoni' }],
  ['mezza cipolla', 'certo', { q: 0.5, nome: 'cipolla' }],
  ['due carote', 'certo', { q: 2, nome: 'carote', ing: 'ing-carote' }],
  ['tre coste di sedano', 'certo', { q: 3, nome: 'coste di sedano', ing: 'ing-sedano' }],
  ['quattro patate medie', 'certo', { q: 4, nome: 'patate', nota: 'medie' }],
  ['dieci gamberi', 'certo', { q: 10, nome: 'gamberi' }],
  ['una dozzina di uova', 'certo', { q: 12, nome: 'uova' }],
  ['un paio di foglie di alloro', 'certo', { q: 2, u: 'foglia', nome: 'alloro', sc: 'fissa' }],
  ['6 uova grandi', 'certo', { q: 6, nome: 'uova', nota: 'grandi' }],
  ['n. 2 uova', 'certo', { q: 2, u: 'pz', nome: 'uova' }],
  ['3 pz di finocchi', 'certo', { q: 3, u: 'pz', nome: 'finocchi', ing: 'ing-finocchi' }],
  ['1 cipolla rossa di Tropea', 'certo', { q: 1, nome: 'cipolla rossa di Tropea' }],
  ['2 pomodori ramati', 'certo', { q: 2, nome: 'pomodori ramati', ing: 'ing-pomodori' }],
  // frazioni
  ['1/2 cucchiaino di sale', 'certo', { q: 0.5, u: 'cucchiaino', nome: 'sale' }],
  ['½ bicchiere di vino bianco', 'certo', { q: 0.5, u: 'bicchiere', nome: 'vino bianco' }],
  ['1½ cucchiai di zucchero', 'certo', { q: 1.5, u: 'cucchiaio' }],
  ['1 1/2 tazza di latte', 'certo', { q: 1.5, u: 'tazza' }],
  ['¾ di litro di latte', 'certo', { q: 0.75, u: 'l', nome: 'latte' }],
  ['2 kg e mezzo di patate', 'certo', { q: 2.5, u: 'kg', nome: 'patate' }],
  ['un chilo e mezzo di cozze', 'certo', { q: 1.5, u: 'kg', nome: 'cozze' }],
  // intervalli
  ['2-3 patate', 'certo', { q: 2, max: 3, nome: 'patate' }],
  ['2 - 3 patate', 'certo', { q: 2, max: 3 }],
  ['2 o 3 patate', 'certo', { q: 2, max: 3, nome: 'patate' }],
  ['da 4 a 5 cucchiai di olio', 'certo', { q: 4, max: 5, u: 'cucchiaio', nome: 'olio' }],
  ['100-150 ml di panna', 'certo', { q: 100, max: 150, u: 'ml', nome: 'panna' }],
  // misure domestiche e confezioni
  ['1 spicchio d\'aglio', 'certo', { q: 1, u: 'spicchio', nome: 'aglio', ing: 'ing-aglio' }],
  ['2 spicchi di aglio', 'certo', { q: 2, u: 'spicchio', nome: 'aglio' }],
  ['2 cucchiai abbondanti di olio', 'certo', { q: 2, u: 'cucchiaio', nome: 'olio', nota: 'abbondanti', ing: 'ing-olio-extravergine-d-oliva' }],
  ['3 cucchiai rasi di zucchero', 'certo', { q: 3, u: 'cucchiaio', nota: 'rasi' }],
  ['1 cucch. di miele', 'certo', { q: 1, u: 'cucchiaio', nome: 'miele' }],
  ['un pizzico di sale', 'certo', { q: 1, u: 'pizzico', nome: 'sale', sc: 'fissa' }],
  ['una noce di burro', 'certo', { q: 1, u: 'noce', nome: 'burro' }],
  ['una manciata di pinoli', 'certo', { q: 1, u: 'manciata', nome: 'pinoli' }],
  ['un mazzetto di prezzemolo', 'certo', { q: 1, u: 'mazzetto', nome: 'prezzemolo', sc: 'fissa' }],
  ['2 rametti di rosmarino', 'certo', { q: 2, u: 'rametto', nome: 'rosmarino', sc: 'fissa' }],
  ['4 foglie di salvia', 'certo', { q: 4, u: 'foglia', nome: 'salvia' }],
  ['6 fette di pane in cassetta', 'certo', { q: 6, u: 'fetta', nome: 'pane in cassetta' }],
  ['1 confezione di pasta sfoglia (230 g)', 'certo', { q: 1, u: 'confezione', nome: 'pasta sfoglia', nota: '230 g', ing: 'ing-pasta-sfoglia' }],
  ['1 bustina di lievito per dolci', 'certo', { q: 1, u: 'bustina', nome: 'lievito per dolci' }],
  ['2 bustine di zafferano', 'certo', { q: 2, u: 'bustina', nome: 'zafferano' }],
  ['1 scatola di pelati', 'certo', { q: 1, u: 'scatola', nome: 'pelati', ing: 'ing-pomodori-pelati' }],
  ['2 lattine di fagioli borlotti', 'certo', { q: 2, u: 'scatola', nome: 'fagioli borlotti' }],
  ['1 vasetto di yogurt bianco', 'certo', { q: 1, u: 'vasetto', nome: 'yogurt bianco', ing: 'ing-yogurt' }],
  ['1 barattolo di olive', 'certo', { q: 1, u: 'vasetto', nome: 'olive' }],
  ['2 pacchi di spaghetti', 'certo', { q: 2, u: 'confezione', nome: 'spaghetti' }],
  ['1 conf. di savoiardi', 'certo', { q: 1, u: 'confezione', nome: 'savoiardi' }],
  ['1 tazzina di caffè', 'certo', { q: 1, u: 'tazza', nome: 'caffè' }],
  // q.b.
  ['sale q.b.', 'certo', { u: 'qb', q: null, nome: 'sale', sc: 'fissa' }],
  ['q.b. pepe', 'certo', { u: 'qb', nome: 'pepe' }],
  ['pepe nero qb', 'certo', { u: 'qb', nome: 'pepe nero' }],
  ['olio extravergine d\'oliva q.b.', 'certo', { u: 'qb', nome: "olio extravergine d'oliva", ing: 'ing-olio-extravergine-d-oliva' }],
  ['parmigiano quanto basta', 'certo', { u: 'qb', nome: 'parmigiano' }],
  ['noce moscata a piacere', 'certo', { u: 'qb', nome: 'noce moscata' }],
  ['Sale e pepe q.b.', 'certo', { u: 'qb', nome: 'Sale e pepe' }],
  // elenchi puntati e maiuscole
  ['- 300 g di riso carnaroli', 'certo', { q: 300, u: 'g', nome: 'riso carnaroli', ing: 'ing-riso-carnaroli' }],
  ['• 2 uova', 'certo', { q: 2, nome: 'uova' }],
  ['* 100 g zucchero a velo', 'certo', { q: 100, nome: 'zucchero a velo' }],
  ['1. 250 g mascarpone', 'certo', { q: 250, nome: 'mascarpone' }],
  ['500 G FARINA', 'certo', { q: 500, u: 'g', nome: 'FARINA' }],
  ['circa 300 g di carne di manzo', 'certo', { q: 300, u: 'g', nome: 'carne di manzo', nota: 'circa' }],
  ['farina tipo 1 500 g', 'certo', { q: 500, u: 'g', nome: 'farina tipo 1' }],
  ['200 g cioccolato fondente 70%', 'certo', { q: 200, nome: 'cioccolato fondente 70%' }],
  // facoltativi
  ['parmigiano grattugiato facoltativo', 'da_verificare', { fac: true, nome: 'parmigiano grattugiato', q: null }],
  ['50 g di pinoli (facoltativo)', 'certo', { fac: true, q: 50, nome: 'pinoli', nota: '' }],
  ['uvetta 30 g, facoltativa', 'certo', { fac: true, q: 30, nome: 'uvetta' }],
  // casi ambigui: mai «certo»
  ['1.000 g di farina', 'da_verificare', { q: 1000, u: 'g' }],
  ['3 4 pomodori', 'da_verificare', { q: null }],
  ['200 g 2 uova', 'da_verificare', { q: null }],
  ['2 uova + 1 tuorlo', 'da_verificare', { q: null }],
  ['zucchero di canna', 'da_verificare', { q: null, nome: 'zucchero di canna' }],
  ['sale', 'da_verificare', { q: null, nome: 'sale' }],
  ['2 vasi di miele', 'da_verificare', { q: 2 }],
  ['pomodori 400 g pelati', 'da_verificare', { q: 400 }],
  ['250 g', 'da_verificare', { q: 250, nome: '' }],
  ['100 g di burro q.b.', 'da_verificare', { u: 'qb', q: null }],
  ['1 l (circa 2 bottiglie) di acqua', 'certo', { q: 1, u: 'l', nome: 'acqua', nota: 'circa 2 bottiglie' }],
  // catalogo: suggerimenti, mai collegamenti approssimati
  ['500 g di carne macinata mista', 'certo', { ing: null, sugg: 'ing-macinato-di-manzo' }],
  ['2 cipolle bianche', 'certo', { ing: null, sugg: 'ing-cipolle' }],
  ['1 limone non trattato', 'certo', { ing: null, sugg: 'ing-limoni' }],
  ['3 zucchine', 'certo', { ing: 'ing-zucchine' }],
  ['1 zucchina', 'certo', { ing: 'ing-zucchine' }],
  ['2 carciofi', 'certo', { ing: 'ing-carciofi' }],
  ['300 g di gorgonzola dolce', 'certo', { ing: null, sugg: 'ing-gorgonzola' }],
]

describe('parser ingredienti — tabella di collaudo', () => {
  it('ha almeno 100 casi', () => {
    expect(CASI.length).toBeGreaterThanOrEqual(100)
  })

  it('nessuna riga ambigua è marcata «certo»', () => {
    const errate = CASI.filter(([, stato]) => stato === 'da_verificare')
      .map(([riga]) => [riga, analizzaRiga(riga, indice)] as const)
      .filter(([, r]) => r.statoParsing === 'certo')
      .map(([riga]) => riga)
    expect(errate).toEqual([])
  })

  it('almeno il 90 % dei casi classificati come previsto', () => {
    const sbagliati: string[] = []
    for (const [riga, stato, a] of CASI) {
      const r = analizzaRiga(riga, indice)
      const diff: string[] = []
      if (r.statoParsing !== stato) diff.push(`stato ${r.statoParsing} (${r.problemi.join('; ')})`)
      if ('q' in a && r.quantita !== a.q) diff.push(`q ${r.quantita}`)
      if ('max' in a && r.quantitaMax !== a.max) diff.push(`max ${r.quantitaMax}`)
      if ('u' in a && r.unita !== a.u) diff.push(`u ${r.unita}`)
      if ('nome' in a && r.nome !== a.nome) diff.push(`nome «${r.nome}»`)
      if ('nota' in a && r.nota !== a.nota) diff.push(`nota «${r.nota}»`)
      if ('fac' in a && r.facoltativo !== a.fac) diff.push(`fac ${r.facoltativo}`)
      if ('ing' in a && r.ingredienteId !== a.ing) diff.push(`ing ${r.ingredienteId}`)
      if ('sugg' in a && r.suggerimento?.id !== a.sugg) diff.push(`sugg ${r.suggerimento?.id}`)
      if ('sc' in a && r.scalatura !== a.sc) diff.push(`sc ${r.scalatura}`)
      if (diff.length) sbagliati.push(`${riga} → ${diff.join(', ')}`)
    }
    const corretti = CASI.length - sbagliati.length
    if (sbagliati.length) console.log(`Casi non previsti (${sbagliati.length}):\n${sbagliati.join('\n')}`)
    expect(corretti / CASI.length).toBeGreaterThanOrEqual(0.9)
  })

  it('il testo originale è sempre conservato', () => {
    for (const [riga] of CASI) expect(analizzaRiga(`  ${riga}  `, indice).testoOriginale).toBe(riga.trim())
  })

  it('analizzaTesto ignora righe vuote e titoli', () => {
    const r = analizzaTesto('Ingredienti per 4 persone\n\nPer il ripieno:\n200 g ricotta\n1 uovo\n', indice)
    expect(r.map((x) => x.nome)).toEqual(['ricotta', 'uovo'])
  })
})
