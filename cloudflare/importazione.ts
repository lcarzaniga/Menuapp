// Importazione dei contenuti del server Debian nell'installazione Cloudflare (SPEC §33).
//
// I contenuti arrivano come esportazione completa (§11.3) caricata in R2 sotto
// `importazione/<id>/`, con le foto in `importazione/<id>/foto/` e la corrispondenza degli
// utenti confermata da Loris in `importazione/<id>/corrispondenza.json`. Gli utenti, le
// sessioni, gli inviti, le richieste di attivazione e le preferenze di Cloudflare restano;
// tutto il resto (contenuti di prova compresi) è sostituito da quello di Debian, con ogni
// riferimento a un utente Debian tradotto nel corrispondente utente Cloudflare. Nessun
// riferimento senza corrispondenza: in quel caso l'importazione si ferma prima di toccare nulla.
import { createHash } from 'node:crypto'
import { SchemaEsportazione, type Esportazione } from '../src/contratto/backup.ts'
import type { TipoFoto } from '../src/contratto/foto.ts'
import { norm } from '../src/domain/testo.ts'
import { inserisciContenuto, META_DI_SERVIZIO, TABELLE_CONTENUTO, type RigaGenerica } from '../server/backup/contenuto.ts'
import { calcolaImpronta } from '../server/backup/esportazione.ts'
import { type Db, esegui, transazione, tutti, uno, versioneSchema } from '../server/db/connessione.ts'
import { incrementaRevisione } from '../server/db/repo/meta.ts'
import { nomeFile } from '../server/servizi/foto.ts'
import * as identita from '../server/servizi/identita.ts'
import { creaBackupR2 } from './backup.ts'

export const PREFISSO_IMPORTAZIONE = 'importazione/'
export const RE_ID_IMPORTAZIONE = /^[0-9]{8}-[0-9]{4,6}$/

/** Tabelle dell'identità di Cloudflare: mai sostituite dall'importazione. */
export const TABELLE_IDENTITA = ['utenti', 'sessioni', 'preferenze_notifiche'] as const
const TABELLE_IMPORTATE = TABELLE_CONTENUTO.filter((t) => !(TABELLE_IDENTITA as readonly string[]).includes(t))

/** Utente Debian → utente Cloudflare esistente, oppure da creare (senza dispositivi). */
export type Destinazione = { utente: string } | { nuovo: { nome: string; ruolo: 'amministratore' | 'utente' } }
export interface Corrispondenza {
  importazione: string
  /** Messa a true da Loris dopo aver controllato la proposta: senza, niente importazione. */
  confermata: boolean
  utenti: Record<string, Destinazione & { nomeDebian: string }>
}

interface UtenteDebian {
  id: string
  nome: string
  ruolo: 'amministratore' | 'utente'
  stato: string
}

const chiave = (id: string, nome: string) => `${PREFISSO_IMPORTAZIONE}${id}/${nome}`

/** Colonne che puntano a `utenti`, lette dallo schema reale (chiavi esterne). */
export function colonneUtente(db: Db): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const t of TABELLE_IMPORTATE) {
    const c = tutti<{ from: string; table: string }>(db, 'SELECT "from", "table" FROM pragma_foreign_key_list(?)', t)
      .filter((f) => f.table === 'utenti')
      .map((f) => f.from)
    if (c.length) out.set(t, c)
  }
  return out
}

async function leggiJson<T>(bucket: R2Bucket, k: string): Promise<T> {
  const o = await bucket.get(k)
  if (!o) throw new Error(`Manca ${k} in R2: caricalo con scripts/cloudflare/migra.ts carica`)
  return JSON.parse(await o.text()) as T
}

export async function leggiEsportazione(bucket: R2Bucket, id: string): Promise<Esportazione> {
  const r = SchemaEsportazione.safeParse(await leggiJson(bucket, chiave(id, 'esportazione.json')))
  if (!r.success) throw new Error('esportazione.json non è un\'esportazione valida')
  if (calcolaImpronta(r.data) !== r.data.impronta) throw new Error('Impronta dell\'esportazione non corrispondente: file danneggiato o modificato')
  return r.data
}

/** Utenti di Cloudflare con l'indicazione delle sessioni attive (per la proposta). */
export function utentiCloudflare(db: Db, adesso = Date.now()) {
  return tutti<{ id: string; nome: string; ruolo: string; stato: string; dispositivi: number }>(
    db,
    'SELECT u.id, u.nome, u.ruolo, u.stato, (SELECT count(*) FROM sessioni s WHERE s.utente_id = u.id AND s.revocata_il IS NULL AND s.scade_il > ?) AS dispositivi FROM utenti u ORDER BY u.nome',
    adesso,
  )
}

/**
 * Proposta di corrispondenza per nome normalizzato. Le omonimie (più utenti con lo stesso nome
 * da una parte o dall'altra) e i nomi senza corrispondenza non vengono mai risolti in automatico.
 */
export function proponiCorrispondenza(db: Db, e: Esportazione, id: string): { corrispondenza: Corrispondenza; problemi: string[] } {
  const debian = (e.dati.utenti ?? []) as unknown as UtenteDebian[]
  const cf = utentiCloudflare(db)
  const problemi: string[] = []
  const utenti: Corrispondenza['utenti'] = {}
  const contaD = new Map<string, number>()
  for (const u of debian) contaD.set(norm(u.nome), (contaD.get(norm(u.nome)) ?? 0) + 1)
  for (const u of debian) {
    const candidati = cf.filter((c) => norm(c.nome) === norm(u.nome))
    if ((contaD.get(norm(u.nome)) ?? 0) > 1) problemi.push(`Omonimia su Debian: più utenti «${u.nome}»: scegli a mano`)
    if (candidati.length === 1 && (contaD.get(norm(u.nome)) ?? 0) === 1) {
      utenti[u.id] = { nomeDebian: u.nome, utente: candidati[0]!.id }
      if (candidati[0]!.ruolo !== u.ruolo) problemi.push(`«${u.nome}»: ruolo ${u.ruolo} su Debian, ${candidati[0]!.ruolo} su Cloudflare (resta quello di Cloudflare)`)
    } else if (candidati.length > 1) {
      problemi.push(`Omonimia su Cloudflare: ${candidati.length} utenti «${u.nome}» (${candidati.map((c) => c.id).join(', ')}): scegli a mano`)
      utenti[u.id] = { nomeDebian: u.nome, utente: '' }
    } else {
      problemi.push(`«${u.nome}» non esiste su Cloudflare: indica un utente esistente oppure lascia «nuovo» (creato senza dispositivi)`)
      utenti[u.id] = { nomeDebian: u.nome, nuovo: { nome: u.nome, ruolo: u.ruolo } }
    }
  }
  return { corrispondenza: { importazione: id, confermata: false, utenti }, problemi }
}

interface Piano {
  esportazione: Esportazione
  mappa: Map<string, string>
  nuovi: { id: string; nome: string; ruolo: 'amministratore' | 'utente' }[]
  file: { nome: string; sha256: string; byte: number }[]
}

/** Controlli completi senza modificare nulla: ciò che `importa` farebbe, o l'errore che lo ferma. */
export async function preparaPiano(db: Db, bucket: R2Bucket, id: string): Promise<Piano> {
  if (!RE_ID_IMPORTAZIONE.test(id)) throw new Error('Identificativo d\'importazione non valido')
  const e = await leggiEsportazione(bucket, id)
  if (e.versioneSchema !== versioneSchema(db)) throw new Error(`Esportazione allo schema ${e.versioneSchema}, Cloudflare al ${versioneSchema(db)}: rilascia prima la stessa versione`)
  const c = await leggiJson<Corrispondenza>(bucket, chiave(id, 'corrispondenza.json'))
  if (c.importazione !== id) throw new Error('La corrispondenza è di un\'altra importazione')
  if (c.confermata !== true) throw new Error('Corrispondenza non confermata: controllala e metti "confermata": true')

  const debian = (e.dati.utenti ?? []) as unknown as UtenteDebian[]
  const esistenti = new Map(utentiCloudflare(db).map((u) => [u.id, u]))
  const mappa = new Map<string, string>()
  const nuovi: Piano['nuovi'] = []
  const usati = new Map<string, string>()
  for (const u of debian) {
    const d = c.utenti[u.id]
    if (!d) throw new Error(`Utente Debian «${u.nome}» (${u.id}) assente dalla corrispondenza`)
    let destinazione: string
    if ('utente' in d) {
      if (!esistenti.has(d.utente)) throw new Error(`«${u.nome}»: l'utente Cloudflare ${d.utente || '(vuoto)'} non esiste`)
      destinazione = d.utente
    } else {
      if (esistenti.has(u.id) || [...esistenti.values()].some((x) => norm(x.nome) === norm(d.nuovo.nome))) {
        throw new Error(`«${u.nome}»: esiste già un utente con quell'identificativo o quel nome su Cloudflare: usa la corrispondenza, non un nuovo utente`)
      }
      nuovi.push({ id: u.id, nome: d.nuovo.nome, ruolo: d.nuovo.ruolo })
      destinazione = u.id
    }
    // Due utenti Debian sullo stesso utente Cloudflare unirebbero due persone: mai.
    const gia = usati.get(destinazione)
    if (gia) throw new Error(`«${gia}» e «${u.nome}» puntano allo stesso utente Cloudflare`)
    usati.set(destinazione, u.nome)
    mappa.set(u.id, destinazione)
  }

  // Ogni riferimento a un utente nei contenuti deve avere la sua corrispondenza.
  const colonne = colonneUtente(db)
  for (const [t, cs] of colonne) {
    for (const r of (e.dati[t] ?? []) as RigaGenerica[]) {
      for (const col of cs) {
        const v = r[col]
        if (v !== null && v !== undefined && !mappa.has(String(v))) throw new Error(`${t}.${col}: riferimento all'utente ${String(v)}, che non è fra gli utenti Debian`)
      }
    }
  }

  // Ogni foto e ogni allegato deve avere il suo file, identico.
  const file: Piano['file'] = []
  for (const t of ['foto_piatti', 'allegati'] as const) {
    for (const r of (e.dati[t] ?? []) as { id: string; tipo: TipoFoto; sha256: string; byte: number }[]) {
      const nome = nomeFile(r)
      const o = await bucket.head(chiave(id, `foto/${nome}`))
      if (!o) throw new Error(`Manca il file ${nome} (${t}) fra quelli caricati`)
      if (o.size !== r.byte) throw new Error(`Il file ${nome} ha ${o.size} byte invece di ${r.byte}`)
      file.push({ nome, sha256: r.sha256, byte: r.byte })
    }
  }
  return { esportazione: e, mappa, nuovi, file }
}

/** Traduce gli id degli utenti Debian dentro un JSON (dettagli delle notifiche). */
function traduciJson(testo: string, mappa: Map<string, string>): string {
  const visita = (x: unknown): unknown =>
    typeof x === 'string' ? (mappa.get(x) ?? x) : Array.isArray(x) ? x.map(visita) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, visita(v)])) : x
  try {
    return JSON.stringify(visita(JSON.parse(testo)))
  } catch {
    return testo
  }
}

export function contenutoTradotto(db: Db, p: Piano): Record<string, RigaGenerica[]> {
  const colonne = colonneUtente(db)
  const dati: Record<string, RigaGenerica[]> = {}
  for (const t of TABELLE_IMPORTATE) {
    const cs = colonne.get(t) ?? []
    dati[t] = ((p.esportazione.dati[t] ?? []) as RigaGenerica[]).map((r) => {
      const n: RigaGenerica = { ...r }
      for (const c of cs) if (n[c] !== null && n[c] !== undefined) n[c] = p.mappa.get(String(n[c]))!
      if (t === 'notifiche' && typeof n.dettagli === 'string') n.dettagli = traduciJson(n.dettagli, p.mappa)
      return n
    })
  }
  return dati
}

/** Conteggi attesi dopo l'importazione: quelli di Debian per i contenuti. */
export function conteggiAttesi(p: Piano): Record<string, number> {
  return Object.fromEntries(TABELLE_IMPORTATE.filter((t) => t !== 'meta').map((t) => [t, (p.esportazione.dati[t] ?? []).length]))
}

export interface EsitoImportazione {
  backupPrecedente: string
  conteggi: Record<string, number>
  nuoviUtenti: string[]
}

/**
 * Importazione: backup `pre-migrazione` di Cloudflare, file copiati dalla zona di carico ai
 * nomi definitivi, poi in una sola transazione via i contenuti di prova e dentro quelli di
 * Debian tradotti. Se un controllo fallisce dentro la transazione, il database resta com'era.
 */
export async function importa(db: Db, bucket: R2Bucket, id: string, versioneApp: string): Promise<EsitoImportazione> {
  const p = await preparaPiano(db, bucket, id)
  const backup = await creaBackupR2(db, bucket, 'pre-migrazione', versioneApp)
  for (const f of p.file) {
    const o = await bucket.get(chiave(id, `foto/${f.nome}`))
    const dati = new Uint8Array(await o!.arrayBuffer())
    if (createHash('sha256').update(dati).digest('hex') !== f.sha256) throw new Error(`Il file ${f.nome} non corrisponde alla sua impronta`)
    await bucket.put(f.nome, dati)
  }
  const dati = contenutoTradotto(db, p)
  transazione(db, () => {
    esegui(db, 'PRAGMA defer_foreign_keys = ON')
    for (const t of [...TABELLE_IMPORTATE].reverse()) {
      if (t === 'meta') esegui(db, `DELETE FROM meta WHERE chiave NOT IN (${META_DI_SERVIZIO.map(() => '?').join(', ')})`, ...META_DI_SERVIZIO)
      else esegui(db, `DELETE FROM "${t}"`)
    }
    // Utenti che su Cloudflare non c'erano: senza dispositivi; le Famiglie arrivano da Debian.
    for (const u of p.nuovi) identita.creaUtente(db, { id: u.id, nome: u.nome, ruolo: u.ruolo, famiglia: false })
    inserisciContenuto(db, dati)
    const fk = tutti(db, 'PRAGMA foreign_key_check')
    if (fk.length > 0) throw new Error(`${fk.length} riferimenti non validi dopo l'importazione`)
    const attesi = conteggiAttesi(p)
    for (const [t, n] of Object.entries(attesi)) {
      const reali = Number(uno<{ n: number }>(db, `SELECT count(*) AS n FROM "${t}"`)?.n ?? 0)
      if (reali !== n) throw new Error(`${t}: ${reali} righe invece di ${n}`)
    }
    incrementaRevisione(db)
  })
  return { backupPrecedente: backup.nome, conteggi: conteggiAttesi(p), nuoviUtenti: p.nuovi.map((u) => u.nome) }
}

/**
 * Verifica dopo l'importazione (ripetibile): conteggi uguali a Debian, nessun riferimento
 * rotto, ogni riferimento a un utente esistente, ogni foto e allegato presente in R2 e identico.
 */
export async function verificaImportazione(db: Db, bucket: R2Bucket, id: string): Promise<string[]> {
  const e = await leggiEsportazione(bucket, id)
  const problemi: string[] = []
  for (const t of TABELLE_IMPORTATE) {
    if (t === 'meta') continue
    const atteso = (e.dati[t] ?? []).length
    const reali = Number(uno<{ n: number }>(db, `SELECT count(*) AS n FROM "${t}"`)?.n ?? 0)
    if (reali !== atteso) problemi.push(`${t}: ${reali} righe, attese ${atteso}`)
  }
  const fk = tutti<{ table: string }>(db, 'PRAGMA foreign_key_check')
  if (fk.length) problemi.push(`${fk.length} riferimenti non validi (${[...new Set(fk.map((f) => f.table))].join(', ')})`)
  for (const [t, cs] of colonneUtente(db)) {
    for (const c of cs) {
      const n = Number(uno<{ n: number }>(db, `SELECT count(*) AS n FROM "${t}" WHERE "${c}" IS NOT NULL AND "${c}" NOT IN (SELECT id FROM utenti)`)?.n ?? 0)
      if (n) problemi.push(`${t}.${c}: ${n} riferimenti a utenti inesistenti`)
    }
  }
  for (const r of tutti<{ id: string; tipo: TipoFoto; sha256: string }>(db, 'SELECT id, tipo, sha256 FROM foto_piatti UNION ALL SELECT id, tipo, sha256 FROM allegati')) {
    const o = await bucket.get(nomeFile(r))
    if (!o) problemi.push(`File mancante: ${nomeFile(r)}`)
    else if (createHash('sha256').update(new Uint8Array(await o.arrayBuffer())).digest('hex') !== r.sha256) problemi.push(`File diverso dall'originale: ${nomeFile(r)}`)
  }
  return problemi
}
