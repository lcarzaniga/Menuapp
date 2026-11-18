// Backup del database: creazione a caldo, verifica, rotazione, elenco (SPEC §11.1–11.2).
import { createHash } from 'node:crypto'
import { copyFile, mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { backup as backupSqlite, type DatabaseSync } from 'node:sqlite'
import { type Db, tutti } from '../db/connessione.ts'
import { apriDatabase } from '../db/sqlite-node.ts'

export const TIPI_BACKUP = ['giornaliero', 'settimanale', 'pre-migrazione', 'pre-ripristino', 'manuale'] as const
export type TipoBackup = (typeof TIPI_BACKUP)[number]

export const CONSERVAZIONE: Record<TipoBackup, number> = {
  giornaliero: 14,
  settimanale: 8,
  'pre-migrazione': 5,
  'pre-ripristino': 5,
  manuale: 10,
}

export const RE_NOME_BACKUP = /^(giornaliero|settimanale|pre-migrazione|pre-ripristino|manuale)-(\d{8}-\d{6})(?:-(\d+))?-v(\d+)\.db$/

export interface InfoBackup {
  nome: string
  tipo: TipoBackup
  creatoIl: string
  versioneSchema: number
  byte: number
  sha256: string
  conteggi: Record<string, number>
  verificato: boolean
}

export class ErroreBackup extends Error {}

function marcaTemporale(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function sha256File(percorso: string): Promise<string> {
  return createHash('sha256').update(await readFile(percorso)).digest('hex')
}

async function sincronizza(percorso: string): Promise<void> {
  const fh = await open(percorso, 'r')
  try {
    await fh.sync()
  } finally {
    await fh.close()
  }
}

/** Verifica un file SQLite in sola lettura: integrità, chiavi esterne, versione, conteggi. */
export function verificaFile(percorso: string): { versioneSchema: number; conteggi: Record<string, number> } {
  const db = apriDatabase(percorso, { soloLettura: true })
  try {
    const integrita = tutti<{ integrity_check: string }>(db, 'PRAGMA integrity_check')
    if (integrita.length !== 1 || integrita[0]?.integrity_check !== 'ok') {
      throw new ErroreBackup(`Verifica di integrità fallita: ${integrita.map((r) => r.integrity_check).join('; ')}`)
    }
    const fk = tutti(db, 'PRAGMA foreign_key_check')
    if (fk.length > 0) throw new ErroreBackup(`Riferimenti non validi nel backup: ${fk.length}`)
    const versioneSchema = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
    const tabelle = tutti<{ name: string }>(
      db,
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    const conteggi: Record<string, number> = {}
    for (const { name } of tabelle) {
      conteggi[name] = Number((db.prepare(`SELECT count(*) AS n FROM "${name}"`).get() as { n: number }).n)
    }
    return { versioneSchema, conteggi }
  } finally {
    db.close()
  }
}

/**
 * Crea un backup verificato. La copia è coerente anche durante le scritture (API di
 * backup online di SQLite). Il file definitivo esiste solo se la verifica riesce.
 */
export async function creaBackup(
  db: Db,
  cartella: string,
  tipo: TipoBackup,
  adesso: Date = new Date(),
): Promise<InfoBackup> {
  await mkdir(cartella, { recursive: true })
  const temporaneo = join(cartella, `.temp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
  try {
    // Solo sul server Debian: il database è sempre un DatabaseSync.
    await backupSqlite(db as DatabaseSync, temporaneo)
    const { versioneSchema, conteggi } = verificaFile(temporaneo)
    await sincronizza(temporaneo)
    const base = `${tipo}-${marcaTemporale(adesso)}`
    let nome = `${base}-v${versioneSchema}.db`
    for (let i = 2; await esiste(join(cartella, nome)); i++) nome = `${base}-${i}-v${versioneSchema}.db`
    const definitivo = join(cartella, nome)
    await rename(temporaneo, definitivo)
    const info: InfoBackup = {
      nome,
      tipo,
      creatoIl: adesso.toISOString(),
      versioneSchema,
      byte: (await stat(definitivo)).size,
      sha256: await sha256File(definitivo),
      conteggi,
      verificato: true,
    }
    await writeFile(`${definitivo}.json`, JSON.stringify(info, null, 2))
    if (tipo === 'giornaliero' && adesso.getDay() === 0) {
      const nomeSett = nome.replace(/^giornaliero/, 'settimanale')
      await copyFile(definitivo, join(cartella, nomeSett))
      await writeFile(join(cartella, `${nomeSett}.json`), JSON.stringify({ ...info, nome: nomeSett, tipo: 'settimanale' }, null, 2))
      await ruota(cartella, 'settimanale')
    }
    await ruota(cartella, tipo)
    return info
  } finally {
    await rm(temporaneo, { force: true })
  }
}

async function esiste(percorso: string): Promise<boolean> {
  try {
    await stat(percorso)
    return true
  } catch {
    return false
  }
}

/** Tiene gli ultimi N backup del tipo indicato. */
export async function ruota(cartella: string, tipo: TipoBackup): Promise<void> {
  const elenco = (await elencaBackup(cartella)).filter((b) => b.tipo === tipo)
  for (const vecchio of elenco.slice(CONSERVAZIONE[tipo])) {
    await rm(join(cartella, vecchio.nome), { force: true })
    await rm(join(cartella, `${vecchio.nome}.json`), { force: true })
  }
}

/** Backup presenti, dal più recente. I file temporanei e quelli con nome estraneo sono ignorati. */
export async function elencaBackup(cartella: string): Promise<InfoBackup[]> {
  let nomi: string[]
  try {
    nomi = await readdir(cartella)
  } catch {
    return []
  }
  const risultato: InfoBackup[] = []
  for (const nome of nomi) {
    const m = RE_NOME_BACKUP.exec(nome)
    if (!m) continue
    let info: InfoBackup
    try {
      info = JSON.parse(await readFile(join(cartella, `${nome}.json`), 'utf8')) as InfoBackup
    } catch {
      const s = await stat(join(cartella, nome))
      info = {
        nome,
        tipo: m[1] as TipoBackup,
        creatoIl: s.mtime.toISOString(),
        versioneSchema: Number(m[4]),
        byte: s.size,
        sha256: '',
        conteggi: {},
        verificato: false,
      }
    }
    risultato.push(info)
  }
  return risultato.sort((a, b) => b.creatoIl.localeCompare(a.creatoIl) || b.nome.localeCompare(a.nome))
}

export function percorsoBackup(cartella: string, nome: string): string {
  if (!RE_NOME_BACKUP.test(nome)) throw new ErroreBackup('Nome di backup non valido')
  return join(cartella, nome)
}
