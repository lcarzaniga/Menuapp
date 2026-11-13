import { describe, expect, it } from 'vitest'
import { inizialeRubrica, portataDelPiatto, portateDelRicettario, rubrica, SENZA_PORTATA } from './ricettario.ts'

const PREDEFINITE = ['Antipasti', 'Primi', 'Secondi', 'Contorni', 'Dolci', 'Frutta e caffè', 'Bevande']

describe('portate del ricettario', () => {
  it('le varianti importate ricadono nella portata predefinita', () => {
    expect(portataDelPiatto('Antipasti / Fritti', PREDEFINITE)).toBe('Antipasti')
    expect(portataDelPiatto('antipasto', PREDEFINITE)).toBe('Antipasti')
    expect(portataDelPiatto('Dolci al cucchiaio', PREDEFINITE)).toBe('Dolci')
    expect(portataDelPiatto('Dolce', PREDEFINITE)).toBe('Dolci')
    expect(portataDelPiatto('Secondi di pesce', PREDEFINITE)).toBe('Secondi')
    expect(portataDelPiatto('Frutta e caffe', PREDEFINITE)).toBe('Frutta e caffè')
  })
  it('le altre restano a sé; vuota → senza portata', () => {
    expect(portataDelPiatto('Piatti Unici', PREDEFINITE)).toBe('Piatti Unici')
    expect(portataDelPiatto('Primizie', PREDEFINITE)).toBe('Primizie')
    expect(portataDelPiatto('Dolcetti', PREDEFINITE)).toBe('Dolcetti')
    expect(portataDelPiatto(null, PREDEFINITE)).toBe(SENZA_PORTATA)
    expect(portataDelPiatto('  ', PREDEFINITE)).toBe(SENZA_PORTATA)
  })
  it('elenco con conteggi: predefinite nel loro ordine, poi le altre, poi senza portata', () => {
    const piatti = ['Secondi', 'Condimenti', null, 'Antipasti', 'Antipasti / Fritti', 'Piatti Unici', 'piatti unici', 'Dolci al cucchiaio'].map((portataSuggerita) => ({ portataSuggerita }))
    expect(portateDelRicettario(piatti, PREDEFINITE)).toEqual([
      { nome: 'Antipasti', numero: 2 },
      { nome: 'Secondi', numero: 1 },
      { nome: 'Dolci', numero: 1 },
      { nome: 'Condimenti', numero: 1 },
      { nome: 'Piatti Unici', numero: 2 },
      { nome: SENZA_PORTATA, numero: 1 },
    ])
  })
})

describe('rubrica alfabetica', () => {
  it('iniziale senza accenti; numeri e simboli sotto #', () => {
    expect(inizialeRubrica('Èclair')).toBe('E')
    expect(inizialeRubrica('«Zuppa» inglese')).toBe('Z')
    expect(inizialeRubrica('3 salse')).toBe('#')
    expect(inizialeRubrica('')).toBe('#')
  })
  it('ordine alfabetico italiano, gruppi per lettera, # in fondo', () => {
    const g = rubrica(['risotto', 'Baccalà mantecato', '10 tartine', 'Baccalà con cipolle', 'Àcciughe', 'Rosti'].map((nome) => ({ nome })))
    expect(g.map((x) => [x.lettera, x.piatti.map((p) => p.nome)])).toEqual([
      ['A', ['Àcciughe']],
      ['B', ['Baccalà con cipolle', 'Baccalà mantecato']],
      ['R', ['risotto', 'Rosti']],
      ['#', ['10 tartine']],
    ])
  })
})
