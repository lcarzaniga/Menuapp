import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { elencaBackup } from '../../backup/backup.ts'
import { cartellaTemporanea } from '../../prova.ts'
import { apriDatabase, chiudiDatabase, type Db, tutti, uno, versioneSchema } from '../connessione.ts'
import { CARTELLA_MIGRAZIONI, applicaMigrazioni, ErroreMigrazione, ultimaVersione } from './esegui.ts'
import { eseguiSeed } from '../seed/seed.ts'

const pulizie: (() => void)[] = []
afterEach(() => {
  while (pulizie.length) pulizie.pop()?.()
})

function preparaCartella() {
  const t = cartellaTemporanea()
  const dbs: Db[] = []
  pulizie.push(() => {
    dbs.forEach((d) => d.isOpen && chiudiDatabase(d))
    t.elimina()
  })
  const apri = () => {
    const db = apriDatabase(join(t.cartella, 'menuapp.db'))
    dbs.push(db)
    return db
  }
  return { ...t, apri, backup: join(t.cartella, 'backup') }
}

/** Copia le migrazioni reali più una migrazione di prova in una cartella separata. */
function migrazioniConExtra(cartella: string, sqlExtra: string): string {
  const dir = join(cartella, 'migrazioni')
  mkdirSync(dir)
  copyFileSync(join(CARTELLA_MIGRAZIONI, '0001_iniziale.sql'), join(dir, '0001_iniziale.sql'))
  writeFileSync(join(dir, '0002_prova.sql'), sqlExtra)
  return dir
}

describe('migrazioni', () => {
  it('porta un database vuoto all\'ultima versione senza backup', async () => {
    const c = preparaCartella()
    const db = c.apri()
    const esito = await applicaMigrazioni(db, { cartellaBackup: c.backup })
    expect(esito.versionePrima).toBe(0)
    expect(esito.versioneDopo).toBe(ultimaVersione())
    expect(esito.backup).toBeNull()
    expect(versioneSchema(db)).toBe(ultimaVersione())
    expect(uno(db, 'PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 })
  })

  it('una seconda esecuzione non fa nulla', async () => {
    const c = preparaCartella()
    const db = c.apri()
    await applicaMigrazioni(db, { cartellaBackup: c.backup })
    const esito = await applicaMigrazioni(db, { cartellaBackup: c.backup })
    expect(esito.applicate).toEqual([])
  })

  it('crea un backup verificato prima di migrare un database in uso', async () => {
    const c = preparaCartella()
    const db = c.apri()
    await applicaMigrazioni(db, { cartellaBackup: c.backup })
    eseguiSeed(db)
    const dir = migrazioniConExtra(c.cartella, 'ALTER TABLE eventi ADD COLUMN prova TEXT;')
    const esito = await applicaMigrazioni(db, { cartellaBackup: c.backup, cartellaMigrazioni: dir })
    expect(esito.versioneDopo).toBe(2)
    expect(esito.backup).toMatch(/^pre-migrazione-.*-v1\.db$/)
    const backup = await elencaBackup(c.backup)
    expect(backup).toHaveLength(1)
    expect(backup[0]?.verificato).toBe(true)
    expect(backup[0]?.conteggi.reparti).toBe(14)
  })

  it('una migrazione che fallisce lascia il database alla versione precedente con i dati', async () => {
    const c = preparaCartella()
    const db = c.apri()
    await applicaMigrazioni(db, { cartellaBackup: c.backup })
    eseguiSeed(db)
    const dir = migrazioniConExtra(
      c.cartella,
      "ALTER TABLE eventi ADD COLUMN prova TEXT; INSERT INTO reparti (id) VALUES ('rotto');",
    )
    await expect(applicaMigrazioni(db, { cartellaBackup: c.backup, cartellaMigrazioni: dir })).rejects.toThrow(
      ErroreMigrazione,
    )
    expect(versioneSchema(db)).toBe(1)
    expect(tutti(db, "SELECT name FROM pragma_table_info('eventi') WHERE name = 'prova'")).toEqual([])
    expect(uno<{ n: number }>(db, 'SELECT count(*) AS n FROM reparti')?.n).toBe(14)
    expect((await elencaBackup(c.backup)).map((b) => b.tipo)).toEqual(['pre-migrazione'])
  })

  it('rifiuta un database più recente del codice', async () => {
    const c = preparaCartella()
    const db = c.apri()
    await applicaMigrazioni(db, { cartellaBackup: c.backup })
    db.exec('PRAGMA user_version = 99')
    await expect(applicaMigrazioni(db, { cartellaBackup: c.backup })).rejects.toThrow(/più vecchio del database/)
  })

  it('rifiuta una migrazione modificata dopo l\'applicazione', async () => {
    const c = preparaCartella()
    const db = c.apri()
    const dir = migrazioniConExtra(c.cartella, 'CREATE TABLE x (a INTEGER) STRICT;')
    await applicaMigrazioni(db, { cartellaBackup: c.backup, cartellaMigrazioni: dir })
    writeFileSync(join(dir, '0002_prova.sql'), 'CREATE TABLE x (a INTEGER, b INTEGER) STRICT;')
    await expect(applicaMigrazioni(db, { cartellaBackup: c.backup, cartellaMigrazioni: dir })).rejects.toThrow(
      /modificata/,
    )
  })
})

describe('seed', () => {
  it('è idempotente e non sovrascrive le modifiche', async () => {
    const c = preparaCartella()
    const db = c.apri()
    await applicaMigrazioni(db, { cartellaBackup: c.backup })
    eseguiSeed(db)
    db.exec("UPDATE reparti SET nome = 'Frutta e verdura' WHERE id = 'rep-ortofrutta'")
    db.exec('UPDATE impostazioni SET coefficiente_bambini = 0.7')
    db.exec("DELETE FROM meta WHERE chiave = 'seed_impostazioni'")
    eseguiSeed(db)
    expect(uno<{ n: number }>(db, 'SELECT count(*) AS n FROM reparti')?.n).toBe(14)
    expect(uno<{ n: number }>(db, 'SELECT count(*) AS n FROM portate_predefinite')?.n).toBe(7)
    expect(uno(db, "SELECT nome FROM reparti WHERE id = 'rep-ortofrutta'")).toEqual({ nome: 'Frutta e verdura' })
    expect(uno(db, 'SELECT coefficiente_bambini AS c FROM impostazioni')).toEqual({ c: 0.7 })
    expect(uno(db, "SELECT di_sistema FROM reparti WHERE id = 'rep-altro'")).toEqual({ di_sistema: 1 })
  })
})
