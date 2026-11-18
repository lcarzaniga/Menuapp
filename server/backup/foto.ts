// Foto e allegati nei backup del server Debian: copia dei file accanto ai backup e recupero
// dopo un ripristino (SPEC §11). Su Cloudflare i file restano in R2.
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TipoFoto } from '../../src/contratto/foto.ts'
import { type Db, tutti } from '../db/connessione.ts'
import { nomeFile } from '../servizi/foto.ts'

/** Copia nei backup le foto non ancora salvate (i file sono immutabili: basta copiare i nuovi). */
export async function sincronizzaFotoNelBackup(cartellaFoto: string, cartellaBackup: string): Promise<number> {
  if (!existsSync(cartellaFoto)) return 0
  const dest = join(cartellaBackup, 'foto')
  await mkdir(dest, { recursive: true })
  let copiate = 0
  for (const f of await readdir(cartellaFoto)) {
    if (f.includes('.tmp-') || existsSync(join(dest, f))) continue
    await copyFile(join(cartellaFoto, f), join(dest, f))
    copiate++
  }
  return copiate
}

/** Dopo un ripristino: rimette in dati/foto i file mancanti presi dai backup; restituisce quelli ancora assenti. */
export async function recuperaFotoMancanti(db: Db, cartellaFoto: string, cartellaBackup: string): Promise<string[]> {
  await mkdir(cartellaFoto, { recursive: true })
  const mancanti: string[] = []
  // Foto dei piatti e allegati delle bacheche condividono cartella e backup.
  const righe = tutti<{ id: string; tipo: TipoFoto }>(db, 'SELECT id, tipo FROM foto_piatti UNION ALL SELECT id, tipo FROM allegati')
  for (const r of righe) {
    const nome = nomeFile(r)
    if (existsSync(join(cartellaFoto, nome))) continue
    const copia = join(cartellaBackup, 'foto', nome)
    if (existsSync(copia)) await copyFile(copia, join(cartellaFoto, nome))
    else mancanti.push(r.id)
  }
  return mancanti
}
