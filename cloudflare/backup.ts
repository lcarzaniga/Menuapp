// Backup su Cloudflare (SPEC §32.6): esportazioni JSON nel bucket R2 (`backup/`), una ogni
// notte e a richiesta; ripristino solo dalla console (script amministrativo).
import type { InfoBackupApi, StatoBackup } from '../src/contratto/backup.ts'
import { SchemaEsportazione } from '../src/contratto/backup.ts'
import { createHash } from 'node:crypto'
import { type Db, transazione, tutti, versioneSchema } from '../server/db/connessione.ts'
import { incrementaRevisione, leggiMeta, scriviMeta } from '../server/db/repo/meta.ts'
import { calcolaImpronta, esporta } from '../server/backup/esportazione.ts'
import { inserisciContenuto, META_DI_SERVIZIO, TABELLE_CONTENUTO, type RigaGenerica } from '../server/backup/contenuto.ts'
import { esegui } from '../server/db/connessione.ts'
import { nomeFile } from '../server/servizi/foto.ts'
import type { TipoFoto } from '../src/contratto/foto.ts'
import { CESTINO } from './cartella-r2.ts'

export const PREFISSO_BACKUP = 'backup/'
export type TipoBackupR2 = 'giornaliero' | 'manuale' | 'pre-ripristino'
export const RE_NOME_BACKUP_R2 = /^(giornaliero|manuale|pre-ripristino)-(\d{8}-\d{6})-v(\d+)\.json$/
const CONSERVAZIONE: Record<TipoBackupR2, number> = { giornaliero: 14, manuale: 10, 'pre-ripristino': 5 }
const GIORNI_CESTINO = 30
const ORE = 3_600_000

const marca = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)

/** Esportazione completa salvata in R2, con le informazioni del backup nei metadati. */
export async function creaBackupR2(db: Db, bucket: R2Bucket, tipo: TipoBackupR2, versioneApp: string, adesso = new Date()): Promise<InfoBackupApi> {
  try {
    const e = esporta(db, versioneApp, adesso)
    const testo = new TextEncoder().encode(JSON.stringify(e))
    const nome = `${tipo}-${marca(adesso)}-v${e.versioneSchema}.json`
    const info: InfoBackupApi = {
      nome,
      tipo,
      creatoIl: adesso.toISOString(),
      versioneSchema: e.versioneSchema,
      byte: testo.length,
      sha256: createHash('sha256').update(testo).digest('hex'),
      // Metadati R2 al massimo 2 KB: solo le tabelle non vuote.
      conteggi: Object.fromEntries(Object.entries(e.conteggi).filter(([, n]) => n > 0)),
      verificato: true,
    }
    await bucket.put(`${PREFISSO_BACKUP}${nome}`, testo, { httpMetadata: { contentType: 'application/json' }, customMetadata: { info: JSON.stringify(info) } })
    scriviMeta(db, 'ultimo_backup', { nome, creatoIl: info.creatoIl, tipo, esito: 'ok' })
    await ruota(bucket, tipo)
    return info
  } catch (e) {
    scriviMeta(db, 'ultimo_backup', { nome: '', creatoIl: adesso.toISOString(), tipo, esito: 'errore', messaggio: (e as Error).message })
    throw e
  }
}

export async function elencaBackupR2(bucket: R2Bucket): Promise<InfoBackupApi[]> {
  const out: InfoBackupApi[] = []
  let cursor: string | undefined
  do {
    const pagina = await bucket.list({ prefix: PREFISSO_BACKUP, include: ['customMetadata'], cursor })
    for (const o of pagina.objects) {
      const nome = o.key.slice(PREFISSO_BACKUP.length)
      const m = RE_NOME_BACKUP_R2.exec(nome)
      if (!m) continue
      try {
        out.push(JSON.parse(o.customMetadata?.info ?? '') as InfoBackupApi)
      } catch {
        out.push({ nome, tipo: m[1] as TipoBackupR2, creatoIl: o.uploaded.toISOString(), versioneSchema: Number(m[3]), byte: o.size, sha256: '', conteggi: {}, verificato: false })
      }
    }
    cursor = pagina.truncated ? pagina.cursor : undefined
  } while (cursor)
  return out.sort((a, b) => b.creatoIl.localeCompare(a.creatoIl) || b.nome.localeCompare(a.nome))
}

async function ruota(bucket: R2Bucket, tipo: TipoBackupR2): Promise<void> {
  const vecchi = (await elencaBackupR2(bucket)).filter((b) => b.tipo === tipo).slice(CONSERVAZIONE[tipo])
  if (vecchi.length) await bucket.delete(vecchi.map((b) => `${PREFISSO_BACKUP}${b.nome}`))
}

export async function statoBackupR2(db: Db, bucket: R2Bucket, adesso = Date.now()): Promise<StatoBackup> {
  const backup = await elencaBackupR2(bucket)
  const ultimo = leggiMeta<{ esito: string; tipo: string; messaggio?: string }>(db, 'ultimo_backup')
  const ultimaEsportazione = leggiMeta<string>(db, 'ultima_esportazione') ?? null
  const avvisi: string[] = []
  if (ultimo?.esito === 'errore') avvisi.push(`L'ultimo backup (${ultimo.tipo}) non è riuscito: ${ultimo.messaggio ?? 'errore'}`)
  const eventi = Number(tutti<{ n: number }>(db, 'SELECT count(*) AS n FROM eventi')[0]?.n ?? 0)
  const giornaliero = backup.find((b) => b.tipo === 'giornaliero')
  if (eventi > 0 && (!giornaliero || adesso - Date.parse(giornaliero.creatoIl) > 36 * ORE)) avvisi.push('Nessun backup giornaliero riuscito nelle ultime 36 ore.')
  if (eventi > 0 && (!ultimaEsportazione || adesso - Date.parse(ultimaEsportazione) > 14 * 24 * ORE)) {
    avvisi.push('Da più di 14 giorni non scarichi un\'esportazione su un altro dispositivo.')
  }
  return { backup, ultimaEsportazione, avvisi }
}

/** File di foto e allegati citati dal database. */
function fileCitati(db: Db): Set<string> {
  return new Set(tutti<{ id: string; tipo: TipoFoto }>(db, 'SELECT id, tipo FROM foto_piatti UNION ALL SELECT id, tipo FROM allegati').map((r) => nomeFile(r)))
}

/**
 * Ripristino da un backup in R2 (solo console): verifica formato, impronta e schema, salva i
 * dati attuali come `pre-ripristino`, sostituisce il contenuto in una sola transazione e
 * rimette dal cestino i file delle foto che servono di nuovo.
 */
export async function ripristinaDaR2(db: Db, bucket: R2Bucket, nome: string, versioneApp: string): Promise<{ backupPrecedente: string; conteggi: Record<string, number>; fotoMancanti: string[] }> {
  if (!RE_NOME_BACKUP_R2.test(nome)) throw new Error('Nome di backup non valido')
  const oggetto = await bucket.get(`${PREFISSO_BACKUP}${nome}`)
  if (!oggetto) throw new Error(`Backup ${nome} inesistente`)
  const r = SchemaEsportazione.safeParse(JSON.parse(await oggetto.text()))
  if (!r.success) throw new Error('Il file non è un\'esportazione valida')
  const e = r.data
  if (calcolaImpronta(e) !== e.impronta) throw new Error('Impronta non corrispondente: il file è danneggiato o modificato')
  if (e.versioneSchema !== versioneSchema(db)) throw new Error(`Il backup è allo schema ${e.versioneSchema}, il database al ${versioneSchema(db)}`)
  const precedente = await creaBackupR2(db, bucket, 'pre-ripristino', versioneApp)
  transazione(db, () => {
    esegui(db, 'PRAGMA defer_foreign_keys = ON')
    for (const t of [...TABELLE_CONTENUTO].reverse()) {
      if (t === 'meta') esegui(db, `DELETE FROM meta WHERE chiave NOT IN (${META_DI_SERVIZIO.map(() => '?').join(', ')})`, ...META_DI_SERVIZIO)
      else esegui(db, `DELETE FROM "${t}"`)
    }
    inserisciContenuto(db, e.dati as Record<string, RigaGenerica[]>)
    const fk = tutti(db, 'PRAGMA foreign_key_check')
    if (fk.length > 0) throw new Error(`${fk.length} riferimenti non validi`)
    incrementaRevisione(db)
  })
  const fotoMancanti: string[] = []
  for (const f of fileCitati(db)) {
    if (await bucket.head(f)) continue
    const nelCestino = await bucket.get(`${CESTINO}${f}`)
    if (nelCestino) await bucket.put(f, await nelCestino.arrayBuffer())
    else fotoMancanti.push(f)
  }
  return { backupPrecedente: precedente.nome, conteggi: e.conteggi, fotoMancanti }
}

/**
 * Manutenzione notturna: backup giornaliero, file non più citati spostati nel cestino (dopo un
 * giorno, così non si tocca un caricamento in corso), cestino svuotato dopo 30 giorni.
 */
export async function manutenzioneNotturna(db: Db, bucket: R2Bucket, versioneApp: string, adesso = new Date()): Promise<{ backup: string; nelCestino: number; eliminati: number }> {
  const info = await creaBackupR2(db, bucket, 'giornaliero', versioneApp, adesso)
  const citati = fileCitati(db)
  let nelCestino = 0
  let eliminati = 0
  let cursor: string | undefined
  do {
    const pagina = await bucket.list({ cursor, include: ['customMetadata'] })
    for (const o of pagina.objects) {
      if (o.key.startsWith(PREFISSO_BACKUP)) continue
      if (o.key.startsWith(CESTINO)) {
        const quando = Date.parse(o.customMetadata?.eliminatoIl ?? o.uploaded.toISOString())
        if (adesso.getTime() - quando > GIORNI_CESTINO * 24 * ORE) {
          await bucket.delete(o.key)
          eliminati++
        }
      } else if (!citati.has(o.key) && adesso.getTime() - o.uploaded.getTime() > 24 * ORE) {
        const dati = await bucket.get(o.key)
        if (dati) await bucket.put(`${CESTINO}${o.key}`, await dati.arrayBuffer(), { customMetadata: { eliminatoIl: adesso.toISOString() } })
        await bucket.delete(o.key)
        nelCestino++
      }
    }
    cursor = pagina.truncated ? pagina.cursor : undefined
  } while (cursor)
  return { backup: info.nome, nelCestino, eliminati }
}
