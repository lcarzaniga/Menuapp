// Contratto API: snapshot degli eventi archiviati e attività (SPEC §7.3–7.4, §7.7).
import { z } from 'zod'
import type { Menu } from './eventi.ts'
import type { RispostaSpesa } from './spesa.ts'
import type { OpzioniStampa } from '../domain/stampa.ts'
import type { Attivita, Evento, Piatto } from '../domain/tipi.ts'
import { DataISO, Id, NomeObbligatorio, Ora, TestoLungo, Versione } from './comune.ts'
import { STATI_ATTIVITA } from '../domain/tipi.ts'

export const VERSIONE_FORMATO_SNAPSHOT = 1

/** Contenuto autonomo: si mostra senza leggere altre tabelle. */
export interface ContenutoSnapshot {
  evento: Omit<Evento, 'versione' | 'creatoIl' | 'aggiornatoIl'>
  copertiEquivalenti: number
  menu: Menu['portate']
  piatti: (Omit<Piatto, 'versione' | 'creatoIl' | 'aggiornatoIl' | 'ingredienti'> & {
    ingredienti: (Piatto['ingredienti'][number] & { ingredienteNome: string | null; repartoNome: string | null })[]
  })[]
  spesa: RispostaSpesa
  reparti: { id: string; nome: string }[]
  attivita: Omit<Attivita, 'versione' | 'creatoIl' | 'aggiornatoIl'>[]
  /** Stile del menù stampato all'archiviazione (assente negli snapshot precedenti). */
  stampa?: OpzioniStampa | null
}

export interface Snapshot {
  id: string
  eventoId: string
  stato: 'valido' | 'superato'
  versioneFormato: number
  creatoIl: number
  superatoIl: number | null
  contenuto: ContenutoSnapshot
}

export interface InfoRiapertura {
  piattiCambiati: { dishId: string; nome: string; esito: 'modificato' | 'eliminato' }[]
}

export const SchemaCopiaPiatto = z.object({ piattoId: Id, nuovoId: Id })

const CampiAttivita = {
  titolo: NomeObbligatorio,
  data: DataISO,
  ora: Ora.nullable(),
  voceMenuId: Id.nullable(),
  note: TestoLungo,
}
export const SchemaNuovaAttivita = z.object({ id: Id, ...CampiAttivita })
export const SchemaAggiornaAttivita = z.object({ ...CampiAttivita, stato: z.enum(STATI_ATTIVITA), versione: Versione })
export const SchemaSpostaAttivita = z.object({ giorni: z.number().int().min(-365).max(365) })
