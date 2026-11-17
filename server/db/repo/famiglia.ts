// SQL dello spazio della famiglia: messaggi, commenti, reazioni, allegati, sondaggi,
// proposte, cose da portare, valutazioni, notifiche.
import { type Db, esegui, tutti, uno } from '../connessione.ts'

// ── Messaggi ─────────────────────────────────────────────────

export interface RigaMessaggio {
  id: string
  gruppo_id: string | null
  evento_id: string | null
  autore_id: string
  autore_nome: string
  tipo: 'messaggio' | 'sondaggio' | 'proposta'
  testo: string
  piatto_id: string | null
  fissato: number
  versione: number
  creato_il: number
  modificato_il: number | null
}

const SELEZIONE_MESSAGGIO = 'SELECT m.*, u.nome AS autore_nome FROM messaggi m JOIN utenti u ON u.id = m.autore_id'

export const leggiMessaggio = (db: Db, id: string) => uno<RigaMessaggio>(db, `${SELEZIONE_MESSAGGIO} WHERE m.id = ?`, id)

/** Messaggi di una bacheca: prima i fissati, poi dal più recente. */
export const messaggiBacheca = (db: Db, ambito: { gruppoId?: string | null; eventoId?: string | null }, limite = 200) =>
  ambito.gruppoId
    ? tutti<RigaMessaggio>(db, `${SELEZIONE_MESSAGGIO} WHERE m.gruppo_id = ? ORDER BY m.fissato DESC, m.creato_il DESC LIMIT ?`, ambito.gruppoId, limite)
    : tutti<RigaMessaggio>(db, `${SELEZIONE_MESSAGGIO} WHERE m.evento_id = ? ORDER BY m.fissato DESC, m.creato_il DESC LIMIT ?`, ambito.eventoId!, limite)

export function inserisciMessaggio(
  db: Db,
  m: { id: string; gruppoId: string | null; eventoId: string | null; autoreId: string; tipo: RigaMessaggio['tipo']; testo: string; piattoId: string | null },
  adesso: number,
): void {
  esegui(
    db,
    'INSERT INTO messaggi (id, gruppo_id, evento_id, autore_id, tipo, testo, piatto_id, creato_il, aggiornato_il) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    m.id, m.gruppoId, m.eventoId, m.autoreId, m.tipo, m.testo, m.piattoId, adesso, adesso,
  )
}

export const aggiornaTestoMessaggio = (db: Db, id: string, versione: number, testo: string, adesso: number) =>
  esegui(db, 'UPDATE messaggi SET testo = ?, modificato_il = ?, aggiornato_il = ?, versione = versione + 1 WHERE id = ? AND versione = ?', testo, adesso, adesso, id, versione)
export const fissaMessaggio = (db: Db, id: string, fissato: boolean, adesso: number) =>
  esegui(db, 'UPDATE messaggi SET fissato = ?, aggiornato_il = ?, versione = versione + 1 WHERE id = ?', fissato, adesso, id)
export const eliminaMessaggio = (db: Db, id: string) => esegui(db, 'DELETE FROM messaggi WHERE id = ?', id)

// ── Commenti e reazioni ─────────────────────────────────────

export interface RigaCommento {
  id: string
  messaggio_id: string
  autore_id: string
  autore_nome: string
  testo: string
  versione: number
  creato_il: number
  modificato_il: number | null
}
export const commentiMessaggi = (db: Db, ids: string[]) =>
  ids.length
    ? tutti<RigaCommento>(
        db,
        `SELECT c.*, u.nome AS autore_nome FROM commenti c JOIN utenti u ON u.id = c.autore_id WHERE c.messaggio_id IN (${ids.map(() => '?').join(',')}) ORDER BY c.creato_il`,
        ...ids,
      )
    : []
export const leggiCommento = (db: Db, id: string) =>
  uno<RigaCommento>(db, 'SELECT c.*, u.nome AS autore_nome FROM commenti c JOIN utenti u ON u.id = c.autore_id WHERE c.id = ?', id)
export function inserisciCommento(db: Db, c: { id: string; messaggioId: string; autoreId: string; testo: string }, adesso: number): void {
  esegui(db, 'INSERT INTO commenti (id, messaggio_id, autore_id, testo, creato_il, aggiornato_il) VALUES (?, ?, ?, ?, ?, ?)', c.id, c.messaggioId, c.autoreId, c.testo, adesso, adesso)
}
export const aggiornaCommento = (db: Db, id: string, versione: number, testo: string, adesso: number) =>
  esegui(db, 'UPDATE commenti SET testo = ?, modificato_il = ?, aggiornato_il = ?, versione = versione + 1 WHERE id = ? AND versione = ?', testo, adesso, adesso, id, versione)
export const eliminaCommento = (db: Db, id: string) => esegui(db, 'DELETE FROM commenti WHERE id = ?', id)
/** Chi ha commentato un messaggio (per le risposte). */
export const commentatori = (db: Db, messaggioId: string) =>
  tutti<{ autore_id: string }>(db, 'SELECT DISTINCT autore_id FROM commenti WHERE messaggio_id = ?', messaggioId).map((r) => r.autore_id)

export const reazioniMessaggi = (db: Db, ids: string[]) =>
  ids.length
    ? tutti<{ messaggio_id: string; utente_id: string; nome: string; reazione: string }>(
        db,
        `SELECT r.messaggio_id, r.utente_id, u.nome, r.reazione FROM reazioni r JOIN utenti u ON u.id = r.utente_id WHERE r.messaggio_id IN (${ids.map(() => '?').join(',')}) ORDER BY r.creato_il`,
        ...ids,
      )
    : []
export const aggiungiReazione = (db: Db, messaggioId: string, utenteId: string, reazione: string, adesso: number) =>
  esegui(db, 'INSERT INTO reazioni (messaggio_id, utente_id, reazione, creato_il) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING', messaggioId, utenteId, reazione, adesso)
export const togliReazione = (db: Db, messaggioId: string, utenteId: string, reazione: string) =>
  esegui(db, 'DELETE FROM reazioni WHERE messaggio_id = ? AND utente_id = ? AND reazione = ?', messaggioId, utenteId, reazione)

// ── Allegati ────────────────────────────────────────────────

export interface RigaAllegato {
  id: string
  messaggio_id: string
  ordine: number
  tipo: 'image/jpeg' | 'image/png' | 'image/webp'
  byte: number
  sha256: string
}
export const allegatiMessaggi = (db: Db, ids: string[]) =>
  ids.length ? tutti<RigaAllegato>(db, `SELECT * FROM allegati WHERE messaggio_id IN (${ids.map(() => '?').join(',')}) ORDER BY ordine`, ...ids) : []
export const leggiAllegato = (db: Db, id: string) => uno<RigaAllegato>(db, 'SELECT * FROM allegati WHERE id = ?', id)
export const allegatiEvento = (db: Db, eventoId: string) =>
  tutti<RigaAllegato>(db, 'SELECT a.* FROM allegati a JOIN messaggi m ON m.id = a.messaggio_id WHERE m.evento_id = ?', eventoId)
export function inserisciAllegato(db: Db, a: RigaAllegato, adesso: number): void {
  esegui(db, 'INSERT INTO allegati (id, messaggio_id, ordine, tipo, byte, sha256, creato_il) VALUES (?, ?, ?, ?, ?, ?, ?)', a.id, a.messaggio_id, a.ordine, a.tipo, a.byte, a.sha256, adesso)
}

// ── Sondaggi ────────────────────────────────────────────────

export interface RigaSondaggio {
  messaggio_id: string
  multipla: number
  risultati: 'sempre' | 'dopo_voto' | 'alla_chiusura'
  scade_il: number | null
  chiuso_il: number | null
}
export const leggiSondaggio = (db: Db, id: string) => uno<RigaSondaggio>(db, 'SELECT * FROM sondaggi WHERE messaggio_id = ?', id)
export const opzioniSondaggio = (db: Db, id: string) =>
  tutti<{ id: string; testo: string }>(db, 'SELECT id, testo FROM opzioni_sondaggio WHERE messaggio_id = ? ORDER BY ordine', id)
export const votiSondaggio = (db: Db, id: string) =>
  tutti<{ utente_id: string; nome: string; opzione_id: string }>(
    db,
    'SELECT v.utente_id, u.nome, v.opzione_id FROM voti_sondaggio v JOIN utenti u ON u.id = v.utente_id WHERE v.messaggio_id = ? ORDER BY u.nome_norm',
    id,
  )
export function inserisciSondaggio(db: Db, id: string, s: { multipla: boolean; risultati: string; scadeIl: number | null; opzioni: { id: string; testo: string }[] }): void {
  esegui(db, 'INSERT INTO sondaggi (messaggio_id, multipla, risultati, scade_il) VALUES (?, ?, ?, ?)', id, s.multipla, s.risultati, s.scadeIl)
  s.opzioni.forEach((o, i) => esegui(db, 'INSERT INTO opzioni_sondaggio (id, messaggio_id, ordine, testo) VALUES (?, ?, ?, ?)', o.id, id, i, o.testo))
}
export function sostituisciVoti(db: Db, id: string, utenteId: string, opzioni: string[], adesso: number): void {
  esegui(db, 'DELETE FROM voti_sondaggio WHERE messaggio_id = ? AND utente_id = ?', id, utenteId)
  for (const o of opzioni) esegui(db, 'INSERT INTO voti_sondaggio (messaggio_id, utente_id, opzione_id, creato_il) VALUES (?, ?, ?, ?)', id, utenteId, o, adesso)
}
export const chiudiSondaggio = (db: Db, id: string, da: string, adesso: number) =>
  esegui(db, 'UPDATE sondaggi SET chiuso_il = ?, chiuso_da = ? WHERE messaggio_id = ? AND chiuso_il IS NULL', adesso, da, id)

// ── Proposte ────────────────────────────────────────────────

export interface RigaProposta {
  messaggio_id: string
  nome: string
  piatto_id: string | null
  portata_nome: string
  stato: 'in_valutazione' | 'accettata' | 'rifiutata'
  voce_id: string | null
  deciso_da_nome: string | null
}
export const leggiProposta = (db: Db, id: string) =>
  uno<RigaProposta>(db, 'SELECT p.*, u.nome AS deciso_da_nome FROM proposte p LEFT JOIN utenti u ON u.id = p.deciso_da WHERE p.messaggio_id = ?', id)
export function inserisciProposta(db: Db, id: string, p: { nome: string; piattoId: string | null; portataNome: string }): void {
  esegui(db, 'INSERT INTO proposte (messaggio_id, nome, piatto_id, portata_nome) VALUES (?, ?, ?, ?)', id, p.nome, p.piattoId, p.portataNome)
}
export const decidiProposta = (db: Db, id: string, stato: string, da: string, adesso: number) =>
  esegui(db, 'UPDATE proposte SET stato = ?, deciso_da = ?, deciso_il = ? WHERE messaggio_id = ?', stato, da, adesso, id)
export const collegaVoceProposta = (db: Db, id: string, voceId: string) => esegui(db, 'UPDATE proposte SET voce_id = ? WHERE messaggio_id = ?', voceId, id)

// ── Chi porta cosa ──────────────────────────────────────────

export interface RigaVoceIncarico {
  id: string
  nome: string
  portata: string
  incaricato: string
  incaricato_id: string | null
  incarico_completato: number
  spesa_tolta_da_incarico: number
  in_spesa: number
  versione: number
  incaricato_esterno_id: string | null
  note_incarico: string
  porzioni: number | null
}
export const vociIncarichi = (db: Db, eventoId: string) =>
  tutti<RigaVoceIncarico>(
    db,
    `SELECT v.id, v.nome, p.nome AS portata, v.incaricato, v.incaricato_id, v.incarico_completato, v.spesa_tolta_da_incarico, v.in_spesa, v.versione,
       v.incaricato_esterno_id, v.note_incarico, v.porzioni
     FROM voci_menu v JOIN portate_evento p ON p.id = v.portata_id WHERE v.evento_id = ? ORDER BY p.ordine, v.ordine`,
    eventoId,
  )
export const leggiVoceIncarico = (db: Db, id: string) =>
  uno<RigaVoceIncarico & { evento_id: string }>(
    db,
    `SELECT v.id, v.evento_id, v.nome, p.nome AS portata, v.incaricato, v.incaricato_id, v.incarico_completato, v.spesa_tolta_da_incarico, v.in_spesa, v.versione,
       v.incaricato_esterno_id, v.note_incarico, v.porzioni
     FROM voci_menu v JOIN portate_evento p ON p.id = v.portata_id WHERE v.id = ?`,
    id,
  )
/** Aggiorna l'incarico di una voce solo se la versione è quella letta (presa in carico concorrente → 0). */
export function scriviIncaricoVoce(
  db: Db,
  id: string,
  versione: number,
  c: { incaricato: string; incaricatoId: string | null; esternoId: string | null; note: string; completato: boolean; inSpesa: boolean; spesaTolta: boolean },
  adesso: number,
): number {
  return esegui(
    db,
    `UPDATE voci_menu SET incaricato = ?, incaricato_id = ?, incaricato_esterno_id = ?, note_incarico = ?, incarico_completato = ?, in_spesa = ?,
       spesa_tolta_da_incarico = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ? AND versione = ?`,
    c.incaricato, c.incaricatoId, c.esternoId, c.note, c.completato, c.inSpesa, c.spesaTolta, adesso, id, versione,
  )
}

export interface RigaCosa {
  id: string
  evento_id: string
  nome: string
  quantita: string
  note: string
  incaricato: string
  incaricato_id: string | null
  completato: number
  creato_da: string | null
  versione: number
  incaricato_esterno_id: string | null
  quantita_numero: number | null
  unita: string
}
export const coseEvento = (db: Db, eventoId: string) => tutti<RigaCosa>(db, 'SELECT * FROM cose_da_portare WHERE evento_id = ? ORDER BY ordine, creato_il', eventoId)
export const leggiCosa = (db: Db, id: string) => uno<RigaCosa>(db, 'SELECT * FROM cose_da_portare WHERE id = ?', id)
export interface DatiCosa {
  nome: string
  quantita: string
  quantitaNumero: number | null
  unita: string
  note: string
}
export function inserisciCosa(db: Db, c: DatiCosa & { id: string; eventoId: string; creatoDa: string }, adesso: number): void {
  const ordine = (uno<{ m: number | null }>(db, 'SELECT max(ordine) AS m FROM cose_da_portare WHERE evento_id = ?', c.eventoId)?.m ?? -1) + 1
  esegui(
    db,
    `INSERT INTO cose_da_portare (id, evento_id, nome, quantita, quantita_numero, unita, note, creato_da, ordine, creato_il, aggiornato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    c.id, c.eventoId, c.nome, c.quantita, c.quantitaNumero, c.unita, c.note, c.creatoDa, ordine, adesso, adesso,
  )
}
export const aggiornaCosa = (db: Db, id: string, versione: number, c: DatiCosa, adesso: number) =>
  esegui(
    db,
    'UPDATE cose_da_portare SET nome = ?, quantita = ?, quantita_numero = ?, unita = ?, note = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ? AND versione = ?',
    c.nome, c.quantita, c.quantitaNumero, c.unita, c.note, adesso, id, versione,
  )
export function scriviIncaricoCosa(
  db: Db,
  id: string,
  versione: number,
  c: { incaricato: string; incaricatoId: string | null; esternoId: string | null; completato: boolean },
  adesso: number,
): number {
  return esegui(
    db,
    'UPDATE cose_da_portare SET incaricato = ?, incaricato_id = ?, incaricato_esterno_id = ?, completato = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ? AND versione = ?',
    c.incaricato, c.incaricatoId, c.esternoId, c.completato, adesso, id, versione,
  )
}

// ── Rubrica delle persone senza account (per Famiglia) ──────

export interface RigaEsterno {
  id: string
  gruppo_id: string
  nome: string
  nome_norm: string
  note: string
  creato_da: string | null
  versione: number
}
export const rubrica = (db: Db, gruppoId: string) => tutti<RigaEsterno>(db, 'SELECT * FROM persone_esterne WHERE gruppo_id = ? ORDER BY nome_norm', gruppoId)
export const leggiEsterno = (db: Db, id: string) => uno<RigaEsterno>(db, 'SELECT * FROM persone_esterne WHERE id = ?', id)
export const esternoPerNome = (db: Db, gruppoId: string, nomeNorm: string) => uno<RigaEsterno>(db, 'SELECT * FROM persone_esterne WHERE gruppo_id = ? AND nome_norm = ?', gruppoId, nomeNorm)
export function inserisciEsterno(db: Db, e: { id: string; gruppoId: string; nome: string; nomeNorm: string; note: string; creatoDa: string }, adesso: number): void {
  esegui(
    db,
    'INSERT INTO persone_esterne (id, gruppo_id, nome, nome_norm, note, creato_da, creato_il, aggiornato_il) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    e.id, e.gruppoId, e.nome, e.nomeNorm, e.note, e.creatoDa, adesso, adesso,
  )
}
export const aggiornaEsterno = (db: Db, id: string, versione: number, e: { nome: string; nomeNorm: string; note: string }, adesso: number) =>
  esegui(db, 'UPDATE persone_esterne SET nome = ?, nome_norm = ?, note = ?, versione = versione + 1, aggiornato_il = ? WHERE id = ? AND versione = ?', e.nome, e.nomeNorm, e.note, adesso, id, versione)
/** Il nome nuovo segue negli incarichi ancora assegnati alla persona. */
export function rinominaInIncarichi(db: Db, id: string, nome: string): void {
  esegui(db, 'UPDATE voci_menu SET incaricato = ?, versione = versione + 1 WHERE incaricato_esterno_id = ?', nome, id)
  esegui(db, 'UPDATE cose_da_portare SET incaricato = ?, versione = versione + 1 WHERE incaricato_esterno_id = ?', nome, id)
}
export const eliminaEsterno = (db: Db, id: string) => esegui(db, 'DELETE FROM persone_esterne WHERE id = ?', id)
export const eliminaCosa = (db: Db, id: string, versione: number) => esegui(db, 'DELETE FROM cose_da_portare WHERE id = ? AND versione = ?', id, versione)

// ── Valutazioni ─────────────────────────────────────────────

export function scriviValutazione(
  db: Db,
  v: { eventoId: string; voceId: string; utenteId: string; stelle: number; nomePiatto: string; portata: string; ricettaOrigineId: string | null },
  adesso: number,
): void {
  esegui(
    db,
    `INSERT INTO valutazioni (evento_id, voce_id, utente_id, stelle, nome_piatto, portata, ricetta_origine_id, creato_il, aggiornato_il)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (voce_id, utente_id) DO UPDATE SET stelle = excluded.stelle, aggiornato_il = excluded.aggiornato_il`,
    v.eventoId, v.voceId, v.utenteId, v.stelle, v.nomePiatto, v.portata, v.ricettaOrigineId, adesso, adesso,
  )
}
export const togliValutazione = (db: Db, voceId: string, utenteId: string) => esegui(db, 'DELETE FROM valutazioni WHERE voce_id = ? AND utente_id = ?', voceId, utenteId)
export const valutazioniEvento = (db: Db, eventoId: string) =>
  tutti<{ voce_id: string; utente_id: string; stelle: number }>(db, 'SELECT voce_id, utente_id, stelle FROM valutazioni WHERE evento_id = ?', eventoId)

/** Ricetta d'origine fotografata al voto, per voce (una sola per voce). */
export const originiValutate = (db: Db, eventoId: string) =>
  tutti<{ voce_id: string; ricetta_origine_id: string }>(db, 'SELECT voce_id, max(ricetta_origine_id) AS ricetta_origine_id FROM valutazioni WHERE evento_id = ? AND ricetta_origine_id IS NOT NULL GROUP BY voce_id', eventoId)

/** Valutazioni degli eventi visibili all'utente (suoi o condivisi con lui). */
export const valutazioniVisibili = (db: Db, utenteId: string) =>
  tutti<{ evento_id: string; voce_id: string; stelle: number; nome_piatto: string; portata: string; ricetta_origine_id: string | null; data: string; aggiornato_il: number; gruppo_id: string | null }>(
    db,
    `SELECT v.evento_id, v.voce_id, v.stelle, v.nome_piatto, v.portata, v.ricetta_origine_id, e.data, v.aggiornato_il, e.gruppo_id
     FROM valutazioni v JOIN eventi e ON e.id = v.evento_id
     WHERE e.proprietario_id = ? OR EXISTS (SELECT 1 FROM condivisioni_evento c WHERE c.evento_id = e.id AND c.utente_id = ?)`,
    utenteId,
    utenteId,
  )

// ── Notifiche ───────────────────────────────────────────────

export interface RigaNotifica {
  id: string
  utente_id: string
  tipo: string
  chiave: string
  gruppo_id: string | null
  evento_id: string | null
  messaggio_id: string | null
  piatto_id: string | null
  attore_nome: string | null
  testo: string
  conteggio: number
  aggiornato_il: number
  letta_il: number | null
  dettagli: string | null
}

/** Un aggiornamento dentro una notifica raggruppata (colonna JSON `dettagli`, gli ultimi 10). */
export interface DettaglioNotifica {
  attoreId: string | null
  testo: string
  messaggioId: string | null
  /** Elemento a cui porta, oltre al messaggio: «voce:<id>» o «cosa:<id>». */
  ancora: string | null
  il: number
}
const MASSIMO_DETTAGLI = 10

export interface NuovaNotifica {
  id: string
  utenteId: string
  tipo: string
  chiave: string
  gruppoId: string | null
  eventoId: string | null
  messaggioId: string | null
  piattoId: string | null
  attoreId: string | null
  testo: string
  ancora: string | null
}

/**
 * Raggruppa: se c'è già una notifica non letta con la stessa chiave la aggiorna (e aggiunge
 * l'aggiornamento all'elenco dei dettagli), altrimenti ne crea una.
 */
export function registraNotifica(db: Db, n: NuovaNotifica, adesso: number): void {
  const nuovo: DettaglioNotifica = { attoreId: n.attoreId, testo: n.testo, messaggioId: n.messaggioId, ancora: n.ancora, il: adesso }
  const aperta = uno<{ id: string; attore_id: string | null; testo: string; messaggio_id: string | null; aggiornato_il: number; dettagli: string | null }>(
    db,
    'SELECT id, attore_id, testo, messaggio_id, aggiornato_il, dettagli FROM notifiche WHERE utente_id = ? AND chiave = ? AND letta_il IS NULL',
    n.utenteId,
    n.chiave,
  )
  if (aperta) {
    // Le notifiche nate prima dei dettagli (0014) cominciano l'elenco con il loro ultimo aggiornamento.
    const prima: DettaglioNotifica[] = aperta.dettagli
      ? (JSON.parse(aperta.dettagli) as DettaglioNotifica[])
      : [{ attoreId: aperta.attore_id, testo: aperta.testo, messaggioId: aperta.messaggio_id, ancora: null, il: aperta.aggiornato_il }]
    const dettagli = JSON.stringify([...prima, nuovo].slice(-MASSIMO_DETTAGLI))
    esegui(
      db,
      'UPDATE notifiche SET conteggio = conteggio + 1, attore_id = ?, testo = ?, messaggio_id = coalesce(?, messaggio_id), aggiornato_il = ?, dettagli = ? WHERE id = ?',
      n.attoreId, n.testo, n.messaggioId, adesso, dettagli, aperta.id,
    )
    return
  }
  esegui(
    db,
    `INSERT INTO notifiche (id, utente_id, tipo, chiave, gruppo_id, evento_id, messaggio_id, piatto_id, attore_id, testo, creato_il, aggiornato_il, dettagli)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    n.id, n.utenteId, n.tipo, n.chiave, n.gruppoId, n.eventoId, n.messaggioId, n.piattoId, n.attoreId, n.testo, adesso, adesso, JSON.stringify([nuovo]),
  )
}
export const notificheUtente = (db: Db, utenteId: string, limite = 100) =>
  tutti<RigaNotifica>(
    db,
    'SELECT n.*, u.nome AS attore_nome FROM notifiche n LEFT JOIN utenti u ON u.id = n.attore_id WHERE n.utente_id = ? ORDER BY n.aggiornato_il DESC LIMIT ?',
    utenteId,
    limite,
  )
export const segnaLetta = (db: Db, id: string, utenteId: string, adesso: number) =>
  esegui(db, 'UPDATE notifiche SET letta_il = ? WHERE id = ? AND utente_id = ? AND letta_il IS NULL', adesso, id, utenteId)
export const segnaTutteLette = (db: Db, utenteId: string, adesso: number) => esegui(db, 'UPDATE notifiche SET letta_il = ? WHERE utente_id = ? AND letta_il IS NULL', adesso, utenteId)
export const eliminaNotifica = (db: Db, id: string) => esegui(db, 'DELETE FROM notifiche WHERE id = ?', id)
/** Le notifiche lette più vecchie di 60 giorni non servono più. */
export const pulisciNotificheVecchie = (db: Db, utenteId: string, prima: number) =>
  esegui(db, 'DELETE FROM notifiche WHERE utente_id = ? AND letta_il IS NOT NULL AND aggiornato_il < ?', utenteId, prima)
export const notificheDisattivate = (db: Db, utenteId: string) =>
  tutti<{ tipo: string }>(db, 'SELECT tipo FROM preferenze_notifiche WHERE utente_id = ? AND attiva = 0', utenteId).map((r) => r.tipo)
export function scriviPreferenze(db: Db, utenteId: string, disattivate: string[]): void {
  esegui(db, 'DELETE FROM preferenze_notifiche WHERE utente_id = ?', utenteId)
  for (const t of disattivate) esegui(db, 'INSERT INTO preferenze_notifiche (utente_id, tipo, attiva) VALUES (?, ?, 0)', utenteId, t)
}

/**
 * Dopo una modifica a mano di «A cura di»: se il testo non è più il nome dell'utente (o della
 * persona esterna) incaricato, il collegamento cade (resta il testo scritto).
 */
export const allineaIncaricato = (db: Db, voceId: string) =>
  esegui(
    db,
    `UPDATE voci_menu SET incaricato_id = NULL, incarico_completato = CASE WHEN incaricato = '' THEN 0 ELSE incarico_completato END
     WHERE id = ? AND incaricato_id IS NOT NULL AND incaricato <> coalesce((SELECT nome FROM utenti WHERE id = voci_menu.incaricato_id), '')`,
    voceId,
  ) +
  esegui(
    db,
    `UPDATE voci_menu SET incaricato_esterno_id = NULL, incarico_completato = CASE WHEN incaricato = '' THEN 0 ELSE incarico_completato END
     WHERE id = ? AND incaricato_esterno_id IS NOT NULL AND incaricato <> coalesce((SELECT nome FROM persone_esterne WHERE id = voci_menu.incaricato_esterno_id), '')`,
    voceId,
  )
