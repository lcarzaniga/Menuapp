// Catalogo delle unità di misura (SPEC §8.1–§8.2, §9.4).
// Le uniche conversioni ammesse sono interne alla famiglia metrica (massa, volume).

export const CODICI_UNITA = [
  'g', 'hg', 'kg',
  'ml', 'cl', 'dl', 'l',
  'pz', 'spicchio', 'foglia', 'rametto', 'mazzetto', 'fetta',
  'cucchiaio', 'cucchiaino', 'tazza', 'bicchiere', 'pizzico', 'manciata', 'noce',
  'bustina', 'confezione', 'scatola', 'vasetto',
  'qb',
] as const

export type CodiceUnita = (typeof CODICI_UNITA)[number]

export type FamigliaUnita = 'massa' | 'volume' | 'conteggio' | 'domestica' | 'confezione' | 'qb'

interface InfoUnita {
  famiglia: FamigliaUnita
  /** Fattore verso l'unità base della famiglia (g per massa, ml per volume). */
  fattore?: number
  singolare: string
  plurale: string
  forme: string[]
}

export const UNITA: Record<CodiceUnita, InfoUnita> = {
  g: { famiglia: 'massa', fattore: 1, singolare: 'g', plurale: 'g', forme: ['g', 'gr', 'grammo', 'grammi'] },
  hg: { famiglia: 'massa', fattore: 100, singolare: 'hg', plurale: 'hg', forme: ['hg', 'etto', 'etti'] },
  kg: { famiglia: 'massa', fattore: 1000, singolare: 'kg', plurale: 'kg', forme: ['kg', 'chilo', 'chili', 'chilogrammo', 'chilogrammi'] },
  ml: { famiglia: 'volume', fattore: 1, singolare: 'ml', plurale: 'ml', forme: ['ml', 'millilitro', 'millilitri'] },
  cl: { famiglia: 'volume', fattore: 10, singolare: 'cl', plurale: 'cl', forme: ['cl', 'centilitro', 'centilitri'] },
  dl: { famiglia: 'volume', fattore: 100, singolare: 'dl', plurale: 'dl', forme: ['dl', 'decilitro', 'decilitri'] },
  l: { famiglia: 'volume', fattore: 1000, singolare: 'l', plurale: 'l', forme: ['l', 'lt', 'litro', 'litri'] },
  pz: { famiglia: 'conteggio', singolare: 'pezzo', plurale: 'pezzi', forme: ['pz', 'pezzo', 'pezzi', 'n', 'nr'] },
  spicchio: { famiglia: 'conteggio', singolare: 'spicchio', plurale: 'spicchi', forme: ['spicchio', 'spicchi'] },
  foglia: { famiglia: 'conteggio', singolare: 'foglia', plurale: 'foglie', forme: ['foglia', 'foglie', 'foglioline', 'fogliolina'] },
  rametto: { famiglia: 'conteggio', singolare: 'rametto', plurale: 'rametti', forme: ['rametto', 'rametti', 'ramo', 'rami'] },
  mazzetto: { famiglia: 'conteggio', singolare: 'mazzetto', plurale: 'mazzetti', forme: ['mazzetto', 'mazzetti', 'mazzo', 'mazzi', 'ciuffo', 'ciuffi'] },
  fetta: { famiglia: 'conteggio', singolare: 'fetta', plurale: 'fette', forme: ['fetta', 'fette', 'fettina', 'fettine'] },
  cucchiaio: { famiglia: 'domestica', singolare: 'cucchiaio', plurale: 'cucchiai', forme: ['cucchiaio', 'cucchiai', 'cucch', 'c'] },
  cucchiaino: { famiglia: 'domestica', singolare: 'cucchiaino', plurale: 'cucchiaini', forme: ['cucchiaino', 'cucchiaini', 'cno', 'c.no'] },
  tazza: { famiglia: 'domestica', singolare: 'tazza', plurale: 'tazze', forme: ['tazza', 'tazze', 'tazzina', 'tazzine'] },
  bicchiere: { famiglia: 'domestica', singolare: 'bicchiere', plurale: 'bicchieri', forme: ['bicchiere', 'bicchieri'] },
  pizzico: { famiglia: 'domestica', singolare: 'pizzico', plurale: 'pizzichi', forme: ['pizzico', 'pizzichi'] },
  manciata: { famiglia: 'domestica', singolare: 'manciata', plurale: 'manciate', forme: ['manciata', 'manciate'] },
  noce: { famiglia: 'domestica', singolare: 'noce', plurale: 'noci', forme: ['noce'] },
  bustina: { famiglia: 'confezione', singolare: 'bustina', plurale: 'bustine', forme: ['bustina', 'bustine'] },
  confezione: { famiglia: 'confezione', singolare: 'confezione', plurale: 'confezioni', forme: ['confezione', 'confezioni', 'conf', 'pacco', 'pacchi', 'pacchetto', 'pacchetti'] },
  scatola: { famiglia: 'confezione', singolare: 'scatola', plurale: 'scatole', forme: ['scatola', 'scatole', 'lattina', 'lattine', 'scatoletta', 'scatolette'] },
  vasetto: { famiglia: 'confezione', singolare: 'vasetto', plurale: 'vasetti', forme: ['vasetto', 'vasetti', 'barattolo', 'barattoli'] },
  qb: { famiglia: 'qb', singolare: 'q.b.', plurale: 'q.b.', forme: ['qb', 'q.b.', 'q.b'] },
}

export function isCodiceUnita(x: unknown): x is CodiceUnita {
  return typeof x === 'string' && (CODICI_UNITA as readonly string[]).includes(x)
}

export function famiglia(u: CodiceUnita): FamigliaUnita {
  return UNITA[u].famiglia
}

/** Unità base della famiglia metrica, o l'unità stessa se non è metrica. */
export function unitaBase(u: CodiceUnita): CodiceUnita {
  const f = UNITA[u].famiglia
  if (f === 'massa') return 'g'
  if (f === 'volume') return 'ml'
  return u
}

/** Converte nell'unità base della famiglia. Solo massa e volume hanno un fattore. */
export function aUnitaBase(quantita: number, u: CodiceUnita): number {
  return quantita * (UNITA[u].fattore ?? 1)
}

/**
 * Conversione fra due unità: possibile solo dentro la stessa famiglia metrica.
 * Restituisce null quando la conversione non è sicura (es. cucchiaio → ml, confezione → g).
 */
export function converti(quantita: number, da: CodiceUnita, a: CodiceUnita): number | null {
  if (da === a) return quantita
  const fa = UNITA[da]
  const fb = UNITA[a]
  if (fa.famiglia !== fb.famiglia) return null
  if (fa.fattore === undefined || fb.fattore === undefined) return null
  return (quantita * fa.fattore) / fb.fattore
}

/** Chiave di famiglia usata nelle chiavi della spesa (SPEC §10.2). */
export function chiaveFamiglia(u: CodiceUnita | null): string {
  // «2 uova» e «n. 2 uova» sono lo stesso conteggio: pezzi e numero puro si sommano.
  if (u === null || u === 'pz') return 'senza_unita'
  const f = UNITA[u].famiglia
  if (f === 'massa' || f === 'volume') return f
  if (f === 'qb') return 'qb'
  return `u:${u}`
}

/** Mappa forma testuale normalizzata → codice. */
const FORME = new Map<string, CodiceUnita>()
for (const codice of CODICI_UNITA) {
  for (const forma of UNITA[codice].forme) FORME.set(forma.replace(/\.$/, ''), codice)
}

export function riconosciUnita(token: string): CodiceUnita | null {
  const t = token.toLowerCase().replace(/\.$/, '')
  return FORME.get(t) ?? null
}

// ── Formattazione (SPEC §9.4) ───────────────────────────────

const fmt = (decimali: number) =>
  new Intl.NumberFormat('it-IT', { maximumFractionDigits: decimali, minimumFractionDigits: 0 })

const FRAZIONI: [number, string][] = [
  [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'],
]

export function formattaNumero(n: number, decimali = 2): string {
  return fmt(decimali).format(n)
}

/** Numero con frazioni comuni se entro il 5 % (vista cucina). */
export function formattaFrazione(n: number): string {
  const intero = Math.floor(n)
  const resto = n - intero
  if (resto < 0.02) return String(intero)
  if (resto > 0.98) return String(intero + 1)
  for (const [valore, simbolo] of FRAZIONI) {
    if (Math.abs(resto - valore) <= 0.05 * Math.max(n, 1) && Math.abs(resto - valore) < 0.06) {
      return intero === 0 ? simbolo : `${intero}${simbolo}`
    }
  }
  return formattaNumero(n, 1)
}

function arrotondaAMezzo(n: number): number {
  return Math.round(n * 2) / 2
}

export type Contesto = 'cucina' | 'spesa'

export interface QuantitaFormattata {
  numero: string
  unita: string
  testo: string
}

/** Formatta una quantità espressa nell'unità indicata, secondo il contesto. */
export function formattaQuantita(
  quantita: number | null,
  unita: CodiceUnita | null,
  contesto: Contesto,
): QuantitaFormattata {
  if (unita === 'qb') return { numero: '', unita: 'q.b.', testo: 'q.b.' }
  if (quantita === null) return { numero: '', unita: '', testo: '' }
  if (unita === null) {
    const numero = contesto === 'spesa' ? String(Math.ceil(quantita - 1e-9)) : formattaFrazione(quantita)
    return { numero, unita: '', testo: numero }
  }
  const info = UNITA[unita]
  let q = quantita
  let u: CodiceUnita = unita
  let numero: string
  if (info.famiglia === 'massa' || info.famiglia === 'volume') {
    q = aUnitaBase(quantita, unita)
    const grande = info.famiglia === 'massa' ? 'kg' : 'l'
    const piccola = info.famiglia === 'massa' ? 'g' : 'ml'
    if (q >= 1000) {
      u = grande
      numero = formattaNumero(q / 1000, 2)
    } else {
      u = piccola
      if (contesto === 'spesa') numero = String(Math.ceil(q / 5 - 1e-9) * 5 || Math.ceil(q))
      else numero = q < 10 ? formattaNumero(q, 1) : String(Math.round(q))
    }
  } else if (info.famiglia === 'domestica') {
    numero = formattaFrazione(arrotondaAMezzo(q) || q)
  } else {
    numero = contesto === 'spesa' ? String(Math.ceil(q - 1e-9)) : formattaFrazione(q)
  }
  const singolare = numero === '1' || /^[½⅓¼¾⅔]$/.test(numero)
  const nomeUnita = singolare ? UNITA[u].singolare : UNITA[u].plurale
  return { numero, unita: nomeUnita, testo: `${numero} ${nomeUnita}` }
}
