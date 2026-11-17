// SQL del riepilogo organizzativo di un evento (SPEC §26): solo conteggi.
import { type Db, tutti, uno } from '../connessione.ts'

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

export const vociMenu = (db: Db, eventoId: string) => conta(db, 'SELECT count(*) AS n FROM voci_menu WHERE evento_id = ?', eventoId)

// ── «Per te» (SPEC §31.3): ciò che riguarda l'utente fra tutti gli eventi in corso ──────────

export interface RigaIncaricoMio {
  tipo: 'voce' | 'cosa'
  id: string
  nome: string
  evento_id: string
  evento: string
  data: string
}

/** Piatti e cose affidati all'utente, non ancora fatti, negli eventi non archiviati (i permessi li ricontrolla il servizio). */
export const incarichiMiei = (db: Db, utenteId: string) =>
  tutti<RigaIncaricoMio>(
    db,
    `SELECT 'voce' AS tipo, v.id, v.nome, e.id AS evento_id, e.nome AS evento, e.data FROM voci_menu v JOIN eventi e ON e.id = v.evento_id
       WHERE v.incaricato_id = ? AND v.incarico_completato = 0 AND e.stato <> 'archiviato'
     UNION ALL
     SELECT 'cosa', c.id, c.nome, e.id, e.nome, e.data FROM cose_da_portare c JOIN eventi e ON e.id = c.evento_id
       WHERE c.incaricato_id = ? AND c.completato = 0 AND e.stato <> 'archiviato'
     ORDER BY 6, 3`,
    utenteId,
    utenteId,
  )

export interface RigaSondaggioAperto {
  id: string
  testo: string
  gruppo_id: string | null
  evento_id: string | null
  dove: string
}

/** Sondaggi aperti a cui l'utente non ha ancora risposto, nelle sue Famiglie e negli eventi non archiviati. */
export const sondaggiDaVotare = (db: Db, utenteId: string, adesso: number) =>
  tutti<RigaSondaggioAperto>(
    db,
    `SELECT m.id, m.testo, m.gruppo_id, m.evento_id, coalesce(g.nome, e.nome) AS dove
       FROM sondaggi s JOIN messaggi m ON m.id = s.messaggio_id
       LEFT JOIN gruppi g ON g.id = m.gruppo_id LEFT JOIN eventi e ON e.id = m.evento_id
      WHERE s.chiuso_il IS NULL AND (s.scade_il IS NULL OR s.scade_il > ?)
        AND NOT EXISTS (SELECT 1 FROM voti_sondaggio v WHERE v.messaggio_id = m.id AND v.utente_id = ?)
        AND (m.gruppo_id IN (SELECT gruppo_id FROM membri_gruppo WHERE utente_id = ?) OR (e.id IS NOT NULL AND e.stato <> 'archiviato'))
      ORDER BY m.creato_il DESC LIMIT 20`,
    adesso,
    utenteId,
    utenteId,
  )
