// Parser delle righe ingrediente in italiano (SPEC §8). Funzione pura.
// Principio: nessuna interpretazione incerta è presentata come certa.
import { norm } from '../testo.ts'
import type { Scalatura } from '../tipi.ts'
import { type CodiceUnita, riconosciUnita } from '../unita.ts'

export interface VoceCatalogoParser {
  id: string
  nome: string
  sinonimi: string[]
  scalaturaAbituale: Scalatura
}

export interface RigaAnalizzata {
  testoOriginale: string
  nome: string
  quantita: number | null
  quantitaMax: number | null
  unita: CodiceUnita | null
  nota: string
  facoltativo: boolean
  scalatura: Scalatura
  ingredienteId: string | null
  /** Corrispondenza approssimata: solo un suggerimento, da confermare. */
  suggerimento: { id: string; nome: string } | null
  statoParsing: 'certo' | 'da_verificare'
  problemi: string[]
}

// ── Numeri ──────────────────────────────────────────────────

const FRAZIONI_UNICODE: Record<string, string> = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅛': '1/8' }

const PAROLE_NUMERO: Record<string, number> = {
  un: 1, uno: 1, una: 1, mezzo: 0.5, mezza: 0.5, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7,
  otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, quindici: 15, venti: 20, trenta: 30, cento: 100,
}

const RE_NUMERO = /^\d+(?:[.,]\d+)?$/
const RE_FRAZIONE = /^(\d+)\/(\d+)$/
const RE_INTERVALLO = /^(\d+(?:[.,]\d+)?)[-–](\d+(?:[.,]\d+)?)$/
const RE_MIGLIAIA = /^\d{1,3}(?:\.\d{3})+$/

function valoreNumero(t: string): number | null {
  if (RE_MIGLIAIA.test(t)) return Number(t.replaceAll('.', ''))
  if (RE_NUMERO.test(t)) return Number(t.replace(',', '.'))
  const f = RE_FRAZIONE.exec(t)
  if (f) return Number(f[2]) === 0 ? null : Number(f[1]) / Number(f[2])
  return null
}

// ── Parole di servizio ──────────────────────────────────────

/** Connettivi rimossi in testa al nome. */
const CONNETTIVI = new Set(['di', "d'", 'del', 'della', 'dello', 'dei', 'degli', 'delle', "dell'", 'da', 'circa', 'ca', 'ca.'])
/** Parole che descrivono la quantità o la pezzatura: vanno in nota. */
const PAROLE_NOTA = new Set([
  'abbondante', 'abbondanti', 'scarso', 'scarsi', 'scarsa', 'scarse', 'raso', 'rasi', 'rasa', 'rase', 'colmo', 'colmi',
  'colma', 'colme', 'circa', 'grande', 'grandi', 'piccolo', 'piccoli', 'piccola', 'piccole', 'medio', 'medi', 'media', 'medie',
])
const FACOLTATIVO = /\b(facoltativ[oaie]|opzional[ei])\b/i
const QB = /(?:^|\s)(q\.?\s?b\.?|quanto\s+basta|a\s+piacere)(?=\s|$|[,;.])/i

function eConnettivo(t: string): boolean {
  return CONNETTIVI.has(t.toLowerCase())
}

/** Token numerici che fanno parte del nome: farina 00, tipo 1, cioccolato 70%. */
function protetto(token: string, precedente: string | undefined): boolean {
  const p = precedente?.toLowerCase()
  if (/^\d+%$/.test(token)) return true
  if ((token === '00' || token === '0') && (p === 'farina' || p === 'tipo')) return true
  if (p === 'tipo' && /^\d$/.test(token)) return true
  return false
}

// ── Scomposizione ───────────────────────────────────────────

function tokenizza(testo: string): string[] {
  let s = testo
  for (const [u, f] of Object.entries(FRAZIONI_UNICODE)) s = s.replace(new RegExp(`(\\d)${u}`, 'g'), `$1 ${f}`).replaceAll(u, ` ${f} `)
  s = s
    .replace(/(\d)\s*[-–]\s*(\d)/g, '$1-$2') // intervalli «2 - 3»
    .replace(/(\d)([a-zA-Zàèéìòù])/g, '$1 $2') // «200g» → «200 g»
    .replace(/,(?!\d)|(?<!\d),/g, ' ') // virgole non decimali
    .replace(/\s+\+\s+/g, ' + ')
  const token: string[] = []
  for (const t of s.split(/\s+/).filter(Boolean)) {
    // «d'aglio», «un'arancia», «dell'acqua» → connettivo + parola
    const m = /^(d'|un'|dell'|dall'|nell'|l')(.+)$/i.exec(t.replace(/[’‘`]/g, "'"))
    if (m) token.push(m[1]!.toLowerCase(), m[2]!)
    else token.push(t)
  }
  return token
}

interface Gruppo {
  inizio: number
  fine: number // esclusivo
  valore: number
  massimo: number | null
  migliaia: boolean
}

/** Trova i gruppi numerici: interi, decimali, frazioni, misti, intervalli, numeri in parola. */
function gruppiNumerici(t: string[]): Gruppo[] {
  const gruppi: Gruppo[] = []
  let i = 0
  while (i < t.length) {
    const tok = t[i]!
    const basso = tok.toLowerCase()
    if (protetto(tok, t[i - 1])) {
      i++
      continue
    }
    let valore: number | null = null
    let massimo: number | null = null
    let fine = i + 1
    const intervallo = RE_INTERVALLO.exec(tok)
    if (intervallo) {
      valore = Number(intervallo[1]!.replace(',', '.'))
      massimo = Number(intervallo[2]!.replace(',', '.'))
    } else if (valoreNumero(tok) !== null) {
      valore = valoreNumero(tok)
      const f = t[i + 1] && RE_FRAZIONE.exec(t[i + 1]!)
      if (f && Number.isInteger(valore)) {
        valore = valore! + Number(f[1]) / Number(f[2])
        fine = i + 2
      }
    } else if (basso === 'paio' && t[i - 1]?.toLowerCase() === 'un') {
      // gestito sotto con «un paio»
    } else if ((basso === 'mezzo' || basso === 'mezza') && t[i - 1]?.toLowerCase() === 'e') {
      // «2 kg e mezzo»: frazione del numero precedente, gestita dopo
    } else if (basso in PAROLE_NUMERO) {
      // «un» e «una» sono numeri solo in testa o davanti a un'unità/nome, non dentro il nome
      if ((basso === 'un' || basso === 'una' || basso === 'uno') && i > 0 && !eConnettivo(t[i - 1]!)) {
        i++
        continue
      }
      valore = PAROLE_NUMERO[basso]!
      if ((basso === 'un' || basso === 'una') && t[i + 1]?.toLowerCase() === 'paio') {
        valore = 2
        fine = i + 2
      } else if ((basso === 'una' || basso === 'un') && t[i + 1]?.toLowerCase() === 'dozzina') {
        valore = 12
        fine = i + 2
      } else if (basso === "un'") {
        valore = 1
      }
    } else if (basso === "un'") {
      valore = 1
    }
    if (valore === null) {
      i++
      continue
    }
    // «2 o 3», «da 2 a 3»
    const sep = t[fine]?.toLowerCase()
    if ((sep === 'o' || sep === 'a' || sep === '/') && t[fine + 1] && valoreNumero(t[fine + 1]!) !== null) {
      massimo = valoreNumero(t[fine + 1]!)
      fine += 2
    }
    // «e mezzo» subito dopo il numero o dopo l'unità
    gruppi.push({ inizio: i, fine, valore, massimo, migliaia: RE_MIGLIAIA.test(tok) })
    i = fine
  }
  return gruppi
}

// ── Catalogo ────────────────────────────────────────────────

export interface IndiceCatalogo {
  esatto: Map<string, VoceCatalogoParser>
  voci: VoceCatalogoParser[]
}

export function indicizzaCatalogo(catalogo: VoceCatalogoParser[]): IndiceCatalogo {
  const esatto = new Map<string, VoceCatalogoParser>()
  for (const v of catalogo) {
    esatto.set(norm(v.nome), v)
    for (const s of v.sinonimi) if (!esatto.has(norm(s))) esatto.set(norm(s), v)
  }
  return { esatto, voci: catalogo }
}

function variantiNumero(parola: string): string[] {
  const v: string[] = []
  const radice = parola.slice(0, -1)
  const finale = parola.slice(-1)
  if ('aeio'.includes(finale)) for (const x of 'aeio') if (x !== finale) v.push(radice + x)
  if (parola.endsWith('che')) v.push(`${parola.slice(0, -3)}ca`)
  if (parola.endsWith('ca')) v.push(`${parola.slice(0, -2)}che`)
  if (parola.endsWith('chi')) v.push(`${parola.slice(0, -3)}co`)
  if (parola.endsWith('ghe')) v.push(`${parola.slice(0, -3)}ga`)
  if (parola.endsWith('gli')) v.push(`${parola.slice(0, -3)}glio`)
  if (parola.endsWith('glio')) v.push(`${parola.slice(0, -4)}gli`)
  return v
}

/** Corrispondenza approssimata (singolare/plurale, prefisso più lungo): solo suggerimento. */
export function suggerisci(nome: string, indice: IndiceCatalogo): VoceCatalogoParser | null {
  const parole = norm(nome).split(' ').filter(Boolean)
  if (parole.length === 0) return null
  for (let n = parole.length; n >= 1; n--) {
    const parte = parole.slice(0, n)
    const diretto = indice.esatto.get(parte.join(' '))
    if (diretto && n < parole.length) return diretto
    for (let k = 0; k < parte.length; k++) {
      for (const var_ of variantiNumero(parte[k]!)) {
        const candidato = [...parte.slice(0, k), var_, ...parte.slice(k + 1)].join(' ')
        const trovato = indice.esatto.get(candidato)
        if (trovato) return trovato
      }
    }
  }
  return null
}

// ── Analisi ─────────────────────────────────────────────────

const UNITA_FISSE = new Set<CodiceUnita>(['foglia', 'rametto', 'pizzico', 'qb'])

export function analizzaRiga(testoOriginale: string, indice: IndiceCatalogo): RigaAnalizzata {
  const problemi: string[] = []
  const note: string[] = []
  let s = testoOriginale.trim().replace(/^\s*(?:[-*•·]|\d+[.)](?!\d))\s*/, '')

  // Parentesi → nota
  s = s.replace(/\(([^)]*)\)/g, (_m, dentro: string) => {
    if (dentro.trim()) note.push(dentro.trim())
    return ' '
  })

  let facoltativo = false
  if (FACOLTATIVO.test(s) || note.some((n) => FACOLTATIVO.test(n))) {
    facoltativo = true
    s = s.replace(FACOLTATIVO, ' ')
    for (let i = note.length - 1; i >= 0; i--) if (FACOLTATIVO.test(note[i]!)) note.splice(i, 1)
  }

  let qb = false
  if (QB.test(s)) {
    qb = true
    s = s.replace(QB, ' ')
  }

  const t = tokenizza(s)
  const gruppi = gruppiNumerici(t)

  let quantita: number | null = null
  let quantitaMax: number | null = null
  let unita: CodiceUnita | null = null
  const usati = new Set<number>()
  let unitaSospetta: string | null = null

  if (gruppi.length > 1) {
    problemi.push('Più numeri nella riga: indica tu quantità e unità')
  }
  const g = gruppi.length >= 1 ? (gruppi.length === 1 ? gruppi[0]! : null) : null

  if (g) {
    quantita = g.valore
    quantitaMax = g.massimo
    if (g.migliaia) problemi.push('Il punto potrebbe separare le migliaia: controlla la quantità')
    for (let k = g.inizio; k < g.fine; k++) usati.add(k)
    // unità dopo il numero («200 g farina», «farina 200 g»)
    const dopo = t[g.fine]
    const prima = t[g.inizio - 1]
    let posUnita = -1
    if (dopo !== undefined && riconosciUnita(dopo)) posUnita = g.fine
    else if (dopo?.toLowerCase() === 'di' && t[g.fine + 1] !== undefined && riconosciUnita(t[g.fine + 1]!) && g.inizio === 0) {
      posUnita = g.fine + 1
      usati.add(g.fine)
    } else if (prima !== undefined && riconosciUnita(prima) && (g.fine === t.length || g.inizio === 1)) posUnita = g.inizio - 1
    if (posUnita >= 0) {
      unita = riconosciUnita(t[posUnita]!)
      usati.add(posUnita)
      // «noce» è un'unità solo in «una noce di burro»
      if (unita === 'noce' && t[posUnita + 1]?.toLowerCase() !== 'di') {
        unita = null
        usati.delete(posUnita)
      }
    }
    // «e mezzo» subito dopo numero o unità
    const dopoTutto = Math.max(g.fine, posUnita + 1)
    if (t[dopoTutto]?.toLowerCase() === 'e' && ['mezzo', 'mezza'].includes(t[dopoTutto + 1]?.toLowerCase() ?? '')) {
      quantita += 0.5
      if (quantitaMax !== null) quantitaMax += 0.5
      usati.add(dopoTutto)
      usati.add(dopoTutto + 1)
    }
    const inTesta = g.inizio === 0 || (g.inizio === 1 && posUnita === 0) || t.slice(0, g.inizio).every((x) => eConnettivo(x))
    const inCoda = g.fine === t.length || (posUnita === g.fine && posUnita === t.length - 1)
    if (!inTesta && !inCoda) problemi.push('Quantità in mezzo al nome: controlla')
    // Unità sconosciuta: «2 vasi di yogurt»
    if (unita === null && inTesta && t[g.fine + 1] && eConnettivo(t[g.fine + 1]!) && t[g.fine + 1]!.toLowerCase().startsWith('d')) {
      unitaSospetta = t[g.fine]!
    }
  }

  // Nome: token rimasti, senza connettivi in testa; parole di pezzatura in nota.
  const resto: string[] = []
  t.forEach((tok, k) => {
    if (usati.has(k)) return
    if (tok === '+') return
    if (PAROLE_NOTA.has(tok.toLowerCase())) {
      note.push(tok.toLowerCase())
      return
    }
    resto.push(tok)
  })
  while (resto.length && eConnettivo(resto[0]!)) resto.shift()
  while (resto.length && eConnettivo(resto[resto.length - 1]!)) resto.pop()
  let nome = resto.join(' ').replace(/\s+'/g, "'").replace(/'\s+/g, "'").replace(/^[,;:.\s]+|[,;:.\s]+$/g, '').trim()
  // «d'» ricomposto dentro il nome: «olio extravergine d'oliva»
  nome = nome.replace(/\b(d|dell|dall|nell|l|un)'\s*/gi, (m) => m.replace(/\s+$/, ''))

  if (qb) {
    if (quantita !== null) problemi.push('Indicati sia una quantità sia «q.b.»')
    unita = 'qb'
    quantita = null
    quantitaMax = null
  }

  if (!nome) problemi.push('Nome dell\'ingrediente mancante')
  if (quantita === null && unita !== 'qb' && gruppi.length <= 1) problemi.push('Quantità non indicata')
  if (gruppi.length > 1) {
    quantita = null
    quantitaMax = null
    unita = null
  }

  // Catalogo: corrispondenza esatta = collegamento certo; approssimata = suggerimento.
  const esatto = nome ? indice.esatto.get(norm(nome)) : undefined
  const suggerito = !esatto && nome ? suggerisci(nome, indice) : null
  // «2 vasi di miele»: unità sconosciuta, a meno che la frase intera sia nel catalogo («coste di sedano»)
  if (unitaSospetta && !esatto) problemi.push(`Unità non riconosciuta: «${unitaSospetta}»`)

  const scalatura: Scalatura =
    (unita && UNITA_FISSE.has(unita)) || esatto?.scalaturaAbituale === 'fissa' ? 'fissa' : 'proporzionale'

  return {
    testoOriginale: testoOriginale.trim(),
    nome,
    quantita,
    quantitaMax,
    unita,
    nota: note.join(', '),
    facoltativo,
    scalatura,
    ingredienteId: esatto?.id ?? null,
    suggerimento: suggerito ? { id: suggerito.id, nome: suggerito.nome } : null,
    statoParsing: problemi.length === 0 ? 'certo' : 'da_verificare',
    problemi,
  }
}

/** Righe di un testo incollato: vuote e titoli («Per il ripieno:») ignorati. */
export function analizzaTesto(testo: string, indice: IndiceCatalogo): RigaAnalizzata[] {
  return testo
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0 && !/^[^\d]*:$/.test(r) && !/^ingredienti\b/i.test(r))
    .slice(0, 200)
    .map((r) => analizzaRiga(r, indice))
}
