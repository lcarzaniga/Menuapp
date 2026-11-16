// SQL dei partecipanti degli eventi (SPEC §24).
import type { Anonimi, CategoriaPersona, Presenza, StatoPresenza } from '../../../src/domain/partecipanti.ts'
import { type Db, esegui, tutti, uno } from '../connessione.ts'

export interface RigaPartecipante {
  id: string
  evento_id: string
  invito_id: string | null
  nome: string
  nome_norm: string
  categoria: CategoriaPersona
  stato: StatoPresenza
  note: string
  utente_id: string | null
  esterno_id: string | null
  anonimi_adulti_confermati: number
  anonimi_adulti_in_attesa: number
  anonimi_bambini_confermati: number
  anonimi_bambini_in_attesa: number
  ordine: number
  versione: number
  creato_il: number
  aggiornato_il: number
}

export const anonimiDi = (r: RigaPartecipante): Anonimi => ({
  adultiConfermati: r.anonimi_adulti_confermati,
  adultiInAttesa: r.anonimi_adulti_in_attesa,
  bambiniConfermati: r.anonimi_bambini_confermati,
  bambiniInAttesa: r.anonimi_bambini_in_attesa,
})

export const presenza = (r: RigaPartecipante): Presenza => ({ id: r.id, invitoId: r.invito_id, categoria: r.categoria, stato: r.stato, anonimi: anonimiDi(r) })

export function partecipantiEvento(db: Db, eventoId: string): RigaPartecipante[] {
  return tutti<RigaPartecipante>(db, 'SELECT * FROM partecipanti WHERE evento_id = ? ORDER BY ordine, creato_il, id', eventoId)
}

export const presenzeEvento = (db: Db, eventoId: string): Presenza[] => partecipantiEvento(db, eventoId).map(presenza)

export function leggiPartecipante(db: Db, id: string): RigaPartecipante | undefined {
  return uno<RigaPartecipante>(db, 'SELECT * FROM partecipanti WHERE id = ?', id)
}

export function prossimoOrdine(db: Db, eventoId: string): number {
  return (uno<{ n: number | null }>(db, 'SELECT max(ordine) AS n FROM partecipanti WHERE evento_id = ?', eventoId)?.n ?? -1) + 1
}

export interface DatiPartecipante {
  id: string
  eventoId: string
  invitoId: string | null
  nome: string
  nomeNorm: string
  categoria: CategoriaPersona
  stato: StatoPresenza
  note: string
  utenteId: string | null
  esternoId: string | null
  anonimi: Anonimi
  ordine: number
}

export function inserisciPartecipante(db: Db, d: DatiPartecipante, adesso: number): void {
  esegui(
    db,
    `INSERT INTO partecipanti (id, evento_id, invito_id, nome, nome_norm, categoria, stato, note, utente_id, esterno_id,
       anonimi_adulti_confermati, anonimi_adulti_in_attesa, anonimi_bambini_confermati, anonimi_bambini_in_attesa, ordine, creato_il, aggiornato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    d.id, d.eventoId, d.invitoId, d.nome, d.nomeNorm, d.categoria, d.stato, d.note, d.utenteId, d.esternoId,
    d.anonimi.adultiConfermati, d.anonimi.adultiInAttesa, d.anonimi.bambiniConfermati, d.anonimi.bambiniInAttesa, d.ordine, adesso, adesso,
  )
}

/** Aggiornamento condizionato alla versione: false se un altro l'ha cambiato nel frattempo. */
export function aggiornaPartecipante(
  db: Db,
  id: string,
  versione: number,
  d: Pick<DatiPartecipante, 'invitoId' | 'nome' | 'nomeNorm' | 'categoria' | 'stato' | 'note' | 'utenteId' | 'esternoId' | 'anonimi'>,
  adesso: number,
): boolean {
  const cambiate = esegui(
    db,
    `UPDATE partecipanti SET invito_id = ?, nome = ?, nome_norm = ?, categoria = ?, stato = ?, note = ?, utente_id = ?, esterno_id = ?,
       anonimi_adulti_confermati = ?, anonimi_adulti_in_attesa = ?, anonimi_bambini_confermati = ?, anonimi_bambini_in_attesa = ?,
       versione = versione + 1, aggiornato_il = ?
     WHERE id = ? AND versione = ?`,
    d.invitoId, d.nome, d.nomeNorm, d.categoria, d.stato, d.note, d.utenteId, d.esternoId,
    d.anonimi.adultiConfermati, d.anonimi.adultiInAttesa, d.anonimi.bambiniConfermati, d.anonimi.bambiniInAttesa, adesso, id, versione,
  )
  return cambiate === 1
}

export function eliminaPartecipante(db: Db, id: string): void {
  esegui(db, 'DELETE FROM partecipanti WHERE id = ?', id)
}

/** Rinomina in rubrica: il nome segue nei partecipanti collegati. */
export function rinominaEsterno(db: Db, esternoId: string, nome: string, nomeNorm: string, adesso: number): void {
  esegui(db, 'UPDATE partecipanti SET nome = ?, nome_norm = ?, versione = versione + 1, aggiornato_il = ? WHERE esterno_id = ?', nome, nomeNorm, adesso, esternoId)
}

export function impostaCoperti(db: Db, eventoId: string, d: { automatici: boolean; adulti: number; bambini: number; maxAccompagnatori: number | null }, adesso: number): void {
  esegui(
    db,
    'UPDATE eventi SET coperti_automatici = ?, adulti = ?, bambini = ?, max_accompagnatori = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ?',
    d.automatici ? 1 : 0, d.adulti, d.bambini, d.maxAccompagnatori, adesso, eventoId,
  )
}
