// SQL di eventi, portate e voci di menù.
import type { Evento, Portata, StatoEvento, TipoEvento, VoceMenu } from '../../../src/domain/tipi.ts'
import { type Db, esegui, tutti, uno } from '../connessione.ts'

interface RigaEvento {
  id: string
  nome: string
  data: string
  ora_servizio: string | null
  tipo: string
  occasione: string
  adulti: number
  bambini: number
  coefficiente_bambini: number
  note: string
  stato: string
  concluso_il: number | null
  archiviato_il: number | null
  versione: number
  creato_il: number
  aggiornato_il: number
}

function daRigaEvento(r: RigaEvento, portate: Portata[]): Evento {
  return {
    id: r.id,
    nome: r.nome,
    data: r.data,
    oraServizio: r.ora_servizio,
    tipo: r.tipo as TipoEvento,
    occasione: r.occasione,
    adulti: r.adulti,
    bambini: r.bambini,
    coefficienteBambini: r.coefficiente_bambini,
    note: r.note,
    stato: r.stato as StatoEvento,
    conclusoIl: r.concluso_il,
    archiviatoIl: r.archiviato_il,
    versione: r.versione,
    creatoIl: r.creato_il,
    aggiornatoIl: r.aggiornato_il,
    portate,
  }
}

export function portateEvento(db: Db, eventoId: string): Portata[] {
  return tutti<Portata>(db, 'SELECT id, nome, ordine FROM portate_evento WHERE evento_id = ? ORDER BY ordine, nome', eventoId).map(
    (p) => ({ id: p.id, nome: p.nome, ordine: p.ordine }),
  )
}

export function leggiEvento(db: Db, id: string): Evento | undefined {
  const r = uno<RigaEvento>(db, 'SELECT * FROM eventi WHERE id = ?', id)
  return r ? daRigaEvento(r, portateEvento(db, id)) : undefined
}

export function elencaEventi(db: Db, stato?: StatoEvento): (Evento & { numeroVoci: number })[] {
  const righe = stato
    ? tutti<RigaEvento & { numero_voci: number }>(
        db,
        'SELECT e.*, (SELECT count(*) FROM voci_menu v WHERE v.evento_id = e.id) AS numero_voci FROM eventi e WHERE stato = ? ORDER BY data, ora_servizio, nome',
        stato,
      )
    : tutti<RigaEvento & { numero_voci: number }>(
        db,
        'SELECT e.*, (SELECT count(*) FROM voci_menu v WHERE v.evento_id = e.id) AS numero_voci FROM eventi e ORDER BY data, ora_servizio, nome',
      )
  return righe.map((r) => ({ ...daRigaEvento(r, portateEvento(db, r.id)), numeroVoci: r.numero_voci }))
}

export function inserisciEvento(db: Db, e: Omit<Evento, 'versione' | 'portate'>): void {
  esegui(
    db,
    `INSERT INTO eventi (id, nome, data, ora_servizio, tipo, occasione, adulti, bambini, coefficiente_bambini, note, stato,
       concluso_il, archiviato_il, versione, creato_il, aggiornato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    e.id, e.nome, e.data, e.oraServizio, e.tipo, e.occasione, e.adulti, e.bambini, e.coefficienteBambini, e.note, e.stato,
    e.conclusoIl, e.archiviatoIl, e.creatoIl, e.aggiornatoIl,
  )
}

export function inserisciPortata(db: Db, eventoId: string, p: Portata): void {
  esegui(db, 'INSERT INTO portate_evento (id, evento_id, nome, ordine) VALUES (?, ?, ?, ?)', p.id, eventoId, p.nome, p.ordine)
}

export function aggiornaPortata(db: Db, p: Portata): void {
  esegui(db, 'UPDATE portate_evento SET nome = ?, ordine = ? WHERE id = ?', p.nome, p.ordine, p.id)
}

export function eliminaPortata(db: Db, id: string): void {
  esegui(db, 'DELETE FROM portate_evento WHERE id = ?', id)
}

export function contaVociPortata(db: Db, portataId: string): number {
  return uno<{ n: number }>(db, 'SELECT count(*) AS n FROM voci_menu WHERE portata_id = ?', portataId)?.n ?? 0
}

export function portataDiEvento(db: Db, eventoId: string, portataId: string): boolean {
  return uno(db, 'SELECT 1 FROM portate_evento WHERE id = ? AND evento_id = ?', portataId, eventoId) !== undefined
}

// ── Voci di menù ────────────────────────────────────────────

interface RigaVoce {
  id: string
  evento_id: string
  portata_id: string
  ordine: number
  nome: string
  piatto_id: string | null
  porzioni: number | null
  incaricato: string
  in_spesa: number
  note: string
  versione: number
  creato_il: number
  aggiornato_il: number
}

const daRigaVoce = (r: RigaVoce): VoceMenu => ({
  id: r.id,
  eventoId: r.evento_id,
  portataId: r.portata_id,
  ordine: r.ordine,
  nome: r.nome,
  piattoId: r.piatto_id,
  porzioni: r.porzioni,
  incaricato: r.incaricato,
  inSpesa: r.in_spesa === 1,
  note: r.note,
  versione: r.versione,
  creatoIl: r.creato_il,
  aggiornatoIl: r.aggiornato_il,
})

export function leggiVoce(db: Db, id: string): VoceMenu | undefined {
  const r = uno<RigaVoce>(db, 'SELECT * FROM voci_menu WHERE id = ?', id)
  return r ? daRigaVoce(r) : undefined
}

export function vociEvento(db: Db, eventoId: string): (VoceMenu & { piattoNome: string | null })[] {
  return tutti<RigaVoce & { piatto_nome: string | null }>(
    db,
    `SELECT v.*, p.nome AS piatto_nome FROM voci_menu v LEFT JOIN piatti p ON p.id = v.piatto_id
     JOIN portate_evento pe ON pe.id = v.portata_id
     WHERE v.evento_id = ? ORDER BY pe.ordine, v.ordine`,
    eventoId,
  ).map((r) => ({ ...daRigaVoce(r), piattoNome: r.piatto_nome }))
}

export function vociPortata(db: Db, portataId: string): VoceMenu[] {
  return tutti<RigaVoce>(db, 'SELECT * FROM voci_menu WHERE portata_id = ? ORDER BY ordine, creato_il', portataId).map(daRigaVoce)
}

export function inserisciVoce(db: Db, v: Omit<VoceMenu, 'versione'>): void {
  esegui(
    db,
    `INSERT INTO voci_menu (id, evento_id, portata_id, ordine, nome, piatto_id, porzioni, incaricato, in_spesa, note,
       versione, creato_il, aggiornato_il) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    v.id, v.eventoId, v.portataId, v.ordine, v.nome, v.piattoId, v.porzioni, v.incaricato, v.inSpesa, v.note, v.creatoIl, v.aggiornatoIl,
  )
}

/** Riscrive l'ordine 0..n-1 delle voci di una portata nell'ordine indicato. */
export function scriviOrdine(db: Db, portataId: string, ids: string[], adesso: number, incrementa: Set<string>): void {
  ids.forEach((id, i) => {
    if (incrementa.has(id)) {
      esegui(db, 'UPDATE voci_menu SET portata_id = ?, ordine = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ?', portataId, i, adesso, id)
    } else {
      esegui(db, 'UPDATE voci_menu SET ordine = ? WHERE id = ? AND ordine <> ?', i, id, i)
    }
  })
}

export function piattoEsiste(db: Db, id: string): boolean {
  return uno(db, 'SELECT 1 FROM piatti WHERE id = ?', id) !== undefined
}
