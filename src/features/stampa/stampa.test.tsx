import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SchemaOpzioniStampa, opzioniDaSalvate } from '@/contratto/stampa.ts'
import type { Menu } from '@/contratto/eventi.ts'
import { conModello, MODELLI, MODELLI_STAMPA, opzioniPredefinite } from '@/domain/stampa.ts'
import { FogliMenu, tuttoInUnaPagina } from './FogliMenu'
import { contenutoDa, impagina, type MisuraBlocco, scegliLivello } from './impaginazione'

const voce = (id: string, nome: string, note = '') => ({ id, nome, note, eventoId: 'e', portataId: 'p', ordine: 0, piattoId: null, porzioni: null, incaricato: '', inSpesa: true, versione: 1, creatoIl: 0, aggiornatoIl: 0, piattoNome: null, porzioniEffettive: 8 })
const menu = {
  evento: { id: 'e', nome: 'Natale 2026', data: '2026-12-25', occasione: 'Natale' },
  copertiEquivalenti: 8,
  portate: [
    { id: 'a', nome: 'Antipasti', ordine: 0, voci: [voce('v1', 'Crostini', 'Con fegatini'), voce('v2', 'Salmone')] },
    { id: 'p', nome: 'Primi', ordine: 1, voci: [] },
    { id: 'd', nome: 'Dolci', ordine: 2, voci: [voce('v3', 'Tiramisù')] },
  ],
} as unknown as Menu

describe('contenuto del menù stampato', () => {
  const base = opzioniPredefinite({ occasione: 'Natale', nome: 'Natale 2026' })
  it('titolo dall\'evento, portate vuote nascoste, note solo se richieste', () => {
    const c = contenutoDa(menu, base)
    expect(c.titolo).toBe('Natale 2026')
    expect(c.data).toBe('venerdì 25 dicembre 2026')
    expect(c.portate.map((p) => p.nome)).toEqual(['Antipasti', 'Dolci'])
    expect(c.portate[0]!.voci[0]!.nota).toBe('')
    const tutto = contenutoDa(menu, { ...base, titolo: '  ', nascondiPortateVuote: false, mostraNote: true, mostraData: false })
    expect(tutto.titolo).toBe('Natale 2026')
    expect(tutto.data).toBeNull()
    expect(tutto.portate).toHaveLength(3)
    expect(tutto.portate[0]!.voci[0]!.nota).toBe('Con fegatini')
  })
  it('cambio di modello: palette e caratteri coordinati', () => {
    expect(conModello(base, 'minimal')).toMatchObject({ modello: 'minimal', palette: MODELLI.minimal.palette, caratteri: MODELLI.minimal.caratteri })
  })
  it('validazione e recupero delle opzioni salvate', () => {
    expect(SchemaOpzioniStampa.safeParse(base).success).toBe(true)
    expect(SchemaOpzioniStampa.safeParse({ ...base, formato: 'A3' }).success).toBe(false)
    expect(opzioniDaSalvate({ ...base, caratteri: 'comic', nota: 'Ciao' }, base)).toEqual({ ...base, nota: 'Ciao' })
    expect(opzioniDaSalvate(null, base)).toEqual(base)
  })
})

describe('impaginazione', () => {
  const blocco = (chiave: string, alto: number, basso: number, voci?: number[]): MisuraBlocco => ({
    chiave,
    alto,
    basso,
    ...(voci ? { voci: voci.map((y) => ({ alto: y, basso: y + 20 })) } : {}),
  })
  it('tutto in una pagina quando c\'è posto', () => {
    expect(impagina([blocco('testata', 0, 100), blocco('portata:a', 120, 220), blocco('nota', 240, 260)], 1000)).toEqual([[{ chiave: 'testata' }, { chiave: 'portata:a' }, { chiave: 'nota' }]])
  })
  it('i blocchi passano alla pagina successiva senza spezzarsi', () => {
    const p = impagina([blocco('testata', 0, 300), blocco('portata:a', 320, 380), blocco('portata:b', 400, 700)], 500)
    expect(p).toEqual([[{ chiave: 'testata' }, { chiave: 'portata:a' }], [{ chiave: 'portata:b' }]])
  })
  it('una portata più lunga di una pagina si divide fra le voci, senza voci isolate', () => {
    const voci = Array.from({ length: 10 }, (_, i) => 30 + i * 30) // titolo 30, voci da 20 ogni 30
    const p = impagina([blocco('portata:a', 0, 320, voci)], 200)
    expect(p.length).toBeGreaterThan(1)
    const intervalli = p.flat()
    expect(intervalli[0]).toMatchObject({ chiave: 'portata:a', da: 0 })
    expect(intervalli.slice(1).every((z) => z.segue)).toBe(true)
    // Copre tutte le voci esattamente una volta, mai una sola voce per pezzo.
    expect(intervalli.at(-1)!.a).toBe(10)
    for (let i = 1; i < intervalli.length; i++) expect(intervalli[i]!.da).toBe(intervalli[i - 1]!.a)
    expect(intervalli.every((z) => z.a! - z.da! >= 2)).toBe(true)
  })
  it('senza misure (capienza zero) resta una pagina', () => {
    expect(impagina([blocco('testata', 0, 0)], 0)).toEqual([[{ chiave: 'testata' }]])
  })
  it('sceglie il livello più arioso col minor numero di pagine', () => {
    expect(scegliLivello([[[], [], []], [[], []], [[], []], [[]], [[]]])).toBe(3)
    expect(scegliLivello([[[]], [[]]])).toBe(0)
  })
})

describe('i cinque modelli', () => {
  for (const m of MODELLI_STAMPA) {
    it(`${m}: layout proprio, testi, decorazioni attivabili`, () => {
      const o = { ...conModello(opzioniPredefinite({ occasione: '', nome: '' }), m), nota: 'Buon appetito', sottotitolo: 'Casa Rossi' }
      const c = contenutoDa(menu, o)
      const { container, rerender } = render(<FogliMenu contenuto={c} opzioni={o} impaginazione={tuttoInUnaPagina(c)} />)
      const pagina = container.querySelector('.menu-pagina')!
      expect(pagina.getAttribute('data-modello')).toBe(m)
      expect(container.querySelector('.menu-titolo')!.textContent).toBe('Natale 2026')
      expect(container.textContent).toContain('Casa Rossi')
      expect(container.textContent).toContain('Tiramisù')
      expect(container.textContent).toContain('Buon appetito')
      expect(container.querySelectorAll('.menu-portata')).toHaveLength(2)
      const ornamenti = container.querySelectorAll('svg, .menu-cornice, .menu-verticale').length
      expect(ornamenti).toBeGreaterThan(0)
      rerender(<FogliMenu contenuto={c} opzioni={{ ...o, decorazioni: false }} impaginazione={tuttoInUnaPagina(c)} />)
      expect(container.querySelectorAll('svg, .menu-cornice, .menu-verticale').length).toBeLessThan(ornamenti)
    })
  }
  it('2 × A5: due copie per foglio con i segni di taglio', () => {
    const o = { ...opzioniPredefinite({ occasione: '', nome: '' }), formato: 'A5x2' as const }
    const c = contenutoDa(menu, o)
    const { container } = render(<FogliMenu contenuto={c} opzioni={o} impaginazione={tuttoInUnaPagina(c)} />)
    const foglio = container.querySelector<HTMLElement>('.menu-foglio')!
    expect(foglio.style.width).toBe('297mm')
    expect(foglio.style.height).toBe('210mm')
    expect(foglio.querySelectorAll('.menu-pagina')).toHaveLength(2)
    expect(foglio.querySelectorAll('.menu-taglio')).toHaveLength(2)
  })
  it('A4 e A5: misure fisiche del foglio', () => {
    for (const [formato, w, h] of [['A4', '210mm', '297mm'], ['A5', '148mm', '210mm']] as const) {
      const o = { ...opzioniPredefinite({ occasione: '', nome: '' }), formato }
      const c = contenutoDa(menu, o)
      const { container, unmount } = render(<FogliMenu contenuto={c} opzioni={o} impaginazione={tuttoInUnaPagina(c)} />)
      const foglio = container.querySelector<HTMLElement>('.menu-foglio')!
      expect([foglio.style.width, foglio.style.height]).toEqual([w, h])
      unmount()
    }
  })
})
