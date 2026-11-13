// Ricettario sfogliabile: portate per il filtro e iniziali per la rubrica (SPEC §5).
import { norm } from './testo.ts'

export const SENZA_PORTATA = 'Senza portata'
export const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
/** Iniziale dei nomi che non cominciano con una lettera (numeri, simboli). */
export const ALTRO_INIZIALE = '#'

/** Radice per confronti tolleranti: «Antipasti» e «Antipasto» → «antipast». */
const radice = (s: string) => norm(s).replace(/[aeio]$/, '')

/**
 * Portata del ricettario a cui appartiene un piatto. Le portate importate con varianti
 * («Antipasti / Fritti», «Dolci al cucchiaio») ricadono in quella predefinita da cui
 * cominciano; le altre restano a sé; senza portata → `SENZA_PORTATA`.
 */
export function portataDelPiatto(portata: string | null, predefinite: readonly string[]): string {
  const t = norm(portata ?? '')
  if (!t) return SENZA_PORTATA
  // La radice, eventualmente seguita da una vocale, deve chiudere una parola: «Primizie» non è «Primi».
  const comincia = (nome: string) => {
    const r = radice(nome)
    return r !== '' && t.startsWith(r) && !/^[a-z0-9]/.test(t.slice(r.length).replace(/^[aeio]/, ''))
  }
  return predefinite.find(comincia) ?? portata!.trim()
}

export interface PortataRicettario {
  nome: string
  numero: number
}

/** Portate presenti nel ricettario: prima le predefinite (nel loro ordine), poi le altre, infine «Senza portata». */
export function portateDelRicettario(piatti: readonly { portataSuggerita: string | null }[], predefinite: readonly string[]): PortataRicettario[] {
  const conteggi = new Map<string, PortataRicettario>()
  for (const p of piatti) {
    const nome = portataDelPiatto(p.portataSuggerita, predefinite)
    const chiave = norm(nome)
    const c = conteggi.get(chiave)
    if (c) c.numero++
    else conteggi.set(chiave, { nome, numero: 1 })
  }
  const ordine = (nome: string) => {
    if (nome === SENZA_PORTATA) return predefinite.length + 1
    const i = predefinite.indexOf(nome)
    return i === -1 ? predefinite.length : i
  }
  return [...conteggi.values()].sort((a, b) => ordine(a.nome) - ordine(b.nome) || a.nome.localeCompare(b.nome, 'it'))
}

/** Lettera della rubrica: iniziale senza accenti, oppure `#`. */
export function inizialeRubrica(nome: string): string {
  const c = norm(nome).replace(/^[^\p{L}\p{N}]+/u, '').charAt(0).toUpperCase()
  return ALFABETO.includes(c) ? c : ALTRO_INIZIALE
}

export interface GruppoRubrica<T> {
  lettera: string
  piatti: T[]
}

/** Piatti in ordine alfabetico italiano, raggruppati per iniziale (`#` in fondo). */
export function rubrica<T extends { nome: string }>(piatti: readonly T[]): GruppoRubrica<T>[] {
  const ordinati = [...piatti].sort((a, b) => a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base', numeric: true }))
  const gruppi = new Map<string, T[]>()
  for (const p of ordinati) {
    const l = inizialeRubrica(p.nome)
    gruppi.set(l, [...(gruppi.get(l) ?? []), p])
  }
  return [...ALFABETO, ALTRO_INIZIALE].filter((l) => gruppi.has(l)).map((lettera) => ({ lettera, piatti: gruppi.get(lettera)! }))
}
