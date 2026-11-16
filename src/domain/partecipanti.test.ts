import { describe, expect, it } from 'vitest'
import { contaPresenze, copertiEffettivi, NESSUN_ANONIMO, type Presenza, stessaPersona } from './partecipanti.ts'

const p = (id: string, extra: Partial<Presenza> = {}): Presenza => ({ id, invitoId: null, categoria: 'adulto', stato: 'confermato', anonimi: NESSUN_ANONIMO, ...extra })

describe('presenze e coperti (SPEC §24)', () => {
  it('ogni persona conta una volta, con il suo stato; anonimi per categoria e stato', () => {
    const c = contaPresenze([
      p('marco'),
      p('anna', { anonimi: { adultiConfermati: 1, adultiInAttesa: 0, bambiniConfermati: 0, bambiniInAttesa: 0 } }),
      p('paolo', { stato: 'assente', anonimi: { adultiConfermati: 2, adultiInAttesa: 1, bambiniConfermati: 3, bambiniInAttesa: 1 } }),
      p('leo', { invitoId: 'paolo', categoria: 'bambino', stato: 'in_attesa' }),
      p('giulia', { invitoId: 'paolo' }),
    ])
    // Adulti confermati: Marco, Anna +1, i 2 senza nome di Paolo (stato loro), Giulia.
    expect(c).toEqual({ adulti: { confermati: 6, inAttesa: 1, assenti: 1 }, bambini: { confermati: 3, inAttesa: 2, assenti: 0 }, inviti: 3, persone: 13 })
  })

  it('manuale: valgono i numeri scritti; automatico: solo i confermati', () => {
    const presenze = [p('a'), p('b', { stato: 'in_attesa' }), p('c', { categoria: 'bambino' })]
    expect(copertiEffettivi({ adulti: 8, bambini: 2, copertiAutomatici: false }, presenze)).toEqual({ adulti: 8, bambini: 2 })
    expect(copertiEffettivi({ adulti: 8, bambini: 2, copertiAutomatici: true }, presenze)).toEqual({ adulti: 1, bambini: 1 })
    expect(copertiEffettivi({ adulti: 8, bambini: 2, copertiAutomatici: true }, [])).toEqual({ adulti: 0, bambini: 0 })
  })

  it('responsabile e partecipante: per collegamento, altrimenti per nome', () => {
    const marco = { utenteId: null, esternoId: 'e1', nomeNorm: 'zio marco' }
    expect(stessaPersona({ incaricatoId: null, esternoId: 'e1', nomeNorm: 'zio marco' }, marco)).toBe(true)
    expect(stessaPersona({ incaricatoId: null, esternoId: null, nomeNorm: 'zio marco' }, marco)).toBe(true)
    expect(stessaPersona({ incaricatoId: null, esternoId: 'e2', nomeNorm: 'zio marco' }, marco)).toBe(false)
    expect(stessaPersona({ incaricatoId: 'u1', esternoId: null, nomeNorm: 'anna' }, { utenteId: 'u1', esternoId: null, nomeNorm: 'anna' })).toBe(true)
    expect(stessaPersona({ incaricatoId: null, esternoId: null, nomeNorm: 'anna' }, { utenteId: 'u1', esternoId: null, nomeNorm: 'anna' })).toBe(false)
    expect(stessaPersona({ incaricatoId: null, esternoId: null, nomeNorm: '' }, marco)).toBe(false)
  })
})
