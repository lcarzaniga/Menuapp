import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { segnapostoDaSalvati } from '@/contratto/segnaposto.ts'
import { NOME_PT, segnapostoPredefiniti, type StileSegnaposto } from '@/domain/segnaposto.ts'
import { MODELLI_STAMPA } from '@/domain/stampa.ts'
import { areaNome, FogliSegnaposto, type ImpostazioniFogli } from './FogliSegnaposto'

const stile: StileSegnaposto = { modello: 'elegante', palette: 'bordeaux', caratteri: 'classica', decorazioni: true }
const imp = (extra: Partial<ImpostazioniFogli> = {}): ImpostazioniFogli => ({ formato: 'cavalletto', stile, evento: null, secondaFaccia: true, lineeTaglio: true, ...extra })
const cartoncini = (n: number, testo = 'Anna') => Array.from({ length: n }, (_, i) => ({ chiave: `c${i}`, testo: `${testo} ${i + 1}` }))

describe('segnaposto stampati', () => {
  it('cavalletto: faccia anteriore e retro capovolto con lo stesso nome; senza retro, faccia posteriore vuota', () => {
    const { container, rerender } = render(<FogliSegnaposto cartoncini={cartoncini(1)} imp={imp()} />)
    const retro = container.querySelector('[data-testid="retro-segnaposto"]')!
    expect(retro.textContent).toBe('Anna 1')
    expect(container.querySelectorAll('[data-testid="faccia-segnaposto"]')).toHaveLength(2)
    expect(container.querySelectorAll('.sp-piega')).toHaveLength(2)
    rerender(<FogliSegnaposto cartoncini={cartoncini(1)} imp={imp({ secondaFaccia: false })} />)
    expect(container.querySelector('[data-testid="retro-segnaposto"]')!.textContent).toBe('')
    expect(container.querySelectorAll('[data-testid="faccia-segnaposto"]')).toHaveLength(1)
  })

  it('piatto: una faccia, niente piega; linee di taglio solo se richieste', () => {
    const { container, rerender } = render(<FogliSegnaposto cartoncini={cartoncini(3)} imp={imp({ formato: 'piatto' })} />)
    expect(container.querySelectorAll('[data-testid="faccia-segnaposto"]')).toHaveLength(3)
    expect(container.querySelector('.sp-piega')).toBeNull()
    expect(container.querySelectorAll('.sp-taglio')).toHaveLength(3)
    rerender(<FogliSegnaposto cartoncini={cartoncini(3)} imp={imp({ formato: 'piatto', lineeTaglio: false })} />)
    expect(container.querySelector('.sp-taglio')).toBeNull()
  })

  it('più fogli A4 con i segnaposto interi: 23 piatti → 12 + 11; 13 cavalletti → 6 + 6 + 1', () => {
    const piatti = render(<FogliSegnaposto cartoncini={cartoncini(23)} imp={imp({ formato: 'piatto' })} />).container
    expect([...piatti.querySelectorAll('[data-testid="foglio-segnaposto"]')].map((f) => f.querySelectorAll('[data-testid="segnaposto"]').length)).toEqual([12, 11])
    const cavalletti = render(<FogliSegnaposto cartoncini={cartoncini(13)} imp={imp()} />).container
    expect([...cavalletti.querySelectorAll('[data-testid="foglio-segnaposto"]')].map((f) => f.querySelectorAll('[data-testid="segnaposto"]').length)).toEqual([6, 6, 1])
  })

  it('nome dell\'evento più piccolo sotto il nome; accenti e apostrofi intatti; nomi lunghi su due righe', () => {
    const { container } = render(
      <FogliSegnaposto cartoncini={[{ chiave: 'a', testo: "Nonno D'Angelo" }, { chiave: 'b', testo: 'Maria Gabriella Bartolomei Carzaniga' }]} imp={imp({ formato: 'piatto', evento: 'Natale 2026' })} />,
    )
    const facce = container.querySelectorAll('[data-testid="faccia-segnaposto"]')
    expect(facce[0]!.querySelector('.sp-nome')!.textContent).toBe("Nonno D'Angelo")
    expect(facce[0]!.querySelector('.sp-evento')!.textContent).toBe('Natale 2026')
    const pt = (el: Element) => parseFloat((el.querySelector('.sp-nome') as HTMLElement).style.fontSize)
    expect(pt(facce[0]!)).toBeGreaterThan(6.5)
    expect(pt(facce[1]!)).toBeGreaterThanOrEqual(NOME_PT.minimo)
    expect(facce[1]!.querySelector('.sp-nome')!.getAttribute('data-righe')).toBe('2')
    expect(facce[1]!.querySelector('.sp-nome')!.textContent).toBe('Maria GabriellaBartolomei Carzaniga')
  })

  it('ogni modello del menù ha la sua composizione; le zone fisse lasciano spazio al nome', () => {
    for (const modello of MODELLI_STAMPA) {
      const { container } = render(<FogliSegnaposto cartoncini={cartoncini(1)} imp={imp({ formato: 'piatto', stile: { ...stile, modello }, evento: 'Festa' })} />)
      expect(container.querySelector('[data-testid="faccia-segnaposto"]')!.getAttribute('data-modello')).toBe(modello)
      expect(container.querySelector('.sp-zona-ornamento')).not.toBeNull()
    }
    expect(areaNome(true, true)).toEqual({ larghezza: 76, altezza: 27 })
    expect(areaNome(false, false)).toEqual({ larghezza: 76, altezza: 40 })
  })

  it('opzioni salvate non più valide: tornano ai predefiniti campo per campo, nomi non validi scartati', () => {
    expect(segnapostoDaSalvati(undefined)).toBeUndefined()
    const anna = { id: 'a', testo: 'Anna', stampa: true, copie: 2 }
    const salvati = { ...segnapostoPredefiniti(), formato: 'biglietto', mostraEvento: true, nomi: [anna, { id: 'b', testo: 'Bruno', copie: 0, stampa: true }, 'x'] }
    expect(segnapostoDaSalvati(salvati)).toEqual({ ...segnapostoPredefiniti([anna]), mostraEvento: true })
  })
})
