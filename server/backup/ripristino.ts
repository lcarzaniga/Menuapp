// Ripristino in due passi: verifica su database temporaneo, poi sostituzione atomica (SPEC §11.4).
import { randomBytes } from 'node:crypto'
import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { backup as backupSqlite } from 'node:sqlite'
import {
  FORMATO_ESPORTAZIONE,
  type RiepilogoRipristino,
  type RichiestaVerifica,
  SchemaEsportazione,
} from '../../src/contratto/backup.ts'
import { apriDatabase, chiudiDatabase, type Db, esegui, tutti, versioneSchema } from '../db/connessione.ts'
import { applicaMigrazioni, ultimaVersione } from '../db/migrazioni/esegui.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import { ErroreApi, regolaViolata, richiestaNonValida } from '../servizi/errori.ts'
import { creaBackup, elencaBackup, type InfoBackup, percorsoBackup } from './backup.ts'
import { conteggi, inserisciContenuto, leggiContenuto, META_DI_SERVIZIO, TABELLE_CONTENUTO } from './contenuto.ts'
import { calcolaImpronta } from './esportazione.ts'

const DURATA_TOKEN_MS = 10 * 60 * 1000

interface Preparato {
  percorso: string
  scade: number
  riepilogo: RiepilogoRipristino
}

/** Ripristini verificati in attesa di esecuzione, per token. */
export class RegistroRipristini {
  private preparati = new Map<string, Preparato>()
  readonly cartellaTemporanea: string
  constructor(cartellaTemporanea: string) {
    this.cartellaTemporanea = cartellaTemporanea
  }

  async pulisciScaduti(adesso = Date.now()): Promise<void> {
    for (const [token, p] of this.preparati) {
      if (p.scade < adesso) {
        this.preparati.delete(token)
        await rm(p.percorso, { force: true })
      }
    }
  }

  /** Elimina file temporanei rimasti da un avvio precedente. */
  async pulisciTutto(): Promise<void> {
    this.preparati.clear()
    await rm(this.cartellaTemporanea, { recursive: true, force: true })
  }

  registra(percorso: string, riepilogo: Omit<RiepilogoRipristino, 'token' | 'scadeIl'>, adesso = Date.now()): RiepilogoRipristino {
    const token = randomBytes(16).toString('hex')
    const scade = adesso + DURATA_TOKEN_MS
    const completo = { ...riepilogo, token, scadeIl: new Date(scade).toISOString() }
    this.preparati.set(token, { percorso, scade, riepilogo: completo })
    return completo
  }

  /** Consuma il token: un token vale per un solo tentativo. */
  prendi(token: string, adesso = Date.now()): Preparato {
    const p = this.preparati.get(token)
    this.preparati.delete(token)
    if (!p || p.scade < adesso) {
      throw regolaViolata('token_non_valido', 'Verifica scaduta o già usata: ripeti la verifica del ripristino')
    }
    return p
  }
}

function controllaRiferimenti(db: Db): void {
  const fk = tutti<{ table: string; parent: string }>(db, 'PRAGMA foreign_key_check')
  if (fk.length > 0) {
    const esempi = [...new Set(fk.map((r) => `${r.table} → ${r.parent}`))].slice(0, 5).join(', ')
    throw regolaViolata('riferimenti_non_validi', `Il file contiene ${fk.length} riferimenti non validi (${esempi})`)
  }
}

/** Passo 1: verifica senza toccare il database di produzione. */
export async function verificaRipristino(
  richiesta: RichiestaVerifica,
  opzioni: { registro: RegistroRipristini; cartellaBackup: string },
): Promise<RiepilogoRipristino> {
  const { registro } = opzioni
  await registro.pulisciScaduti()
  await mkdir(registro.cartellaTemporanea, { recursive: true })
  const percorso = join(registro.cartellaTemporanea, `verifica-${randomBytes(8).toString('hex')}.db`)
  const ultima = ultimaVersione()
  const avvisi: string[] = []
  let origine: string
  let dataDati: string
  let db: Db | null = null
  try {
    if (richiesta.origine === 'file') {
      const r = SchemaEsportazione.safeParse(richiesta.contenuto)
      if (!r.success) {
        const formato = (richiesta.contenuto as { formato?: unknown } | null)?.formato
        if (formato !== FORMATO_ESPORTAZIONE) throw richiestaNonValida('Il file non è un\'esportazione di Menù & Co.')
        throw richiestaNonValida(`Esportazione non valida: ${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`)
      }
      const e = r.data
      if (e.versioneSchema > ultima) {
        throw regolaViolata('schema_futuro', `Esportazione creata da una versione più recente (schema ${e.versioneSchema}): aggiorna l'app`)
      }
      // Impronta sul contenuto originale, prima di qualsiasi trasformazione.
      if (calcolaImpronta(e) !== e.impronta) {
        avvisi.push('L\'impronta non corrisponde: il file è stato modificato o è danneggiato.')
      }
      db = apriDatabase(percorso)
      await applicaMigrazioni(db, { cartellaBackup: null, fino: e.versioneSchema })
      db.exec('BEGIN IMMEDIATE')
      try {
        db.exec('PRAGMA defer_foreign_keys = ON')
        inserisciContenuto(db, e.dati)
        controllaRiferimenti(db)
        db.exec('COMMIT')
      } catch (err) {
        if (db.isTransaction) db.exec('ROLLBACK')
        if (err instanceof ErroreApi) throw err
        throw regolaViolata('contenuto_non_valido', `Dati non validi nel file: ${(err as Error).message}`)
      }
      origine = `File esportato da Menù & Co. ${e.versioneApp}`
      dataDati = e.esportatoAt
    } else {
      const sorgente = percorsoBackup(opzioni.cartellaBackup, richiesta.nome)
      const info = (await elencaBackup(opzioni.cartellaBackup)).find((b: InfoBackup) => b.nome === richiesta.nome)
      if (!info) throw new ErroreApi(404, 'non_trovato', 'Backup non trovato')
      const src = apriDatabase(sorgente, { soloLettura: true })
      try {
        await backupSqlite(src, percorso)
      } finally {
        src.close()
      }
      db = apriDatabase(percorso)
      const integrita = tutti<{ integrity_check: string }>(db, 'PRAGMA integrity_check')
      if (integrita[0]?.integrity_check !== 'ok') throw regolaViolata('backup_danneggiato', 'Il backup è danneggiato')
      if (versioneSchema(db) > ultima) {
        throw regolaViolata('schema_futuro', 'Backup creato da una versione più recente: aggiorna l\'app')
      }
      origine = `Backup del server ${info.nome}`
      dataDati = info.creatoIl
    }
    await applicaMigrazioni(db, { cartellaBackup: null })
    controllaRiferimenti(db)
    const riepilogo = {
      origine,
      dataDati,
      versioneSchema: versioneSchema(db),
      conteggi: conteggi(leggiContenuto(db)),
      avvisi,
    }
    chiudiDatabase(db)
    db = null
    return registro.registra(percorso, riepilogo)
  } catch (e) {
    if (db?.isOpen) db.close()
    await rm(percorso, { force: true })
    await rm(`${percorso}-wal`, { force: true })
    await rm(`${percorso}-shm`, { force: true })
    if (e instanceof ErroreApi) throw e
    throw regolaViolata('verifica_fallita', `Verifica non riuscita: ${(e as Error).message}`)
  }
}

/**
 * Passo 2: backup pre-ripristino obbligatorio, poi sostituzione del contenuto in
 * un'unica transazione. Se qualcosa fallisce, il database resta com'era.
 */
export async function eseguiRipristino(
  db: Db,
  token: string,
  opzioni: { registro: RegistroRipristini; cartellaBackup: string; dopoBackup?: (percorsoSorgente: string) => void },
): Promise<{ backupPrecedente: string; conteggi: Record<string, number> }> {
  const preparato = opzioni.registro.prendi(token)
  try {
    let backupPrecedente: string
    try {
      backupPrecedente = (await creaBackup(db, opzioni.cartellaBackup, 'pre-ripristino')).nome
    } catch (e) {
      throw regolaViolata('backup_fallito', `Backup dei dati attuali non riuscito, ripristino annullato: ${(e as Error).message}`)
    }
    opzioni.dopoBackup?.(preparato.percorso)
    db.prepare('ATTACH DATABASE ? AS sorgente').run(preparato.percorso)
    try {
      db.exec('BEGIN IMMEDIATE')
      try {
        db.exec('PRAGMA defer_foreign_keys = ON')
        for (const t of [...TABELLE_CONTENUTO].reverse()) {
          if (t === 'meta') esegui(db, `DELETE FROM main.meta WHERE chiave NOT IN (${META_DI_SERVIZIO.map(() => '?').join(', ')})`, ...META_DI_SERVIZIO)
          else db.exec(`DELETE FROM main."${t}"`)
        }
        for (const t of TABELLE_CONTENUTO) {
          const nomi = tutti<{ name: string }>(db, 'SELECT name FROM pragma_table_info(?, ?) ORDER BY cid', t, 'main').map((c) => `"${c.name}"`)
          const filtro = t === 'meta' ? ` WHERE chiave NOT IN (${META_DI_SERVIZIO.map((k) => `'${k}'`).join(', ')})` : ''
          db.exec(`INSERT INTO main."${t}" (${nomi.join(', ')}) SELECT ${nomi.join(', ')} FROM sorgente."${t}"${filtro}`)
        }
        const fk = tutti(db, 'PRAGMA main.foreign_key_check')
        if (fk.length > 0) throw new Error(`${fk.length} riferimenti non validi`)
        incrementaRevisione(db)
        db.exec('COMMIT')
      } catch (e) {
        if (db.isTransaction) db.exec('ROLLBACK')
        throw regolaViolata('ripristino_fallito', `Ripristino non riuscito, nessuna modifica: ${(e as Error).message}`)
      }
    } finally {
      db.exec('DETACH DATABASE sorgente')
    }
    return { backupPrecedente, conteggi: preparato.riepilogo.conteggi }
  } finally {
    await rm(preparato.percorso, { force: true })
    for (const suffisso of ['-wal', '-shm']) await rm(`${preparato.percorso}${suffisso}`, { force: true })
  }
}

/** File temporanei di verifica rimasti (per diagnostica). */
export async function temporaneiRimasti(cartella: string): Promise<string[]> {
  try {
    return await readdir(cartella)
  } catch {
    return []
  }
}
