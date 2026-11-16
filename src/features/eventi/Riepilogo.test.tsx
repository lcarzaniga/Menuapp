import { describe, expect, it } from 'vitest'
import type { RiepilogoOrganizzativo } from '@/contratto/edizioni.ts'
import { nomeEdizione } from './Edizioni'
import { indicatori } from './Riepilogo'

const base: RiepilogoOrganizzativo = {
  coperti: { equivalenti: 7, adulti: 6, bambini: 2, automatici: false },
  partecipanti: null,
  mioInvito: null,
  incarichi: null,
  attivita: null,
  proposte: null,
  sondaggi: null,
  spesa: null,
  archiviato: false,
}

describe('a che punto siamo: indicatori', () => {
  it('evento senza funzioni collaborative: solo i coperti, nessun allarme', () => {
    expect(indicatori(base)).toEqual([{ testo: '7 coperti', dettaglio: 'manuali', livello: 'ok', a: 'partecipanti' }])
  })

  it('piatti non affidati sono solo un\'informazione; cose senza nessuno e responsabili assenti chiedono attenzione', () => {
    const l = indicatori({ ...base, incarichi: { coseSenzaResponsabile: 1, daCompletare: 0, piattiNonAffidati: 3, responsabiliAssenti: 1 } })
    expect(l.filter((x) => x.livello === 'attenzione').map((x) => x.testo)).toEqual(['1 incarico di chi non partecipa', '1 cosa da portare senza nessuno'])
    expect(l.find((x) => x.testo === '3 piatti non affidati')).toMatchObject({ livello: 'info', a: 'chi-porta' })
  })

  it('ogni indicatore porta alla sua sezione; le cose finite risultano a posto', () => {
    const l = indicatori({
      ...base,
      mioInvito: 'in_attesa',
      partecipanti: { confermati: 5, inAttesa: 2, assenti: 1 },
      attivita: { daFare: 0, inRitardo: 0 },
      proposte: { inAttesa: 1 },
      sondaggi: { aperti: 2 },
      spesa: { daComprare: 0, daVerificare: 0, avvisi: 0 },
    })
    expect(l.map((x) => [x.testo, x.a, x.livello])).toEqual([
      ['Conferma la tua presenza', 'partecipanti', 'attenzione'],
      ['5 confermati, 2 in attesa', 'partecipanti', 'info'],
      ['7 coperti', 'partecipanti', 'ok'],
      ['Piano completato', 'piano', 'ok'],
      ['1 proposta da decidere', 'bacheca', 'info'],
      ['2 sondaggi aperti', 'bacheca', 'info'],
      ['Spesa fatta', 'spesa', 'ok'],
    ])
  })
})

describe('nome della nuova edizione', () => {
  it('cambia l\'anno solo se compare nel nome', () => {
    expect(nomeEdizione('Natale 2026', '2026-12-25', '2027-12-25')).toBe('Natale 2027')
    expect(nomeEdizione('Pasqua dai nonni', '2026-04-05', '2027-03-28')).toBe('Pasqua dai nonni')
  })
})
