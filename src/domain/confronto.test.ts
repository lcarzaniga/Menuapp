import { describe, expect, it } from 'vitest'
import { confrontaMenu, type VoceConfronto } from './confronto.ts'

const v = (id: string, nome: string, identita: string | null, origine: string | null = null): VoceConfronto => ({ id, nome, portata: 'Primi', identita, origine })

describe('confronto fra edizioni (SPEC §27)', () => {
  it('mantenuti per ricetta d\'origine, anche se il nome è cambiato; aggiunti e non riproposti', () => {
    const e = confrontaMenu([v('a1', 'Lasagne della nonna', 'r-lasagne'), v('a2', 'Risotto', 'r-risotto')], [v('b1', 'Lasagne', 'r-lasagne'), v('b2', 'Cannelloni', 'r-cannelloni')])
    expect(e.mantenuti.map((m) => [m.ora.id, m.prima.id, m.corrispondenza])).toEqual([['a1', 'b1', 'certa']])
    expect(e.aggiunti.map((x) => [x.id, x.omonimo])).toEqual([['a2', false]])
    expect(e.nonRiproposti.map((x) => [x.id, x.omonimo])).toEqual([['b2', false]])
  })

  it('stesso nome ma ricette diverse: due piatti distinti, segnalati come omonimi', () => {
    const e = confrontaMenu([v('a1', 'Tiramisù', 'r-nuovo')], [v('b1', 'tiramisu', 'r-vecchio')])
    expect(e.mantenuti).toEqual([])
    expect(e.aggiunti).toMatchObject([{ id: 'a1', omonimo: true }])
    expect(e.nonRiproposti).toMatchObject([{ id: 'b1', omonimo: true }])
  })

  it('senza ricetta lo stesso nome dà una corrispondenza incerta; una sola volta per voce', () => {
    const e = confrontaMenu([v('a1', 'Pane', null), v('a2', 'Pane', null)], [v('b1', 'pane', null)])
    expect(e.mantenuti).toMatchObject([{ ora: { id: 'a1' }, prima: { id: 'b1' }, corrispondenza: 'incerta' }])
    expect(e.aggiunti.map((x) => x.id)).toEqual(['a2'])
    expect(confrontaMenu([v('a1', 'Arrosto', 'r1')], [v('b1', 'Arrosto', null)]).mantenuti[0]!.corrispondenza).toBe('incerta')
  })

  it('una voce copiata duplicando l\'evento è lo stesso piatto, anche senza ricetta; non se la ricetta è stata sostituita', () => {
    expect(confrontaMenu([v('a1', 'Tortellini in brodo', null, 'b1')], [v('b1', 'Tortellini in brodo', null)]).mantenuti[0]!.corrispondenza).toBe('certa')
    expect(confrontaMenu([v('a1', 'Brodo di cappone', null, 'b1')], [v('b1', 'Tortellini in brodo', null)]).mantenuti).toHaveLength(1)
    const sostituita = confrontaMenu([v('a1', 'Tiramisù', 'r-nuovo', 'b1')], [v('b1', 'Tiramisù', 'r-vecchio')])
    expect(sostituita.mantenuti).toEqual([])
    expect(sostituita.aggiunti).toMatchObject([{ omonimo: true }])
  })
})
