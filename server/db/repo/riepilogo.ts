// SQL del riepilogo organizzativo di un evento (SPEC §26): solo conteggi.
import { type Db, uno } from '../connessione.ts'

const conta = (db: Db, sql: string, ...p: (string | number)[]) => uno<{ n: number }>(db, sql, ...p)?.n ?? 0

export const proposteInAttesa = (db: Db, eventoId: string) =>
  conta(db, "SELECT count(*) AS n FROM proposte p JOIN messaggi m ON m.id = p.messaggio_id WHERE m.evento_id = ? AND p.stato = 'in_valutazione'", eventoId)

export const sondaggiAperti = (db: Db, eventoId: string, adesso: number) =>
  conta(
    db,
    'SELECT count(*) AS n FROM sondaggi s JOIN messaggi m ON m.id = s.messaggio_id WHERE m.evento_id = ? AND s.chiuso_il IS NULL AND (s.scade_il IS NULL OR s.scade_il > ?)',
    eventoId,
    adesso,
  )

export const attivita = (db: Db, eventoId: string, oggi: string) =>
  uno<{ da_fare: number; in_ritardo: number; totale: number }>(
    db,
    "SELECT count(*) AS totale, coalesce(sum(stato = 'da_fare'), 0) AS da_fare, coalesce(sum(stato = 'da_fare' AND data < ?), 0) AS in_ritardo FROM attivita WHERE evento_id = ?",
    oggi,
    eventoId,
  )!
