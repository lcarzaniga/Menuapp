// Piano delle attività (SPEC §7.7, F6).
import { pulisci } from '../../src/domain/testo.ts'
import { aggiungiGiorni } from '../../src/domain/tempo.ts'
import type { Attivita, StatoAttivita } from '../../src/domain/tipi.ts'
import { type Db, esegui, transazione, tutti, uno } from '../db/connessione.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import { nonTrovato, regolaViolata } from './errori.ts'
import { leggiEvento, richiediModificabile } from './eventi.ts'
import { aggiornaConVersione, creaIdempotente, eliminaConVersione } from './versioni.ts'

interface Riga {
  id: string
  evento_id: string
  titolo: string
  data: string
  ora: string | null
  stato: string
  voce_menu_id: string | null
  note: string
  ordine: number
  versione: number
  creato_il: number
  aggiornato_il: number
}

const daRiga = (r: Riga): Attivita => ({
  id: r.id,
  eventoId: r.evento_id,
  titolo: r.titolo,
  data: r.data,
  ora: r.ora,
  stato: r.stato as StatoAttivita,
  voceMenuId: r.voce_menu_id,
  note: r.note,
  ordine: r.ordine,
  versione: r.versione,
  creatoIl: r.creato_il,
  aggiornatoIl: r.aggiornato_il,
})

/** Ordine: data, poi ora (prima quelle senza ora), poi ordine di inserimento. */
export function elencaAttivita(db: Db, eventoId: string): Attivita[] {
  return tutti<Riga>(db, 'SELECT * FROM attivita WHERE evento_id = ? ORDER BY data, ora IS NOT NULL, ora, ordine, creato_il', eventoId).map(daRiga)
}

export function leggiAttivita(db: Db, id: string): Attivita {
  const r = uno<Riga>(db, 'SELECT * FROM attivita WHERE id = ?', id)
  if (!r) throw nonTrovato('Attività')
  return daRiga(r)
}

function controllaVoce(db: Db, eventoId: string, voceId: string | null): void {
  if (!voceId) return
  if (!uno(db, 'SELECT 1 FROM voci_menu WHERE id = ? AND evento_id = ?', voceId, eventoId)) {
    throw regolaViolata('voce_di_altro_evento', 'La voce di menù collegata non appartiene a questo evento')
  }
}

export function creaAttivita(
  db: Db,
  eventoId: string,
  d: { id: string; titolo: string; data: string; ora: string | null; voceMenuId: string | null; note: string },
  adesso = Date.now(),
): { creato: boolean; valore: Attivita } {
  return transazione(db, () => {
    richiediModificabile(leggiEvento(db, eventoId))
    controllaVoce(db, eventoId, d.voceMenuId)
    const titolo = pulisci(d.titolo)
    const esito = creaIdempotente(
      db,
      'attivita',
      d.id,
      () => uno(db, 'SELECT 1 FROM attivita WHERE id = ?', d.id) && leggiAttivita(db, d.id),
      (a) => a !== undefined && a.titolo === titolo && a.eventoId === eventoId,
      () => {
        const ordine = (uno<{ m: number | null }>(db, 'SELECT max(ordine) AS m FROM attivita WHERE evento_id = ? AND data = ?', eventoId, d.data)?.m ?? -1) + 1
        esegui(
          db,
          `INSERT INTO attivita (id, evento_id, titolo, data, ora, stato, voce_menu_id, note, ordine, versione, creato_il, aggiornato_il)
           VALUES (?, ?, ?, ?, ?, 'da_fare', ?, ?, ?, 1, ?, ?)`,
          d.id, eventoId, titolo, d.data, d.ora, d.voceMenuId, d.note, ordine, adesso, adesso,
        )
      },
    )
    if (esito.creato) incrementaRevisione(db)
    return { creato: esito.creato, valore: esito.valore as Attivita }
  })
}

export function aggiornaAttivita(
  db: Db,
  id: string,
  d: { titolo: string; data: string; ora: string | null; voceMenuId: string | null; note: string; stato: StatoAttivita; versione: number },
): Attivita {
  return transazione(db, () => {
    const a = leggiAttivita(db, id)
    richiediModificabile(leggiEvento(db, a.eventoId))
    controllaVoce(db, a.eventoId, d.voceMenuId)
    aggiornaConVersione(
      db,
      'attivita',
      id,
      d.versione,
      { titolo: pulisci(d.titolo), data: d.data, ora: d.ora, voce_menu_id: d.voceMenuId, note: d.note, stato: d.stato },
      () => leggiAttivita(db, id),
    )
    incrementaRevisione(db)
    return leggiAttivita(db, id)
  })
}

export function eliminaAttivita(db: Db, id: string, versione: number): void {
  transazione(db, () => {
    const a = leggiAttivita(db, id)
    richiediModificabile(leggiEvento(db, a.eventoId))
    eliminaConVersione(db, 'attivita', id, versione, () => leggiAttivita(db, id))
    incrementaRevisione(db)
  })
}

/** «Sposta anche le attività di N giorni» quando cambia la data dell'evento. */
export function spostaAttivita(db: Db, eventoId: string, giorni: number, adesso = Date.now()): Attivita[] {
  return transazione(db, () => {
    richiediModificabile(leggiEvento(db, eventoId))
    for (const a of elencaAttivita(db, eventoId)) {
      esegui(db, 'UPDATE attivita SET data = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ?', aggiungiGiorni(a.data, giorni), adesso, a.id)
    }
    incrementaRevisione(db)
    return elencaAttivita(db, eventoId)
  })
}
