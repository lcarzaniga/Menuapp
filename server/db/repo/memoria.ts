// SQL della memoria di famiglia (SPEC §40): storia, ricordi ed esperienze delle ricette.
import { type Db, esegui, tutti, uno } from '../connessione.ts'
import { CONDIVISA_CON_LE_MIE_FAMIGLIE } from './accesso.ts'

export interface RigaMemoria {
  id: string
  gruppo_id: string | null
  piatto_id: string | null
  tipo: 'storia' | 'ricordo' | 'esperienza'
  testo: string
  evento_id: string | null
  evento_nome: string | null
  pubblica: number
  autore_id: string | null
  autore_nome: string
  versione: number
  creato_il: number
  aggiornato_il: number
}

const SELEZIONE = 'SELECT m.*, e.nome AS evento_nome FROM memorie m LEFT JOIN eventi e ON e.id = m.evento_id'

export const leggiMemoria = (db: Db, id: string) => uno<RigaMemoria>(db, `${SELEZIONE} WHERE m.id = ?`, id)
export const memoriePiatto = (db: Db, piattoId: string) => tutti<RigaMemoria>(db, `${SELEZIONE} WHERE m.piatto_id = ? ORDER BY m.creato_il`, piattoId)
export const storiaPiatto = (db: Db, piattoId: string) => uno<RigaMemoria>(db, `${SELEZIONE} WHERE m.piatto_id = ? AND m.tipo = 'storia'`, piattoId)

export function inserisciMemoria(
  db: Db,
  m: { id: string; gruppoId: string | null; piattoId: string; tipo: RigaMemoria['tipo']; testo: string; eventoId: string | null; pubblica: boolean; autoreId: string; autoreNome: string },
  adesso: number,
): void {
  esegui(
    db,
    `INSERT INTO memorie (id, gruppo_id, piatto_id, tipo, testo, evento_id, pubblica, autore_id, autore_nome, versione, creato_il, aggiornato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    m.id, m.gruppoId, m.piattoId, m.tipo, m.testo, m.eventoId, m.pubblica, m.autoreId, m.autoreNome, adesso, adesso,
  )
}

/**
 * La memoria di una ricetta la vede chi ne fa parte: il proprietario, i membri della Famiglia con
 * cui è condivisa e le persone con cui è condivisa personalmente. Non chi la legge solo perché
 * pubblica o perché collegata al menù di un evento.
 */
export function memoriaLeggibile(db: Db, piattoId: string, utenteId: string): boolean {
  return (
    uno(
      db,
      `SELECT 1 FROM piatti p WHERE p.id = ? AND (p.proprietario_id = ? OR ${CONDIVISA_CON_LE_MIE_FAMIGLIE}
         OR EXISTS (SELECT 1 FROM condivisioni_piatto c WHERE c.piatto_id = p.id AND c.utente_id = ?))`,
      piattoId,
      utenteId,
      utenteId,
      utenteId,
    ) !== undefined
  )
}

/** Aggiunge ricordi ed esperienze: il proprietario e i membri della Famiglia con cui è condivisa. */
export function memoriaScrivibile(db: Db, piattoId: string, utenteId: string): boolean {
  return uno(db, `SELECT 1 FROM piatti p WHERE p.id = ? AND (p.proprietario_id = ? OR ${CONDIVISA_CON_LE_MIE_FAMIGLIE})`, piattoId, utenteId, utenteId) !== undefined
}
