// Tipi di dominio condivisi da client e server (SPEC §6.2).
import type { CodiceUnita } from './unita.ts'
import type { DataISO, Ora } from './tempo.ts'

export type { CodiceUnita } from './unita.ts'
export type { DataISO, Ora } from './tempo.ts'

export type Id = string
export type Epoch = number

export interface Versionato {
  id: Id
  versione: number
  creatoIl: Epoch
  aggiornatoIl: Epoch
}

export const TIPI_EVENTO = ['pranzo', 'cena', 'aperitivo', 'brunch'] as const
export type TipoEvento = (typeof TIPI_EVENTO)[number]

export const STATI_EVENTO = ['attivo', 'concluso', 'archiviato'] as const
export type StatoEvento = (typeof STATI_EVENTO)[number]

export interface Portata {
  id: Id
  nome: string
  ordine: number
}

export interface Evento extends Versionato {
  nome: string
  data: DataISO
  oraServizio: Ora | null
  tipo: TipoEvento
  occasione: string
  /** Adulti e bambini effettivi: manuali, o i confermati se `copertiAutomatici` (SPEC §24). */
  adulti: number
  bambini: number
  coefficienteBambini: number
  /** Coperti calcolati dai partecipanti confermati invece che dai numeri scritti a mano. */
  copertiAutomatici: boolean
  /** Numeri scritti a mano, conservati anche quando i coperti sono automatici. */
  copertiManuali: { adulti: number; bambini: number }
  /** Accompagnatori che chi usa l'app può aggiungere da sé al proprio invito (null: nessun limite). */
  maxAccompagnatori: number | null
  /** Ricorrenza della Famiglia a cui appartiene l'evento («Natale»), facoltativa (SPEC §28). */
  ricorrenzaId: Id | null
  /** Ricorrenza standard del catalogo (`src/domain/ricorrenze.ts`), in alternativa alla precedente (SPEC §30). */
  ricorrenzaStandard: string | null
  note: string
  stato: StatoEvento
  conclusoIl: Epoch | null
  archiviatoIl: Epoch | null
  portate: Portata[]
}

export interface VoceMenu extends Versionato {
  eventoId: Id
  portataId: Id
  ordine: number
  nome: string
  piattoId: Id | null
  porzioni: number | null
  incaricato: string
  inSpesa: boolean
  note: string
}

export const STATI_PARSING = ['certo', 'da_verificare', 'confermato'] as const
export type StatoParsing = (typeof STATI_PARSING)[number]

export const SCALATURE = ['proporzionale', 'fissa'] as const
export type Scalatura = (typeof SCALATURE)[number]

export interface IngredientePiatto {
  id: Id
  ordine: number
  testoOriginale: string
  nome: string
  ingredienteId: Id | null
  quantita: number | null
  quantitaMax: number | null
  unita: CodiceUnita | null
  scalatura: Scalatura
  facoltativo: boolean
  nota: string
  statoParsing: StatoParsing
  problemiParsing: string[]
}

export interface Piatto extends Versionato {
  nome: string
  portataSuggerita: string | null
  porzioniBase: number | null
  tempoPreparazioneMin: number | null
  tempoCotturaMin: number | null
  tempoRiposoMin: number | null
  attrezzature: string[]
  procedimento: string[]
  note: string
  fonte: string
  ingredienti: IngredientePiatto[]
}

export interface Ingrediente extends Versionato {
  nome: string
  sinonimi: string[]
  repartoId: Id
  unitaPreferita: CodiceUnita | null
  scalaturaAbituale: Scalatura
}

export interface Reparto extends Versionato {
  nome: string
  ordine: number
  diSistema: boolean
}

export const STATI_SPESA = ['da_comprare', 'ce_lho', 'comprato'] as const
export type StatoSpesa = (typeof STATI_SPESA)[number]

export interface ArticoloSpesa extends Versionato {
  eventoId: Id
  tipo: 'calcolato' | 'manuale'
  chiave: string | null
  stato: StatoSpesa
  fabbisognoCoperto: number | null
  quantitaUtente: number | null
  quantitaCalcolataAllaCorrezione: number | null
  repartoId: Id | null
  nascosto: boolean
  inclusa: boolean
  nota: string
  nome: string
  quantitaTesto: string
}

export const STATI_ATTIVITA = ['da_fare', 'fatto'] as const
export type StatoAttivita = (typeof STATI_ATTIVITA)[number]

export interface Attivita extends Versionato {
  eventoId: Id
  titolo: string
  data: DataISO
  ora: Ora | null
  stato: StatoAttivita
  voceMenuId: Id | null
  note: string
  ordine: number
}

export interface PortataPredefinita {
  id: Id
  nome: string
  ordine: number
}

export interface Impostazioni {
  coefficienteBambini: number
  portatePredefinite: PortataPredefinita[]
  versione: number
  aggiornatoIl: Epoch
}

export const REPARTO_ALTRO = 'rep-altro'
