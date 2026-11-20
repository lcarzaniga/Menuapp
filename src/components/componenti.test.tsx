import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { partiData } from '@/domain/tempo.ts'
import { BloccoData } from './BloccoData'
import { Badge } from './ui/badge'

describe('blocco data', () => {
  it('giorno, numero e mese in italiano; data completa per chi usa un lettore di schermo', () => {
    expect(partiData('2030-12-24')).toEqual({ giorno: 'mar', numero: 24, mese: 'dic' })
    expect(partiData('2026-12-24')).toEqual({ giorno: 'gio', numero: 24, mese: 'dic' })
    expect(partiData('24/12/2026')).toBeNull()
    const { container } = render(<BloccoData data="2026-12-24" evidenza />)
    const t = container.querySelector('time')!
    expect(t.getAttribute('datetime')).toBe('2026-12-24')
    expect(t.getAttribute('aria-label')).toBe('giovedì 24 dicembre 2026')
    expect(t.textContent).toBe('gio24dic')
    expect(t.className).toContain('bg-oro-medio')
    expect(t.querySelector('.text-accento-caldo')!.textContent).toBe('24')
    expect(render(<BloccoData data="2026-12-25" />).container.querySelector('time')!.className).toContain('bg-oro-tenue')
    expect(render(<BloccoData data="non una data" />).container.innerHTML).toBe('')
  })
})

describe('badge del conto alla rovescia', () => {
  it('nelle tonalità dell\'oro', () => {
    const { container } = render(<Badge variante="tempo">tra 35 giorni</Badge>)
    expect(container.firstElementChild!.className).toContain('bg-oro-tenue')
    expect(container.firstElementChild!.className).toContain('text-oro-forte')
  })
})
