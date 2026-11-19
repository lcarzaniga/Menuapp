// SQL della cronologia delle ricette (SPEC §41).
import { type Db, esegui, tutti, uno } from '../connessione.ts'

export interface RigaRevisione {
  id: string
  piatto_id: string
  numero: number
  tipo: 'iniziale' | 'modifica' | 'proposta' | 'ripristino' | 'foto' | 'trasferimento' | 'riassegnazione'
  autore_id: string | null
  autore_nome: string
  approvato_da_id: string | null
  approvato_da_nome: string | null
  proposta_id: string | null
  ripristina_numero: number | null
  campi: string
  contenuto: string | null
  motivazione: string
  creato_il: number
}

export const revisioni = (db: Db, piattoId: string) => tutti<RigaRevisione>(db, 'SELECT * FROM revisioni_piatto WHERE piatto_id = ? ORDER BY numero DESC', piattoId)
export const leggiRevisione = (db: Db, id: string) => uno<RigaRevisione>(db, 'SELECT * FROM revisioni_piatto WHERE id = ?', id)
export const ultimoNumero = (db: Db, piattoId: string) => uno<{ n: number | null }>(db, 'SELECT max(numero) AS n FROM revisioni_piatto WHERE piatto_id = ?', piattoId)?.n ?? 0

export function inserisci(db: Db, r: Omit<RigaRevisione, 'numero'>): number {
  const numero = ultimoNumero(db, r.piatto_id) + 1
  esegui(
    db,
    `INSERT INTO revisioni_piatto (id, piatto_id, numero, tipo, autore_id, autore_nome, approvato_da_id, approvato_da_nome, proposta_id, ripristina_numero, campi, contenuto, motivazione, creato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    r.id, r.piatto_id, numero, r.tipo, r.autore_id, r.autore_nome, r.approvato_da_id, r.approvato_da_nome, r.proposta_id, r.ripristina_numero, r.campi, r.contenuto, r.motivazione, r.creato_il,
  )
  return numero
}
