// SQL delle proposte di modifica e dei trasferimenti di proprietà (SPEC §41).
import { type Db, esegui, tutti, uno } from '../connessione.ts'

export interface RigaProposta {
  id: string
  piatto_id: string
  autore_id: string | null
  autore_nome: string
  versione_base: number
  motivazione: string
  stato: 'in_attesa' | 'conclusa' | 'ritirata'
  chiarimenti: string
  deciso_da_id: string | null
  deciso_da_nome: string | null
  deciso_il: number | null
  versione: number
  creato_il: number
  aggiornato_il: number
}

export interface RigaModifica {
  id: string
  proposta_id: string
  ordine: number
  campo: string
  operazione: 'modifica' | 'aggiungi' | 'rimuovi'
  chiave: string | null
  prima: string | null
  dopo: string | null
  dipende_da: string | null
  stato: 'in_attesa' | 'approvata' | 'rifiutata' | 'ritirata'
  motivo: string
}

export const leggiProposta = (db: Db, id: string) => uno<RigaProposta>(db, 'SELECT * FROM proposte_piatto WHERE id = ?', id)
export const proposteDiPiatto = (db: Db, piattoId: string) => tutti<RigaProposta>(db, 'SELECT * FROM proposte_piatto WHERE piatto_id = ? ORDER BY creato_il DESC', piattoId)
export const modifiche = (db: Db, propostaId: string) => tutti<RigaModifica>(db, 'SELECT * FROM modifiche_proposta WHERE proposta_id = ? ORDER BY ordine', propostaId)
export const contaInAttesa = (db: Db, piattoId: string, autoreId?: string) =>
  uno<{ n: number }>(db, `SELECT count(*) AS n FROM proposte_piatto WHERE piatto_id = ? AND stato = 'in_attesa' ${autoreId ? 'AND autore_id = ?' : ''}`, piattoId, ...(autoreId ? [autoreId] : []))!.n

export function inserisciProposta(db: Db, p: { id: string; piattoId: string; autoreId: string; autoreNome: string; versioneBase: number; motivazione: string }, adesso: number): void {
  esegui(
    db,
    'INSERT INTO proposte_piatto (id, piatto_id, autore_id, autore_nome, versione_base, motivazione, creato_il, aggiornato_il) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    p.id, p.piattoId, p.autoreId, p.autoreNome, p.versioneBase, p.motivazione, adesso, adesso,
  )
}

export function inserisciModifica(db: Db, m: Omit<RigaModifica, 'stato' | 'motivo'>): void {
  esegui(
    db,
    'INSERT INTO modifiche_proposta (id, proposta_id, ordine, campo, operazione, chiave, prima, dopo, dipende_da) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    m.id, m.proposta_id, m.ordine, m.campo, m.operazione, m.chiave, m.prima, m.dopo, m.dipende_da,
  )
}

export const prossimoOrdine = (db: Db, propostaId: string) => (uno<{ m: number | null }>(db, 'SELECT max(ordine) AS m FROM modifiche_proposta WHERE proposta_id = ?', propostaId)?.m ?? -1) + 1

export const decidiModifica = (db: Db, id: string, stato: RigaModifica['stato'], motivo: string) =>
  esegui(db, "UPDATE modifiche_proposta SET stato = ?, motivo = ? WHERE id = ? AND stato = 'in_attesa'", stato, motivo, id)

export const aggiornaStatoProposta = (db: Db, id: string, stato: RigaProposta['stato'], decisoDa: { id: string; nome: string } | null, adesso: number) =>
  esegui(
    db,
    'UPDATE proposte_piatto SET stato = ?, deciso_da_id = coalesce(?, deciso_da_id), deciso_da_nome = coalesce(?, deciso_da_nome), deciso_il = CASE WHEN ? = \'in_attesa\' THEN deciso_il ELSE ? END, versione = versione + 1, aggiornato_il = ? WHERE id = ?',
    stato, decisoDa?.id ?? null, decisoDa?.nome ?? null, stato, adesso, adesso, id,
  )

export const scriviChiarimenti = (db: Db, id: string, json: string, adesso: number) =>
  esegui(db, 'UPDATE proposte_piatto SET chiarimenti = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ?', json, adesso, id)

// ── Trasferimenti ──

export interface RigaTrasferimento {
  id: string
  piatto_id: string
  da_id: string | null
  a_id: string
  gruppo_id: string | null
  tipo: 'volontario' | 'amministrativo'
  motivazione: string
  stato: 'in_attesa' | 'accettato' | 'rifiutato' | 'annullato'
  creato_da_id: string | null
  creato_da_nome: string
  versione: number
  creato_il: number
  deciso_il: number | null
}

export const leggiTrasferimento = (db: Db, id: string) => uno<RigaTrasferimento>(db, 'SELECT * FROM trasferimenti_piatto WHERE id = ?', id)
export const trasferimentoInAttesa = (db: Db, piattoId: string) => uno<RigaTrasferimento>(db, "SELECT * FROM trasferimenti_piatto WHERE piatto_id = ? AND stato = 'in_attesa'", piattoId)

export function inserisciTrasferimento(db: Db, t: Omit<RigaTrasferimento, 'stato' | 'versione' | 'deciso_il'>): void {
  esegui(
    db,
    `INSERT INTO trasferimenti_piatto (id, piatto_id, da_id, a_id, gruppo_id, tipo, motivazione, creato_da_id, creato_da_nome, creato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    t.id, t.piatto_id, t.da_id, t.a_id, t.gruppo_id, t.tipo, t.motivazione, t.creato_da_id, t.creato_da_nome, t.creato_il,
  )
}

export const chiudiTrasferimento = (db: Db, id: string, stato: RigaTrasferimento['stato'], versione: number, adesso: number) =>
  esegui(db, "UPDATE trasferimenti_piatto SET stato = ?, versione = versione + 1, deciso_il = ? WHERE id = ? AND versione = ? AND stato = 'in_attesa'", stato, adesso, id, versione)

export const cambiaProprietarioPiatto = (db: Db, piattoId: string, proprietarioId: string, adesso: number) =>
  esegui(db, 'UPDATE piatti SET proprietario_id = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ?', proprietarioId, adesso, piattoId)

/** Famiglie a cui la ricetta è condivisa (anche se il proprietario non ne fa più parte). */
export const famiglieCondivise = (db: Db, piattoId: string) => tutti<{ gruppo_id: string }>(db, 'SELECT gruppo_id FROM condivisioni_piatto_gruppo WHERE piatto_id = ?', piattoId).map((r) => r.gruppo_id)
