import { describe, expect, it } from 'vitest'
import {
  aggiungiNomi,
  cartonciniDa,
  chiaveNome,
  dueRighe,
  fogliDi,
  griglia,
  MARGINE_MINIMO,
  misuraNome,
  NOME_PT,
  nomiDaPartecipanti,
  type NomeSegnaposto,
  segnapostoPredefiniti,
  spostaNome,
} from './segnaposto.ts'

let contatore = 0
const nuovoId = () => `id-${++contatore}`
const n = (id: string, testo: string, extra: Partial<NomeSegnaposto> = {}): NomeSegnaposto => ({ id, testo, stampa: true, copie: 1, ...extra })

describe('nomi dei segnaposto', () => {
  it('dai partecipanti: titolari e accompagnatori con nome, non gli assenti, senza doppioni', () => {
    const inviti = [
      { nome: 'Nonna Lù', stato: 'confermato', accompagnatori: [{ nome: "Nonno D'Angelo", stato: 'in_attesa' }, { nome: 'Leo', stato: 'assente' }] },
      { nome: 'Zio Piero', stato: 'assente', accompagnatori: [] },
      { nome: '  nonna lu ', stato: 'confermato', accompagnatori: [] },
      { nome: 'Élise', stato: 'confermato', accompagnatori: [] },
    ]
    expect(nomiDaPartecipanti(inviti)).toEqual(['Nonna Lù', "Nonno D'Angelo", 'Élise'])
    expect(nomiDaPartecipanti([])).toEqual([])
  })

  it('aggiunta senza doppioni (maiuscole, accenti, spazi), anche importando di nuovo', () => {
    const elenco = [n('a', 'Nonna Lù')]
    const r = aggiungiNomi(elenco, ['nonna lu', '  Élise  ', '', 'elise', 'Zia  Ada'], nuovoId)
    expect(r.aggiunti).toBe(2)
    expect(r.nomi.map((x) => x.testo)).toEqual(['Nonna Lù', 'Élise', 'Zia  Ada'])
    expect(r.nomi[1]).toMatchObject({ stampa: true, copie: 1 })
    expect(aggiungiNomi(r.nomi, ['Élise', 'zia ada'], nuovoId).aggiunti).toBe(0)
    expect(chiaveNome(" D'Àngelo  Rossi ")).toBe("d'angelo rossi")
    // Nomi troppo lunghi: tagliati al limite.
    expect(aggiungiNomi([], ['x'.repeat(80)], nuovoId).nomi[0]!.testo).toHaveLength(60)
  })

  it('riordino, selezione e copie', () => {
    const nomi = [n('a', 'Anna'), n('b', 'Bruno', { copie: 3 }), n('c', 'Carla', { stampa: false }), n('d', '   ')]
    expect(spostaNome(nomi, 'b', -1).map((x) => x.id)).toEqual(['b', 'a', 'c', 'd'])
    expect(spostaNome(nomi, 'a', -1)).toBe(nomi)
    expect(spostaNome(nomi, 'd', 1)).toBe(nomi)
    expect(cartonciniDa(nomi).map((c) => c.testo)).toEqual(['Anna', 'Bruno', 'Bruno', 'Bruno'])
    expect(new Set(cartonciniDa(nomi).map((c) => c.chiave)).size).toBe(4)
  })

  it('predefiniti: cavalletto con seconda faccia e linee di taglio, nome dell\'evento spento, stile del menù', () => {
    expect(segnapostoPredefiniti()).toEqual({ formato: 'cavalletto', nomi: [], secondaFaccia: true, mostraEvento: false, testoEvento: null, lineeTaglio: true, stile: null })
  })
})

describe('impaginazione su A4', () => {
  it('piatto 90 × 50: 2 colonne per 5 righe, centrati e dentro i margini', () => {
    const g = griglia('piatto')
    expect(g).toMatchObject({ larghezza: 90, altezza: 50, colonne: 2, righe: 5, perFoglio: 10 })
    expect(g.margineX).toBe(15)
    expect(g.margineY).toBe(23.5)
  })
  it('cavalletto 90 × 100 (due facce): 2 per 2, piega a metà', () => {
    const g = griglia('cavalletto')
    expect(g).toMatchObject({ larghezza: 90, altezza: 100, colonne: 2, righe: 2, perFoglio: 4 })
    expect(Math.min(g.margineX, g.margineY)).toBeGreaterThanOrEqual(MARGINE_MINIMO)
  })
  it('più fogli: segnaposto interi, nell\'ordine', () => {
    const c = Array.from({ length: 23 }, (_, i) => i)
    expect(fogliDi(c, 'piatto').map((f) => f.length)).toEqual([10, 10, 3])
    expect(fogliDi(c, 'cavalletto').map((f) => f.length)).toEqual([4, 4, 4, 4, 4, 3])
    expect(fogliDi(c, 'cavalletto').flat()).toEqual(c)
    expect(fogliDi([], 'piatto')).toEqual([])
  })
})

describe('dimensione del nome', () => {
  const area = { larghezza: 76, altezza: 20 }
  it('nomi brevi al corpo massimo, lunghi più piccoli; mai sotto il minimo', () => {
    expect(misuraNome('Leo', 'classica', area.larghezza, area.altezza).pt).toBeLessThanOrEqual(NOME_PT.massimo)
    const breve = misuraNome('Anna', 'classica', area.larghezza, area.altezza)
    const medio = misuraNome('Mariagabriella', 'classica', area.larghezza, area.altezza)
    expect(medio.pt).toBeLessThan(breve.pt)
    expect(medio.righe).toBe(1)
    const lunghissimo = misuraNome('Supercalifragilistichespiralidoso-Bartolomei', 'classica', area.larghezza, area.altezza)
    expect(lunghissimo).toMatchObject({ righe: 1, pt: NOME_PT.minimo })
  })
  it('nome e cognome lunghi: due righe bilanciate', () => {
    const m = misuraNome('Maria Gabriella Bartolomei Carzaniga', 'classica', area.larghezza, area.altezza)
    expect(m.righe).toBe(2)
    expect(m.pt).toBeGreaterThanOrEqual(NOME_PT.minimoUnaRiga)
    expect(dueRighe('Maria Gabriella Bartolomei Carzaniga'.split(' '))).toEqual(['Maria Gabriella', 'Bartolomei Carzaniga'])
  })
  it('due parole lunghe: su due righe se così il nome viene molto più grande', () => {
    expect(misuraNome('Massimiliano Ferdinando', 'classica', 76, 27)).toMatchObject({ righe: 2 })
    expect(misuraNome("Nonno D'Angelo", 'classica', 76, 27)).toMatchObject({ righe: 1 })
  })
  it('la calligrafia è più grande a parità di spazio, quindi rimpicciolisce prima', () => {
    expect(misuraNome('Mariagabriella', 'calligrafica', 76, 20).pt).toBeLessThan(misuraNome('Mariagabriella', 'garamond', 76, 20).pt)
  })
  it('l\'altezza disponibile limita il corpo', () => {
    expect(misuraNome('Leo', 'classica', 76, 8).pt).toBeLessThan(misuraNome('Leo', 'classica', 76, 20).pt)
  })
})
