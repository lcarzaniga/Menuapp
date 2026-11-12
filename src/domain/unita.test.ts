import { describe, expect, it } from 'vitest'
import { aggiungiGiorni, dataLunga, differenzaGiorni, isDataISO, sottraiMinuti } from './tempo.ts'
import { norm } from './testo.ts'
import { CODICI_UNITA, chiaveFamiglia, converti, formattaQuantita, riconosciUnita } from './unita.ts'

describe('unità (SPEC §8.1–8.2)', () => {
  it('riconosce le forme italiane', () => {
    expect(riconosciUnita('gr')).toBe('g')
    expect(riconosciUnita('etti')).toBe('hg')
    expect(riconosciUnita('Litri')).toBe('l')
    expect(riconosciUnita('cucchiai')).toBe('cucchiaio')
    expect(riconosciUnita('spicchi')).toBe('spicchio')
    expect(riconosciUnita('conf.')).toBe('confezione')
    expect(riconosciUnita('q.b.')).toBe('qb')
    expect(riconosciUnita('farina')).toBeNull()
  })
  it('conversioni sicure solo dentro massa e volume', () => {
    expect(converti(1, 'kg', 'g')).toBe(1000)
    expect(converti(2, 'hg', 'g')).toBe(200)
    expect(converti(3, 'dl', 'ml')).toBe(300)
    expect(converti(5, 'cl', 'l')).toBe(0.05)
  })
  it('conversioni vietate non esistono', () => {
    expect(converti(1, 'cucchiaio', 'ml')).toBeNull()
    expect(converti(1, 'confezione', 'g')).toBeNull()
    expect(converti(1, 'g', 'ml')).toBeNull()
    expect(converti(1, 'spicchio', 'pz')).toBeNull()
    expect(converti(1, 'scatola', 'vasetto')).toBeNull()
    for (const a of CODICI_UNITA) for (const b of CODICI_UNITA) {
      const r = converti(1, a, b)
      if (r !== null && a !== b) expect(['massa', 'volume']).toContain(chiaveFamiglia(a))
    }
  })
  it('formattazione per cucina e spesa', () => {
    expect(formattaQuantita(1500, 'g', 'spesa').testo).toBe('1,5 kg')
    expect(formattaQuantita(333.3, 'g', 'spesa').testo).toBe('335 g')
    expect(formattaQuantita(333.3, 'g', 'cucina').testo).toBe('333 g')
    expect(formattaQuantita(2.5, 'cl', 'cucina').testo).toBe('25 ml')
    expect(formattaQuantita(0.5, null, 'cucina').testo).toBe('½')
    expect(formattaQuantita(4.4, null, 'spesa').testo).toBe('5')
    expect(formattaQuantita(1.5, 'cucchiaio', 'cucina').testo).toBe('1½ cucchiai')
    expect(formattaQuantita(1, 'spicchio', 'cucina').testo).toBe('1 spicchio')
    expect(formattaQuantita(null, 'qb', 'spesa').testo).toBe('q.b.')
  })
})

describe('date e testi', () => {
  it('date di calendario', () => {
    expect(isDataISO('2026-02-29')).toBe(false)
    expect(isDataISO('2028-02-29')).toBe(true)
    expect(aggiungiGiorni('2026-12-25', -2)).toBe('2026-12-23')
    expect(aggiungiGiorni('2026-12-31', 1)).toBe('2027-01-01')
    expect(differenzaGiorni('2026-12-23', '2026-12-25')).toBe(2)
    expect(sottraiMinuti('2026-12-25', '00:30', 60)).toEqual({ data: '2026-12-24', ora: '23:30' })
    expect(dataLunga('2026-12-25')).toBe('venerdì 25 dicembre 2026')
  })
  it('normalizzazione', () => {
    expect(norm('  Caffè   Espresso ')).toBe('caffe espresso')
    expect(norm('Pomodori’ San Marzano')).toBe("pomodori' san marzano")
  })
})
