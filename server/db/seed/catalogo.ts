// Catalogo ingredienti iniziale, idempotente (SPEC §7.5).
import { norm } from '../../../src/domain/testo.ts'
import { isCodiceUnita, type CodiceUnita } from '../../../src/domain/unita.ts'
import { type Db, esegui, transazione, uno } from '../connessione.ts'
import { leggiMeta, scriviMeta } from '../repo/meta.ts'
import { CATALOGO } from './dati-catalogo.ts'

export const VERSIONE_SEED_CATALOGO = 1

export interface VoceCatalogo {
  id: string
  nome: string
  repartoId: string
  unita: CodiceUnita | null
  sinonimi: string[]
  fissa: boolean
}

export function idIngrediente(nome: string): string {
  return `ing-${norm(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

export function vociCatalogo(): VoceCatalogo[] {
  return CATALOGO.trim()
    .split('\n')
    .map((riga) => {
      const [nome = '', reparto = '', unita = '', sinonimi = '', fissa = ''] = riga.split('|').map((s) => s.trim())
      if (unita && !isCodiceUnita(unita)) throw new Error(`Unità sconosciuta nel catalogo: ${riga}`)
      return {
        id: idIngrediente(nome),
        nome,
        repartoId: `rep-${reparto}`,
        unita: (unita || null) as CodiceUnita | null,
        sinonimi: sinonimi ? sinonimi.split(';').map((s) => s.trim()).filter(Boolean) : [],
        fissa: fissa === 'f',
      }
    })
}

/**
 * Aggiunge le voci mancanti; aggiorna solo quelle mai modificate dall'utente; non
 * elimina nulla. Un ingrediente dell'utente con lo stesso nome vince.
 */
export function seedCatalogo(db: Db, adesso = Date.now()): boolean {
  return transazione(db, () => {
    const applicata = leggiMeta<number>(db, 'seed_catalogo') ?? 0
    if (applicata >= VERSIONE_SEED_CATALOGO) return false
    for (const v of vociCatalogo()) {
      if (!uno(db, 'SELECT 1 FROM reparti WHERE id = ?', v.repartoId)) continue
      const esistente = uno<{ id: string; versione: number }>(db, 'SELECT id, versione FROM ingredienti WHERE id = ?', v.id)
      const omonimo = uno<{ id: string }>(db, 'SELECT id FROM ingredienti WHERE nome_norm = ? AND id <> ?', norm(v.nome), v.id)
      if (omonimo) continue
      if (esistente && esistente.versione > 1) continue
      if (esistente) {
        esegui(
          db,
          'UPDATE ingredienti SET nome = ?, nome_norm = ?, reparto_id = ?, unita_preferita = ?, scalatura_abituale = ? WHERE id = ?',
          v.nome, norm(v.nome), v.repartoId, v.unita, v.fissa ? 'fissa' : 'proporzionale', v.id,
        )
      } else {
        esegui(
          db,
          `INSERT INTO ingredienti (id, nome, nome_norm, reparto_id, unita_preferita, scalatura_abituale, versione, creato_il, aggiornato_il)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          v.id, v.nome, norm(v.nome), v.repartoId, v.unita, v.fissa ? 'fissa' : 'proporzionale', adesso, adesso,
        )
      }
      for (const s of v.sinonimi) {
        const k = norm(s)
        const occupato =
          uno(db, 'SELECT 1 FROM ingredienti WHERE nome_norm = ? AND id <> ?', k, v.id) ??
          uno(db, 'SELECT 1 FROM sinonimi_ingrediente WHERE sinonimo_norm = ?', k)
        if (!occupato) esegui(db, 'INSERT INTO sinonimi_ingrediente (ingrediente_id, sinonimo, sinonimo_norm) VALUES (?, ?, ?)', v.id, s, k)
      }
    }
    scriviMeta(db, 'seed_catalogo', VERSIONE_SEED_CATALOGO)
    return true
  })
}
