import { describe, expect, it } from 'vitest'
import type { RiepilogoOrganizzativo } from '@/contratto/edizioni.ts'
import { nomeEdizione } from './Edizioni'
import { indicatori, inSospeso } from './Riepilogo'

const base: RiepilogoOrganizzativo = {
  coperti: { equivalenti: 7, adulti: 6, bambini: 2, automatici: false },
  partecipanti: null,
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
    // Facoltativo: non è fra le cose in sospeso.
    expect(l.find((x) => x.testo === '3 piatti non affidati')).toMatchObject({ livello: 'nota', a: 'chi-porta' })
    expect(l.filter(inSospeso).map((x) => x.testo)).toEqual(['1 incarico di chi non partecipa', '1 cosa da portare senza nessuno'])
  })

  it('prima ciò che manca (le conferme per prime), poi ciò che è a posto; ogni indicatore porta alla sua sezione', () => {
    const l = indicatori({
      ...base,
      partecipanti: { confermati: 5, inAttesa: 2, assenti: 1 },
      attivita: { daFare: 0, inRitardo: 0 },
      proposte: { inAttesa: 1 },
      sondaggi: { aperti: 2 },
      spesa: { daComprare: 0, daVerificare: 0, avvisi: 0 },
    })
    expect(l.map((x) => [x.testo, x.a, x.livello])).toEqual([
      ['2 in attesa di conferma', 'partecipanti', 'da_fare'],
      ['1 proposta da decidere', 'bacheca', 'da_fare'],
      ['2 sondaggi aperti', 'bacheca', 'da_fare'],
      ['7 coperti', 'partecipanti', 'ok'],
      ['Piano completato', 'piano', 'ok'],
      ['Spesa fatta', 'spesa', 'ok'],
    ])
  })

  it('tutto pronto: nessuna cosa in sospeso, i problemi in ritardo passano davanti', () => {
    const pronto = indicatori({ ...base, partecipanti: { confermati: 8, inAttesa: 0, assenti: 1 }, spesa: { daComprare: 0, daVerificare: 0, avvisi: 0 } })
    expect(pronto.filter(inSospeso)).toEqual([])
    expect(pronto[0]).toMatchObject({ testo: '8 confermati, 1 non partecipa', dettaglio: 'tutti hanno risposto', livello: 'ok' })
    const ritardo = indicatori({ ...base, partecipanti: { confermati: 1, inAttesa: 1, assenti: 0 }, attivita: { daFare: 3, inRitardo: 1 } })
    expect(ritardo.map((x) => x.livello)).toEqual(['attenzione', 'da_fare', 'ok'])
  })
})

describe('nome della nuova edizione', () => {
  it('cambia l\'anno solo se compare nel nome', () => {
    expect(nomeEdizione('Natale 2026', '2026-12-25', '2027-12-25')).toBe('Natale 2027')
    expect(nomeEdizione('Pasqua dai nonni', '2026-04-05', '2027-03-28')).toBe('Pasqua dai nonni')
  })
})
