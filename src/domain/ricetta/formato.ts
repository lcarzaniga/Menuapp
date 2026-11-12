// Formato ricetta di Menù & Co., versione 1 (docs/FORMATO-RICETTA.md). Funzioni pure.
import type { Piatto, Scalatura } from '../tipi.ts'
import type { CodiceUnita } from '../unita.ts'

export const FORMATO_RICETTA = 'menuapp-ricetta'
export const VERSIONE_FORMATO_RICETTA = 1
export const ESTENSIONE_RICETTA = '.menuapp-ricetta'

export interface IngredienteFormato {
  testo: string
  quantita?: number | null
  quantitaMax?: number | null
  unita?: CodiceUnita | null
  nome?: string
  nota?: string
  facoltativo?: boolean
  scalatura?: Scalatura
}

export interface FotoFormato {
  file: string
  didascalia?: string
  principale?: boolean
}

export interface RicettaFormato {
  formato: typeof FORMATO_RICETTA
  versione: number
  nome: string
  portata?: string | null
  porzioniBase?: number | null
  tempi?: { preparazioneMin?: number | null; cotturaMin?: number | null; riposoMin?: number | null }
  attrezzature?: string[]
  ingredienti?: (string | IngredienteFormato)[]
  procedimento?: string[]
  note?: string
  fonte?: string
  foto?: FotoFormato[]
}

/** Piatto dell'app → ricetta.json (ingredienti come oggetti completi). */
export function daPiatto(p: Piatto, foto: { file: string; didascalia: string; principale: boolean }[] = []): RicettaFormato {
  return {
    formato: FORMATO_RICETTA,
    versione: VERSIONE_FORMATO_RICETTA,
    nome: p.nome,
    portata: p.portataSuggerita,
    porzioniBase: p.porzioniBase,
    tempi: { preparazioneMin: p.tempoPreparazioneMin, cotturaMin: p.tempoCotturaMin, riposoMin: p.tempoRiposoMin },
    attrezzature: p.attrezzature,
    ingredienti: p.ingredienti.map((i) => ({
      testo: i.testoOriginale || i.nome,
      quantita: i.quantita,
      quantitaMax: i.quantitaMax,
      unita: i.unita,
      nome: i.nome,
      nota: i.nota,
      facoltativo: i.facoltativo,
      scalatura: i.scalatura,
    })),
    procedimento: p.procedimento,
    note: p.note,
    fonte: p.fonte,
    foto,
  }
}

/** Nome di file sicuro per l'esportazione. */
export function nomeFileRicetta(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${base || 'ricetta'}${ESTENSIONE_RICETTA}`
}

// ── Scrittura a mano ────────────────────────────────────────

const SEZIONI: [RegExp, 'ingredienti' | 'procedimento' | 'note'][] = [
  [/^(ingredienti|occorrente)\b/, 'ingredienti'],
  [/^(procedimento|preparazione|istruzioni|esecuzione|metodo)\b/, 'procedimento'],
  [/^(note|consigli|suggerimenti)\b/, 'note'],
]

/** «1 h 30 min», «90 min», «1 ora», «45'» → minuti. */
export function minutiDaTesto(testo: string): number | null {
  const t = testo.toLowerCase().replace(',', '.')
  let totale = 0
  let trovato = false
  const ore = /(\d+(?:\.\d+)?)\s*(h|ore|ora)\b/.exec(t)
  if (ore) {
    totale += Number(ore[1]) * 60
    trovato = true
  }
  const min = /(\d+)\s*(min|minuti|minuto|m\b|')/.exec(t)
  if (min) {
    totale += Number(min[1])
    trovato = true
  }
  if (!trovato) {
    const solo = /^\s*(\d+)\s*$/.exec(t)
    if (solo) return Number(solo[1])
    return null
  }
  return Math.round(totale)
}

function chiaveSezione(riga: string): 'ingredienti' | 'procedimento' | 'note' | null {
  const t = riga
    .replace(/^#+\s*/, '')
    .replace(/[:：]\s*$/, '')
    .trim()
    .toLowerCase()
  if (t.length > 30) return null
  const pulita = /^#+/.test(riga.trim()) || /[:：]\s*$/.test(riga) || riga.trim() === riga.trim().toUpperCase()
  if (!pulita) return null
  for (const [re, k] of SEZIONI) if (re.test(t)) return k
  return null
}

/** Testo scritto a mano (docs/FORMATO-RICETTA.md §3) → ricetta. Gli ingredienti restano righe di testo. */
export function daTesto(testo: string): RicettaFormato {
  const righe = testo.replace(/\r\n?/g, '\n').split('\n')
  let nome = ''
  const r: RicettaFormato = { formato: FORMATO_RICETTA, versione: 1, nome: '', ingredienti: [], procedimento: [], attrezzature: [], tempi: {} }
  let sezione: 'intestazione' | 'ingredienti' | 'procedimento' | 'note' = 'intestazione'
  const passi: string[] = []
  let passo: string[] = []
  const note: string[] = []
  const chiudiPasso = () => {
    if (passo.length) passi.push(passo.join(' ').trim())
    passo = []
  }

  for (const grezza of righe) {
    const riga = grezza.trim()
    if (!nome && /^#\s+/.test(riga) && !/^##/.test(riga)) {
      nome = riga.replace(/^#\s+/, '').trim()
      continue
    }
    const nuova = chiaveSezione(riga)
    if (nuova) {
      if (sezione === 'procedimento') chiudiPasso()
      sezione = nuova
      continue
    }
    if (sezione === 'intestazione') {
      if (!riga) continue
      const campo = /^([A-Za-zÀ-ÿ ]{3,20})\s*:\s*(.+)$/.exec(riga)
      if (campo) {
        const k = campo[1]!.trim().toLowerCase()
        const v = campo[2]!.trim()
        if (k === 'portata' || k === 'categoria') r.portata = v
        else if (k === 'porzioni' || k === 'persone' || k === 'dosi') {
          const n = /(\d+(?:[.,]\d+)?)/.exec(v)
          r.porzioniBase = n ? Number(n[1]!.replace(',', '.')) : null
        } else if (k === 'preparazione' || k === 'tempo di preparazione') r.tempi!.preparazioneMin = minutiDaTesto(v)
        else if (k === 'cottura' || k === 'tempo di cottura') r.tempi!.cotturaMin = minutiDaTesto(v)
        else if (k === 'riposo' || k === 'lievitazione') r.tempi!.riposoMin = minutiDaTesto(v)
        else if (k === 'attrezzature' || k === 'attrezzatura' || k === 'strumenti') r.attrezzature = v.split(/[,;]/).map((x) => x.trim()).filter(Boolean)
        else if (k === 'fonte' || k === 'autore' || k === 'da') r.fonte = v
        continue
      }
      const persone = /per\s+(\d+)\s+(persone|porzioni)/i.exec(riga)
      if (persone) {
        r.porzioniBase = Number(persone[1])
        continue
      }
      if (!nome) {
        nome = riga.replace(/^#+\s*/, '')
        continue
      }
      note.push(riga)
      continue
    }
    if (sezione === 'ingredienti') {
      if (!riga || /[:：]$/.test(riga)) continue
      r.ingredienti!.push(riga.replace(/^\s*(?:[-*•·]|\d+[.)](?!\d))\s*/, ''))
      continue
    }
    if (sezione === 'procedimento') {
      if (!riga) {
        chiudiPasso()
        continue
      }
      const numerato = /^\s*(?:\d+[.)]|[-*•])\s+(.*)$/.exec(riga)
      if (numerato) {
        chiudiPasso()
        passo.push(numerato[1]!)
      } else passo.push(riga)
      continue
    }
    if (riga) note.push(riga)
  }
  chiudiPasso()
  r.nome = nome
  r.procedimento = passi.filter(Boolean)
  r.note = note.join('\n')
  return r
}

/** Ricetta → testo scritto a mano (per l'esportazione leggibile e i test di andata e ritorno). */
export function aTesto(r: RicettaFormato): string {
  const righe = [`# ${r.nome}`, '']
  if (r.portata) righe.push(`Portata: ${r.portata}`)
  if (r.porzioniBase) righe.push(`Porzioni: ${r.porzioniBase}`)
  if (r.tempi?.preparazioneMin) righe.push(`Preparazione: ${r.tempi.preparazioneMin} min`)
  if (r.tempi?.cotturaMin) righe.push(`Cottura: ${r.tempi.cotturaMin} min`)
  if (r.tempi?.riposoMin) righe.push(`Riposo: ${r.tempi.riposoMin} min`)
  if (r.attrezzature?.length) righe.push(`Attrezzature: ${r.attrezzature.join(', ')}`)
  if (r.fonte) righe.push(`Fonte: ${r.fonte}`)
  righe.push('', '## Ingredienti', ...(r.ingredienti ?? []).map((i) => `- ${typeof i === 'string' ? i : i.testo}`))
  righe.push('', '## Procedimento', ...(r.procedimento ?? []).map((p, k) => `${k + 1}. ${p}`))
  if (r.note) righe.push('', '## Note', r.note)
  return `${righe.join('\n')}\n`
}
