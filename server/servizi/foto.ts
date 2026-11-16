// Foto dei piatti: file in dati/foto, metadati in foto_piatti (formato ricetta v1).
import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { type Foto, LIMITE_BYTE_FOTO, MASSIMO_FOTO, type TipoFoto } from '../../src/contratto/foto.ts'
import { pulisci } from '../../src/domain/testo.ts'
import { type Db, esegui, transazione, tutti, uno } from '../db/connessione.ts'
import { incrementaRevisione } from '../db/repo/meta.ts'
import { nonTrovato, regolaViolata, richiestaNonValida } from './errori.ts'
import { aggiornaConVersione, eliminaConVersione } from './versioni.ts'

const ESTENSIONI: Record<TipoFoto, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

interface Riga {
  id: string
  piatto_id: string
  ordine: number
  didascalia: string
  principale: number
  passo: number | null
  tipo: TipoFoto
  byte: number
  sha256: string
  versione: number
  creato_il: number
}

const daRiga = (r: Riga): Foto => ({
  id: r.id,
  piattoId: r.piatto_id,
  ordine: r.ordine,
  didascalia: r.didascalia,
  principale: r.principale === 1,
  passo: r.passo,
  tipo: r.tipo,
  byte: r.byte,
  sha256: r.sha256,
  versione: r.versione,
  creatoIl: r.creato_il,
})

/** Tipo reale del file dai primi byte: il tipo dichiarato non basta. */
export function tipoDaContenuto(b: Buffer): TipoFoto | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

export const nomeFile = (f: Pick<Foto, 'id' | 'tipo'>) => `${f.id}.${ESTENSIONI[f.tipo]}`

export function elencaFoto(db: Db, piattoId: string): Foto[] {
  return tutti<Riga>(db, 'SELECT * FROM foto_piatti WHERE piatto_id = ? ORDER BY principale DESC, ordine', piattoId).map(daRiga)
}

export function fotoPrincipali(db: Db): Map<string, string> {
  return new Map(
    tutti<{ piatto_id: string; id: string }>(
      db,
      `SELECT piatto_id, id FROM foto_piatti f WHERE principale = 1
       OR (NOT EXISTS (SELECT 1 FROM foto_piatti g WHERE g.piatto_id = f.piatto_id AND g.principale = 1)
           AND ordine = (SELECT min(ordine) FROM foto_piatti h WHERE h.piatto_id = f.piatto_id))`,
    ).map((r) => [r.piatto_id, r.id]),
  )
}

export function leggiFoto(db: Db, id: string): Foto {
  const r = uno<Riga>(db, 'SELECT * FROM foto_piatti WHERE id = ?', id)
  if (!r) throw nonTrovato('Foto')
  return daRiga(r)
}

export async function caricaFoto(
  db: Db,
  cartella: string,
  piattoId: string,
  d: { id: string; dati: Buffer; didascalia: string; principale: boolean; passo?: number | null },
  adesso = Date.now(),
): Promise<Foto> {
  if (d.dati.length === 0 || d.dati.length > LIMITE_BYTE_FOTO) throw richiestaNonValida('Foto vuota o più grande di 8 MB')
  const tipo = tipoDaContenuto(d.dati)
  if (!tipo) throw richiestaNonValida('Formato non supportato: servono JPEG, PNG o WebP')
  const piatto = uno<{ procedimento: string }>(db, 'SELECT procedimento FROM piatti WHERE id = ?', piattoId)
  if (!piatto) throw nonTrovato('Piatto')
  const passo = d.passo ?? null
  controllaPasso(passo, JSON.parse(piatto.procedimento) as string[])
  const esistente = uno<Riga>(db, 'SELECT * FROM foto_piatti WHERE id = ?', d.id)
  const sha256 = createHash('sha256').update(d.dati).digest('hex')
  if (esistente) {
    if (esistente.piatto_id === piattoId && esistente.sha256 === sha256) return daRiga(esistente) // ripetizione
    throw regolaViolata('id_esistente', 'Identificativo di foto già usato')
  }
  const n = uno<{ n: number }>(db, 'SELECT count(*) AS n FROM foto_piatti WHERE piatto_id = ?', piattoId)?.n ?? 0
  if (n >= MASSIMO_FOTO) throw regolaViolata('troppe_foto', `Al massimo ${MASSIMO_FOTO} foto per ricetta`)
  // Prima il file (scrittura atomica), poi la riga: una riga non punta mai a un file mancante.
  await mkdir(cartella, { recursive: true })
  const finale = join(cartella, nomeFile({ id: d.id, tipo }))
  const temporaneo = `${finale}.tmp-${process.pid}`
  await writeFile(temporaneo, d.dati)
  await rename(temporaneo, finale)
  try {
    return transazione(db, () => {
      const principale = d.principale || n === 0
      if (principale) esegui(db, 'UPDATE foto_piatti SET principale = 0 WHERE piatto_id = ?', piattoId)
      const ordine = (uno<{ m: number | null }>(db, 'SELECT max(ordine) AS m FROM foto_piatti WHERE piatto_id = ?', piattoId)?.m ?? -1) + 1
      esegui(
        db,
        `INSERT INTO foto_piatti (id, piatto_id, ordine, didascalia, principale, passo, tipo, byte, sha256, versione, creato_il, aggiornato_il)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        d.id, piattoId, ordine, pulisci(d.didascalia), principale, passo, tipo, d.dati.length, sha256, adesso, adesso,
      )
      incrementaRevisione(db)
      return leggiFoto(db, d.id)
    })
  } catch (e) {
    await rm(finale, { force: true })
    throw e
  }
}

function controllaPasso(passo: number | null, procedimento: string[]): void {
  if (passo !== null && passo >= procedimento.length) {
    throw regolaViolata('passo_inesistente', `Il procedimento ha ${procedimento.length} passaggi: non esiste il passaggio ${passo + 1}`)
  }
}

export function aggiornaFoto(db: Db, id: string, d: { didascalia: string; principale: boolean; passo: number | null; versione: number }): Foto {
  return transazione(db, () => {
    const f = leggiFoto(db, id)
    const piatto = uno<{ procedimento: string }>(db, 'SELECT procedimento FROM piatti WHERE id = ?', f.piattoId)
    controllaPasso(d.passo, JSON.parse(piatto?.procedimento ?? '[]') as string[])
    if (d.principale && !f.principale) esegui(db, 'UPDATE foto_piatti SET principale = 0 WHERE piatto_id = ?', f.piattoId)
    aggiornaConVersione(db, 'foto_piatti', id, d.versione, { didascalia: pulisci(d.didascalia), principale: d.principale, passo: d.passo }, () => leggiFoto(db, id))
    incrementaRevisione(db)
    return leggiFoto(db, id)
  })
}

export async function eliminaFoto(db: Db, cartella: string, id: string, versione: number): Promise<void> {
  const f = leggiFoto(db, id)
  transazione(db, () => {
    eliminaConVersione(db, 'foto_piatti', id, versione, () => leggiFoto(db, id))
    incrementaRevisione(db)
  })
  // Il file resta nei backup (dati/backup/foto) finché serve per un ripristino.
  await rm(join(cartella, nomeFile(f)), { force: true })
}

export async function leggiFile(cartella: string, f: Pick<Foto, 'id' | 'tipo'>): Promise<Buffer> {
  try {
    return await readFile(join(cartella, nomeFile(f)))
  } catch {
    throw nonTrovato('File della foto')
  }
}

/**
 * Dopo una modifica del procedimento: ogni foto segue il suo passaggio se il testo è rimasto
 * uguale (anche spostato); se il passaggio è stato riscritto o tolto, la foto resta solo in galleria.
 */
export function ricollegaPassi(db: Db, piattoId: string, prima: string[], dopo: string[]): void {
  for (const r of tutti<{ id: string; passo: number | null }>(db, 'SELECT id, passo FROM foto_piatti WHERE piatto_id = ? AND passo IS NOT NULL', piattoId)) {
    const testo = prima[r.passo!]
    const nuovo = testo === undefined ? -1 : dopo.indexOf(testo)
    const passo = nuovo >= 0 ? nuovo : prima.length === dopo.length && r.passo! < dopo.length && testo !== undefined && simili(testo, dopo[r.passo!]!) ? r.passo : null
    if (passo !== r.passo) esegui(db, 'UPDATE foto_piatti SET passo = ?, versione = versione + 1 WHERE id = ?', passo, r.id)
  }
}

/** Stesso passaggio corretto di poco (refusi, punteggiatura): almeno metà delle parole in comune. */
function simili(a: string, b: string): boolean {
  const pa = new Set(a.toLowerCase().split(/\W+/).filter((x) => x.length > 2))
  const pb = b.toLowerCase().split(/\W+/).filter((x) => x.length > 2)
  if (pa.size === 0) return false
  return pb.filter((x) => pa.has(x)).length / pa.size >= 0.5
}

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

/** Rimette il file di una foto già registrata ma mancante (ripristino da esportazione ZIP). */
export async function rimettiFile(db: Db, cartella: string, id: string, dati: Buffer): Promise<void> {
  const f = leggiFoto(db, id)
  if (createHash('sha256').update(dati).digest('hex') !== f.sha256) throw richiestaNonValida('Il file non corrisponde alla foto registrata')
  await mkdir(cartella, { recursive: true })
  const finale = join(cartella, nomeFile(f))
  await writeFile(`${finale}.tmp-${process.pid}`, dati)
  await rename(`${finale}.tmp-${process.pid}`, finale)
}

export { ESTENSIONI }

/**
 * Copia le foto di un piatto in un altro (copia di una ricetta condivisa): file nuovi con id
 * nuovi, così le due ricette restano indipendenti. Da chiamare dentro una transazione.
 */
export function copiaFotoPiatto(db: Db, cartella: string, daPiatto: string, aPiatto: string, adesso = Date.now()): void {
  mkdirSync(cartella, { recursive: true })
  for (const f of tutti<Riga>(db, 'SELECT * FROM foto_piatti WHERE piatto_id = ? ORDER BY ordine', daPiatto)) {
    const sorgente = join(cartella, nomeFile({ id: String(f.id), tipo: f.tipo as TipoFoto }))
    if (!existsSync(sorgente)) continue
    const id = randomUUID()
    copyFileSync(sorgente, join(cartella, nomeFile({ id, tipo: f.tipo as TipoFoto })))
    esegui(
      db,
      `INSERT INTO foto_piatti (id, piatto_id, ordine, didascalia, principale, passo, tipo, byte, sha256, versione, creato_il, aggiornato_il)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      id, aPiatto, f.ordine, f.didascalia, f.principale, f.passo, f.tipo, f.byte, f.sha256, adesso, adesso,
    )
  }
}
