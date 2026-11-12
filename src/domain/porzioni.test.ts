import { describe, expect, it } from 'vitest'
import { copertiEquivalenti, fattoreAnomalo, fattoreScalatura, porzioniEffettive, quasiUguali, scala } from './porzioni.ts'
import { daConcludere, nomeSuggerito, statoDopo } from './regole/evento.ts'

describe('porzioni (SPEC §7.1, §16)', () => {
  it('8 adulti, 4 bambini, coefficiente 0,5 → 10; con 6 bambini → 11', () => {
    expect(copertiEquivalenti({ adulti: 8, bambini: 4, coefficienteBambini: 0.5 })).toBe(10)
    expect(copertiEquivalenti({ adulti: 8, bambini: 6, coefficienteBambini: 0.5 })).toBe(11)
  })
  it('decimali senza rumore della virgola mobile', () => {
    expect(copertiEquivalenti({ adulti: 1, bambini: 3, coefficienteBambini: 0.35 })).toBe(2.05)
    expect(copertiEquivalenti({ adulti: 0, bambini: 0, coefficienteBambini: 0.5 })).toBe(0)
  })
  it('porzioni proprie o coperti', () => {
    expect(porzioniEffettive({ porzioni: null }, 10)).toBe(10)
    expect(porzioniEffettive({ porzioni: 6 }, 10)).toBe(6)
  })
  it('fattore e scalatura', () => {
    expect(fattoreScalatura(10, 4)).toBe(2.5)
    expect(fattoreScalatura(10, null)).toBeNull()
    expect(fattoreScalatura(10, 0)).toBeNull()
    expect(scala(200, 2.5, 'proporzionale')).toBe(500)
    expect(scala(1, 2.5, 'fissa')).toBe(1)
    expect(fattoreAnomalo(5)).toBe(true)
    expect(fattoreAnomalo(0.2)).toBe(true)
    expect(fattoreAnomalo(1.5)).toBe(false)
    expect(quasiUguali(0.1 + 0.2, 0.3)).toBe(true)
  })
})

describe('stati dell\'evento (SPEC §7.3)', () => {
  it('transizioni ammesse', () => {
    expect(statoDopo('concludi', 'attivo')).toBe('concluso')
    expect(statoDopo('concludi', 'concluso')).toBeNull()
    expect(statoDopo('riapri', 'concluso')).toBe('attivo')
    expect(statoDopo('riapri', 'archiviato')).toBe('attivo')
    expect(statoDopo('archivia', 'attivo')).toBe('archiviato')
    expect(statoDopo('archivia', 'archiviato')).toBeNull()
  })
  it('proposta di conclusione e nome suggerito', () => {
    expect(daConcludere({ stato: 'attivo', data: '2026-12-25' }, '2026-12-26')).toBe(true)
    expect(daConcludere({ stato: 'attivo', data: '2026-12-25' }, '2026-12-25')).toBe(false)
    expect(nomeSuggerito('Natale', '2026-12-25')).toBe('Natale 2026')
  })
})
