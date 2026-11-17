// Ricorrenze standard (SPEC §30): un catalogo unico nel codice, uguale per tutte le Famiglie,
// con identificativi stabili indipendenti dal nome mostrato. Nessuna copia per Famiglia, nessuna
// data né generazione di eventi: servono a ritrovare, duplicare e confrontare le edizioni.
import { norm } from './testo.ts'

export interface RicorrenzaStandard {
  /** Identificativo stabile salvato negli eventi (`eventi.ricorrenza_standard`): non cambia mai. */
  id: string
  nome: string
  /** Altri modi di scrivere l'occasione che indicano la stessa ricorrenza. */
  sinonimi?: string[]
}

export const RICORRENZE_STANDARD: readonly RicorrenzaStandard[] = [
  { id: 'vigilia-natale', nome: 'Vigilia di Natale', sinonimi: ['Vigilia'] },
  { id: 'natale', nome: 'Natale' },
  { id: 'santo-stefano', nome: 'Santo Stefano' },
  { id: 'capodanno', nome: 'Capodanno' },
  { id: 'epifania', nome: 'Epifania', sinonimi: ['Befana'] },
  { id: 'pasqua', nome: 'Pasqua' },
  { id: 'pasquetta', nome: 'Pasquetta', sinonimi: ['Lunedì dell\'Angelo'] },
  { id: 'ferragosto', nome: 'Ferragosto' },
]

export const ID_RICORRENZE_STANDARD = RICORRENZE_STANDARD.map((r) => r.id) as [string, ...string[]]

export const ricorrenzaStandard = (id: string | null | undefined): RicorrenzaStandard | undefined => RICORRENZE_STANDARD.find((r) => r.id === id)

/**
 * Ricorrenza standard indicata dall'occasione dell'evento (il suo «tipo»), solo se coincide con
 * il nome o un sinonimo, senza badare a maiuscole e accenti. Mai dal nome libero dell'evento:
 * «Natale dai nonni» non è riconosciuto, «natale» sì.
 */
export function standardPerOccasione(occasione: string): RicorrenzaStandard | undefined {
  const chiave = norm(occasione)
  if (!chiave) return undefined
  return RICORRENZE_STANDARD.find((r) => norm(r.nome) === chiave || r.sinonimi?.some((s) => norm(s) === chiave))
}
