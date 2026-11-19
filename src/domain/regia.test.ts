import { describe, expect, it } from 'vitest'
import { attrezzatureRicetta, fasiRegia, minutiRicetta, oraInizioSuggerita } from './regia.ts'

const a = (titolo: string, data: string, ora: string | null, stato: 'da_fare' | 'fatto' = 'da_fare') => ({ titolo, data, ora, stato })

describe('regia della cucina', () => {
  it('fasi: in ritardo, adesso (oggi senza ora o entro un\'ora), più tardi, fatte; in ordine di tempo', () => {
    const f = fasiRegia(
      [
        a('Tavola', '2030-12-24', '19:00'),
        a('Ragù', '2030-12-23', null),
        a('Brodo', '2030-12-24', '11:00'),
        a('Antipasti', '2030-12-24', '12:45'),
        a('Spesa del pane', '2030-12-24', null),
        a('Dolce', '2030-12-25', '09:00'),
        a('Lasagne', '2030-12-24', '10:00', 'fatto'),
      ],
      { data: '2030-12-24', ora: '12:00' },
    )
    const titoli = (l: { titolo: string }[]) => l.map((x) => x.titolo)
    expect(titoli(f.inRitardo)).toEqual(['Ragù', 'Brodo'])
    expect(titoli(f.adesso)).toEqual(['Spesa del pane', 'Antipasti'])
    expect(titoli(f.piuTardi)).toEqual(['Tavola', 'Dolce'])
    expect(titoli(f.fatte)).toEqual(['Lasagne'])
  })

  it('la finestra di «adesso» passa la mezzanotte senza errori', () => {
    expect(fasiRegia([a('Brindisi', '2030-12-31', '23:50')], { data: '2030-12-31', ora: '23:30' }).adesso).toHaveLength(1)
  })

  it('attrezzature dal testo della ricetta: un\'indicazione, non un dato certo', () => {
    expect(attrezzatureRicetta(['teglia', 'carta da forno'], ['Cuocere a 180 °C'])).toEqual(['forno'])
    expect(attrezzatureRicetta([], ['Rosolare in padella', 'Lasciare in frigo una notte'])).toEqual(['fornelli', 'frigo'])
    expect(attrezzatureRicetta(['ciotola'], ['Mescolare'])).toEqual([])
  })

  it('ora di inizio suggerita: al quarto d\'ora prima, solo con i dati e nello stesso giorno', () => {
    expect(minutiRicetta({ preparazione: 30, cottura: 50, riposo: null })).toBe(80)
    expect(minutiRicetta({ preparazione: null, cottura: null, riposo: null })).toBeNull()
    expect(oraInizioSuggerita('2030-12-24', '13:00', 80)).toBe('11:30')
    expect(oraInizioSuggerita('2030-12-24', '13:00', 70)).toBe('11:45')
    expect(oraInizioSuggerita('2030-12-24', null, 80)).toBeNull()
    expect(oraInizioSuggerita('2030-12-24', '01:00', 120)).toBeNull()
  })
})
