// Calcolo della lista della spesa (SPEC §10.1–10.2). Funzione pura.
// Principio: si somma solo ciò che è certo; ogni contributo incompleto resta visibile a sé.
import { copertiEquivalenti, fattoreScalatura, porzioniEffettive, scala, arrotondaPrecisione } from '../porzioni.ts'
import { norm } from '../testo.ts'
import { type Id, type IngredientePiatto, type Piatto, REPARTO_ALTRO } from '../tipi.ts'
import { aUnitaBase, chiaveFamiglia, type CodiceUnita, famiglia, unitaBase } from '../unita.ts'

export type Natura = 'sommata' | 'qb' | 'da_verificare' | 'facoltativa'

export interface Provenienza {
  voceId: Id
  piattoId: Id
  ingredientePiattoId: Id
  nomeVoce: string
  testoOriginale: string
  /** Quantità scalata nell'unità della riga, se calcolabile. */
  quantita: number | null
}

export interface RigaCalcolata {
  chiave: string
  natura: Natura
  nome: string
  ingredienteId: Id | null
  repartoId: Id
  /** In unità base (g, ml) o nell'unità di conteggio; null se non sommabile. */
  quantita: number | null
  unita: CodiceUnita | null
  provenienze: Provenienza[]
  /** Solo 'da_verificare': perché non è sommata. */
  motivi: string[]
}

export interface AvvisoSpesa {
  tipo: 'voce_senza_ricetta' | 'piatto_senza_ingredienti'
  voceId: Id
  nomeVoce: string
  messaggio: string
}

export interface DatiCalcolo {
  evento: { adulti: number; bambini: number; coefficienteBambini: number }
  /** `daDefinire`: contributo a scelta di chi lo porta (SPEC §39), fuori dalla spesa e senza avvisi. */
  voci: { id: Id; nome: string; piattoId: Id | null; porzioni: number | null; inSpesa: boolean; daDefinire?: boolean }[]
  piatti: ReadonlyMap<Id, Piatto>
  catalogo: ReadonlyMap<Id, { id: Id; nome: string; repartoId: Id }>
}

export interface RisultatoCalcolo {
  righe: RigaCalcolata[]
  avvisi: AvvisoSpesa[]
  copertiEquivalenti: number
}

export function identita(i: Pick<IngredientePiatto, 'ingredienteId' | 'nome'>, catalogo: DatiCalcolo['catalogo']): string {
  return i.ingredienteId && catalogo.has(i.ingredienteId) ? `ing:${i.ingredienteId}` : `txt:${norm(i.nome)}`
}

/** Quantità nell'unità della riga (unità base per massa e volume). */
function inUnitaRiga(q: number, u: CodiceUnita | null): number {
  return u === null ? q : aUnitaBase(q, u)
}

function unitaRiga(u: CodiceUnita | null): CodiceUnita | null {
  if (u === null || u === 'pz') return null
  return unitaBase(u)
}

export function calcolaSpesa(d: DatiCalcolo): RisultatoCalcolo {
  const coperti = copertiEquivalenti(d.evento)
  const righe = new Map<string, RigaCalcolata>()
  const avvisi: AvvisoSpesa[] = []

  for (const voce of d.voci) {
    if (!voce.inSpesa || voce.daDefinire) continue
    if (!voce.piattoId) {
      avvisi.push({ tipo: 'voce_senza_ricetta', voceId: voce.id, nomeVoce: voce.nome, messaggio: `${voce.nome}: nessuna ricetta — aggiungila o crea un articolo manuale` })
      continue
    }
    const piatto = d.piatti.get(voce.piattoId)
    if (!piatto || piatto.ingredienti.length === 0) {
      avvisi.push({ tipo: 'piatto_senza_ingredienti', voceId: voce.id, nomeVoce: voce.nome, messaggio: `${voce.nome}: nessun ingrediente — aggiungili o crea un articolo manuale` })
      continue
    }
    const porzioni = porzioniEffettive(voce, coperti)
    const fattore = fattoreScalatura(porzioni, piatto.porzioniBase)

    for (const ing of piatto.ingredienti) {
      const id = identita(ing, d.catalogo)
      const voceCat = ing.ingredienteId ? d.catalogo.get(ing.ingredienteId) : undefined
      const nome = voceCat?.nome ?? ing.nome
      const repartoId = voceCat?.repartoId ?? REPARTO_ALTRO
      const base = ing.quantitaMax ?? ing.quantita
      const quantitaScalata =
        base === null || ing.unita === 'qb' ? null : fattore === null ? (ing.scalatura === 'fissa' ? base : null) : scala(base, fattore, ing.scalatura)
      const prov: Provenienza = {
        voceId: voce.id,
        piattoId: piatto.id,
        ingredientePiattoId: ing.id,
        nomeVoce: voce.nome,
        testoOriginale: ing.testoOriginale || ing.nome,
        quantita: quantitaScalata === null ? null : inUnitaRiga(quantitaScalata, ing.unita),
      }

      // Classificazione (SPEC §10.1), nell'ordine.
      let natura: Natura
      const motivi: string[] = []
      if (ing.facoltativo) natura = 'facoltativa'
      else if (ing.unita === 'qb') natura = 'qb'
      else {
        if (ing.statoParsing === 'da_verificare') motivi.push('interpretazione da verificare')
        if (!(piatto.porzioniBase && piatto.porzioniBase > 0) && ing.scalatura !== 'fissa') motivi.push('porzioni base mancanti')
        if (ing.quantita === null) motivi.push('quantità da definire')
        natura = motivi.length ? 'da_verificare' : 'sommata'
      }

      let chiave: string
      if (natura === 'da_verificare') chiave = `dv:${voce.id}:${ing.id}`
      else if (natura === 'qb') chiave = `${id}|qb`
      else chiave = `${id}|${chiaveFamiglia(ing.unita)}${natura === 'facoltativa' ? '|fac' : ''}`

      let riga = righe.get(chiave)
      if (!riga) {
        riga = {
          chiave,
          natura,
          nome,
          ingredienteId: voceCat ? ing.ingredienteId : null,
          repartoId,
          quantita: natura === 'qb' ? null : 0,
          unita: natura === 'qb' ? 'qb' : unitaRiga(ing.unita),
          provenienze: [],
          motivi,
        }
        if (natura === 'da_verificare') {
          // Indicazione, mai sommata: quantità scalata se possibile, altrimenti quella della ricetta.
          const indicativa = quantitaScalata ?? (fattore === null ? base : null)
          riga.quantita = indicativa === null ? null : inUnitaRiga(indicativa, ing.unita)
          riga.unita = ing.unita === null ? null : unitaRiga(ing.unita)
          if (fattore === null && base !== null && quantitaScalata === null) motivi.push('quantità della ricetta, non scalata')
        }
        righe.set(chiave, riga)
      }
      riga.provenienze.push(prov)
      if (natura === 'sommata' || natura === 'facoltativa') {
        if (riga.quantita !== null && prov.quantita !== null) riga.quantita = arrotondaPrecisione(riga.quantita + prov.quantita)
        else riga.quantita = null
      }
    }
  }
  return { righe: [...righe.values()], avvisi, copertiEquivalenti: coperti }
}

/** Identità di una chiave (prima del «|»), per i rimandi fra righe dello stesso ingrediente. */
export function identitaDaChiave(chiave: string): string {
  return chiave.split('|')[0]!
}

/** Contributi da verificare dello stesso ingrediente di una riga sommata (rimando «+ N da verificare»). */
export function contributiDaVerificare(righe: RigaCalcolata[], d: Pick<DatiCalcolo, 'piatti' | 'catalogo'>): Map<string, number> {
  const conteggio = new Map<string, number>()
  for (const r of righe) {
    if (r.natura !== 'da_verificare') continue
    const p = r.provenienze[0]!
    const ing = d.piatti.get(p.piattoId)?.ingredienti.find((i) => i.id === p.ingredientePiattoId)
    if (!ing) continue
    const id = identita(ing, d.catalogo)
    conteggio.set(id, (conteggio.get(id) ?? 0) + 1)
  }
  return conteggio
}

export { famiglia }
