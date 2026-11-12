import { describe, expect, it } from 'vitest'
import type { ArticoloSpesa, IngredientePiatto, Piatto } from '../tipi.ts'
import { calcolaSpesa, contributiDaVerificare, type DatiCalcolo } from './calcolo.ts'
import { testoCondivisione } from './condivisione.ts'
import { orfaniSenzaValore, riconciliaSpesa } from './riconciliazione.ts'

let n = 0
function ing(nome: string, extra: Partial<IngredientePiatto> = {}): IngredientePiatto {
  return {
    id: `i${++n}`, ordine: 0, testoOriginale: nome, nome, ingredienteId: null, quantita: null, quantitaMax: null, unita: null,
    scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [], ...extra,
  }
}
function piatto(id: string, porzioniBase: number | null, ingredienti: IngredientePiatto[]): Piatto {
  return {
    id, nome: id, portataSuggerita: null, porzioniBase, tempoPreparazioneMin: null, tempoCotturaMin: null, tempoRiposoMin: null,
    attrezzature: [], procedimento: [], note: '', fonte: '', versione: 1, creatoIl: 0, aggiornatoIl: 0, ingredienti,
  }
}
const catalogo = new Map([
  ['ing-burro', { id: 'ing-burro', nome: 'Burro', repartoId: 'rep-latte-uova-frigo' }],
  ['ing-olio', { id: 'ing-olio', nome: 'Olio extravergine', repartoId: 'rep-dispensa' }],
  ['ing-uova', { id: 'ing-uova', nome: 'Uova', repartoId: 'rep-latte-uova-frigo' }],
  ['ing-sale', { id: 'ing-sale', nome: 'Sale', repartoId: 'rep-spezie-condimenti' }],
  ['ing-pinoli', { id: 'ing-pinoli', nome: 'Pinoli', repartoId: 'rep-dispensa' }],
])
const ordineReparti = new Map(['rep-ortofrutta', 'rep-latte-uova-frigo', 'rep-dispensa', 'rep-spezie-condimenti', 'rep-altro'].map((r, i) => [r, i]))

function dati(piatti: Piatto[], voci: DatiCalcolo['voci'], persone = { adulti: 8, bambini: 4, coefficienteBambini: 0.5 }): DatiCalcolo {
  return { evento: persone, voci, piatti: new Map(piatti.map((p) => [p.id, p])), catalogo }
}
const voce = (id: string, piattoId: string | null, extra: Partial<DatiCalcolo['voci'][number]> = {}) => ({ id, nome: id, piattoId, porzioni: null, inSpesa: true, ...extra })

function articolo(chiave: string, extra: Partial<ArticoloSpesa> = {}): ArticoloSpesa {
  return {
    id: `a-${chiave}`, eventoId: 'e', tipo: 'calcolato', chiave, stato: 'da_comprare', fabbisognoCoperto: null, quantitaUtente: null,
    quantitaCalcolataAllaCorrezione: null, repartoId: null, nascosto: false, inclusa: false, nota: '', nome: '', quantitaTesto: '',
    versione: 1, creatoIl: 0, aggiornatoIl: 0, ...extra,
  }
}

describe('calcolo: classificazione dei contributi (SPEC §10.1)', () => {
  const lasagne = piatto('lasagne', 6, [
    ing('burro', { ingredienteId: 'ing-burro', quantita: 60, unita: 'g' }),
    ing('olio', { ingredienteId: 'ing-olio', quantita: 2, unita: 'cucchiaio' }),
    ing('sale', { ingredienteId: 'ing-sale', unita: 'qb', scalatura: 'fissa' }),
    ing('pinoli', { ingredienteId: 'ing-pinoli', quantita: 30, unita: 'g', facoltativo: true }),
    ing('besciamella'),
    ing('3 4 pomodori', { statoParsing: 'da_verificare', problemiParsing: ['più numeri'] }),
  ])
  const arrosto = piatto('arrosto', null, [ing('burro', { ingredienteId: 'ing-burro', quantita: 50, unita: 'g' })])
  const crostata = piatto('crostata', 8, [
    ing('burro', { ingredienteId: 'ing-burro', quantita: 0.2, unita: 'kg' }),
    ing('uova', { ingredienteId: 'ing-uova', quantita: 2, unita: null }),
    ing('olio', { ingredienteId: 'ing-olio', quantita: 50, unita: 'ml' }),
  ])
  const r = calcolaSpesa(dati([lasagne, arrosto, crostata], [voce('v1', 'lasagne'), voce('v2', 'arrosto'), voce('v3', 'crostata', { porzioni: 4 })]))
  const riga = (chiave: string) => r.righe.find((x) => x.chiave === chiave)

  it('sommata: si sommano solo i contributi certi, in unità base', () => {
    // lasagne 60 g × 10/6 = 100 g; crostata 200 g × 4/8 = 100 g; arrosto escluso (porzioni base mancanti)
    expect(riga('ing:ing-burro|massa')).toMatchObject({ natura: 'sommata', quantita: 200, unita: 'g', nome: 'Burro', repartoId: 'rep-latte-uova-frigo' })
    expect(riga('ing:ing-burro|massa')!.provenienze).toHaveLength(2)
  })
  it('stesso ingrediente in famiglie diverse: righe distinte', () => {
    expect(riga('ing:ing-olio|u:cucchiaio')?.quantita).toBeCloseTo(3.333333, 4)
    expect(riga('ing:ing-olio|volume')?.quantita).toBe(25)
  })
  it('conteggi senza unità', () => {
    expect(riga('ing:ing-uova|senza_unita')).toMatchObject({ quantita: 1, unita: null })
  })
  it('q.b.: mai sommato', () => {
    expect(riga('ing:ing-sale|qb')).toMatchObject({ natura: 'qb', quantita: null, unita: 'qb' })
  })
  it('facoltativo: riga a parte', () => {
    expect(riga('ing:ing-pinoli|massa|fac')).toMatchObject({ natura: 'facoltativa', quantita: 50 })
    expect(riga('ing:ing-pinoli|massa')).toBeUndefined()
  })
  it('da verificare: quantità mancante, interpretazione incerta, porzioni base mancanti — una riga per contributo', () => {
    const dv = r.righe.filter((x) => x.natura === 'da_verificare')
    expect(dv.map((x) => x.motivi.join(','))).toEqual(['quantità da definire', 'interpretazione da verificare,quantità da definire', 'porzioni base mancanti,quantità della ricetta, non scalata'])
    expect(dv.every((x) => x.chiave.startsWith('dv:'))).toBe(true)
    const arrostoBurro = dv.find((x) => x.provenienze[0]!.voceId === 'v2')!
    expect(arrostoBurro.quantita).toBe(50)
  })
  it('rimando «+ N contributi da verificare» sulla riga sommata dello stesso ingrediente', () => {
    expect(contributiDaVerificare(r.righe, dati([lasagne, arrosto, crostata], [])).get('ing:ing-burro')).toBe(1)
  })
  it('proprietà: la somma delle provenienze è il totale, nessun «da verificare» nei totali', () => {
    for (const x of r.righe.filter((y) => y.natura === 'sommata')) {
      expect(x.provenienze.reduce((s, p) => s + (p.quantita ?? 0), 0)).toBeCloseTo(x.quantita!, 9)
    }
  })
  it('avvisi per voci senza ricetta o piatto senza ingredienti; voci fuori spesa ignorate', () => {
    const vuoto = piatto('vuoto', 4, [])
    const x = calcolaSpesa(dati([vuoto, lasagne], [voce('a', null), voce('b', 'vuoto'), voce('c', 'lasagne', { inSpesa: false })]))
    expect(x.avvisi.map((a) => a.tipo)).toEqual(['voce_senza_ricetta', 'piatto_senza_ingredienti'])
    expect(x.righe).toEqual([])
  })
  it('intervalli: si usa il massimo; quantità fissa non scalata', () => {
    const p = piatto('p', 2, [ing('patate', { quantita: 2, quantitaMax: 3 }), ing('alloro', { quantita: 2, unita: 'foglia', scalatura: 'fissa' })])
    const x = calcolaSpesa(dati([p], [voce('v', 'p')]))
    expect(x.righe.find((y) => y.chiave === 'txt:patate|senza_unita')?.quantita).toBe(15) // 3 × 10/2
    expect(x.righe.find((y) => y.chiave === 'txt:alloro|u:foglia')?.quantita).toBe(2)
  })
  it('chiave stabile al cambio di coperti e porzioni', () => {
    const a = calcolaSpesa(dati([crostata], [voce('v3', 'crostata')])).righe.map((y) => y.chiave)
    const b = calcolaSpesa(dati([crostata], [voce('v3', 'crostata', { porzioni: 20 })], { adulti: 2, bambini: 0, coefficienteBambini: 0.5 })).righe.map((y) => y.chiave)
    expect(b).toEqual(a)
  })
})

describe('riconciliazione R1–R10 (SPEC §10.4)', () => {
  const crostata = piatto('crostata', 8, [ing('burro', { ingredienteId: 'ing-burro', quantita: 200, unita: 'g' }), ing('sale', { ingredienteId: 'ing-sale', unita: 'qb' })])
  const burro = 'ing:ing-burro|massa'
  const calcola = (porzioni: number | null) => calcolaSpesa(dati([crostata], [voce('v', 'crostata', { porzioni })])).righe
  const ric = (righe: ReturnType<typeof calcola>, art: ArticoloSpesa[]) => riconciliaSpesa(righe, art, { ordineReparti })
  const di = (l: ReturnType<typeof ric>, chiave: string) => l.voci.find((v) => v.chiave === chiave)!

  it('R1 nuova: da comprare, senza record', () => {
    expect(di(ric(calcola(8), []), burro)).toMatchObject({ caso: 'R1', sezione: 'da_comprare', stato: 'da_comprare', quantita: 200, versione: 0 })
  })
  it('R2 invariata', () => {
    expect(di(ric(calcola(8), [articolo(burro, { stato: 'comprato', fabbisognoCoperto: 200 })]), burro)).toMatchObject({ caso: 'R2', sezione: 'comprato' })
  })
  it('R3 fabbisogno aumentato: torna fra le cose da comprare con l\'aumento', () => {
    const v = di(ric(calcola(16), [articolo(burro, { stato: 'comprato', fabbisognoCoperto: 200 })]), burro)
    expect(v).toMatchObject({ caso: 'R3', sezione: 'da_comprare', stato: 'comprato', aumento: 200, fabbisognoCoperto: 200, quantita: 400 })
  })
  it('R4 fabbisogno diminuito: resta comprato con informazione', () => {
    expect(di(ric(calcola(4), [articolo(burro, { stato: 'ce_lho', fabbisognoCoperto: 200 })]), burro)).toMatchObject({ caso: 'R4', sezione: 'ce_lho', diminuzione: 100 })
  })
  it('R5 non più necessaria: mai eliminata in automatico', () => {
    const l = ric([], [articolo(burro, { stato: 'comprato', fabbisognoCoperto: 200, nome: 'Burro', quantitaTesto: '200 g' })])
    expect(di(l, burro)).toMatchObject({ caso: 'R5', sezione: 'non_piu_necessari', descrizioneOrfana: '200 g', nome: 'Burro' })
  })
  it('R6 orfana senza valore: non mostrata e proposta per la pulizia', () => {
    const a = articolo(burro)
    expect(ric([], [a]).voci).toEqual([])
    expect(orfaniSenzaValore([], [a, articolo('x', { nota: 'importante' })]).map((x) => x.chiave)).toEqual([burro])
  })
  it('R7 correzione dell\'utente con ricetta cambiata', () => {
    const v = di(ric(calcola(16), [articolo(burro, { quantitaUtente: 250, quantitaCalcolataAllaCorrezione: 200 })]), burro)
    expect(v).toMatchObject({ caso: 'R7', quantita: 250, quantitaCalcolata: 400, correzione: { calcolataOra: 400, allaCorrezione: 200 } })
  })
  it('R7 senza cambiamenti: nessun avviso', () => {
    const v = di(ric(calcola(8), [articolo(burro, { quantitaUtente: 250, quantitaCalcolataAllaCorrezione: 200 })]), burro)
    expect(v.correzione).toBeNull()
  })
  it('R8 nascosta', () => {
    expect(di(ric(calcola(8), [articolo(burro, { nascosto: true })]), burro)).toMatchObject({ caso: 'R8', sezione: 'nascosti' })
  })
  it('R9 q.b. e da verificare: nessun confronto quantitativo', () => {
    expect(di(ric(calcola(8), [articolo('ing:ing-sale|qb', { stato: 'comprato' })]), 'ing:ing-sale|qb')).toMatchObject({ caso: 'R9', sezione: 'comprato' })
  })
  it('R10 cambio di chiave: suggerito il trasferimento', () => {
    // il burro passa da grammi a pezzi: la vecchia chiave è orfana, la nuova è senza record
    const p = piatto('crostata', 8, [ing('burro', { ingredienteId: 'ing-burro', quantita: 1, unita: 'confezione' })])
    const righe = calcolaSpesa(dati([p], [voce('v', 'crostata', { porzioni: 8 })])).righe
    const l = ric(righe, [articolo(burro, { stato: 'comprato', fabbisognoCoperto: 200, nome: 'Burro' })])
    expect(di(l, burro).trasferibileA).toEqual({ chiave: 'ing:ing-burro|u:confezione', nome: 'Burro' })
  })
  it('facoltativi: sezione propria finché non inclusi', () => {
    const p = piatto('p', 4, [ing('pinoli', { ingredienteId: 'ing-pinoli', quantita: 20, unita: 'g', facoltativo: true })])
    const righe = calcolaSpesa(dati([p], [voce('v', 'p', { porzioni: 4 })])).righe
    expect(ric(righe, [])).toMatchObject({ voci: [{ sezione: 'facoltativi' }] })
    expect(ric(righe, [articolo('ing:ing-pinoli|massa|fac', { inclusa: true })])).toMatchObject({ voci: [{ sezione: 'da_comprare' }] })
  })
  it('idempotenza: riconciliare due volte dà lo stesso risultato', () => {
    const art = [articolo(burro, { stato: 'comprato', fabbisognoCoperto: 200 })]
    expect(ric(calcola(16), art)).toEqual(ric(calcola(16), art))
  })
  it('manuali indipendenti dal calcolo e contatori', () => {
    const l = ric(calcola(8), [articolo('', { id: 'm1', tipo: 'manuale', chiave: null, nome: 'Ghiaccio', quantitaTesto: '2 sacchetti' })])
    expect(l.manuali).toMatchObject([{ nome: 'Ghiaccio', sezione: 'da_comprare' }])
    expect(l.contatori).toEqual({ da_comprare: 3, da_verificare: 0, comprato: 0, ce_lho: 0 })
  })
})

describe('condivisione', () => {
  it('righe da comprare per reparto, aumento come differenza, da verificare a parte', () => {
    const crostata = piatto('crostata', 8, [ing('burro', { ingredienteId: 'ing-burro', quantita: 200, unita: 'g' }), ing('besciamella')])
    const righe = calcolaSpesa(dati([crostata], [voce('Crostata', 'crostata', { porzioni: 16 })])).righe
    const l = riconciliaSpesa(righe, [articolo('ing:ing-burro|massa', { stato: 'comprato', fabbisognoCoperto: 300 })], { ordineReparti })
    const t = testoCondivisione({ nome: 'Natale 2026', data: '2026-12-25' }, l, [{ id: 'rep-latte-uova-frigo', nome: 'Latte, uova e frigo' }])
    expect(t).toContain('Spesa — Natale 2026 (25/12)')
    expect(t).toContain('LATTE, UOVA E FRIGO\n☐ Burro +100 g (aumento rispetto a quanto già segnato)')
    expect(t).toContain('DA VERIFICARE\n☐ Crostata: "besciamella" (quantità da definire)')
    expect(t).not.toMatch(/hai|possied/i)
  })
})
