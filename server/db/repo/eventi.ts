// SQL di eventi, portate e voci di menù.
import type { Evento, Portata, StatoEvento, TipoEvento, VoceMenu } from '../../../src/domain/tipi.ts'
import { copertiEffettivi } from '../../../src/domain/partecipanti.ts'
import { type Db, esegui, tutti, uno } from '../connessione.ts'
import { presenzeEvento } from './partecipanti.ts'

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
  coperti_automatici: number
  max_accompagnatori: number | null
  serie_id: string | null
  note: string
  stato: string
  concluso_il: number | null
  archiviato_il: number | null
  versione: number
  creato_il: number
  aggiornato_il: number
}

function daRigaEvento(db: Db, r: RigaEvento, portate: Portata[]): Evento {
  const automatici = r.coperti_automatici === 1
  const effettivi = copertiEffettivi({ adulti: r.adulti, bambini: r.bambini, copertiAutomatici: automatici }, automatici ? presenzeEvento(db, r.id) : [])
  return {
    id: r.id,
    nome: r.nome,
    data: r.data,
    oraServizio: r.ora_servizio,
    tipo: r.tipo as TipoEvento,
    occasione: r.occasione,
    adulti: effettivi.adulti,
    bambini: effettivi.bambini,
    coefficienteBambini: r.coefficiente_bambini,
    copertiAutomatici: automatici,
    copertiManuali: { adulti: r.adulti, bambini: r.bambini },
    maxAccompagnatori: r.max_accompagnatori,
    serieId: r.serie_id,
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
  return r ? daRigaEvento(db, r, portateEvento(db, id)) : undefined
}

/** Eventi visibili all'utente (suoi e condivisi), con il suo permesso e il proprietario. */
/**
 * Eventi visibili all'utente (suoi e condivisi), con il suo permesso, il proprietario e la
 * Famiglia. Con `gruppoId` (Famiglia attiva): quelli di quella Famiglia, più gli eventi
 * personali e quelli di Famiglie di cui l'utente non fa parte (inviti individuali).
 */
export function elencaEventi(db: Db, utenteId: string, stato?: StatoEvento, gruppoId?: string) {
  const righe = tutti<RigaEvento & { numero_voci: number; proprietario_id: string; proprietario_nome: string; permesso: string | null; gruppo_id: string | null; gruppo_nome: string | null }>(
    db,
    `SELECT e.*, (SELECT count(*) FROM voci_menu v WHERE v.evento_id = e.id) AS numero_voci,
       u.nome AS proprietario_nome, c.permesso, g.nome AS gruppo_nome
     FROM eventi e JOIN utenti u ON u.id = e.proprietario_id
     LEFT JOIN gruppi g ON g.id = e.gruppo_id
     LEFT JOIN condivisioni_evento c ON c.evento_id = e.id AND c.utente_id = ?
     WHERE (e.proprietario_id = ? OR c.utente_id IS NOT NULL) AND (? IS NULL OR e.stato = ?)
       AND (? IS NULL OR e.gruppo_id IS NULL OR e.gruppo_id = ?
            OR NOT EXISTS (SELECT 1 FROM membri_gruppo m WHERE m.gruppo_id = e.gruppo_id AND m.utente_id = ?))
     ORDER BY e.data, e.ora_servizio, e.nome`,
    utenteId,
    utenteId,
    stato ?? null,
    stato ?? null,
    gruppoId ?? null,
    gruppoId ?? null,
    utenteId,
  )
  return righe.map((r) => ({
    ...daRigaEvento(db, r, portateEvento(db, r.id)),
    numeroVoci: r.numero_voci,
    proprietario: { id: r.proprietario_id, nome: r.proprietario_nome },
    permesso: (r.proprietario_id === utenteId ? 'proprietario' : r.permesso) as 'proprietario' | 'modifica' | 'lettura',
    gruppo: r.gruppo_id ? { id: r.gruppo_id, nome: r.gruppo_nome ?? '' } : null,
  }))
}

export function cambiaProprietario(db: Db, id: string, proprietarioId: string, adesso: number): void {
  esegui(db, 'UPDATE eventi SET proprietario_id = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ?', proprietarioId, adesso, id)
}

export function collegaPiatto(db: Db, voceId: string, piattoId: string | null, adesso: number): void {
  esegui(db, 'UPDATE voci_menu SET piatto_id = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ?', piattoId, adesso, voceId)
}

export function inserisciEvento(db: Db, e: Omit<Evento, 'versione' | 'portate' | 'copertiAutomatici' | 'copertiManuali' | 'maxAccompagnatori' | 'serieId'>, proprietarioId: string, gruppoId: string | null = null): void {
  esegui(
    db,
    `INSERT INTO eventi (id, nome, data, ora_servizio, tipo, occasione, adulti, bambini, coefficiente_bambini, note, stato,
       concluso_il, archiviato_il, versione, creato_il, aggiornato_il, proprietario_id, gruppo_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    e.id, e.nome, e.data, e.oraServizio, e.tipo, e.occasione, e.adulti, e.bambini, e.coefficienteBambini, e.note, e.stato,
    e.conclusoIl, e.archiviatoIl, e.creatoIl, e.aggiornatoIl, proprietarioId, gruppoId,
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

// ── Edizioni ────────────────────────────────────────────────

export function impostaSerie(db: Db, eventoId: string, serieId: string | null): void {
  esegui(db, 'UPDATE eventi SET serie_id = ? WHERE id = ?', serieId, eventoId)
}

export const eventiDellaSerie = (db: Db, serieId: string) =>
  tutti<{ id: string }>(db, 'SELECT id FROM eventi WHERE serie_id = ? ORDER BY data, ora_servizio, nome', serieId).map((r) => r.id)

/** Voce d'origine delle voci copiate duplicando l'evento (SPEC §27). */
export function originiVoci(db: Db, eventoId: string): Map<string, string> {
  return new Map(
    tutti<{ id: string; voce_origine_id: string }>(db, 'SELECT id, voce_origine_id FROM voci_menu WHERE evento_id = ? AND voce_origine_id IS NOT NULL', eventoId).map((r) => [r.id, r.voce_origine_id]),
  )
}

export function impostaOrigineVoce(db: Db, voceId: string, origineId: string): void {
  esegui(db, 'UPDATE voci_menu SET voce_origine_id = ? WHERE id = ?', origineId, voceId)
}
