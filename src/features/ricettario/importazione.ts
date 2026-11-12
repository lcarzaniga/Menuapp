// Lettura dei file ricetta (docs/FORMATO-RICETTA.md) e conversione in piatti dell'app.
import { strFromU8, unzipSync } from 'fflate'
import { nuovoId } from '@/api/client'
import { validaRicetta } from '@/contratto/formato-ricetta.ts'
import { analizzaRiga, type IndiceCatalogo } from '@/domain/parser/analizza.ts'
import { daTesto, type RicettaFormato } from '@/domain/ricetta/formato.ts'
import { norm } from '@/domain/testo.ts'
import type { IngredientePiatto } from '@/domain/tipi.ts'
import { MASSIMO_FOTO } from '@/contratto/foto.ts'
import { tipoDaNome } from '@/lib/immagini'
import { daAnalisi } from './EditorIngredienti'

export interface FotoDaImportare {
  nome: string
  dati: Blob
  didascalia: string
  principale: boolean
  /** Passaggio del procedimento (indice da 0), se indicato. */
  passo: number | null
}

export interface RicettaDaImportare {
  ricetta: RicettaFormato
  foto: FotoDaImportare[]
  avvisi: string[]
}

const decodifica = (b: Uint8Array) => strFromU8(b.subarray(0, 3).every((x, i) => x === [0xef, 0xbb, 0xbf][i]) ? b.subarray(3) : b)

function daJson(testo: string, foto: (percorso: string) => Uint8Array | undefined): RicettaDaImportare {
  let dati: unknown
  try {
    dati = JSON.parse(testo)
  } catch {
    throw new Error('Il file JSON non è valido')
  }
  const v = validaRicetta(dati)
  if (!v.ok) throw new Error(v.errore)
  const avvisi: string[] = []
  const elenco: FotoDaImportare[] = []
  for (const f of v.ricetta.foto ?? []) {
    const contenuto = foto(f.file)
    if (!contenuto) {
      avvisi.push(`Foto mancante nel pacchetto: ${f.file}`)
      continue
    }
    elenco.push({
      nome: f.file,
      dati: new Blob([contenuto as Uint8Array<ArrayBuffer>], { type: tipoDaNome(f.file) }),
      didascalia: f.didascalia ?? '',
      principale: f.principale ?? false,
      passo: f.passo === undefined ? null : f.passo - 1,
    })
  }
  if (!elenco.some((f) => f.principale) && elenco[0]) elenco[0].principale = true
  return { ricetta: v.ricetta, foto: elenco.slice(0, MASSIMO_FOTO), avvisi }
}

/** Legge un file: pacchetto (.menuapp-ricetta/.zip), .json, oppure testo scritto a mano (.txt/.md). */
export async function leggiFile(file: File): Promise<RicettaDaImportare[]> {
  const nome = file.name.toLowerCase()
  const byte = new Uint8Array(await file.arrayBuffer())
  const zip = byte[0] === 0x50 && byte[1] === 0x4b // «PK»
  if (zip) {
    let contenuto: Record<string, Uint8Array>
    try {
      contenuto = unzipSync(byte)
    } catch {
      throw new Error('Pacchetto danneggiato o non leggibile')
    }
    const ricette = Object.keys(contenuto).filter((k) => /(^|\/)ricetta\.json$/.test(k))
    if (ricette.length === 0) throw new Error('Nel pacchetto non c\'è nessun ricetta.json')
    return ricette.map((k) => {
      const base = k.slice(0, -'ricetta.json'.length)
      return daJson(decodifica(contenuto[k]!), (p) => contenuto[`${base}${p.replace(/^\.?\//, '')}`])
    })
  }
  const testo = decodifica(byte)
  if (nome.endsWith('.json') || testo.trimStart().startsWith('{')) return [daJson(testo, () => undefined)]
  return [daTestoLibero(testo)]
}

export function daTestoLibero(testo: string): RicettaDaImportare {
  const ricetta = daTesto(testo)
  if (!ricetta.nome.trim()) throw new Error('Manca il titolo della ricetta (prima riga, o riga che comincia con #)')
  const avvisi = ricetta.ingredienti?.length ? [] : ['Nessun ingrediente trovato: c\'è la sezione «Ingredienti»?']
  return { ricetta, foto: [], avvisi }
}

/** Ingredienti del formato → ingredienti dell'app. Gli oggetti con nome sono già verificati. */
export function ingredientiDa(ricetta: RicettaFormato, indice: IndiceCatalogo): IngredientePiatto[] {
  return (ricetta.ingredienti ?? []).map((i, ordine) => {
    if (typeof i === 'string' || !i.nome) {
      return daAnalisi(analizzaRiga(typeof i === 'string' ? i : i.testo, indice), ordine)
    }
    const cat = indice.esatto.get(norm(i.nome))
    return {
      id: nuovoId(),
      ordine,
      testoOriginale: i.testo,
      nome: i.nome,
      ingredienteId: cat?.id ?? null,
      quantita: i.unita === 'qb' ? null : (i.quantita ?? null),
      quantitaMax: i.unita === 'qb' ? null : (i.quantitaMax ?? null),
      unita: i.unita ?? null,
      scalatura: i.scalatura ?? (cat?.scalaturaAbituale === 'fissa' ? 'fissa' : 'proporzionale'),
      facoltativo: i.facoltativo ?? false,
      nota: i.nota ?? '',
      statoParsing: 'confermato',
      problemiParsing: [],
    }
  })
}

/** Corpo di POST /piatti per una ricetta importata. */
export function nuovoPiatto(id: string, nome: string, ricetta: RicettaFormato, ingredienti: IngredientePiatto[]) {
  return {
    id,
    nome,
    portataSuggerita: ricetta.portata ?? null,
    porzioniBase: ricetta.porzioniBase ?? null,
    tempoPreparazioneMin: ricetta.tempi?.preparazioneMin ?? null,
    tempoCotturaMin: ricetta.tempi?.cotturaMin ?? null,
    tempoRiposoMin: ricetta.tempi?.riposoMin ?? null,
    attrezzature: (ricetta.attrezzature ?? []).filter((a) => a.trim()),
    procedimento: (ricetta.procedimento ?? []).filter((p) => p.trim()),
    note: ricetta.note ?? '',
    fonte: ricetta.fonte ?? '',
    ingredienti,
  }
}

/** Nome libero: se esiste già, aggiunge «(importata)», poi un numero. */
export function nomeLibero(nome: string, esistenti: string[]): string {
  const presi = new Set(esistenti.map(norm))
  if (!presi.has(norm(nome))) return nome
  for (let i = 1; ; i++) {
    const candidato = i === 1 ? `${nome} (importata)` : `${nome} (importata ${i})`
    if (!presi.has(norm(candidato))) return candidato
  }
}
