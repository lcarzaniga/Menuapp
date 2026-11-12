// Contenuto del menù stampato e impaginazione su fogli di dimensione fissa.
import type { Menu } from '@/contratto/eventi.ts'
import type { FormatoStampa, OpzioniStampa } from '@/domain/stampa.ts'
import { dataLunga } from '@/domain/tempo.ts'

export interface VoceStampa {
  id: string
  nome: string
  nota: string
}
export interface PortataStampa {
  id: string
  nome: string
  voci: VoceStampa[]
}
export interface ContenutoStampa {
  titolo: string
  sottotitolo: string
  data: string | null
  portate: PortataStampa[]
  nota: string
}

export function contenutoDa(menu: Menu, o: OpzioniStampa): ContenutoStampa {
  return {
    titolo: o.titolo?.trim() || menu.evento.nome,
    sottotitolo: o.sottotitolo.trim(),
    data: o.mostraData ? dataLunga(menu.evento.data) : null,
    portate: menu.portate
      .filter((p) => !o.nascondiPortateVuote || p.voci.length > 0)
      .map((p) => ({ id: p.id, nome: p.nome, voci: p.voci.map((v) => ({ id: v.id, nome: v.nome, nota: o.mostraNote ? v.note.trim() : '' })) })),
    nota: o.nota.trim(),
  }
}

// ── Geometria (mm) ─────────────────────────────────────────

export interface Geometria {
  /** Foglio fisico. */
  foglio: { larghezza: number; altezza: number; orientamento: 'portrait' | 'landscape' }
  /** Pagina logica del menù (in 2×A5 ce ne sono due per foglio). */
  pagina: { larghezza: number; altezza: number }
  copiePerFoglio: 1 | 2
  /** Scala tipografica rispetto all'A4. */
  scala: number
}

export function geometria(formato: FormatoStampa): Geometria {
  if (formato === 'A4') return { foglio: { larghezza: 210, altezza: 297, orientamento: 'portrait' }, pagina: { larghezza: 210, altezza: 297 }, copiePerFoglio: 1, scala: 1 }
  if (formato === 'A5') return { foglio: { larghezza: 148, altezza: 210, orientamento: 'portrait' }, pagina: { larghezza: 148, altezza: 210 }, copiePerFoglio: 1, scala: 0.74 }
  return { foglio: { larghezza: 297, altezza: 210, orientamento: 'landscape' }, pagina: { larghezza: 148.5, altezza: 210 }, copiePerFoglio: 2, scala: 0.74 }
}

export const PX_PER_MM = 96 / 25.4

// ── Densità ─────────────────────────────────────────────────

/**
 * Livelli di compattezza provati in ordine: prima si stringono gli spazi, poi il carattere
 * cala di poco (mai sotto l'86%). Oltre, si va su più pagine.
 */
export const LIVELLI = [
  { carattere: 1, spazi: 1 },
  { carattere: 1, spazi: 0.75 },
  { carattere: 0.95, spazi: 0.6 },
  { carattere: 0.9, spazi: 0.48 },
  { carattere: 0.86, spazi: 0.4 },
] as const

// ── Impaginazione ───────────────────────────────────────────

/** Misure di un blocco nel flusso continuo (px, relative all'area del contenuto). */
export interface MisuraBlocco {
  chiave: string
  alto: number
  basso: number
  /** Solo portate: estensione di ogni voce. */
  voci?: { alto: number; basso: number }[]
}

/** Un blocco su una pagina; per una portata divisa, l'intervallo di voci [da, a). */
export interface Pezzo {
  chiave: string
  da?: number
  a?: number
  /** Continuazione di una portata iniziata nella pagina precedente. */
  segue?: boolean
}

/** Margine di sicurezza contro arrotondamenti e differenze fra schermo e stampa. */
const TOLLERANZA = 0.985

/**
 * Distribuisce i blocchi sulle pagine. I blocchi non si spezzano, tranne le portate più
 * lunghe dello spazio rimasto, che si dividono fra le voci (mai lasciando una voce sola
 * sotto il titolo, se si può evitare).
 */
export function impagina(blocchi: MisuraBlocco[], capacita: number): Pezzo[][] {
  if (!(capacita > 0) || blocchi.length === 0) return [blocchi.map((b) => ({ chiave: b.chiave }))]
  const cap = capacita * TOLLERANZA
  const pagine: Pezzo[][] = [[]]
  let usato = 0
  let precedente: number | null = null // `basso` del blocco precedente nel flusso
  const nuovaPagina = () => {
    pagine.push([])
    usato = 0
  }
  for (const b of blocchi) {
    const spazio = precedente === null ? 0 : Math.max(0, b.alto - precedente)
    precedente = b.basso
    const altezza = b.basso - b.alto
    const gap = usato > 0 ? spazio : 0
    if (usato + gap + altezza <= cap) {
      pagine[pagine.length - 1]!.push({ chiave: b.chiave })
      usato += gap + altezza
      continue
    }
    const voci = b.voci ?? []
    if (voci.length >= 2) {
      // Portata divisa: titolo + voci [da, a) misurano titolo + voci + coda.
      const titolo = voci[0]!.alto - b.alto
      const coda = b.basso - voci[voci.length - 1]!.basso
      const misura = (da: number, a: number) => titolo + (voci[a - 1]!.basso - voci[da]!.alto) + coda
      let da = 0
      let primo = true
      while (da < voci.length) {
        const g = usato > 0 ? spazio : 0
        let a = da
        while (a < voci.length && usato + g + misura(da, a + 1) <= cap) a++
        // Evita una sola voce in fondo alla pagina o all'inizio della successiva.
        if (a < voci.length && a - da === 1 && voci.length - da > 1 && usato > 0) a = da
        if (a < voci.length && voci.length - a === 1 && a - da >= 2) a--
        if (a === da) {
          if (usato === 0) a = da + 1 // non entra nemmeno una voce in una pagina vuota: la si mette comunque
          else {
            nuovaPagina()
            continue
          }
        }
        pagine[pagine.length - 1]!.push({ chiave: b.chiave, da, a, ...(primo ? {} : { segue: true }) })
        usato += g + misura(da, a)
        primo = false
        da = a
        if (da < voci.length) nuovaPagina()
      }
      continue
    }
    if (usato > 0) nuovaPagina()
    pagine[pagine.length - 1]!.push({ chiave: b.chiave })
    usato = altezza
  }
  return pagine.filter((p) => p.length > 0)
}

/** Il livello più arioso che usa il numero minimo di pagine. */
export function scegliLivello(perLivello: Pezzo[][][]): number {
  const minimo = Math.min(...perLivello.map((p) => p.length))
  return Math.max(0, perLivello.findIndex((p) => p.length === minimo))
}
