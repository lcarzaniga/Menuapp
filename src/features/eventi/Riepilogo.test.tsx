import { describe, expect, it } from 'vitest'
import type { RiepilogoOrganizzativo } from '@/contratto/edizioni.ts'
import { nomeEdizione } from '@/domain/edizioni.ts'
import { indicatori, inSospeso } from './Riepilogo'

const base: RiepilogoOrganizzativo = {
  menu: { voci: 5, portateVuote: [] },
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
  it('evento senza funzioni collaborative: menù completato, le parti facoltative non usate, nessun allarme', () => {
    const l = indicatori(base)
    expect(l.filter(inSospeso)).toEqual([])
    expect(l.filter((x) => x.livello === 'ok').map((x) => [x.testo, x.dettaglio, x.a])).toEqual([['Menù completato', '5 piatti', 'menu']])
    expect(l.filter((x) => x.livello === 'facoltativo').map((x) => x.a)).toEqual(['partecipanti', 'chi-porta', 'piano'])
  })

  it('menù vuoto o coperti a zero: non è «tutto pronto»; un archiviato non ha cose da fare', () => {
    const vuoto = indicatori({ ...base, menu: { voci: 0, portateVuote: ['Primi', 'Dolci'] }, coperti: { equivalenti: 0, adulti: 0, bambini: 0, automatici: false } })
    expect(vuoto.filter(inSospeso).map((x) => [x.testo, x.a])).toEqual([
      ['Menù ancora vuoto', 'menu'],
      ['Coperti non indicati', 'partecipanti'],
    ])
    // Senza menù «Chi porta» non si propone.
    expect(vuoto.some((x) => x.a === 'chi-porta')).toBe(false)
    expect(indicatori({ ...base, menu: { voci: 0, portateVuote: ['Primi'] }, archiviato: true }).filter(inSospeso)).toEqual([])
  })

  it('menù in preparazione: qualche piatto ma portate ancora vuote; nessun minimo di portate', () => {
    const l = indicatori({ ...base, menu: { voci: 2, portateVuote: ['Contorni', 'Dolci'] } })
    expect(l.filter(inSospeso)).toEqual([
      { testo: 'Menù in preparazione', dettaglio: 'ancora senza piatti: Contorni, Dolci · se non servono, toglile dalle portate', livello: 'da_fare', a: 'menu' },
    ])
    expect(l.some((x) => x.testo === 'Menù completato')).toBe(false)
    // Un solo piatto nell'unica portata dell'evento: il menù è completato.
    expect(indicatori({ ...base, menu: { voci: 1, portateVuote: [] } }).find((x) => x.a === 'menu')).toMatchObject({ testo: 'Menù completato', dettaglio: '1 piatto', livello: 'ok' })
    // Evento archiviato: il menù non è più una cosa da fare.
    expect(indicatori({ ...base, menu: { voci: 2, portateVuote: ['Dolci'] }, archiviato: true }).some((x) => x.a === 'menu')).toBe(false)
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
      ['Menù completato', 'menu', 'ok'],
      ['Piano completato', 'piano', 'ok'],
      ['Spesa fatta', 'spesa', 'ok'],
      ['Chi porta cosa', 'chi-porta', 'facoltativo'],
    ])
  })

  it('tutto pronto: nessuna cosa in sospeso, i problemi in ritardo passano davanti', () => {
    const pronto = indicatori({ ...base, partecipanti: { confermati: 8, inAttesa: 0, assenti: 1 }, spesa: { daComprare: 0, daVerificare: 0, avvisi: 0 } })
    expect(pronto.filter(inSospeso)).toEqual([])
    expect(pronto[0]).toMatchObject({ testo: 'Menù completato', livello: 'ok' })
    expect(pronto[1]).toMatchObject({ testo: '8 confermati, 1 non partecipa', dettaglio: 'tutti hanno risposto', livello: 'ok' })
    const ritardo = indicatori({ ...base, partecipanti: { confermati: 1, inAttesa: 1, assenti: 0 }, attivita: { daFare: 3, inRitardo: 1 } })
    expect(ritardo.map((x) => x.livello)).toEqual(['attenzione', 'da_fare', 'ok', 'facoltativo'])
    // Con il menù ancora in preparazione non è «tutto pronto».
    expect(indicatori({ ...base, menu: { voci: 3, portateVuote: ['Dolci'] }, spesa: { daComprare: 0, daVerificare: 0, avvisi: 0 } }).filter(inSospeso).map((x) => x.testo)).toEqual(['Menù in preparazione'])
  })
})

describe('nome della nuova edizione', () => {
  it('cambia l\'anno solo se compare nel nome', () => {
    expect(nomeEdizione('Natale 2026', '2026-12-25', '2027-12-25')).toBe('Natale 2027')
    expect(nomeEdizione('Pasqua dai nonni', '2026-04-05', '2027-03-28')).toBe('Pasqua dai nonni')
  })
})
