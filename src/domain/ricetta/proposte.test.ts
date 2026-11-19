import { describe, expect, it } from 'vitest'
import type { IngredientePiatto } from '../tipi.ts'
import { applica, type ContenutoRicetta, differenze, dipendenzeMancanti, inConflitto } from './proposte.ts'

const ing = (id: string, testo: string, quantita: number): IngredientePiatto => ({
  id, ordine: 0, testoOriginale: testo, nome: id, ingredienteId: null, quantita, quantitaMax: null, unita: 'g', scalatura: 'proporzionale', facoltativo: false, nota: '', statoParsing: 'certo', problemiParsing: [],
})
const base: ContenutoRicetta = {
  nome: 'Torta', portataSuggerita: 'Dolci', porzioniBase: 8, tempoPreparazioneMin: 20, tempoCotturaMin: 30, tempoRiposoMin: null,
  attrezzature: ['teglia'], procedimento: ['Impastare', 'Cuocere'], note: '', fonte: '',
  ingredienti: [ing('farina', '400 g farina', 400), ing('uova', '3 uova', 3), ing('burro', '100 g burro', 100)],
}
let n = 0
const id = () => `m${++n}`

describe('proposte di modifica', () => {
  it('differenze: un elemento per campo e per ingrediente, riconosciuto dal suo id', () => {
    n = 0
    const proposto = { ...base, tempoCotturaMin: 25, ingredienti: [ing('farina', '450 g farina', 450), ing('uova', '3 uova', 3), ing('zucchero', '200 g zucchero', 200)] }
    const d = differenze(base, proposto, id)
    expect(d.map((m) => [m.campo, m.operazione, m.chiave])).toEqual([
      ['tempoCotturaMin', 'modifica', null],
      ['ingrediente', 'modifica', 'farina'],
      ['ingrediente', 'aggiungi', 'zucchero'],
      ['ingrediente', 'rimuovi', 'burro'],
    ])
    expect(differenze(base, { ...base, ingredienti: [...base.ingredienti].reverse() }, id)).toEqual([])
  })

  it('approvazione parziale: si applicano solo le modifiche scelte, sul contenuto di adesso', () => {
    n = 0
    const d = differenze(base, { ...base, tempoCotturaMin: 25, ingredienti: [ing('farina', '450 g farina', 450), base.ingredienti[1]!, base.ingredienti[2]!] }, id)
    const r = applica(base, d.filter((m) => m.campo === 'ingrediente'))
    expect(r.tempoCotturaMin).toBe(30)
    expect(r.ingredienti.map((i) => [i.id, i.quantita, i.ordine])).toEqual([['farina', 450, 0], ['uova', 3, 1], ['burro', 100, 2]])
  })

  it('conflitti: solo se il valore ufficiale è cambiato dopo la proposta', () => {
    n = 0
    const [cottura, farina] = differenze(base, { ...base, tempoCotturaMin: 25, ingredienti: [ing('farina', '450 g farina', 450), base.ingredienti[1]!, base.ingredienti[2]!] }, id)
    expect(inConflitto(cottura!, base, [])).toBe(false)
    const cambiata = { ...base, tempoCotturaMin: 35 }
    expect(inConflitto(cottura!, cambiata, [])).toBe(true)
    expect(inConflitto(farina!, cambiata, [])).toBe(false)
    expect(inConflitto(farina!, { ...base, ingredienti: base.ingredienti.slice(1) }, [])).toBe(true)
    const fotoVia = { id: 'f', campo: 'foto' as const, operazione: 'rimuovi' as const, chiave: 'x', prima: null, dopo: null, dipendeDa: null }
    expect(inConflitto(fotoVia, base, [{ id: 'x' }])).toBe(false)
    expect(inConflitto(fotoVia, base, [])).toBe(true)
  })

  it('dipendenze: la foto di un passaggio nuovo non si approva senza il nuovo procedimento', () => {
    const proc = { id: 'p', campo: 'procedimento' as const, operazione: 'modifica' as const, chiave: null, prima: [], dopo: [], dipendeDa: null }
    const foto = { id: 'f', campo: 'foto' as const, operazione: 'aggiungi' as const, chiave: 'x', prima: null, dopo: null, dipendeDa: 'p' }
    expect(dipendenzeMancanti([proc, foto], new Set(['f']))).toEqual([foto])
    expect(dipendenzeMancanti([proc, foto], new Set(['f', 'p']))).toEqual([])
  })
})
