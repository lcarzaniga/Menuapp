// Stati dell'evento e transizioni ammesse (SPEC §7.3–7.4).
import type { StatoEvento } from '../tipi.ts'

export type AzioneEvento = 'concludi' | 'riapri' | 'archivia'

const TRANSIZIONI: Record<AzioneEvento, { da: StatoEvento[]; a: StatoEvento }> = {
  concludi: { da: ['attivo'], a: 'concluso' },
  riapri: { da: ['concluso', 'archiviato'], a: 'attivo' },
  archivia: { da: ['attivo', 'concluso'], a: 'archiviato' },
}

export function statoDopo(azione: AzioneEvento, stato: StatoEvento): StatoEvento | null {
  const t = TRANSIZIONI[azione]
  return t.da.includes(stato) ? t.a : null
}

export function modificabile(stato: StatoEvento): boolean {
  return stato !== 'archiviato'
}

/** Proposta «segna come concluso» quando la data è passata. */
export function daConcludere(e: { stato: StatoEvento; data: string }, oggi: string): boolean {
  return e.stato === 'attivo' && e.data < oggi
}

export const OCCASIONI_SUGGERITE = [
  'Natale',
  'Vigilia di Natale',
  'Santo Stefano',
  'Capodanno',
  'Epifania',
  'Pasqua',
  'Pasquetta',
  'Ferragosto',
  'Compleanno',
  'Anniversario',
  'Battesimo',
  'Comunione',
  'Domenica in famiglia',
]

/** Nome proposto: occasione + anno («Natale 2026»). */
export function nomeSuggerito(occasione: string, data: string): string {
  const anno = data.slice(0, 4)
  return occasione.trim() ? `${occasione.trim()} ${anno}` : ''
}
