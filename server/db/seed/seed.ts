// Dati iniziali idempotenti (SPEC §6.6).
import { REPARTO_ALTRO } from '../../../src/domain/tipi.ts'
import { norm } from '../../../src/domain/testo.ts'
import { type Db, esegui, transazione, uno } from '../connessione.ts'
import { leggiMeta, scriviMeta } from '../repo/meta.ts'
import { seedCatalogo } from './catalogo.ts'
import { PORTATE_PREDEFINITE_INIZIALI, REPARTI_INIZIALI } from './reparti.ts'

export const VERSIONE_SEED_IMPOSTAZIONI = 1

export function seedImpostazioni(db: Db, adesso = Date.now()): boolean {
  return transazione(db, () => {
    const applicata = leggiMeta<number>(db, 'seed_impostazioni') ?? 0
    if (applicata >= VERSIONE_SEED_IMPOSTAZIONI) return false
    if (!uno(db, 'SELECT 1 FROM impostazioni WHERE id = 1')) {
      esegui(db, 'INSERT INTO impostazioni (id, coefficiente_bambini, versione, aggiornato_il) VALUES (1, 0.5, 1, ?)', adesso)
    }
    const portate = uno<{ n: number }>(db, 'SELECT count(*) AS n FROM portate_predefinite')
    if (portate?.n === 0) {
      PORTATE_PREDEFINITE_INIZIALI.forEach((nome, i) => {
        esegui(db, 'INSERT INTO portate_predefinite (id, nome, ordine) VALUES (?, ?, ?)', `pp-${norm(nome).replace(/[^a-z]+/g, '-')}`, nome, i)
      })
    }
    REPARTI_INIZIALI.forEach((r, i) => {
      esegui(
        db,
        `INSERT INTO reparti (id, nome, nome_norm, ordine, di_sistema, versione, creato_il, aggiornato_il)
         SELECT ?, ?, ?, ?, ?, 1, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM reparti WHERE id = ? OR nome_norm = ?)`,
        r.id, r.nome, norm(r.nome), i, r.id === REPARTO_ALTRO, adesso, adesso, r.id, norm(r.nome),
      )
    })
    // «Altro» deve esistere sempre: è la destinazione degli ingredienti senza reparto.
    esegui(db, 'UPDATE reparti SET di_sistema = 1 WHERE id = ?', REPARTO_ALTRO)
    scriviMeta(db, 'seed_impostazioni', VERSIONE_SEED_IMPOSTAZIONI)
    if (leggiMeta<number>(db, 'revisione') === undefined) scriviMeta(db, 'revisione', 0)
    return true
  })
}

export function eseguiSeed(db: Db): void {
  seedImpostazioni(db)
  seedCatalogo(db)
}
