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
  passato: false,
}
const spesa = (x: Partial<NonNullable<RiepilogoOrganizzativo['spesa']>> = {}) => ({ articoli: 10, daComprare: 0, daVerificare: 0, avvisi: 0, senzaRicetta: [], senzaIngredienti: [], ...x })
const attivita = (x: Partial<NonNullable<RiepilogoOrganizzativo['attivita']>> = {}) => ({ daFare: 0, inRitardo: 0, prossima: null, ...x })
const voci = (l: ReturnType<typeof indicatori>) => l.map((x) => [x.testo, x.livello, x.gruppo, x.a])

describe('a che punto siamo: indicatori', () => {
  it('evento senza funzioni collaborative: menù completato, le parti facoltative non usate, nessun allarme', () => {
    const l = indicatori(base)
    expect(l.filter(inSospeso)).toEqual([])
    expect(l.filter((x) => x.livello === 'ok').map((x) => [x.testo, x.dettaglio, x.a])).toEqual([['Menù completato', '5 piatti', 'menu']])
    expect(l.filter((x) => x.livello === 'facoltativo').map((x) => [x.a, x.gruppo])).toEqual([
      ['partecipanti', 'organizzare'],
      ['chi-porta', 'organizzare'],
      ['piano', 'preparare'],
      ['spesa', 'acquistare'],
    ])
  })

  it('menù vuoto e coperti a zero sono aperti, come il menù in preparazione; un archiviato non ha cose da fare', () => {
    const vuoto = indicatori({ ...base, menu: { voci: 0, portateVuote: ['Primi', 'Dolci'] }, coperti: { equivalenti: 0, adulti: 0, bambini: 0, automatici: false } })
    expect(voci(vuoto.filter(inSospeso))).toEqual([
      ['Menù ancora vuoto', 'da_fare', 'organizzare', 'menu'],
      ['Coperti non indicati', 'da_fare', 'organizzare', 'partecipanti'],
    ])
    // Senza menù «Chi porta» non si propone.
    expect(vuoto.some((x) => x.a === 'chi-porta')).toBe(false)
    expect(indicatori({ ...base, menu: { voci: 0, portateVuote: ['Primi'] }, archiviato: true }).filter(inSospeso)).toEqual([])
  })

  it('menù in preparazione: qualche piatto ma portate ancora vuote; nessun minimo di portate', () => {
    const l = indicatori({ ...base, menu: { voci: 2, portateVuote: ['Contorni', 'Dolci'] } })
    expect(l.filter(inSospeso)).toEqual([
      { testo: 'Menù in preparazione', dettaglio: 'ancora senza piatti: Contorni, Dolci · se non servono, toglile dalle portate', livello: 'da_fare', gruppo: 'organizzare', a: 'menu' },
    ])
    expect(indicatori({ ...base, menu: { voci: 1, portateVuote: [] } }).find((x) => x.a === 'menu')).toMatchObject({ testo: 'Menù completato', dettaglio: '1 piatto', livello: 'ok' })
    expect(indicatori({ ...base, menu: { voci: 2, portateVuote: ['Dolci'] }, archiviato: true }).some((x) => x.a === 'menu')).toBe(false)
  })

  it('chi porta: responsabili assenti da risolvere, cose senza nessuno aperte; piatti non affidati solo suggerimenti', () => {
    const l = indicatori({ ...base, incarichi: { coseSenzaResponsabile: 1, daCompletare: 0, piattiNonAffidati: 3, contributiSenzaResponsabile: 0, responsabiliAssenti: 1 } })
    expect(l.filter(inSospeso).map((x) => [x.testo, x.livello])).toEqual([
      ['1 incarico di chi non partecipa', 'attenzione'],
      ['1 cosa da portare senza nessuno', 'da_fare'],
    ])
    expect(l.find((x) => x.testo === '3 piatti non affidati')).toMatchObject({ livello: 'nota', a: 'chi-porta' })
    expect(indicatori({ ...base, incarichi: { coseSenzaResponsabile: 0, daCompletare: 0, piattiNonAffidati: 1, contributiSenzaResponsabile: 0, responsabiliAssenti: 0 } }).find((x) => x.livello === 'nota')?.testo).toBe('1 piatto non affidato')
  })

  it('da acquistare: da verificare da risolvere, da comprare aperto; piatti senza ricetta o ingredienti solo suggerimenti', () => {
    const l = indicatori({ ...base, spesa: spesa({ daComprare: 4, daVerificare: 1, avvisi: 3, senzaRicetta: ['Pane', 'Gelato'], senzaIngredienti: ['Tiramisù'] }) })
    expect(voci(l.filter((x) => x.gruppo === 'acquistare'))).toEqual([
      ['1 articolo da verificare', 'attenzione', 'acquistare', 'spesa'],
      ['4 articoli da comprare', 'da_fare', 'acquistare', 'spesa'],
      ['2 piatti senza ricetta: Pane, Gelato', 'nota', 'acquistare', 'menu'],
      ['Una ricetta senza ingredienti: Tiramisù', 'nota', 'acquistare', 'menu'],
    ])
    // Una scelta intenzionale non tiene l'evento «non pronto».
    expect(indicatori({ ...base, spesa: spesa({ articoli: 0, avvisi: 1, senzaRicetta: ['Pane'] }) }).filter(inSospeso)).toEqual([])
    // «Spesa fatta» solo se c'era una lista.
    expect(indicatori({ ...base, spesa: spesa({ articoli: 0, avvisi: 1, senzaRicetta: ['Pane'] }) }).some((x) => x.testo === 'Spesa fatta')).toBe(false)
    expect(indicatori({ ...base, spesa: spesa() }).find((x) => x.testo === 'Spesa fatta')).toMatchObject({ livello: 'ok' })
  })

  it('da preparare: in ritardo da risolvere, le altre aperte con la prossima; piano completato', () => {
    const l = indicatori({ ...base, attivita: attivita({ daFare: 3, inRitardo: 1, prossima: { titolo: 'Preparare il ragù', data: '2030-12-24', ora: '10:00' } }) })
    expect(voci(l.filter((x) => x.gruppo === 'preparare' && inSospeso(x)))).toEqual([
      ['1 attività in ritardo', 'attenzione', 'preparare', 'piano'],
      ['2 attività da fare', 'da_fare', 'preparare', 'piano'],
    ])
    expect(l.find((x) => x.testo === '2 attività da fare')?.dettaglio).toBe('prossima: Preparare il ragù, 24/12 alle 10:00')
    expect(indicatori({ ...base, attivita: attivita() }).find((x) => x.a === 'piano')).toMatchObject({ testo: 'Piano completato', livello: 'ok' })
  })

  it('prima ciò che è da risolvere, poi ciò che è aperto (le conferme per prime), poi ciò che è a posto', () => {
    const l = indicatori({
      ...base,
      partecipanti: { confermati: 5, inAttesa: 2, assenti: 1 },
      attivita: attivita(),
      proposte: { inAttesa: 1 },
      sondaggi: { aperti: 2 },
      spesa: spesa(),
    })
    expect(l.map((x) => [x.testo, x.a, x.livello])).toEqual([
      ['2 in attesa di conferma', 'partecipanti', 'da_fare'],
      ['1 proposta da decidere', 'bacheca', 'da_fare'],
      ['2 sondaggi aperti', 'bacheca', 'da_fare'],
      ['Menù completato', 'menu', 'ok'],
      ['Spesa fatta', 'spesa', 'ok'],
      ['Piano completato', 'piano', 'ok'],
      ['Chi porta cosa', 'chi-porta', 'facoltativo'],
    ])
  })

  it('piatti a scelta: senza nessuno sono aperti, con qualcuno non contano', () => {
    const l = indicatori({ ...base, incarichi: { coseSenzaResponsabile: 0, daCompletare: 0, piattiNonAffidati: 0, contributiSenzaResponsabile: 2, responsabiliAssenti: 0 } })
    expect(l.filter(inSospeso).map((x) => [x.testo, x.livello, x.a])).toEqual([['2 piatti a scelta senza nessuno', 'da_fare', 'chi-porta']])
    expect(l.some((x) => x.testo === 'Incarichi completati')).toBe(false)
  })

  it('tutto pronto: nessuna cosa in sospeso', () => {
    const pronto = indicatori({ ...base, partecipanti: { confermati: 8, inAttesa: 0, assenti: 1 }, spesa: spesa() })
    expect(pronto.filter(inSospeso)).toEqual([])
    expect(indicatori({ ...base, menu: { voci: 3, portateVuote: ['Dolci'] }, spesa: spesa() }).filter(inSospeso).map((x) => x.testo)).toEqual(['Menù in preparazione'])
  })
})

describe('nome della nuova edizione', () => {
  it('cambia l\'anno solo se compare nel nome', () => {
    expect(nomeEdizione('Natale 2026', '2026-12-25', '2027-12-25')).toBe('Natale 2027')
    expect(nomeEdizione('Pasqua dai nonni', '2026-04-05', '2027-03-28')).toBe('Pasqua dai nonni')
  })
})
