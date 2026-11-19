// Cronologia delle ricette (SPEC §41): ogni modifica applicata diventa una revisione con chi l'ha
// fatta (o suggerita), chi l'ha approvata, i campi cambiati e il contenuto dopo la modifica. Alla
// prima revisione si conserva anche il contenuto di prima («iniziale»), così si può sempre tornare
// indietro. Il ripristino crea una revisione nuova: la cronologia non si cancella mai.
import { randomUUID } from 'node:crypto'
import { campiCambiati, type ContenutoRicetta, contenutoDi } from '../../src/domain/ricetta/proposte.ts'
import type { Db } from '../db/connessione.ts'
import * as repoAccesso from '../db/repo/accesso.ts'
import * as repoRic from '../db/repo/ricettario.ts'
import * as repo from '../db/repo/revisioni.ts'

export interface MetaRevisione {
  tipo: repo.RigaRevisione['tipo']
  /** Chi ha fatto o suggerito la modifica. */
  autore: { id: string | null; nome: string }
  approvatoDa?: { id: string; nome: string } | null
  propostaId?: string | null
  ripristinaNumero?: number | null
  motivazione?: string
}

export const persona = (db: Db, id: string) => ({ id, nome: repoAccesso.leggiUtente(db, id)?.nome ?? '' })

export function contenutoAttuale(db: Db, piattoId: string): ContenutoRicetta {
  const p = repoRic.leggiPiatto(db, piattoId)
  if (!p) throw new Error(`Piatto inesistente: ${piattoId}`)
  return contenutoDi(p)
}

/** Prima revisione della ricetta: il contenuto com'era prima della cronologia. */
function iniziale(db: Db, piattoId: string, prima: ContenutoRicetta, adesso: number): void {
  if (repo.ultimoNumero(db, piattoId) > 0) return
  const proprietario = repoAccesso.proprietarioPiatto(db, piattoId)
  repo.inserisci(db, {
    id: randomUUID(),
    piatto_id: piattoId,
    tipo: 'iniziale',
    autore_id: proprietario ?? null,
    autore_nome: proprietario ? persona(db, proprietario).nome : '',
    approvato_da_id: null,
    approvato_da_nome: null,
    proposta_id: null,
    ripristina_numero: null,
    campi: '[]',
    contenuto: JSON.stringify(prima),
    motivazione: '',
    creato_il: adesso,
  })
}

/** Registra una modifica del contenuto (se qualcosa è cambiato). Da chiamare in una transazione. */
export function registraContenuto(db: Db, piattoId: string, prima: ContenutoRicetta, meta: MetaRevisione, adesso: number): void {
  const dopo = contenutoAttuale(db, piattoId)
  const campi = campiCambiati(prima, dopo)
  if (!campi.length) return
  iniziale(db, piattoId, prima, adesso)
  inserisci(db, piattoId, meta, campi, JSON.stringify(dopo), adesso)
}

/** Registra un evento senza contenuto (foto, proprietà). Da chiamare in una transazione. */
export function registraEvento(db: Db, piattoId: string, meta: MetaRevisione, campi: { campo: string; prima: unknown; dopo: unknown }[], adesso: number): void {
  iniziale(db, piattoId, contenutoAttuale(db, piattoId), adesso)
  inserisci(db, piattoId, meta, campi, null, adesso)
}

function inserisci(db: Db, piattoId: string, meta: MetaRevisione, campi: unknown[], contenuto: string | null, adesso: number): void {
  repo.inserisci(db, {
    id: randomUUID(),
    piatto_id: piattoId,
    tipo: meta.tipo,
    autore_id: meta.autore.id,
    autore_nome: meta.autore.nome,
    approvato_da_id: meta.approvatoDa?.id ?? null,
    approvato_da_nome: meta.approvatoDa?.nome ?? null,
    proposta_id: meta.propostaId ?? null,
    ripristina_numero: meta.ripristinaNumero ?? null,
    campi: JSON.stringify(campi),
    contenuto,
    motivazione: meta.motivazione ?? '',
    creato_il: adesso,
  })
}
