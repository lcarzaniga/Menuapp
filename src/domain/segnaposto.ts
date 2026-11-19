// Segnaposto nominativi (SPEC §42): formati, nomi, impaginazione su A4 e dimensione dei nomi.
// Logica pura: la stessa per anteprima, stampa e server. Lo stile grafico è quello del menù
// (src/domain/stampa.ts), o uno proprio dei segnaposto che non tocca il menù.
import type { CaratteriStampa, ModelloStampa, PaletteStampa } from './stampa.ts'
import { norm } from './testo.ts'

export const FORMATI_SEGNAPOSTO = ['cavalletto', 'piatto'] as const
export type FormatoSegnaposto = (typeof FORMATI_SEGNAPOSTO)[number]

export const LIMITI_SEGNAPOSTO = { nome: 60, nomi: 200, copie: 20, testoEvento: 80 } as const

export interface NomeSegnaposto {
  id: string
  testo: string
  /** Da stampare (deselezionato: resta nell'elenco). */
  stampa: boolean
  copie: number
}

/** Lo stile grafico che i segnaposto condividono con il menù. */
export interface StileSegnaposto {
  modello: ModelloStampa
  palette: PaletteStampa
  caratteri: CaratteriStampa
  decorazioni: boolean
}

export interface OpzioniSegnaposto {
  formato: FormatoSegnaposto
  nomi: NomeSegnaposto[]
  /** Cavalletto: il nome anche sulla faccia posteriore. */
  secondaFaccia: boolean
  mostraEvento: boolean
  /** null = nome dell'evento. */
  testoEvento: string | null
  lineeTaglio: boolean
  /** null = come il menù dello stesso evento. */
  stile: StileSegnaposto | null
}

/** Configurazione iniziale: già stampabile senza toccare nulla (nomi a parte). */
export function segnapostoPredefiniti(nomi: NomeSegnaposto[] = []): OpzioniSegnaposto {
  return { formato: 'cavalletto', nomi, secondaFaccia: true, mostraEvento: false, testoEvento: null, lineeTaglio: true, stile: null }
}

/** Chiave di confronto: senza maiuscole, accenti e spazi doppi («Zia Lù» = «zia lu»). */
export const chiaveNome = (testo: string) => norm(testo).replace(/\s+/g, ' ').trim()

/**
 * Nomi da proporre dai partecipanti: titolari e accompagnatori con nome, confermati e in attesa
 * (gli assenti no), nell'ordine dell'elenco e senza doppioni.
 */
export function nomiDaPartecipanti(inviti: { nome: string; stato: string; accompagnatori: { nome: string; stato: string }[] }[]): string[] {
  const visti = new Set<string>()
  const out: string[] = []
  for (const p of inviti.flatMap((i) => [i, ...i.accompagnatori])) {
    const testo = p.nome.trim()
    const k = chiaveNome(testo)
    if (p.stato === 'assente' || !k || visti.has(k)) continue
    visti.add(k)
    out.push(testo)
  }
  return out
}

/**
 * Aggiunge in fondo i nomi che non ci sono già (stessa chiave): riaprire la schermata o
 * importare di nuovo non crea doppioni. Restituisce l'elenco e quanti nomi sono stati aggiunti.
 */
export function aggiungiNomi(elenco: NomeSegnaposto[], nuovi: string[], nuovoId: () => string): { nomi: NomeSegnaposto[]; aggiunti: number } {
  const presenti = new Set(elenco.map((n) => chiaveNome(n.testo)))
  const nomi = [...elenco]
  for (const testo of nuovi) {
    const t = testo.trim().slice(0, LIMITI_SEGNAPOSTO.nome)
    const k = chiaveNome(t)
    if (!k || presenti.has(k) || nomi.length >= LIMITI_SEGNAPOSTO.nomi) continue
    presenti.add(k)
    nomi.push({ id: nuovoId(), testo: t, stampa: true, copie: 1 })
  }
  return { nomi, aggiunti: nomi.length - elenco.length }
}

/** Sposta un nome di una posizione (−1 su, +1 giù); ai bordi non cambia nulla. */
export function spostaNome(nomi: NomeSegnaposto[], id: string, verso: -1 | 1): NomeSegnaposto[] {
  const i = nomi.findIndex((n) => n.id === id)
  const j = i + verso
  if (i < 0 || j < 0 || j >= nomi.length) return nomi
  const out = [...nomi]
  ;[out[i], out[j]] = [out[j]!, out[i]!]
  return out
}

/** I cartoncini da stampare, nell'ordine dell'elenco: ogni nome selezionato ripetuto per le copie. */
export function cartonciniDa(nomi: NomeSegnaposto[]): { chiave: string; testo: string }[] {
  return nomi
    .filter((n) => n.stampa && n.testo.trim())
    .flatMap((n) => Array.from({ length: Math.min(LIMITI_SEGNAPOSTO.copie, Math.max(1, n.copie)) }, (_, k) => ({ chiave: `${n.id}:${k}`, testo: n.testo.trim() })))
}

// ── Impaginazione su A4 ──────────────────────────────────────

/** Misure in mm. La faccia è quella che si legge sul tavolo. */
export const FACCIA = { larghezza: 90, altezza: 50 } as const
export const A4 = { larghezza: 210, altezza: 297 } as const
/** Margine minimo dal bordo del foglio: le stampanti di casa non stampano fino al bordo. */
export const MARGINE_MINIMO = 10

export interface Griglia {
  /** Misure del cartoncino intero (il cavalletto ha due facce una sopra l'altra). */
  larghezza: number
  altezza: number
  colonne: number
  righe: number
  perFoglio: number
  /** Margini effettivi: la griglia è centrata nel foglio. */
  margineX: number
  margineY: number
}

export function griglia(formato: FormatoSegnaposto): Griglia {
  const larghezza = FACCIA.larghezza
  const altezza = formato === 'cavalletto' ? FACCIA.altezza * 2 : FACCIA.altezza
  const colonne = Math.floor((A4.larghezza - 2 * MARGINE_MINIMO) / larghezza)
  const righe = Math.floor((A4.altezza - 2 * MARGINE_MINIMO) / altezza)
  return {
    larghezza,
    altezza,
    colonne,
    righe,
    perFoglio: colonne * righe,
    margineX: (A4.larghezza - colonne * larghezza) / 2,
    margineY: (A4.altezza - righe * altezza) / 2,
  }
}

/** Divide i cartoncini in fogli: interi, mai a cavallo fra due pagine. */
export function fogliDi<T>(cartoncini: T[], formato: FormatoSegnaposto): T[][] {
  const n = griglia(formato).perFoglio
  const fogli: T[][] = []
  for (let i = 0; i < cartoncini.length; i += n) fogli.push(cartoncini.slice(i, i + n))
  return fogli
}

// ── Dimensione del nome ──────────────────────────────────────

/** Larghezza media di un carattere, in em, per combinazione tipografica (con un po' di margine). */
const LARGHEZZA_MEDIA: Record<CaratteriStampa, number> = { classica: 0.54, garamond: 0.46, moderna: 0.52, calligrafica: 0.44 }
/** Stesse correzioni dei titoli del menù (src/features/stampa/caratteri.ts). */
const FATTORE: Record<CaratteriStampa, number> = { classica: 1, garamond: 1.08, moderna: 1, calligrafica: 1.3 }
const PT_PER_MM = 72 / 25.4
export const NOME_PT = { massimo: 30, minimo: 11, minimoUnaRiga: 16 } as const

/**
 * Corpo del nome (in pt) e righe, calcolati e non misurati: anteprima e stampa vengono uguali.
 * Su una riga, finché il corpo resta sopra la soglia; altrimenti, o se su due righe bilanciate
 * (a capo fra le parole) viene molto più grande, su due. `larghezza` e `altezza` sono quelle
 * dell'area del nome, in mm.
 */
export function misuraNome(testo: string, caratteri: CaratteriStampa, larghezza: number, altezza: number): { pt: number; righe: 1 | 2 } {
  const t = testo.trim()
  const em = LARGHEZZA_MEDIA[caratteri]
  const f = FATTORE[caratteri]
  const altezzaRiga = 1.15
  const perLunghezza = (n: number) => (larghezza * PT_PER_MM) / (Math.max(1, n) * em * f)
  const unaRiga = Math.min(NOME_PT.massimo, perLunghezza(t.length), (altezza * PT_PER_MM) / (altezzaRiga * f))
  const parole = t.split(/\s+/)
  const una = { pt: arrotonda(Math.max(NOME_PT.minimo, unaRiga)), righe: 1 as const }
  if (parole.length < 2) return una
  const piuLunga = Math.max(...dueRighe(parole).map((r) => r.length))
  const due = Math.min(NOME_PT.massimo, perLunghezza(piuLunga), (altezza * PT_PER_MM) / (2 * altezzaRiga * f))
  const meglioDue = unaRiga < NOME_PT.minimoUnaRiga ? due > unaRiga : due >= unaRiga * 1.3
  return meglioDue ? { pt: arrotonda(Math.max(NOME_PT.minimo, due)), righe: 2 } : una
}

/** Le due righe più equilibrate (a capo fra le parole). */
export function dueRighe(parole: string[]): [string, string] {
  let migliore: [string, string] = [parole.join(' '), '']
  let scarto = Infinity
  for (let i = 1; i < parole.length; i++) {
    const a = parole.slice(0, i).join(' ')
    const b = parole.slice(i).join(' ')
    const s = Math.max(a.length, b.length)
    if (s < scarto) {
      scarto = s
      migliore = [a, b]
    }
  }
  return migliore
}

const arrotonda = (pt: number) => Math.round(pt * 10) / 10
